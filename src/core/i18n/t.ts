import { messages, type MessageKey } from '@/core/i18n/resources'
import type { LanguageCode } from '@/shared/types'

export const t = (language: LanguageCode, key: MessageKey): string =>
  messages[language][key] ?? messages['zh-CN'][key] ?? key
