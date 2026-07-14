import { STORAGE_KEYS } from '@/shared/constants'
import type { SavedPrompt } from '@/shared/types'
import { localGet, localSet } from './base'

export const savedPromptStore = {
  async getAll(): Promise<SavedPrompt[]> {
    return await localGet<SavedPrompt[]>(STORAGE_KEYS.savedPrompts, [])
  },
  async save(prompt: SavedPrompt): Promise<SavedPrompt[]> {
    const current = await this.getAll()
    const next = [prompt, ...current.filter((item) => item.id !== prompt.id)]
    await localSet(STORAGE_KEYS.savedPrompts, next)
    return next
  },
  async remove(id: string): Promise<SavedPrompt[]> {
    const current = await this.getAll()
    const next = current.filter((item) => item.id !== id)
    await localSet(STORAGE_KEYS.savedPrompts, next)
    return next
  },
  async incrementUsage(id: string): Promise<SavedPrompt[]> {
    const current = await this.getAll()
    const next = current.map((item) =>
      item.id === id ? { ...item, usageCount: item.usageCount + 1, updatedAt: new Date().toISOString() } : item,
    )
    await localSet(STORAGE_KEYS.savedPrompts, next)
    return next
  },
}
