import {
  SUPPORTED_AI_CHAT_HOSTS,
  SUPPORTED_AI_CHAT_MATCHES,
  SUPPORTED_AI_CHAT_ORIGIN_MATCHES,
  isSupportedAiChatHost,
  isSupportedAiChatPage,
} from '@/shared/supported-sites'

describe('supported AI chat sites', () => {
  it('includes mainstream Chinese and international AI chat products', () => {
    for (const hostname of [
      'www.doubao.com',
      'kimi.com',
      'chat.qwen.ai',
      'yuanbao.tencent.com',
      'chatglm.cn',
      'grok.com',
      'www.perplexity.ai',
      'chat.mistral.ai',
    ]) {
      expect(isSupportedAiChatHost(hostname)).toBe(true)
    }
  })

  it('restricts path-specific AI products to their chat page', () => {
    expect(isSupportedAiChatPage('huggingface.co', '/chat')).toBe(true)
    expect(isSupportedAiChatPage('huggingface.co', '/chat/')).toBe(true)
    expect(isSupportedAiChatPage('huggingface.co', '/models')).toBe(false)
  })

  it('does not classify utility sites as AI chat sites', () => {
    expect(isSupportedAiChatHost('github.com')).toBe(false)
    expect(isSupportedAiChatHost('mail.google.com')).toBe(false)
  })

  it('keeps explicit and unique manifest match patterns', () => {
    expect(SUPPORTED_AI_CHAT_MATCHES).toContain('https://www.doubao.com/*')
    expect(SUPPORTED_AI_CHAT_MATCHES).not.toContain('<all_urls>')
    expect(new Set(SUPPORTED_AI_CHAT_MATCHES).size).toBe(SUPPORTED_AI_CHAT_MATCHES.length)
    expect(new Set(SUPPORTED_AI_CHAT_HOSTS).size).toBe(SUPPORTED_AI_CHAT_HOSTS.length)
    expect(SUPPORTED_AI_CHAT_ORIGIN_MATCHES).toContain('https://huggingface.co/*')
    expect(SUPPORTED_AI_CHAT_ORIGIN_MATCHES.every((pattern) => /^https:\/\/[^/]+\/\*$/.test(pattern))).toBe(true)
  })
})
