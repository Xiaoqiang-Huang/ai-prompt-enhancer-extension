export const logger = {
  info: (...args: unknown[]) => console.info('[APE]', ...args),
  warn: (...args: unknown[]) => console.warn('[APE]', ...args),
  error: (...args: unknown[]) => console.error('[APE]', ...args),
}
