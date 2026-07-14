import { requestOpenAICompatibleChat } from '@/core/providers/openai-compatible-transport'
import { buildAuthHeaders, parseProviderJson } from '@/core/providers/provider-adapter'
import type { ProviderAdapter } from '@/shared/types'

export const azureOpenAIProvider: ProviderAdapter = {
  provider: 'azureOpenAI',
  async enhance(params) {
    const response = await requestOpenAICompatibleChat({
      baseUrl: params.config.baseUrl,
      headers: buildAuthHeaders(params.config, params.apiKey),
      messages: [
        { role: 'system', content: params.prompt.systemPrompt },
        { role: 'user', content: params.prompt.userPrompt },
      ],
      temperature: params.config.temperature,
      maxTokens: params.config.maxTokens,
      timeoutMs: params.config.timeoutMs,
      retryCount: params.config.retryCount,
      providerLabel: params.config.label || 'Azure OpenAI',
      includeModel: false,
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
      messages: [{ role: 'user', content: 'Reply with OK only.' }],
      temperature: 0,
      maxTokens: 16,
      timeoutMs: Math.min(config.timeoutMs, 30_000),
      retryCount: 0,
      providerLabel: 'Azure OpenAI',
      includeModel: false,
    })
    return { ok: Boolean(response.text), message: `Azure OpenAI 真实连接成功 · ${response.requestVariant}` }
  },
}
