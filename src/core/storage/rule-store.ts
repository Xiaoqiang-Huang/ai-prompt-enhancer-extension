import { STORAGE_KEYS } from '@/shared/constants'
import type { UserRule } from '@/shared/types'
import { localGet, localSet } from './base'

export const ruleStore = {
  async getAll(): Promise<UserRule[]> {
    return await localGet<UserRule[]>(STORAGE_KEYS.rules, [])
  },
  async save(rule: UserRule): Promise<UserRule[]> {
    const current = await this.getAll()
    const next = [...current.filter((item) => item.id !== rule.id), rule]
    await localSet(STORAGE_KEYS.rules, next)
    return next
  },
  async remove(id: string): Promise<UserRule[]> {
    const current = await this.getAll()
    const next = current.filter((item) => item.id !== id)
    await localSet(STORAGE_KEYS.rules, next)
    return next
  },
}
