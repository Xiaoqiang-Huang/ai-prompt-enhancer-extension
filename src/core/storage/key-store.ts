import { decryptSecret, encryptSecret } from '@/core/security/crypto'
import { STORAGE_KEYS } from '@/shared/constants'
import type { ProviderKeyRecord, ProviderType } from '@/shared/types'
import { localGet, localSet, sessionGet, sessionSet } from './base'

const getSessionKeyName = (provider: ProviderType) => `${STORAGE_KEYS.sessionPassphrasePrefix}${provider}`

const getManagedPassphrase = (provider: ProviderType) => {
  const runtimeId = globalThis.chrome?.runtime?.id ?? 'ai-prompt-enhancer-local'
  return `ape-local-managed-secret::${runtimeId}::${provider}`
}

const unique = (values: Array<string | undefined | null>) => [...new Set(values.map((item) => item?.trim()).filter(Boolean) as string[])]

export const keyStore = {
  async getAll(): Promise<ProviderKeyRecord[]> {
    return await localGet<ProviderKeyRecord[]>(STORAGE_KEYS.providerKeys, [])
  },
  async save(provider: ProviderType, apiKey: string, passphrase?: string): Promise<void> {
    const current = await this.getAll()
    const effectivePassphrase = passphrase?.trim() || getManagedPassphrase(provider)
    const encrypted = await encryptSecret(apiKey, effectivePassphrase)
    const next: ProviderKeyRecord = {
      provider,
      ...encrypted,
      updatedAt: new Date().toISOString(),
    }
    await localSet(
      STORAGE_KEYS.providerKeys,
      [...current.filter((item) => item.provider !== provider), next],
    )
    await sessionSet(getSessionKeyName(provider), effectivePassphrase)
  },
  async unlock(provider: ProviderType, passphrase?: string): Promise<boolean> {
    const all = await this.getAll()
    const record = all.find((item) => item.provider === provider)
    if (!record) {
      return false
    }

    const candidates = unique([getManagedPassphrase(provider), passphrase])
    for (const candidate of candidates) {
      try {
        await decryptSecret(record, candidate)
        await sessionSet(getSessionKeyName(provider), candidate)
        return true
      } catch {
        // try next
      }
    }
    return false
  },
  async getDecrypted(provider: ProviderType): Promise<string | null> {
    const all = await this.getAll()
    const record = all.find((item) => item.provider === provider)
    if (!record) {
      return null
    }

    const sessionPassphrase = await sessionGet<string>(getSessionKeyName(provider), '')
    const candidates = unique([sessionPassphrase, getManagedPassphrase(provider)])
    for (const candidate of candidates) {
      try {
        const decrypted = await decryptSecret(record, candidate)
        await sessionSet(getSessionKeyName(provider), candidate)
        return decrypted
      } catch {
        // try next
      }
    }
    return null
  },
  async remove(provider: ProviderType): Promise<void> {
    const all = await this.getAll()
    await localSet(
      STORAGE_KEYS.providerKeys,
      all.filter((item) => item.provider !== provider),
    )
    await sessionSet(getSessionKeyName(provider), '')
  },
}
