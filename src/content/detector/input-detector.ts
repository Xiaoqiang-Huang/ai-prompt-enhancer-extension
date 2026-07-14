import { CodeMirrorAdapter } from '@/content/adapters/codemirror-adapter'
import { ContenteditableAdapter } from '@/content/adapters/contenteditable-adapter'
import { MonacoAdapter } from '@/content/adapters/monaco-adapter'
import { NativeInputAdapter } from '@/content/adapters/native-input-adapter'
import type { EditableAdapter } from '@/shared/types'

const AI_CHAT_HOSTS = new Set([
  'chatgpt.com',
  'chat.openai.com',
  'claude.ai',
  'gemini.google.com',
  'copilot.microsoft.com',
])

/**
 * The content script also runs on a few non-chat sites for conversation export
 * and other explicitly requested features. The launcher must only attach to
 * supported AI chat composers, never to arbitrary web inputs.
 */
export const isAiChatHost = (hostname = window.location.hostname): boolean => {
  const normalized = hostname.toLowerCase().split(':')[0]
  return AI_CHAT_HOSTS.has(normalized) || normalized === 'chat.deepseek.com' || normalized.endsWith('.deepseek.com')
}

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
  },
]

const isVisible = (element: HTMLElement): boolean => {
  const style = window.getComputedStyle(element)
  const rect = element.getBoundingClientRect()
  return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
}

const isAllowedInput = (target: HTMLInputElement) => {
  const allowedTypes = new Set(['text', 'search', 'email', 'url', ''])
  return allowedTypes.has(target.type)
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

const candidateSelectors = [
  'textarea',
  'input[type="text"]',
  'input[type="search"]',
  'input[type="email"]',
  'input[type="url"]',
  'input:not([type])',
  '[contenteditable="true"]',
  '[contenteditable=""]',
  '[contenteditable="plaintext-only"]',
  '.cm-editor',
  '.monaco-editor',
].join(', ')

const findSiteSpecificAdapter = (root: ParentNode, hostname = window.location.hostname): EditableAdapter | null => {
  const rule = SITE_SPECIFIC_SELECTORS.find((item) => item.match(hostname))
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
    (element) => !element.closest('[data-ape-root]'),
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
