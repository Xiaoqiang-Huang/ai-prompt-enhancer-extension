import { settingsStore } from '@/core/storage/settings-store'
import { DEFAULT_SETTINGS, SCHEMA_VERSION } from '@/shared/constants'

export const runMigrations = async (): Promise<void> => {
  const settings = await settingsStore.get()
  if (settings.schemaVersion !== SCHEMA_VERSION) {
    // v2 moves the launcher cluster above the composer. Existing installations
    // previously persisted "right", so changing only DEFAULT_SETTINGS would
    // leave them on the old overlapping layout indefinitely.
    const launcher = settings.schemaVersion < 2
      ? { ...settings.launcher, position: 'above' as const }
      : settings.launcher
    await settingsStore.set({
      ...DEFAULT_SETTINGS,
      ...settings,
      launcher,
      schemaVersion: SCHEMA_VERSION,
    })
  }
}
