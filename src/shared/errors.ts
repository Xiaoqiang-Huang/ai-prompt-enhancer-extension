export type AppErrorCode =
  | 'NO_ACTIVE_EDITOR'
  | 'PERMISSION_DENIED'
  | 'API_KEY_MISSING'
  | 'API_KEY_LOCKED'
  | 'API_AUTH_FAILED'
  | 'RATE_LIMITED'
  | 'NETWORK_TIMEOUT'
  | 'PROVIDER_ERROR'
  | 'PARSE_FAILED'
  | 'INSERT_FAILED'
  | 'SENSITIVE_INPUT_BLOCKED'
  | 'UNKNOWN_ERROR'

export interface AppError {
  code: AppErrorCode
  message: string
  recoverable: boolean
  details?: unknown
}

export const appError = (
  code: AppErrorCode,
  message: string,
  recoverable = true,
  details?: unknown,
): AppError => ({ code, message, recoverable, details })
