import { BUILTIN_TEMPLATES, STORAGE_KEYS } from '@/shared/constants'
import type { Template } from '@/shared/types'
import { localGet, localSet } from './base'

const normalizeTemplates = (items: Template[]): Template[] => {
  const merged = [...BUILTIN_TEMPLATES]
  for (const item of items) {
    if (!item.builtin) {
      merged.push(item)
    }
  }
  return merged.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
}

export const templateStore = {
  async getAll(): Promise<Template[]> {
    const stored = await localGet<Template[]>(STORAGE_KEYS.templates, [])
    return normalizeTemplates(stored)
  },
  async getById(id: string): Promise<Template | null> {
    const all = await this.getAll()
    return all.find((item) => item.id === id) ?? null
  },
  async save(template: Template): Promise<Template[]> {
    const stored = await localGet<Template[]>(STORAGE_KEYS.templates, [])
    const next = [...stored.filter((item) => item.id !== template.id), template]
    await localSet(STORAGE_KEYS.templates, next)
    return this.getAll()
  },
  async remove(id: string): Promise<Template[]> {
    const stored = await localGet<Template[]>(STORAGE_KEYS.templates, [])
    const next = stored.filter((item) => item.id !== id)
    await localSet(STORAGE_KEYS.templates, next)
    return this.getAll()
  },
}
