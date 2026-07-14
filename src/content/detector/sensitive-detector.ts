import type { SensitiveScanResult } from '@/shared/types'

const API_KEY_REGEX = /\b(?:sk|rk|pk)-[A-Za-z0-9_-]{12,}\b/g
const JWT_REGEX = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+\b/g
const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const PHONE_REGEX = /\b1\d{10}\b/g

export const detectSensitiveText = (text: string, element?: HTMLElement): SensitiveScanResult => {
  const matches: SensitiveScanResult['matches'] = []
  if (element instanceof HTMLInputElement && element.type === 'password') {
    matches.push({ type: 'password-field', value: 'password' })
  }

  for (const match of text.matchAll(API_KEY_REGEX)) {
    matches.push({ type: 'api-key', value: match[0] })
  }
  for (const match of text.matchAll(JWT_REGEX)) {
    matches.push({ type: 'jwt', value: match[0] })
  }
  for (const match of text.matchAll(EMAIL_REGEX)) {
    matches.push({ type: 'email', value: match[0] })
  }
  for (const match of text.matchAll(PHONE_REGEX)) {
    matches.push({ type: 'phone', value: match[0] })
  }

  return {
    blocked: matches.some((item) => item.type === 'password-field' || item.type === 'api-key' || item.type === 'jwt'),
    matches,
  }
}
