import { CodeMirrorAdapter } from '@/content/adapters/codemirror-adapter'
import { ContenteditableAdapter } from '@/content/adapters/contenteditable-adapter'
import { MonacoAdapter } from '@/content/adapters/monaco-adapter'
import { NativeInputAdapter } from '@/content/adapters/native-input-adapter'
import { isSupportedAiChatHost, normalizeHostname } from '@/shared/supported-sites'
import type { EditableAdapter } from '@/shared/types'

/**
 * The content script also runs on a few non-chat sites for conversation export
 * and other explicitly requested features. The launcher must only attach to
 * supported AI chat composers, never to arbitrary web inputs.
 */
export const isAiChatHost = (hostname = window.location.hostname): boolean => {
  return isSupportedAiChatHost(hostname)
}

const COMMON_AI_CHAT_SELECTORS = [
  '[data-testid*="composer"] textarea',
  '[data-testid*="composer"] [contenteditable="true"]',
  '[class*="composer"] textarea',
  '[class*="composer"] [contenteditable="true"]',
  'rich-textarea [contenteditable="true"]',
  'textarea[placeholder*="Message" i]',
  'textarea[placeholder*="Ask" i]',
  'textarea[placeholder*="Prompt" i]',
  'textarea[placeholder*="发送"]',
  'textarea[placeholder*="输入"]',
  'textarea[placeholder*="提问"]',
  'textarea[placeholder*="问题"]',
  'div[contenteditable="true"][role="textbox"]',
  'div[contenteditable="true"].ProseMirror',
  'input[placeholder*="Ask" i]',
  'input[placeholder*="Message" i]',
  'input[placeholder*="提问"]',
  'input[placeholder*="问题"]',
]

const SITE_SPECIFIC_SELECTORS: Array<{
  match: (hostname: string) => boolean
  selectors: string[]
}> = [
  {
    match: (hostname) => hostname === 'chat.deepseek.com' || hostname.endsWith('.deepseek.com'),
    selectors: [
      'textarea#chat-input',
      'textarea[placeholder*="DeepSeek"]',
      'textarea[placeholder*="发送消息"]',
      'textarea[placeholder*="消息"]',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]',
    ],
  },
  {
    match: (hostname) => hostname === 'chatgpt.com' || hostname === 'chat.openai.com',
    selectors: [
      'textarea[data-testid="prompt-textarea"]',
      'textarea[data-id="root"]',
      '#prompt-textarea',
      'textarea[placeholder*="Message"]',
      'textarea[placeholder*="发送消息"]',
      'div[contenteditable="true"][role="textbox"]',
    ],
  },
  {
    match: (hostname) => hostname === 'claude.ai',
    selectors: [
      'div[contenteditable="true"][data-testid*="composer"]',
      'div[contenteditable="true"].ProseMirror',
      'div[contenteditable="true"][role="textbox"]',
      'textarea[placeholder*="Claude"]',
      'textarea[placeholder*="消息"]',
    ],
  },
  {
    match: (hostname) => hostname === 'gemini.google.com',
    selectors: [
      'rich-textarea [contenteditable="true"]',
      'div[contenteditable="true"][role="textbox"]',
      'textarea[placeholder*="message" i]',
      'textarea[placeholder*="消息"]',
      'div[contenteditable="true"]',
    ],
  },
  {
    match: (hostname) => hostname === 'copilot.microsoft.com',
    selectors: [
      'textarea[placeholder*="Message" i]',
      'textarea[placeholder*="Ask" i]',
      'textarea[placeholder*="消息"]',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]',
    ],
  },  {
    match: (hostname) => isSupportedAiChatHost(hostname),
    selectors: COMMON_AI_CHAT_SELECTORS,
  },
]

const isVisible = (element: HTMLElement): boolean => {
  const style = window.getComputedStyle(element)
  const rect = element.getBoundingClientRect()
  return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
}

const isAllowedInput = (target: HTMLInputElement) => {
  const allowedTypes = new Set(['text', 'search', ''])
  return allowedTypes.has(target.type)
}

const CHAT_INPUT_HINT = /message|ask|prompt|send|question|chat|发送|输入|提问|问题|消息|对话|想问|问问/i
const NON_COMPOSER_INPUT_HINT = /search|history|conversation|搜索|历史|会话列表/i

const isLikelyChatElement = (element: HTMLElement): boolean => {
  if (element instanceof HTMLInputElement) {
    const hint = [
      element.placeholder,
      element.getAttribute('aria-label'),
      element.getAttribute('data-testid'),
      element.name,
    ].filter(Boolean).join(' ')
    return CHAT_INPUT_HINT.test(hint) && !NON_COMPOSER_INPUT_HINT.test(hint)
  }

  return element instanceof HTMLTextAreaElement || element.isContentEditable || element.matches('.cm-editor, .monaco-editor')
}

const resolveFromElement = (target: HTMLElement): EditableAdapter | null => {
  if (!(target instanceof HTMLElement) || !isVisible(target)) {
    return null
  }

  if (target instanceof HTMLTextAreaElement) {
    return new NativeInputAdapter(target)
  }

  if (target instanceof HTMLInputElement) {
    if (isAllowedInput(target)) {
      return new NativeInputAdapter(target)
    }
  }

  const editableRoot = target.closest('[contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]')
  if (editableRoot instanceof HTMLElement && isVisible(editableRoot)) {
    return new ContenteditableAdapter(editableRoot)
  }

  const codemirrorRoot = target.closest('.cm-editor')
  if (codemirrorRoot instanceof HTMLElement) {
    return new CodeMirrorAdapter(codemirrorRoot)
  }

  const monacoRoot = target.closest('.monaco-editor')
  if (monacoRoot instanceof HTMLElement) {
    return new MonacoAdapter(monacoRoot)
  }

  return null
}

export const resolveEditableAdapter = (target: EventTarget | null): EditableAdapter | null => {
  if (!(target instanceof HTMLElement)) {
    return null
  }

  return (
    resolveFromElement(target) ??
    (() => {
      const textarea = target.closest('textarea')
      if (textarea instanceof HTMLTextAreaElement && isVisible(textarea)) {
        return new NativeInputAdapter(textarea)
      }
      const input = target.closest('input')
      if (input instanceof HTMLInputElement && isVisible(input) && isAllowedInput(input)) {
        return new NativeInputAdapter(input)
      }
      return null
    })()
  )
}

export const resolveAiChatAdapter = (
  target: EventTarget | null,
  hostname = window.location.hostname,
): EditableAdapter | null => {
  if (!isSupportedAiChatHost(hostname)) return null
  const adapter = resolveEditableAdapter(target)
  return adapter && isLikelyChatElement(adapter.getElement()) ? adapter : null
}

const candidateSelectors = [
  'textarea',
  'input[type="text"]',
  'input[type="search"]',
  'input:not([type])',
  '[contenteditable="true"]',
  '[contenteditable=""]',
  '[contenteditable="plaintext-only"]',
  '.cm-editor',
  '.monaco-editor',
].join(', ')

const findSiteSpecificAdapter = (root: ParentNode, hostname = window.location.hostname): EditableAdapter | null => {
  const normalizedHostname = normalizeHostname(hostname)
  const rule = SITE_SPECIFIC_SELECTORS.find((item) => item.match(normalizedHostname))
  if (!rule) return null

  for (const selector of rule.selectors) {
    const candidates = Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
      (element) => !element.closest('[data-ape-root]'),
    )
    for (const candidate of candidates) {
      const adapter = resolveEditableAdapter(candidate) ?? resolveFromElement(candidate)
      if (adapter && isVisible(adapter.getElement())) {
        return adapter
      }
    }
  }

  return null
}

export const findBestEditableAdapter = (
  root: ParentNode = document,
  hostname = window.location.hostname,
): EditableAdapter | null => {
  if (!isAiChatHost(hostname)) {
    return null
  }

  const siteSpecific = findSiteSpecificAdapter(root, hostname)
  if (siteSpecific) {
    return siteSpecific
  }

  const candidates = Array.from(root.querySelectorAll<HTMLElement>(candidateSelectors)).filter(
    (element) => !element.closest('[data-ape-root]') && isLikelyChatElement(element),
  )

  const scored = candidates
    .map((element) => {
      const adapter = resolveFromElement(element)
      if (!adapter) return null
      const rect = element.getBoundingClientRect()
      const isInViewport =
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < window.innerHeight &&
        rect.left < window.innerWidth
      const score =
        (document.activeElement === element ? 1000 : 0) +
        (isInViewport ? 200 : 0) +
        Math.max(0, 120 - Math.abs(rect.top - window.innerHeight * 0.65)) +
        Math.max(0, 120 - Math.abs(rect.left - window.innerWidth * 0.5))
      return { adapter, score }
    })
    .filter((item): item is { adapter: EditableAdapter; score: number } => Boolean(item))
    .sort((a, b) => b.score - a.score)

  return scored[0]?.adapter ?? null
}
