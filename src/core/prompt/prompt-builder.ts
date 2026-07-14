import { MODE_PERSONAS } from '@/core/prompt/templates'
import { RESPONSE_SCHEMA_HINT } from '@/core/prompt/schema'
import type { BuildPromptInput, PromptBuildResult } from '@/shared/types'

const DEFAULT_INTENT_REQUIREMENTS: Record<BuildPromptInput['mode'], string[]> = {
  concise: ['goal', 'expectedOutput'],
  detailed: ['goal', 'context', 'expectedOutput', 'acceptanceCriteria'],
  stepByStep: ['goal', 'context', 'expectedOutput', 'acceptanceCriteria'],
  coding: ['goal', 'technicalStack', 'inputs', 'expectedOutput', 'constraints', 'acceptanceCriteria'],
  business: ['goal', 'audience', 'context', 'constraints', 'expectedOutput', 'acceptanceCriteria'],
  english: ['goal', 'audience', 'expectedOutput'],
}

const resolveLanguageHint = (policy: BuildPromptInput['outputLanguagePolicy']) => {
  if (policy === 'zh-CN') return '最终输出使用中文。'
  if (policy === 'en') return 'Final output must be in English.'
  return '最终输出语言默认跟随原始输入语言；若用户明显是中文需求，则优先中文。'
}

export const buildPrompt = (input: BuildPromptInput): PromptBuildResult => {
  const enabledRules = input.rules.filter((rule) => rule.enabled).map((rule) => `- ${rule.content}`)
  const templateSection = input.template
    ? `\n用户选中的模板：${input.template.title}\n模板要求：${input.template.content}\n`
    : ''
  const skillSection = input.skill
    ? `\n选中的 Prompt Skill：${input.skill.name}\nSkill 描述：${input.skill.description}\nSkill 模板：${input.skill.promptTemplate}\n触发条件：${input.skill.triggerConditions.join('；') || '无'}\n关键意图字段：${(input.skill.intentRequirements?.length ? input.skill.intentRequirements : DEFAULT_INTENT_REQUIREMENTS[input.mode]).join('、')}\n`
    : ''
  const followUpSection = input.followUpInstruction
    ? `\n这是基于上一轮结果的继续优化要求：${input.followUpInstruction}\n请保留原始意图连续性，并明确标出本轮新增修改点。\n`
    : ''
  const previousEnhancedSection = input.previousEnhancedText
    ? `\n上一轮优化后的 Prompt：\n${input.previousEnhancedText}\n`
    : ''
  const clarificationSection = input.clarificationContext?.length
    ? `\n用户在意图澄清阶段已经确认的信息：\n${input.clarificationContext
        .map((item, index) => `${index + 1}. ${item.question}\n用户回答：${item.answer}`)
        .join('\n\n')}\n\n这些回答优先级高于通用假设。请把它们准确融入最终 Prompt，不要再次留下已经回答过的占位符。\n`
    : ''

  const systemPrompt = [
    '你是一个专业的 Prompt Enhancer。',
    '你的目标不是替用户虚构事实，而是把原始需求增强为可直接提交给 AI 的高质量 Prompt。',
    MODE_PERSONAS[input.mode],
    resolveLanguageHint(input.outputLanguagePolicy),
    `直接增强时，请先在同一次响应中提炼用户意图摘要，并检查关键意图字段：${DEFAULT_INTENT_REQUIREMENTS[input.mode].join('、')}。若选中 Skill 提供了关键意图字段，则优先按 Skill 字段检查。`,
    '只有缺少会实质改变结果的关键字段时，才将 needsClarification 设为 true，并在 missingInformation 中列出缺失项；不要把可选细节列为缺失。',
    '即使 needsClarification=true，也要先给出当前最佳增强结果；插件会把追问作为可选下一步，而不是自动替换用户原文。',
    '如果关键信息缺失，请使用 [请补充：xxx] 形式的占位符，不要编造。',
    '保持结构清晰，避免空话、套话和营销语气。',
    RESPONSE_SCHEMA_HINT,
  ].join('\n')

  const userPrompt = [
    '请增强以下原始 Prompt：',
    input.sourceText,
    templateSection,
    skillSection,
    previousEnhancedSection,
    followUpSection,
    clarificationSection,
    `目标输出格式：${input.outputFormat}`,
    enabledRules.length > 0 ? `用户规则：\n${enabledRules.join('\n')}` : '用户规则：无',
  ].join('\n\n')

  return {
    systemPrompt,
    userPrompt,
    responseSchemaHint: RESPONSE_SCHEMA_HINT,
    languageHint: resolveLanguageHint(input.outputLanguagePolicy),
  }
}
