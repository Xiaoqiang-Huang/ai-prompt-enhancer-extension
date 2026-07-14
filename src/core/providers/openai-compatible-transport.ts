import {
  fetchWithTimeout,
  isLikelyOutputTruncated,
  readOpenAICompatibleResponse,
  readProviderError,
  type ProviderTextResult,
} from '@/core/providers/provider-adapter'
import { appError } from '@/shared/errors'

export interface CompatibleChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface CompatibleChatRequest {
  baseUrl: string
  headers: Record<string, string>
  model?: string
  messages: CompatibleChatMessage[]
  temperature: number
  maxTokens: number
  timeoutMs: number
  retryCount: number
  providerLabel: string
  includeModel?: boolean
  onPartial?: (partial: string) => void
}

export interface CompatibleChatResult extends ProviderTextResult {
  endpoint: string
  requestVariant: string
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')

export const resolveOpenAICompatibleEndpointCandidates = (baseUrl: string): string[] => {
  const trimmed = baseUrl.trim()
  if (!trimmed) return []
  try {
    const input = new URL(trimmed)
    const pathname = trimTrailingSlash(input.pathname)
    if (/\/chat\/completions$/i.test(pathname)) return [input.toString()]

    const make = (path: string) => {
      const next = new URL(input.toString())
      next.pathname = path
      return next.toString()
    }
    const candidates: string[] = []
    if (!pathname || pathname === '/') {
      candidates.push(make('/v1/chat/completions'), make('/chat/completions'))
    } else if (/(?:\/v1|\/api\/v3|\/api\/paas\/v4|\/compatible-mode\/v1)$/i.test(pathname)) {
      candidates.push(make(`${pathname}/chat/completions`))
    } else {
      candidates.push(input.toString(), make(`${pathname}/chat/completions`))
    }
    return [...new Set(candidates)]
  } catch {
    const normalized = trimTrailingSlash(trimmed)
    return [normalized, `${normalized}/chat/completions`]
  }
}

const mergedUserMessages = (messages: CompatibleChatMessage[]): CompatibleChatMessage[] => {
  const system = messages.filter((item) => item.role === 'system').map((item) => item.content).join('\n\n')
  const rest = messages.filter((item) => item.role !== 'system')
  if (!system) return rest
  const firstUserIndex = rest.findIndex((item) => item.role === 'user')
  if (firstUserIndex === -1) return [{ role: 'user', content: system }]
  return rest.map((item, index) =>
    index === firstUserIndex ? { ...item, content: `${system}\n\n${item.content}` } : item,
  )
}

const buildBodyVariants = (input: CompatibleChatRequest) => {
  const base = input.includeModel === false ? {} : { model: input.model }
  const standardMessages = input.messages
  const mergedMessages = mergedUserMessages(input.messages)
  return [
    {
      name: 'stream:max_tokens',
      body: { ...base, messages: standardMessages, temperature: input.temperature, max_tokens: input.maxTokens, stream: true },
    },
    {
      name: 'stream:max_completion_tokens',
      body: { ...base, messages: standardMessages, max_completion_tokens: input.maxTokens, stream: true },
    },
    {
      name: 'json:max_tokens',
      body: { ...base, messages: standardMessages, temperature: input.temperature, max_tokens: input.maxTokens, stream: false },
    },
    {
      name: 'json:max_completion_tokens',
      body: { ...base, messages: standardMessages, max_completion_tokens: input.maxTokens, stream: false },
    },
    {
      name: 'json:merged-system',
      body: { ...base, messages: mergedMessages, max_tokens: input.maxTokens, stream: false },
    },
    {
      name: 'json:minimal',
      body: { ...base, messages: mergedMessages, stream: false },
    },
  ]
}

const wait = (delayMs: number) => new Promise((resolve) => setTimeout(resolve, delayMs))

export const requestOpenAICompatibleChat = async (
  input: CompatibleChatRequest,
): Promise<CompatibleChatResult> => {
  const endpoints = resolveOpenAICompatibleEndpointCandidates(input.baseUrl)
  if (endpoints.length === 0) throw appError('PROVIDER_ERROR', '未配置有效的 API Base URL')
  const variants = buildBodyVariants(input)
  let lastFailure = ''

  for (const endpoint of endpoints) {
    for (const variant of variants) {
      let moveToNextEndpoint = false
      for (let retry = 0; retry <= Math.max(0, input.retryCount); retry += 1) {
        let response: Response
        try {
          response = await fetchWithTimeout(
            endpoint,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...input.headers },
              body: JSON.stringify(variant.body),
            },
            input.timeoutMs,
          )
        } catch (error) {
          lastFailure = error instanceof Error ? error.message : String(error)
          if (retry < input.retryCount) {
            await wait(350 * (retry + 1))
            continue
          }
          break
        }

        if (response.ok) {
          const result = await readOpenAICompatibleResponse(response, input.onPartial)
          if (result.text) {
            return {
              ...result,
              truncated: result.truncated || isLikelyOutputTruncated(result.text, input.maxTokens),
              endpoint,
              requestVariant: variant.name,
            }
          }
          lastFailure = `${endpoint} 返回成功状态，但响应正文为空（${variant.name}）`
          break
        }

        const detail = await readProviderError(response)
        lastFailure = `${response.status} ${detail || response.statusText}`.trim()
        if (response.status === 401 || response.status === 403) {
          throw appError('API_AUTH_FAILED', `${input.providerLabel} 鉴权失败：${lastFailure}`)
        }
        if ((response.status === 429 || response.status >= 500) && retry < input.retryCount) {
          await wait(500 * (retry + 1))
          continue
        }
        if (response.status === 404) {
          moveToNextEndpoint = true
          break
        }
        if ([400, 405, 415, 422].includes(response.status)) break
        throw appError('PROVIDER_ERROR', `${input.providerLabel} 请求失败：${lastFailure}`)
      }
      if (moveToNextEndpoint) break
    }
  }

  throw appError(
    'PROVIDER_ERROR',
    `${input.providerLabel} 兼容调用失败：${lastFailure || '端点无响应'}。已自动尝试流式/非流式、max_tokens/max_completion_tokens 和无 system 角色兼容模式。`,
  )
}
