import { CLARIFICATION_SCHEMA_HINT } from '@/core/prompt/schema'
import type {
  ClarificationAnswer,
  EnhanceMode,
  PromptBuildResult,
  PromptSkill,
  Settings,
} from '@/shared/types'

interface BuildClarificationPromptInput {
  sourceText: string
  mode: EnhanceMode
  outputLanguagePolicy: Settings['outputLanguagePolicy']
  skill?: PromptSkill
  previousAnswers?: ClarificationAnswer[]
}

const resolveLanguageHint = (policy: Settings['outputLanguagePolicy']) => {
  if (policy === 'en') return 'Ask questions in English.'
  if (policy === 'zh-CN') return '使用中文提问。'
  return '提问语言跟随用户原始输入；中文输入优先使用中文。'
}

export const buildClarificationPrompt = (input: BuildClarificationPromptInput): PromptBuildResult => {
  const priorContext = input.previousAnswers?.length
    ? input.previousAnswers
        .map((item, index) => `${index + 1}. 问：${item.question}\n答：${item.answer}`)
        .join('\n\n')
    : '暂无'
  const skillContext = input.skill
    ? `当前将使用 Skill：${input.skill.name}\nSkill 目标：${input.skill.description}`
    : '当前未指定 Skill，请按通用高质量 Prompt 的信息需求判断。'

  return {
    systemPrompt: [
      '你是一位克制、敏锐的需求访谈师和 Prompt 架构师。',
      '你的任务不是立刻改写 Prompt，而是先判断哪些缺失信息会实质改变最终结果。',
      '只追问高价值信息：目标、受众、使用场景、技术或业务约束、输入输出、交付形式、验收标准。',
      '不要询问原文已经明确的信息，不要一次提出超过 5 个问题，不要把多个主题塞进同一个问题。',
      '每个问题都应容易回答，并给一个简短示例；若意图已足够清楚，直接标记 readyToEnhance=true。',
      resolveLanguageHint(input.outputLanguagePolicy),
      CLARIFICATION_SCHEMA_HINT,
    ].join('\n'),
    userPrompt: [
      '请分析以下原始需求并生成本轮最有价值的追问。',
      `原始需求：\n${input.sourceText}`,
      `优化场景：${input.mode}`,
      skillContext,
      `前面轮次已经确认的信息：\n${priorContext}`,
      '如果前面回答已经解决了某个问题，不要重复追问。',
    ].join('\n\n'),
    responseSchemaHint: CLARIFICATION_SCHEMA_HINT,
    languageHint: resolveLanguageHint(input.outputLanguagePolicy),
  }
}
