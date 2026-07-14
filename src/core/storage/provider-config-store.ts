import { DEFAULT_PROVIDER_CONFIGS, STORAGE_KEYS } from '@/shared/constants'
import type { ProviderServiceConfig, ProviderType } from '@/shared/types'
import { localGet, localSet } from './base'

const mergeConfigs = (stored: ProviderServiceConfig[]): ProviderServiceConfig[] =>
  DEFAULT_PROVIDER_CONFIGS.map((config) => {
    const override = stored.find((item) => item.provider === config.provider)
    return override ? { ...config, ...override } : config
  })

export const providerConfigStore = {
  async getAll(): Promise<ProviderServiceConfig[]> {
    const stored = await localGet<ProviderServiceConfig[]>(STORAGE_KEYS.providerConfigs, [])
    return mergeConfigs(stored)
  },
  async getByProvider(provider: ProviderType): Promise<ProviderServiceConfig> {
    const all = await this.getAll()
    return all.find((item) => item.provider === provider) ?? DEFAULT_PROVIDER_CONFIGS[0]
  },
  async save(config: ProviderServiceConfig): Promise<ProviderServiceConfig[]> {
    const all = await this.getAll()
    const next = [...all.filter((item) => item.provider !== config.provider), config]
    await localSet(STORAGE_KEYS.providerConfigs, next)
    return mergeConfigs(next)
  },
}
