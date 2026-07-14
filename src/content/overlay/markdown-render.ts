export const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const codeTokenPrefix = 'APECODETOKEN'

const renderInlineMarkdown = (raw: string): string => {
  const escaped = escapeHtml(raw)
  const codeTokens: string[] = []

  let content = escaped.replace(/`([^`]+)`/g, (_match, code: string) => {
    const token = `${codeTokenPrefix}${codeTokens.length}ENDTOKEN`
    codeTokens.push(
      `<code style="padding:1px 6px;border-radius:6px;background:rgba(15,23,42,0.08);color:#0f172a;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;">${code}</code>`,
    )
    return token
  })

  content = content
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>')
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer noopener" style="color:#2563eb;text-decoration:underline;">$1</a>',
    )

  codeTokens.forEach((token, index) => {
    content = content.replaceAll(`${codeTokenPrefix}${index}ENDTOKEN`, token)
  })

  return content
}

export const renderMarkdownLineHtml = (line: string): string => {
  const trimmed = line.trim()
  if (!trimmed) {
    return '<div style="height:10px"></div>'
  }

  if (/^```/.test(trimmed)) {
    return `<div style="padding:6px 10px;border-radius:10px;background:#e2e8f0;color:#334155;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;">${escapeHtml(trimmed)}</div>`
  }

  if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
    return '<div style="height:1px;background:#cbd5e1;margin:10px 0;"></div>'
  }

  const heading = trimmed.match(/^(#{1,6})\s+(.+)$/)
  if (heading) {
    const level = heading[1].length
    const text = renderInlineMarkdown(heading[2])
    const size = [26, 22, 19, 17, 15, 14][level - 1] ?? 14
    return `<div style="font-weight:800;color:#0f172a;font-size:${size}px;line-height:1.45;margin:4px 0;">${text}</div>`
  }

  const unordered = line.match(/^\s*[-*+]\s+(.+)$/)
  if (unordered) {
    return `<div style="display:flex;gap:8px;align-items:flex-start;line-height:1.7;color:#1e293b;"><span style="color:#2563eb;font-weight:700;">•</span><span>${renderInlineMarkdown(unordered[1])}</span></div>`
  }

  const ordered = line.match(/^\s*(\d+)\.\s+(.+)$/)
  if (ordered) {
    return `<div style="display:flex;gap:8px;align-items:flex-start;line-height:1.7;color:#1e293b;"><span style="min-width:22px;color:#2563eb;font-weight:700;">${ordered[1]}.</span><span>${renderInlineMarkdown(ordered[2])}</span></div>`
  }

  const quote = line.match(/^\s*>\s?(.+)$/)
  if (quote) {
    return `<div style="border-left:3px solid #93c5fd;padding:4px 0 4px 10px;color:#475569;font-style:italic;line-height:1.7;">${renderInlineMarkdown(quote[1])}</div>`
  }

  return `<div style="line-height:1.75;color:#0f172a;word-break:break-word;">${renderInlineMarkdown(line)}</div>`
}

export const renderMarkdownDocumentHtml = (text: string): string =>
  text
    .split('\n')
    .map((line) => renderMarkdownLineHtml(line))
    .join('')
