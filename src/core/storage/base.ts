export const localGet = async <T>(key: string, fallback: T): Promise<T> => {
  const area = globalThis.chrome?.storage?.local
  if (!area) return fallback
  const result = await area.get(key)
  return (result[key] as T | undefined) ?? fallback
}

export const localSet = async <T>(key: string, value: T): Promise<void> => {
  const area = globalThis.chrome?.storage?.local
  if (!area) return
  await area.set({ [key]: value })
}

export const sessionGet = async <T>(key: string, fallback: T): Promise<T> => {
  const area = globalThis.chrome?.storage?.session
  if (!area) return fallback
  const result = await area.get(key)
  return (result[key] as T | undefined) ?? fallback
}

export const sessionSet = async <T>(key: string, value: T): Promise<void> => {
  const area = globalThis.chrome?.storage?.session
  if (!area) return
  await area.set({ [key]: value })
}
