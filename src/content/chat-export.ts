export interface ChatMessageNode {
  id: string
  role: string
  text: string
}

const candidateSelectors = ['[data-message-author-role]', 'main article', '[role="listitem"]', '.message']

const getMessageText = (node: HTMLElement): string => {
  let text = node.innerText.trim()
  for (const pre of [...node.querySelectorAll<HTMLElement>('pre')]) {
    const code = pre.innerText.trim()
    if (!code) continue
    const fenced = `\`\`\`\n${code}\n\`\`\``
    if (text.includes(code)) {
      text = text.replace(code, fenced)
    } else {
      text = `${text}\n\n${fenced}`
    }
  }
  return text
}

export const collectChatMessages = (): ChatMessageNode[] => {
  const nodes: HTMLElement[] = []
  for (const selector of candidateSelectors) {
    const found = [...document.querySelectorAll<HTMLElement>(selector)]
    if (found.length >= 2) {
      nodes.push(...found)
      break
    }
  }

  return nodes
    .map((node, index) => ({
      id: node.id || `msg-${index + 1}`,
      role:
        node.getAttribute('data-message-author-role') ||
        node.getAttribute('data-role') ||
        (index % 2 === 0 ? 'user' : 'assistant'),
      text: getMessageText(node),
    }))
    .filter((item) => item.text)
}

const toMarkdown = (messages: ChatMessageNode[]): string =>
  messages.map((item) => `## ${item.role}\n\n${item.text}`).join('\n\n---\n\n')

const toPlainText = (messages: ChatMessageNode[]): string =>
  messages.map((item) => `[${item.role}] ${item.text}`).join('\n\n')

const escapeHtml = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')

const highlightCode = (code: string): string =>
  escapeHtml(code)
    .replace(/\b(const|let|var|function|return|if|else|for|while|class|async|await|import|export|type|interface)\b/g, '<span class="kw">$1</span>')
    .replace(/(&quot;.*?&quot;|&#39;.*?&#39;|`.*?`)/g, '<span class="str">$1</span>')
    .replace(/\b(\d+)\b/g, '<span class="num">$1</span>')

const renderContent = (text: string): string => {
  const segments = text.split(/```/g)
  return segments
    .map((segment, index) => {
      if (index % 2 === 1) {
        const lines = segment.replace(/^\w+\n/, '').trim()
        return `<pre class="code-block"><code>${highlightCode(lines)}</code></pre>`
      }
      return segment
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll('\n', '<br />')}</p>`)
        .join('')
    })
    .join('')
}

const toHtml = (messages: ChatMessageNode[]): string => `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Chat Export</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        font-family: Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
        margin: 0;
        padding: 40px;
        color: #0f172a;
        background: #f8fafc;
        line-height: 1.65;
      }
      .export-shell { max-width: 920px; margin: 0 auto; }
      .export-header { margin-bottom: 28px; padding-bottom: 18px; border-bottom: 1px solid #cbd5e1; }
      .export-title { margin: 0; font-size: 26px; line-height: 1.2; }
      .export-meta { margin-top: 8px; color: #64748b; font-size: 13px; }
      .msg {
        break-inside: avoid;
        page-break-inside: avoid;
        margin: 0 0 22px;
        padding: 18px 18px 18px 22px;
        border: 1px solid #dbeafe;
        border-left: 5px solid #60a5fa;
        border-radius: 16px;
        background: #ffffff;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
      }
      .msg.user { border-left-color: #22c55e; }
      .msg.assistant { border-left-color: #2563eb; }
      .role {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: .08em;
        color: #475569;
        text-transform: uppercase;
        margin-bottom: 10px;
      }
      .role::before { content: ""; width: 8px; height: 8px; border-radius: 999px; background: #60a5fa; }
      .msg.user .role::before { background: #22c55e; }
      p { margin: 0 0 10px; }
      p:last-child { margin-bottom: 0; }
      .code-block {
        margin: 12px 0;
        padding: 16px;
        border-radius: 12px;
        background: #0f172a;
        color: #e2e8f0;
        overflow: auto;
        border: 1px solid #1e293b;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.05);
      }
      code { font-family: "Cascadia Code", Consolas, "SFMono-Regular", monospace; font-size: 12.5px; line-height: 1.65; }
      .kw { color: #93c5fd; font-weight: 700; }
      .str { color: #86efac; }
      .num { color: #fbbf24; }
      @page { margin: 16mm; }
      @media print {
        body { padding: 0; background: #fff; color: #111827; }
        .export-shell { max-width: none; }
        .msg { box-shadow: none; border-color: #d1d5db; }
        .code-block { white-space: pre-wrap; overflow: visible; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      }
    </style>
  </head>
  <body>
    <main class="export-shell">
      <header class="export-header">
        <h1 class="export-title">Conversation Export</h1>
        <div class="export-meta">导出时间：${escapeHtml(new Date().toLocaleString('zh-CN'))} · 消息数：${messages.length}</div>
      </header>
      ${messages
        .map(
          (item) => `
        <section class="msg ${escapeHtml(item.role.toLowerCase())}">
          <div class="role">${escapeHtml(item.role)}</div>
          <div class="content">${renderContent(item.text)}</div>
        </section>`,
        )
        .join('')}
    </main>
  </body>
</html>`

const download = (filename: string, mime: string, content: string): void => {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export const exportConversation = (
  format: 'markdown' | 'html' | 'json' | 'txt' | 'pdf',
  messages: ChatMessageNode[],
): void => {
  if (format === 'markdown') {
    download('conversation-export.md', 'text/markdown;charset=utf-8', toMarkdown(messages))
    return
  }
  if (format === 'html') {
    download('conversation-export.html', 'text/html;charset=utf-8', toHtml(messages))
    return
  }
  if (format === 'json') {
    download('conversation-export.json', 'application/json;charset=utf-8', JSON.stringify(messages, null, 2))
    return
  }
  if (format === 'txt') {
    download('conversation-export.txt', 'text/plain;charset=utf-8', toPlainText(messages))
    return
  }

  const html = toHtml(messages)
  const popup = window.open('', '_blank', 'width=960,height=720')
  if (!popup) return
  popup.document.write(html)
  popup.document.close()
  popup.focus()
  if (window.localStorage.getItem('ape_e2e_disable_print') === '1') {
    return
  }
  window.setTimeout(() => popup.print(), 250)
}
