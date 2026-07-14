import {
  fetchWithTimeout,
  isTruncatedFinishReason,
  isLikelyOutputTruncated,
  normalizeApiKey,
  parseProviderJson,
  readProviderError,
} from '@/core/providers/provider-adapter'
import { appError } from '@/shared/errors'
import type { ProviderAdapter, ProviderServiceConfig } from '@/shared/types'

const resolveGeminiEndpoint = (config: ProviderServiceConfig, apiKey: string) => {
  const base = config.baseUrl.trim()
  let url: URL
  try {
    url = new URL(base)
  } catch {
    throw appError('PROVIDER_ERROR', 'Gemini Base URL 不合法')
  }
  const path = url.pathname.replace(/\/+$/, '')
  if (!/:generateContent$/i.test(path)) {
    if (/\/models$/i.test(path)) url.pathname = `${path}/${config.model}:generateContent`
    else if (/\/v1(?:beta)?$/i.test(path)) url.pathname = `${path}/models/${config.model}:generateContent`
    else if (!path || path === '/') url.pathname = `/v1beta/models/${config.model}:generateContent`
    else url.pathname = `${path}/models/${config.model}:generateContent`
  }
  url.searchParams.set('key', normalizeApiKey(apiKey))
  return url.toString()
}

const callGemini = async (
  config: ProviderServiceConfig,
  apiKey: string,
  text: string,
  onPartial?: (partial: string) => void,
) => {
  if (!normalizeApiKey(apiKey)) throw appError('API_AUTH_FAILED', 'Gemini API Key 为空')
  const response = await fetchWithTimeout(
    resolveGeminiEndpoint(config, apiKey),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generationConfig: { temperature: config.temperature, maxOutputTokens: config.maxTokens },
        contents: [{ role: 'user', parts: [{ text }] }],
      }),
    },
    config.timeoutMs,
  )
  if (!response.ok) {
    const detail = await readProviderError(response)
    throw appError(
      response.status === 401 || response.status === 403 ? 'API_AUTH_FAILED' : 'PROVIDER_ERROR',
      `Gemini 请求失败：${response.status}${detail ? ` · ${detail}` : ''}`,
    )
  }
  const json = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> }
      finishReason?: string
    }>
  }
  const candidate = json.candidates?.[0]
  const content = candidate?.content?.parts?.map((item) => item.text ?? '').join('\n') ?? ''
  if (content) onPartial?.(content)
  return { content, finishReason: candidate?.finishReason }
}

export const geminiProvider: ProviderAdapter = {
  provider: 'gemini',
  async enhance(params) {
    const response = await callGemini(
      params.config,
      params.apiKey,
      `${params.prompt.systemPrompt}\n\n${params.prompt.userPrompt}`,
      params.onPartial,
    )
    if (!response.content) throw appError('PROVIDER_ERROR', 'Gemini 未返回可解析内容')
    return {
      ...parseProviderJson(response.content),
      truncated:
        isTruncatedFinishReason(response.finishReason) ||
        isLikelyOutputTruncated(response.content, params.config.maxTokens),
      finishReason: response.finishReason,
    }
  },
  async testConnection(apiKey, _settings, config) {
    const response = await callGemini({ ...config, maxTokens: 16 }, apiKey, 'Reply with OK only.')
    return { ok: Boolean(response.content), message: 'Gemini 真实连接成功' }
  },
}
