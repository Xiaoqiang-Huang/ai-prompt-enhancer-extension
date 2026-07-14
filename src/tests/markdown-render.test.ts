import { renderMarkdownDocumentHtml, renderMarkdownLineHtml } from '@/content/overlay/markdown-render'

describe('markdown-render', () => {
  it('renders headings, bold and list items', () => {
    const html = renderMarkdownDocumentHtml('# 标题\n\n**加粗**\n- 列表项')

    expect(html).toContain('font-weight:800')
    expect(html).toContain('<strong>加粗</strong>')
    expect(html).toContain('•')
    expect(html).toContain('列表项')
  })

  it('renders inline code safely', () => {
    const html = renderMarkdownLineHtml('使用 `npm run build` 构建')

    expect(html).toContain('<code')
    expect(html).toContain('npm run build')
  })

  it('escapes dangerous html before rendering markdown', () => {
    const html = renderMarkdownDocumentHtml('<script>alert(1)</script> **safe**')

    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).toContain('<strong>safe</strong>')
  })
})
