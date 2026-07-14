import { buildPrompt } from '@/core/prompt/prompt-builder'

describe('buildPrompt', () => {
  it('injects mode persona and schema hint', () => {
    const result = buildPrompt({
      sourceText: '这里先写一段中文示例文本',
      mode: 'business',
      outputFormat: 'markdown',
      outputLanguagePolicy: 'zh-CN',
      rules: [{ id: '1', title: 'rule', content: '先后出现规则', enabled: true, createdAt: '', updatedAt: '' }],
    })

    expect(result.systemPrompt).toContain('目标用户')
    expect(result.systemPrompt).toContain('JSON')
    expect(result.userPrompt).toContain('先后出现规则')
  })

  it('injects clarified intent as authoritative context', () => {
    const result = buildPrompt({
      sourceText: '帮我写一个登录接口',
      mode: 'coding',
      outputFormat: 'markdown',
      outputLanguagePolicy: 'zh-CN',
      rules: [],
      clarificationContext: [
        {
          questionId: 'stack',
          question: '使用什么技术栈？',
          answer: 'Node.js、TypeScript 和 PostgreSQL',
        },
      ],
    })

    expect(result.userPrompt).toContain('意图澄清阶段已经确认')
    expect(result.userPrompt).toContain('Node.js、TypeScript 和 PostgreSQL')
    expect(result.userPrompt).toContain('不要再次留下已经回答过的占位符')
  })
})
