import type { SensitiveScanResult } from '@/shared/types'

const patterns = [
  { type: 'api-key' as const, regex: /\b(?:sk|rk|pk)-[A-Za-z0-9_-]{12,}\b/g },
  { type: 'jwt' as const, regex: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+\b/g },
  { type: 'email' as const, regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  { type: 'phone' as const, regex: /\b1\d{10}\b/g },
  { type: 'id-card' as const, regex: /\b\d{17}[\dXx]\b/g },
]

export const scanSensitiveText = (text: string): SensitiveScanResult => {
  const matches = patterns.flatMap(({ type, regex }) =>
    [...text.matchAll(regex)].map((item) => ({
      type,
      value: item[0],
    })),
  )
  return {
    blocked: matches.some((item) => item.type === 'api-key' || item.type === 'jwt'),
    matches,
  }
}

export const redactText = (text: string): string =>
  patterns.reduce((output, pattern) => output.replaceAll(pattern.regex, '[REDACTED]'), text)
