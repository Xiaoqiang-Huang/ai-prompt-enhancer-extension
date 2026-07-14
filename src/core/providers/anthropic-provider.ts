import {
  buildAuthHeaders,
  fetchWithTimeout,
  isLikelyOutputTruncated,
  parseProviderJson,
  readAnthropicResponse,
  readProviderError,
} from '@/core/providers/provider-adapter'
import { appError } from '@/shared/errors'
import type { ProviderAdapter, ProviderEnhanceParams, ProviderServiceConfig } from '@/shared/types'

const resolveAnthropicEndpoint = (baseUrl: string) => {
  const trimmed = baseUrl.trim()
  try {
    const url = new URL(trimmed)
    const path = url.pathname.replace(/\/+$/, '')
    if (!path || path === '/') url.pathname = '/v1/messages'
    else if (path === '/v1') url.pathname = '/v1/messages'
    return url.toString()
  } catch {
    return trimmed
  }
}

const callAnthropic = async (
  config: ProviderServiceConfig,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  onPartial?: (partial: string) => void,
) => {
  const endpoint = resolveAnthropicEndpoint(config.baseUrl)
  const headers = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    ...buildAuthHeaders(config, apiKey),
  }
  const variants = [
    { stream: true, temperature: config.temperature },
    { stream: false },
  ]
  let lastError = ''
  for (const variant of variants) {
    const response = await fetchWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: config.model,
          max_tokens: config.maxTokens,
          ...variant,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      },
      config.timeoutMs,
    )
    if (response.ok) return await readAnthropicResponse(response, onPartial)
    const detail = await readProviderError(response)
    lastError = `${response.status} ${detail || response.statusText}`.trim()
    if (response.status === 401 || response.status === 403) {
      throw appError('API_AUTH_FAILED', `Anthropic 鉴权失败：${lastError}`)
    }
    if (![400, 405, 415, 422].includes(response.status)) break
  }
  throw appError('PROVIDER_ERROR', `Anthropic 请求失败：${lastError}`)
}

export const anthropicProvider: ProviderAdapter = {
  provider: 'anthropic',
  async enhance(params: ProviderEnhanceParams) {
    const response = await callAnthropic(
      params.config,
      params.apiKey,
      params.prompt.systemPrompt,
      params.prompt.userPrompt,
      params.onPartial,
    )
    if (!response.text) throw appError('PROVIDER_ERROR', 'Anthropic 未返回可解析内容')
    return {
      ...parseProviderJson(response.text),
      truncated: response.truncated || isLikelyOutputTruncated(response.text, params.config.maxTokens),
      finishReason: response.finishReason,
    }
  },
  async testConnection(apiKey, _settings, config) {
    const response = await callAnthropic(config, apiKey, '', 'Reply with OK only.')
    return {
      ok: Boolean(response.text),
      message: `Anthropic 真实连接成功 · ${response.responseMode === 'stream' ? '流式' : '非流式'}`,
    }
  },
}
