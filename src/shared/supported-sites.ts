export interface SupportedAiChatSite {
  id: string
  label: string
  hosts: string[]
  pathPrefixes?: string[]
}

export const SUPPORTED_AI_CHAT_SITES: SupportedAiChatSite[] = [
  { id: 'chatgpt', label: 'ChatGPT', hosts: ['chatgpt.com', 'chat.openai.com'] },
  { id: 'claude', label: 'Claude', hosts: ['claude.ai'] },
  { id: 'gemini', label: 'Google Gemini', hosts: ['gemini.google.com'] },
  { id: 'google-ai-studio', label: 'Google AI Studio', hosts: ['aistudio.google.com'] },
  { id: 'deepseek', label: 'DeepSeek', hosts: ['chat.deepseek.com'] },
  { id: 'copilot', label: 'Microsoft Copilot', hosts: ['copilot.microsoft.com'] },
  { id: 'doubao', label: 'Doubao', hosts: ['doubao.com', 'www.doubao.com'] },
  { id: 'dola', label: 'Dola', hosts: ['dola.com', 'www.dola.com'] },
  { id: 'kimi', label: 'Kimi', hosts: ['kimi.com', 'www.kimi.com', 'kimi.moonshot.cn'] },
  { id: 'qwen', label: 'Qwen Chat', hosts: ['chat.qwen.ai', 'tongyi.aliyun.com', 'qianwen.com', 'www.qianwen.com', 'tongyi.com', 'www.tongyi.com'] },
  { id: 'yuanbao', label: 'Tencent Yuanbao', hosts: ['yuanbao.tencent.com'] },
  { id: 'zhipu', label: 'Zhipu Qingyan', hosts: ['chatglm.cn', 'chat.z.ai'] },
  { id: 'ernie', label: 'ERNIE', hosts: ['ernie.baidu.com', 'yiyan.baidu.com', 'chat.baidu.com'] },
  { id: 'hailuo', label: 'Hailuo AI', hosts: ['hailuoai.com', 'www.hailuoai.com'] },
  { id: 'minimax', label: 'MiniMax', hosts: ['chat.minimax.io'] },
  { id: 'spark', label: 'iFlytek Spark', hosts: ['xinghuo.xfyun.cn'] },
  { id: 'tiangong', label: 'Tiangong AI', hosts: ['tiangong.cn', 'www.tiangong.cn'] },
  { id: 'metaso', label: 'Metaso AI', hosts: ['metaso.cn', 'www.metaso.cn'] },
  { id: 'nano-360', label: '360 AI', hosts: ['chat.360.cn', 'n.cn', 'www.n.cn'] },
  { id: 'ima', label: 'ima', hosts: ['ima.qq.com'] },
  { id: 'grok', label: 'Grok', hosts: ['grok.com'] },
  { id: 'perplexity', label: 'Perplexity', hosts: ['perplexity.ai', 'www.perplexity.ai'] },
  { id: 'poe', label: 'Poe', hosts: ['poe.com'] },
  { id: 'mistral', label: 'Mistral Le Chat', hosts: ['chat.mistral.ai'] },
  { id: 'meta-ai', label: 'Meta AI', hosts: ['meta.ai', 'www.meta.ai'] },
  { id: 'you', label: 'You.com', hosts: ['you.com'] },
  { id: 'huggingchat', label: 'HuggingChat', hosts: ['huggingface.co'], pathPrefixes: ['/chat'] },
  { id: 'genspark', label: 'Genspark', hosts: ['genspark.ai', 'www.genspark.ai'] },
  { id: 'manus', label: 'Manus', hosts: ['manus.im'] },
  { id: 'coze', label: 'Coze', hosts: ['www.coze.cn', 'www.coze.com'] },
  { id: 'notebooklm', label: 'NotebookLM', hosts: ['notebooklm.google.com'] },
  { id: 'character-ai', label: 'Character.AI', hosts: ['character.ai', 'www.character.ai'] },
  { id: 'pi', label: 'Pi', hosts: ['pi.ai'] },
  { id: 'duck-ai', label: 'Duck.ai', hosts: ['duck.ai'] },
  { id: 'phind', label: 'Phind', hosts: ['phind.com', 'www.phind.com'] },
  { id: 'lmarena', label: 'LMArena', hosts: ['lmarena.ai', 'www.lmarena.ai', 'arena.ai'] },
]

export const SUPPORTED_AI_CHAT_HOSTS = [...new Set(SUPPORTED_AI_CHAT_SITES.flatMap((site) => site.hosts))]

export const SUPPORTED_AI_CHAT_MATCHES = [...new Set(SUPPORTED_AI_CHAT_HOSTS.map((host) => `https://${host}/*`))]

// Chrome requires web_accessible_resources match patterns to use an origin-wide /* path.
// Keep path-restricted content-script matches separate from these resource origins.
export const SUPPORTED_AI_CHAT_ORIGIN_MATCHES = SUPPORTED_AI_CHAT_HOSTS.map((host) => `https://${host}/*`)

const supportedHostSet = new Set(SUPPORTED_AI_CHAT_HOSTS)

export const normalizeHostname = (hostname: string): string => hostname.trim().toLowerCase().split(':')[0]

export const isSupportedAiChatHost = (hostname: string): boolean => supportedHostSet.has(normalizeHostname(hostname))

export const isSupportedAiChatPage = (hostname: string, pathname = '/'): boolean => {
  const normalizedHostname = normalizeHostname(hostname)
  const site = SUPPORTED_AI_CHAT_SITES.find((candidate) => candidate.hosts.includes(normalizedHostname))
  if (!site) return false
  return !site.pathPrefixes || site.pathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'))
}
