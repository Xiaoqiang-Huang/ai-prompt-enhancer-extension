import { runMigrations } from '@/core/storage/migrations'
import { SCHEMA_VERSION, STORAGE_KEYS } from '@/shared/constants'

describe('settings migrations', () => {
  it('moves existing launcher settings above the composer in schema v2', async () => {
    const state: Record<string, unknown> = {
      [STORAGE_KEYS.settings]: {
        schemaVersion: 1,
        launcher: {
          enabled: true,
          secondaryActionsEnabled: true,
          position: 'right',
          size: 24,
          opacity: 0.92,
          color: '#22c55e',
        },
      },
    }

    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        storage: {
          local: {
            get: async (key: string) => ({ [key]: state[key] }),
            set: async (values: Record<string, unknown>) => Object.assign(state, values),
          },
        },
      },
    })

    await runMigrations()

    const migrated = state[STORAGE_KEYS.settings] as {
      schemaVersion: number
      launcher: { position: string; size: number }
    }
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION)
    expect(migrated.launcher.position).toBe('above')
    expect(migrated.launcher.size).toBe(24)
  })
})
