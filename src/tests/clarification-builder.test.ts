import { buildClarificationPrompt } from '@/core/prompt/clarification-builder'
import { parseEnhanceOutput } from '@/core/prompt/schema'

describe('clarification workflow', () => {
  it('asks only for unresolved high-value intent information', () => {
    const prompt = buildClarificationPrompt({
      sourceText: '帮我写一个登录接口',
      mode: 'coding',
      outputLanguagePolicy: 'zh-CN',
      previousAnswers: [
        {
          questionId: 'stack',
          question: '技术栈是什么？',
          answer: 'Node.js + TypeScript',
        },
      ],
    })

    expect(prompt.systemPrompt).toContain('需求访谈师')
    expect(prompt.systemPrompt).toContain('不要询问原文已经明确的信息')
    expect(prompt.userPrompt).toContain('Node.js + TypeScript')
    expect(prompt.responseSchemaHint).toContain('clarificationQuestions')
  })

  it('parses structured clarification questions safely', () => {
    const output = parseEnhanceOutput(JSON.stringify({
      enhancedPrompt: '用户希望实现一个登录接口，但技术边界还不明确。',
      clarificationQuestions: [
        {
          id: 'stack',
          question: '使用什么技术栈？',
          why: '决定代码结构与依赖。',
          placeholder: 'Node.js + TypeScript',
          required: true,
        },
      ],
      readyToEnhance: false,
      warnings: [],
      placeholders: [],
    }))

    expect(output.clarificationQuestions).toEqual([
      {
        id: 'stack',
        question: '使用什么技术栈？',
        why: '决定代码结构与依赖。',
        placeholder: 'Node.js + TypeScript',
        required: true,
      },
    ])
    expect(output.readyToEnhance).toBe(false)
  })

  it('parses direct-mode intent insight and critical missing fields', () => {
    const output = parseEnhanceOutput(JSON.stringify({
      enhancedPrompt: '请实现一个登录接口。',
      intentSummary: '用户希望实现一个可用于生产环境的登录接口。',
      missingInformation: ['技术栈', '认证方式'],
      needsClarification: true,
      clarificationQuestions: [],
      warnings: [],
      placeholders: [],
    }))

    expect(output.intentSummary).toContain('登录接口')
    expect(output.missingInformation).toEqual(['技术栈', '认证方式'])
    expect(output.needsClarification).toBe(true)
  })
})
