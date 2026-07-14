import { anthropicProvider } from '@/core/providers/anthropic-provider'
import { azureOpenAIProvider } from '@/core/providers/azure-openai-provider'
import { createOpenAICompatibleProvider, customProvider } from '@/core/providers/custom-provider'
import { geminiProvider } from '@/core/providers/gemini-provider'
import { ollamaProvider } from '@/core/providers/ollama-provider'
import { openAIProvider } from '@/core/providers/openai-provider'
import type { ProviderAdapter, ProviderType } from '@/shared/types'

export const providerMap: Record<ProviderType, ProviderAdapter> = {
  openai: openAIProvider,
  anthropic: anthropicProvider,
  gemini: geminiProvider,
  azureOpenAI: azureOpenAIProvider,
  ollama: ollamaProvider,
  deepseek: createOpenAICompatibleProvider('deepseek', {
    customTestMessage: 'DeepSeek 端点已验证。',
  }),
  moonshot: createOpenAICompatibleProvider('moonshot', {
    customTestMessage: 'Moonshot / Kimi 端点已验证。',
  }),
  qwen: createOpenAICompatibleProvider('qwen', {
    customTestMessage: 'Qwen 百炼兼容端点已验证。',
  }),
  zhipu: createOpenAICompatibleProvider('zhipu', {
    customTestMessage: '智谱 GLM 端点已验证。',
  }),
  siliconflow: createOpenAICompatibleProvider('siliconflow', {
    customTestMessage: 'SiliconFlow 端点已验证。',
  }),
  volcengine: createOpenAICompatibleProvider('volcengine', {
    customTestMessage: '火山方舟 / Doubao 端点已验证。',
  }),
  custom: customProvider,
}
