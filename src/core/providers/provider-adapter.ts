import { parseEnhanceOutput } from '@/core/prompt/schema'
import { appError } from '@/shared/errors'
import type { EnhanceOutput, ProviderServiceConfig } from '@/shared/types'

export interface ProviderTextResult {
  text: string
  finishReason?: string
  truncated: boolean
  responseMode: 'stream' | 'json'
}

export const parseProviderJson = (raw: string): EnhanceOutput => {
  try {
    return parseEnhanceOutput(raw)
  } catch (error) {
    const fallbackText = raw.trim()
    if (!fallbackText) {
      throw appError('PARSE_FAILED', 'API 输出为空', true, error)
    }
    return {
      enhancedPrompt: fallbackText,
      warnings: ['模型返回非 JSON 格式，已按原文回退展示'],
      placeholders: [],
    }
  }
}

export const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = 45_000,
): Promise<Response> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export const normalizeApiKey = (value: string) => value.replace(/[\r\n\t]+/g, '').trim()

export const assertHeaderSafe = (label: string, value: string) => {
  if (!value) {
    throw appError('API_AUTH_FAILED', `${label} 为空，请先填写并解锁有效的 API Key`)
  }
  if ([...value].some((char) => (char.codePointAt(0) ?? 0) > 0xff)) {
    throw appError('API_AUTH_FAILED', `${label} 包含非法字符，请重新粘贴纯 API Key，去掉中文说明、全角空格或换行`)
  }
}

export const buildAuthHeaders = (config: ProviderServiceConfig, apiKey: string): Record<string, string> => {
  if (config.authMode === 'none') return {}
  const normalized = normalizeApiKey(apiKey)
  assertHeaderSafe(`${config.label || 'Provider'} API Key`, normalized)
  if (config.authMode === 'bearer' || config.authMode === 'query-key') {
    return config.authMode === 'bearer' ? { Authorization: `Bearer ${normalized}` } : {}
  }
  const headerName = config.apiKeyHeader?.trim() || (config.authMode === 'x-api-key' ? 'x-api-key' : 'api-key')
  return { [headerName]: normalized }
}

export const readProviderError = async (response: Response): Promise<string> => {
  try {
    const text = (await response.text()).trim().replace(/\s+/g, ' ')
    return text.slice(0, 600)
  } catch {
    return ''
  }
}

export const isTruncatedFinishReason = (finishReason?: string) => {
  const normalized = finishReason?.toLowerCase().replace(/[\s-]+/g, '_') ?? ''
  return ['length', 'max_tokens', 'max_output_tokens', 'token_limit', 'max_token'].some((item) =>
    normalized.includes(item),
  )
}

const looksLikeIncompleteStructuredOutput = (text: string) => {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{')) return false
  if (!trimmed.includes('"enhancedPrompt"') && !trimmed.includes('"clarificationQuestions"')) return false
  try {
    JSON.parse(trimmed)
    return false
  } catch {
    return true
  }
}

export const estimateOutputTokens = (text: string) => {
  const cjkCount = (text.match(/[\u3400-\u9fff\uf900-\ufaff]/g) ?? []).length
  const otherCount = Math.max(0, text.length - cjkCount)
  return cjkCount + Math.ceil(otherCount / 4)
}

export const isLikelyOutputTruncated = (text: string, maxTokens: number) => {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (looksLikeIncompleteStructuredOutput(trimmed)) return true
  const estimatedTokens = estimateOutputTokens(trimmed)
  if (maxTokens > 0 && estimatedTokens >= maxTokens * 0.9) return true
  const codeFenceCount = (trimmed.match(/```/g) ?? []).length
  if (codeFenceCount % 2 === 1) return true
  return estimatedTokens >= maxTokens * 0.6 && /(?:[,;:：，、\\]|[-*]\s*)$/.test(trimmed)
}

const normalizeContent = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map((item) => normalizeContent(item)).filter(Boolean).join('')
  if (!value || typeof value !== 'object') return ''
  const record = value as Record<string, unknown>
  return normalizeContent(record.text ?? record.content ?? record.value ?? record.output_text)
}

const extractOpenAIPayload = (payload: unknown): { text: string; finishReason?: string } => {
  if (!payload || typeof payload !== 'object') return { text: '' }
  const json = payload as Record<string, unknown>
  const nestedData = json.data && typeof json.data === 'object' ? (json.data as Record<string, unknown>) : undefined
  const choices = (Array.isArray(json.choices) ? json.choices : nestedData?.choices) as unknown[] | undefined
  const choice = choices?.[0] as Record<string, unknown> | undefined
  const delta = choice?.delta as Record<string, unknown> | undefined
  const message = choice?.message as Record<string, unknown> | undefined
  const text = normalizeContent(
    delta?.content ??
      message?.content ??
      choice?.text ??
      json.output_text ??
      json.content ??
      nestedData?.output_text ??
      nestedData?.content,
  )
  const finishReason = normalizeContent(
    choice?.finish_reason ?? choice?.finishReason ?? json.finish_reason ?? json.stop_reason ?? json.done_reason,
  )
  return { text, finishReason: finishReason || undefined }
}

const parseJsonPayload = (raw: string) => {
  try {
    return extractOpenAIPayload(JSON.parse(raw))
  } catch {
    return { text: '' }
  }
}

export const readOpenAICompatibleResponse = async (
  response: Response,
  onPartial?: (partial: string) => void,
): Promise<ProviderTextResult> => {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  if (contentType.includes('application/json') && !contentType.includes('event-stream')) {
    const raw = await response.text()
    const parsed = parseJsonPayload(raw)
    const text = parsed.text || raw.trim()
    if (text) onPartial?.(text)
    return {
      text,
      finishReason: parsed.finishReason,
      truncated: isTruncatedFinishReason(parsed.finishReason) || looksLikeIncompleteStructuredOutput(text),
      responseMode: 'json',
    }
  }

  const reader = response.body?.getReader()
  if (!reader) throw appError('PROVIDER_ERROR', '当前 Provider 未返回可读取的响应体')
  const decoder = new TextDecoder()
  let buffer = ''
  let rawBody = ''
  let fullText = ''
  let finishReason: string | undefined

  const consumePayload = (raw: string) => {
    const parsed = parseJsonPayload(raw)
    if (parsed.finishReason) finishReason = parsed.finishReason
    if (!parsed.text) return
    fullText += parsed.text
    onPartial?.(fullText)
  }

  const consumeLine = (rawLine: string) => {
    const line = rawLine.trim()
    if (!line || line.startsWith(':') || line.startsWith('event:')) return
    const data = line.startsWith('data:') ? line.slice(5).trim() : line
    if (!data || data === '[DONE]') return
    if (data.startsWith('{')) consumePayload(data)
  }

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    rawBody += chunk
    buffer += chunk
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    lines.forEach(consumeLine)
  }
  const trailing = buffer + decoder.decode()
  trailing.split(/\r?\n/).forEach(consumeLine)
  if (!fullText && rawBody.trim()) {
    const parsed = parseJsonPayload(rawBody.trim())
    finishReason = parsed.finishReason
    fullText = parsed.text || rawBody.trim()
    if (fullText) onPartial?.(fullText)
  }
  return {
    text: fullText.trim(),
    finishReason,
    truncated: isTruncatedFinishReason(finishReason) || looksLikeIncompleteStructuredOutput(fullText),
    responseMode: 'stream',
  }
}

export const readAnthropicResponse = async (
  response: Response,
  onPartial?: (partial: string) => void,
): Promise<ProviderTextResult> => {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  if (contentType.includes('application/json') && !contentType.includes('event-stream')) {
    const raw = await response.text()
    try {
      const json = JSON.parse(raw) as { content?: Array<{ text?: string }>; stop_reason?: string }
      const text = json.content?.map((item) => item.text ?? '').join('') ?? ''
      if (text) onPartial?.(text)
      return {
        text,
        finishReason: json.stop_reason,
        truncated: isTruncatedFinishReason(json.stop_reason) || looksLikeIncompleteStructuredOutput(text),
        responseMode: 'json',
      }
    } catch {
      return { text: raw.trim(), truncated: looksLikeIncompleteStructuredOutput(raw), responseMode: 'json' }
    }
  }
  const reader = response.body?.getReader()
  if (!reader) throw appError('PROVIDER_ERROR', 'Anthropic 未返回可读取的响应体')
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''
  let finishReason: string | undefined
  const consumeBlock = (block: string) => {
    const dataLines = block.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.startsWith('data:'))
    for (const line of dataLines) {
      const data = line.slice(5).trim()
      if (!data || data === '[DONE]') continue
      try {
        const json = JSON.parse(data) as {
          delta?: { text?: string; stop_reason?: string }
          content_block?: { text?: string }
          message?: { stop_reason?: string }
        }
        const text = json.delta?.text ?? json.content_block?.text ?? ''
        finishReason = json.delta?.stop_reason ?? json.message?.stop_reason ?? finishReason
        if (text) {
          fullText += text
          onPartial?.(fullText)
        }
      } catch {
        // Ignore malformed keep-alive events.
      }
    }
  }
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const blocks = buffer.split(/\r?\n\r?\n/)
    buffer = blocks.pop() ?? ''
    blocks.forEach(consumeBlock)
  }
  consumeBlock(buffer + decoder.decode())
  return {
    text: fullText.trim(),
    finishReason,
    truncated: isTruncatedFinishReason(finishReason) || looksLikeIncompleteStructuredOutput(fullText),
    responseMode: 'stream',
  }
}

export const readOllamaResponse = async (
  response: Response,
  onPartial?: (partial: string) => void,
): Promise<ProviderTextResult> => {
  let fullText = ''
  let finishReason: string | undefined

  const consumeLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) return
    try {
      const json = JSON.parse(trimmed) as {
        message?: { content?: string }
        response?: string
        done_reason?: string
      }
      const text = json.message?.content ?? json.response ?? ''
      finishReason = json.done_reason ?? finishReason
      if (text) {
        fullText += text
        onPartial?.(fullText)
      }
    } catch {
      // Ignore malformed NDJSON lines.
    }
  }

  const reader = response.body?.getReader()
  if (!reader) {
    const raw = await response.text()
    raw.split(/\r?\n/).forEach(consumeLine)
    return {
      text: fullText.trim() || raw.trim(),
      finishReason,
      truncated: isTruncatedFinishReason(finishReason) || looksLikeIncompleteStructuredOutput(fullText),
      responseMode: raw.includes('\n') ? 'stream' : 'json',
    }
  }

  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    lines.forEach(consumeLine)
  }
  buffer += decoder.decode()
  buffer.split(/\r?\n/).forEach(consumeLine)

  return {
    text: fullText.trim(),
    finishReason,
    truncated: isTruncatedFinishReason(finishReason) || looksLikeIncompleteStructuredOutput(fullText),
    responseMode: 'stream',
  }
}
