import { settingsStore } from '@/core/storage/settings-store'
import { DEFAULT_SETTINGS, SCHEMA_VERSION } from '@/shared/constants'

export const runMigrations = async (): Promise<void> => {
  const settings = await settingsStore.get()
  if (settings.schemaVersion !== SCHEMA_VERSION) {
    await settingsStore.set({ ...DEFAULT_SETTINGS, ...settings, schemaVersion: SCHEMA_VERSION })
  }
}
