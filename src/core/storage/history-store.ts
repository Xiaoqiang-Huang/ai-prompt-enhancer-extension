import { STORAGE_KEYS } from '@/shared/constants'
import type { HistoryItem } from '@/shared/types'
import { localGet, localSet } from './base'

export const historyStore = {
  async getAll(): Promise<HistoryItem[]> {
    return await localGet<HistoryItem[]>(STORAGE_KEYS.history, [])
  },
  async save(item: HistoryItem, limit: number): Promise<HistoryItem[]> {
    const current = await this.getAll()
    const next = [item, ...current.filter((entry) => entry.id !== item.id)].slice(0, limit)
    await localSet(STORAGE_KEYS.history, next)
    return next
  },
  async remove(id: string): Promise<HistoryItem[]> {
    const current = await this.getAll()
    const next = current.filter((entry) => entry.id !== id)
    await localSet(STORAGE_KEYS.history, next)
    return next
  },
  async clear(): Promise<void> {
    await localSet(STORAGE_KEYS.history, [])
  },
}
