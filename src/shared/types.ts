export type LanguageCode = 'zh-CN' | 'en'

export type ProviderType =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'azureOpenAI'
  | 'ollama'
  | 'deepseek'
  | 'moonshot'
  | 'qwen'
  | 'zhipu'
  | 'siliconflow'
  | 'volcengine'
  | 'custom'

export type EnhanceMode =
  | 'concise'
  | 'detailed'
  | 'stepByStep'
  | 'coding'
  | 'business'
  | 'english'

export type OutputFormat = 'markdown' | 'plain' | 'json' | 'checklist' | 'codex'

export type EnhancementWorkflow = 'direct' | 'clarify'

export interface Settings {
  schemaVersion: number
  language: LanguageCode
  provider: ProviderType
  defaultSkillId?: string
  defaultMode: EnhanceMode
  enhancementWorkflow: EnhancementWorkflow
  outputFormat: OutputFormat
  outputLanguagePolicy: 'followInput' | 'zh-CN' | 'en'
  historyEnabled: boolean
  historyLimit: number
  storeSourceText: boolean
  detectSensitiveText: boolean
  explicitTriggerOnly: boolean
  theme: 'light' | 'system'
  launcher: {
    enabled: boolean
    secondaryActionsEnabled: boolean
    position: 'left' | 'right' | 'floating'
    size: number
    opacity: number
    color: string
  }
  modeProviderStrategy: Partial<Record<EnhanceMode, ProviderType>>
}

export interface ProviderServiceConfig {
  provider: ProviderType
  label: string
  baseUrl: string
  model: string
  models: string[]
  authMode: 'bearer' | 'api-key' | 'x-api-key' | 'query-key' | 'none'
  apiKeyHeader?: string
  temperature: number
  maxTokens: number
  timeoutMs: number
  retryCount: number
  enabled: boolean
}

export interface Template {
  id: string
  title: string
  description: string
  category: string
  mode: EnhanceMode
  content: string
  usageHint?: string
  sourceName?: string
  sourceUrl?: string
  builtin?: boolean
  createdAt: string
  updatedAt: string
}

export interface PromptSkillVariable {
  name: string
  description: string
  required: boolean
  defaultValue?: string
}

export interface PromptSkillVersion {
  versionId: string
  version: string
  updatedAt: string
  promptTemplate: string
  description: string
  variables: PromptSkillVariable[]
  triggerConditions: string[]
  intentRequirements?: string[]
}

export interface PromptSkill {
  id: string
  name: string
  description: string
  tags: string[]
  author: string
  repoUrl: string
  version: string
  updatedAt: string
  promptTemplate: string
  variables: PromptSkillVariable[]
  triggerConditions: string[]
  intentRequirements?: string[]
  enabled: boolean
  builtin: boolean
  rating: number
  usageCount: number
  sourceType: 'builtin-github' | 'github-url' | 'upload' | 'paste'
  versions: PromptSkillVersion[]
}

export interface UserRule {
  id: string
  title: string
  content: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface SavedPrompt {
  id: string
  title: string
  content: string
  source: 'input' | 'selection' | 'message' | 'enhanced_result'
  tags: string[]
  category: string
  note?: string
  hostname?: string
  createdAt: string
  updatedAt: string
  usageCount: number
}

export interface HistoryItem {
  id: string
  sourceText: string
  enhancedText: string
  mode: EnhanceMode
  outputFormat: OutputFormat
  language: LanguageCode | 'followInput'
  templateId?: string
  skillId?: string
  provider: ProviderType
  providerLabel?: string
  model?: string
  temperature?: number
  maxTokens?: number
  hostname: string
  createdAt: string
  favorited: boolean
  tags: string[]
  warnings: string[]
  adopted: boolean
  followUpInstruction?: string
  workflow?: EnhancementWorkflow
}

export interface ClarificationQuestion {
  id: string
  question: string
  why?: string
  placeholder?: string
  required: boolean
}

export interface ClarificationAnswer {
  questionId: string
  question: string
  answer: string
}

export interface ProviderKeyRecord {
  provider: ProviderType
  ciphertext: string
  iv: string
  salt: string
  kdf: 'PBKDF2-SHA-256'
  iterations: number
  updatedAt: string
}

export interface BuildPromptInput {
  sourceText: string
  mode: EnhanceMode
  outputFormat: OutputFormat
  outputLanguagePolicy: Settings['outputLanguagePolicy']
  template?: Template
  skill?: PromptSkill
  rules: UserRule[]
  followUpInstruction?: string
  previousEnhancedText?: string
  clarificationContext?: ClarificationAnswer[]
}

export interface PromptBuildResult {
  systemPrompt: string
  userPrompt: string
  responseSchemaHint: string
  languageHint: string
}

export interface IntentInsight {
  intentSummary?: string
  missingInformation: string[]
  needsClarification: boolean
  clarificationQuestions?: ClarificationQuestion[]
}

export interface EnhanceOutput {
  enhancedPrompt: string
  title?: string
  summary?: string
  warnings: string[]
  placeholders: string[]
  clarificationQuestions?: ClarificationQuestion[]
  readyToEnhance?: boolean
  intentSummary?: string
  missingInformation: string[]
  needsClarification: boolean
  truncated?: boolean
  finishReason?: string
}

export interface ProviderEnhanceParams {
  apiKey: string
  settings: Settings
  config: ProviderServiceConfig
  prompt: PromptBuildResult
  signal?: AbortSignal
  onPartial?: (partial: string) => void
}

export interface ProviderAdapter {
  readonly provider: ProviderType
  enhance(params: ProviderEnhanceParams): Promise<EnhanceOutput>
  testConnection(
    apiKey: string,
    settings: Settings,
    config: ProviderServiceConfig,
  ): Promise<{ ok: boolean; message: string }>
}

export interface SensitiveMatch {
  type:
    | 'password-field'
    | 'api-key'
    | 'jwt'
    | 'email'
    | 'phone'
    | 'id-card'
    | 'secret-like'
  value: string
}

export interface SensitiveScanResult {
  blocked: boolean
  matches: SensitiveMatch[]
}

export interface EditorSnapshot {
  text: string
  selectionStart?: number
  selectionEnd?: number
}

export interface EditableAdapter {
  kind: 'native' | 'contenteditable' | 'codemirror' | 'monaco'
  canWrite: boolean
  getLabel(): string
  getText(): string
  replaceText(nextText: string): Promise<boolean>
  insertText(nextText: string): Promise<boolean>
  snapshot(): EditorSnapshot
  restore(snapshot: EditorSnapshot): Promise<boolean>
  focus(): void
  getElement(): HTMLElement
}

export interface AppExportBundle {
  exportedAt: string
  version: string
  settings: Settings
  providerConfigs: ProviderServiceConfig[]
  templates: Template[]
  skills: PromptSkill[]
  rules: UserRule[]
  savedPrompts: SavedPrompt[]
  history: HistoryItem[]
}

export type RuntimeRequest =
  | { type: 'ENHANCE_ACTIVE_INPUT'; mode?: EnhanceMode; copyOnly?: boolean; skillId?: string }
  | { type: 'ENHANCE_SELECTION'; text: string; mode?: EnhanceMode }
  | { type: 'OPEN_SIDE_PANEL' }
  | { type: 'TEST_PROVIDER'; provider: ProviderType }

export type RuntimeResponse =
  | { ok: true; data?: unknown; message?: string }
  | { ok: false; error: { code: string; message: string; recoverable: boolean } }
