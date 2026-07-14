import YAML from 'yaml'
import type { PromptSkill, PromptSkillVariable, PromptSkillVersion } from '@/shared/types'

const SKILL_ID_PATTERN = /^[a-z0-9._-]{3,80}$/

const toRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} 必须是对象`)
  }
  return value as Record<string, unknown>
}

const normalizeVariables = (value: unknown): PromptSkillVariable[] =>
  Array.isArray(value)
    ? value.map((item, index) => {
        const record = toRecord(item, `variables[${index}]`)
        const name = String(record.name ?? '').trim()
        if (!name) {
          throw new Error(`variables[${index}].name 不能为空`)
        }
        return {
          name,
          description: String(record.description ?? ''),
          required: Boolean(record.required ?? false),
          defaultValue: record.defaultValue === undefined ? undefined : String(record.defaultValue),
        }
      })
    : []

const normalizeVersions = (value: unknown, fallbackTemplate: string, fallbackDescription: string): PromptSkillVersion[] => {
  if (!Array.isArray(value) || value.length === 0) {
    return [
      {
        versionId: crypto.randomUUID(),
        version: '1.0.0',
        updatedAt: new Date().toISOString(),
        promptTemplate: fallbackTemplate,
        description: fallbackDescription,
        variables: [],
        triggerConditions: [],
      },
    ]
  }

  return value.map((item, index) => {
    const record = toRecord(item, `versions[${index}]`)
    return {
      versionId: String(record.versionId ?? crypto.randomUUID()),
      version: String(record.version ?? '1.0.0'),
      updatedAt: String(record.updatedAt ?? new Date().toISOString()),
      promptTemplate: String(record.promptTemplate ?? fallbackTemplate),
      description: String(record.description ?? fallbackDescription),
      variables: normalizeVariables(record.variables),
      triggerConditions: Array.isArray(record.triggerConditions) ? record.triggerConditions.map(String) : [],
      intentRequirements: Array.isArray(record.intentRequirements) ? record.intentRequirements.map(String).filter(Boolean) : undefined,
    }
  })
}

const normalizeSkill = (raw: Record<string, unknown>, sourceType: PromptSkill['sourceType'], indexLabel = 'skill'): PromptSkill => {
  const id = String(raw.id ?? '').trim()
  const name = String(raw.name ?? '').trim()
  const promptTemplate = String(raw.promptTemplate ?? raw.template ?? raw.prompt ?? '').trim()

  if (!id) throw new Error(`${indexLabel}.id 不能为空`)
  if (!SKILL_ID_PATTERN.test(id)) {
    throw new Error(`${indexLabel}.id 不合法，只能包含小写字母、数字、点、下划线和短横线，长度 3-80`)
  }
  if (!name) throw new Error(`${indexLabel}.name 不能为空`)
  if (!promptTemplate) throw new Error(`${indexLabel}.promptTemplate 不能为空`)

  const description = String(raw.description ?? '')

  return {
    id,
    name,
    description,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String).filter(Boolean) : [],
    author: String(raw.author ?? 'Unknown'),
    repoUrl: String(raw.repoUrl ?? raw.source ?? ''),
    version: String(raw.version ?? '1.0.0'),
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
    promptTemplate,
    variables: normalizeVariables(raw.variables),
    triggerConditions: Array.isArray(raw.triggerConditions) ? raw.triggerConditions.map(String) : [],
    intentRequirements: Array.isArray(raw.intentRequirements) ? raw.intentRequirements.map(String).filter(Boolean) : undefined,
    enabled: Boolean(raw.enabled ?? true),
    builtin: false,
    rating: Number(raw.rating ?? 0),
    usageCount: Number(raw.usageCount ?? 0),
    sourceType,
    versions: normalizeVersions(raw.versions, promptTemplate, description),
  }
}

const parseRawSkillDocument = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    const parsed = YAML.parse(text) as unknown
    if (!parsed) {
      throw new Error('无法解析 Skill 配置，请提供合法 JSON 或 YAML')
    }
    return parsed
  }
}

const extractSkillRecords = (parsed: unknown): Record<string, unknown>[] => {
  if (Array.isArray(parsed)) {
    return parsed.map((item, index) => toRecord(item, `skills[${index}]`))
  }
  const record = toRecord(parsed, 'root')
  if (Array.isArray(record.skills)) {
    return record.skills.map((item, index) => toRecord(item, `skills[${index}]`))
  }
  return [record]
}

export const parseSkillTextMany = (text: string, sourceType: PromptSkill['sourceType']): PromptSkill[] => {
  const parsed = parseRawSkillDocument(text)
  const records = extractSkillRecords(parsed)
  if (records.length === 0) {
    throw new Error('Skill 配置中未发现任何 Skill')
  }
  return records.map((record, index) => normalizeSkill(record, sourceType, `skills[${index}]`))
}

export const parseSkillText = (text: string, sourceType: PromptSkill['sourceType']): PromptSkill => {
  const skills = parseSkillTextMany(text, sourceType)
  if (skills.length > 1) {
    throw new Error('当前入口只支持导入单个 Skill；请使用批量导入入口')
  }
  return skills[0]
}
