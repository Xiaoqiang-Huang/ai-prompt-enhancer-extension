import { STORAGE_KEYS } from '@/shared/constants'
import { localGet, localSet } from '@/core/storage/base'

export const getInstallId = async (): Promise<string> => {
  const existing = await localGet<string>(STORAGE_KEYS.installId, '')
  if (existing) {
    return existing
  }
  const created = crypto.randomUUID()
  await localSet(STORAGE_KEYS.installId, created)
  return created
}
