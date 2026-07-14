import { DEFAULT_SETTINGS, STORAGE_KEYS } from '@/shared/constants'
import type { Settings } from '@/shared/types'
import { localGet, localSet } from './base'

export const settingsStore = {
  async get(): Promise<Settings> {
    const current = await localGet<Partial<Settings>>(STORAGE_KEYS.settings, DEFAULT_SETTINGS)
    return {
      ...DEFAULT_SETTINGS,
      ...current,
      launcher: {
        ...DEFAULT_SETTINGS.launcher,
        ...current.launcher,
      },
      modeProviderStrategy: {
        ...DEFAULT_SETTINGS.modeProviderStrategy,
        ...current.modeProviderStrategy,
      },
    }
  },
  async set(patch: Partial<Settings>): Promise<Settings> {
    const next = { ...(await this.get()), ...patch }
    await localSet(STORAGE_KEYS.settings, next)
    return next
  },
}
