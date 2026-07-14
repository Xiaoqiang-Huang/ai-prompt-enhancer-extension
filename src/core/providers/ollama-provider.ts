import {
  buildAuthHeaders,
  fetchWithTimeout,
  isLikelyOutputTruncated,
  parseProviderJson,
  readOllamaResponse,
  readProviderError,
} from '@/core/providers/provider-adapter'
import { appError } from '@/shared/errors'
import type { ProviderAdapter } from '@/shared/types'

const resolveOllamaEndpoint = (baseUrl: string, target: 'chat' | 'tags') => {
  const url = new URL(baseUrl.trim())
  const path = url.pathname.replace(/\/+$/, '')
  if (target === 'tags') {
    url.pathname = /\/api\/(?:chat|generate|tags)$/i.test(path) ? '/api/tags' : `${path || ''}/api/tags`
  } else if (!/\/api\/(?:chat|generate)$/i.test(path)) {
    url.pathname = `${path || ''}/api/chat`
  }
  return url.toString()
}

export const ollamaProvider: ProviderAdapter = {
  provider: 'ollama',
  async enhance(params) {
    const response = await fetchWithTimeout(
      resolveOllamaEndpoint(params.config.baseUrl, 'chat'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(params.config, params.apiKey) },
        body: JSON.stringify({
          model: params.config.model,
          stream: true,
          options: { temperature: params.config.temperature, num_predict: params.config.maxTokens },
          messages: [
            { role: 'system', content: params.prompt.systemPrompt },
            { role: 'user', content: params.prompt.userPrompt },
          ],
        }),
      },
      params.config.timeoutMs,
    )
    if (!response.ok) {
      const detail = await readProviderError(response)
      throw appError('PROVIDER_ERROR', `Ollama 请求失败：${response.status}${detail ? ` · ${detail}` : ''}`)
    }
    const result = await readOllamaResponse(response, params.onPartial)
    if (!result.text) throw appError('PROVIDER_ERROR', 'Ollama 未返回可解析内容')
    return {
      ...parseProviderJson(result.text),
      truncated: result.truncated || isLikelyOutputTruncated(result.text, params.config.maxTokens),
      finishReason: result.finishReason,
    }
  },
  async testConnection(apiKey, _settings, config) {
    const response = await fetchWithTimeout(resolveOllamaEndpoint(config.baseUrl, 'tags'), {
      headers: buildAuthHeaders(config, apiKey),
    }, Math.min(config.timeoutMs, 15_000))
    return {
      ok: response.ok,
      message: response.ok ? 'Ollama 服务与模型列表接口可用' : `Ollama 连接失败：${response.status}`,
    }
  },
}
