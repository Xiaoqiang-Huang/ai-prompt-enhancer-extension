import { requestOpenAICompatibleChat } from '@/core/providers/openai-compatible-transport'
import { buildAuthHeaders, parseProviderJson } from '@/core/providers/provider-adapter'
import type { ProviderAdapter, ProviderEnhanceParams, ProviderType } from '@/shared/types'

const buildMessages = (params: ProviderEnhanceParams) => [
  { role: 'system' as const, content: params.prompt.systemPrompt },
  { role: 'user' as const, content: params.prompt.userPrompt },
]

export const createOpenAICompatibleProvider = (
  provider: ProviderType,
  options?: { customTestMessage?: string },
): ProviderAdapter => ({
  provider,
  async enhance(params) {
    const response = await requestOpenAICompatibleChat({
      baseUrl: params.config.baseUrl,
      headers: buildAuthHeaders(params.config, params.apiKey),
      model: params.config.model,
      messages: buildMessages(params),
      temperature: params.config.temperature,
      maxTokens: params.config.maxTokens,
      timeoutMs: params.config.timeoutMs,
      retryCount: params.config.retryCount,
      providerLabel: params.config.label || 'OpenAI 兼容端点',
      onPartial: params.onPartial,
    })
    return {
      ...parseProviderJson(response.text),
      truncated: response.truncated,
      finishReason: response.finishReason,
    }
  },
  async testConnection(apiKey, _settings, config) {
    const response = await requestOpenAICompatibleChat({
      baseUrl: config.baseUrl,
      headers: buildAuthHeaders(config, apiKey),
      model: config.model,
      messages: [{ role: 'user', content: 'Reply with OK only.' }],
      temperature: 0,
      maxTokens: 16,
      timeoutMs: Math.min(config.timeoutMs, 30_000),
      retryCount: 0,
      providerLabel: config.label || 'OpenAI 兼容端点',
    })
    const prefix = options?.customTestMessage ? `${options.customTestMessage} ` : ''
    return {
      ok: Boolean(response.text),
      message: `${prefix}真实连接成功 · ${response.endpoint} · ${response.requestVariant}`,
    }
  },
})

export const customProvider = createOpenAICompatibleProvider('custom')
