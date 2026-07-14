import type { EnhanceMode } from '@/shared/types'

export const MODE_PERSONAS: Record<EnhanceMode, string> = {
  concise: '将需求压缩为短而高效、可直接使用的 Prompt。',
  detailed: '补全任务目标、背景、约束和输出格式，形成结构化高质量 Prompt。',
  stepByStep: '把任务拆成阶段、步骤和检查点，适合复杂流程执行。',
  coding: '强调技术栈、输入输出、边界条件、测试与验收标准。',
  business: '强调目标用户、场景、指标、风险、交付格式与行动建议。',
  english: '先理解中文意图，再输出高质量英文 Prompt。',
}
