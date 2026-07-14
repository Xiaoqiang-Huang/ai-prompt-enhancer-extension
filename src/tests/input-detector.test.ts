import { findBestEditableAdapter, isAiChatHost } from '@/content/detector/input-detector'

const mockVisibleRect = (element: Element, top = 120, left = 120) => {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      x: left,
      y: top,
      top,
      left,
      right: left + 320,
      bottom: top + 48,
      width: 320,
      height: 48,
      toJSON: () => ({}),
    }),
  })
}

describe('findBestEditableAdapter', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('prefers DeepSeek specific textarea selectors', () => {
    document.body.innerHTML = `
      <textarea id="generic-input"></textarea>
      <textarea id="deepseek-input" placeholder="给 DeepSeek 发送消息"></textarea>
    `

    const generic = document.getElementById('generic-input') as HTMLTextAreaElement
    const deepseek = document.getElementById('deepseek-input') as HTMLTextAreaElement
    mockVisibleRect(generic, 80, 80)
    mockVisibleRect(deepseek, 140, 140)

    const adapter = findBestEditableAdapter(document, 'chat.deepseek.com')

    expect(adapter?.getElement()).toBe(deepseek)
  })

  it('prefers ChatGPT prompt textarea selector', () => {
    document.body.innerHTML = `
      <textarea id="generic-input"></textarea>
      <textarea id="chatgpt-input" data-testid="prompt-textarea"></textarea>
    `

    const generic = document.getElementById('generic-input') as HTMLTextAreaElement
    const chatgpt = document.getElementById('chatgpt-input') as HTMLTextAreaElement
    mockVisibleRect(generic, 60, 60)
    mockVisibleRect(chatgpt, 180, 180)

    const adapter = findBestEditableAdapter(document, 'chatgpt.com')

    expect(adapter?.getElement()).toBe(chatgpt)
  })

  it('prefers Claude ProseMirror composer selector', () => {
    document.body.innerHTML = `
      <textarea id="generic-input"></textarea>
      <div id="claude-input" class="ProseMirror" contenteditable="true" role="textbox"></div>
    `

    const generic = document.getElementById('generic-input') as HTMLTextAreaElement
    const claude = document.getElementById('claude-input') as HTMLDivElement
    mockVisibleRect(generic, 70, 70)
    mockVisibleRect(claude, 200, 200)

    const adapter = findBestEditableAdapter(document, 'claude.ai')

    expect(adapter?.getElement()).toBe(claude)
  })

  it('does not attach to generic inputs on non-AI hosts', () => {
    document.body.innerHTML = '<input id="go-to-file" type="search" placeholder="Go to file" />'
    const input = document.getElementById('go-to-file') as HTMLInputElement
    mockVisibleRect(input, 100, 100)

    expect(findBestEditableAdapter(document, 'github.com')).toBeNull()
    expect(isAiChatHost('github.com')).toBe(false)
  })

  it('allows only supported AI chat hosts', () => {
    expect(isAiChatHost('chatgpt.com')).toBe(true)
    expect(isAiChatHost('chat.deepseek.com')).toBe(true)
    expect(isAiChatHost('gemini.google.com')).toBe(true)
    expect(isAiChatHost('copilot.microsoft.com')).toBe(true)
    expect(isAiChatHost('mail.google.com')).toBe(false)
  })
})
