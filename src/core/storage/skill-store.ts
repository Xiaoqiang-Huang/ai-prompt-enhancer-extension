import { BUILTIN_PROMPT_SKILLS, STORAGE_KEYS } from '@/shared/constants'
import type { PromptSkill } from '@/shared/types'
import { localGet, localSet } from './base'

const mergeSkills = (stored: PromptSkill[]): PromptSkill[] => {
  const map = new Map<string, PromptSkill>()
  for (const skill of BUILTIN_PROMPT_SKILLS) {
    map.set(skill.id, skill)
  }
  for (const skill of stored) {
    map.set(skill.id, skill)
  }
  return [...map.values()]
}

export const skillStore = {
  async getAll(): Promise<PromptSkill[]> {
    const stored = await localGet<PromptSkill[]>(STORAGE_KEYS.skills, [])
    return mergeSkills(stored)
  },
  async getById(id: string): Promise<PromptSkill | null> {
    const all = await this.getAll()
    return all.find((item) => item.id === id) ?? null
  },
  async save(skill: PromptSkill): Promise<PromptSkill[]> {
    const stored = await localGet<PromptSkill[]>(STORAGE_KEYS.skills, [])
    const next = [...stored.filter((item) => item.id !== skill.id), skill]
    await localSet(STORAGE_KEYS.skills, next)
    return mergeSkills(next)
  },
  async remove(id: string): Promise<PromptSkill[]> {
    const stored = await localGet<PromptSkill[]>(STORAGE_KEYS.skills, [])
    const next = stored.filter((item) => item.id !== id)
    await localSet(STORAGE_KEYS.skills, next)
    return mergeSkills(next)
  },
}
