import { COMMANDS } from '@/background/commands'
import { CONTEXT_MENU_ID, registerContextMenus } from '@/background/context-menu'
import { ensureSidePanelEnabled, hasProviderHostPermission } from '@/background/permissions'
import { buildClarificationPrompt } from '@/core/prompt/clarification-builder'
import { buildPrompt } from '@/core/prompt/prompt-builder'
import { providerMap } from '@/core/providers'
import { getInstallId } from '@/core/security/install-id'
import { redactText } from '@/core/security/redaction'
import { historyStore } from '@/core/storage/history-store'
import { keyStore } from '@/core/storage/key-store'
import { runMigrations } from '@/core/storage/migrations'
import { providerConfigStore } from '@/core/storage/provider-config-store'
import { ruleStore } from '@/core/storage/rule-store'
import { settingsStore } from '@/core/storage/settings-store'
import { skillStore } from '@/core/storage/skill-store'
import { templateStore } from '@/core/storage/template-store'
import { appError } from '@/shared/errors'
import { STORAGE_KEYS } from '@/shared/constants'
import { logger } from '@/shared/logger'
import { isSupportedAiChatPage } from '@/shared/supported-sites'
import type {
  ClarificationAnswer,
  ClarificationQuestion,
  EnhanceMode,
  EnhanceOutput,
  EnhancementWorkflow,
  HistoryItem,
  ProviderServiceConfig,
  ProviderType,
  PromptSkill,
  PromptBuildResult,
  Template,
  UserRule,
} from '@/shared/types'

const RESTRICTED_URL_PREFIXES = ['chrome://', 'edge://', 'about:', 'chrome-extension://']
const SUPPORTED_UTILITY_HOSTS = new Set([
  'github.com',
  'mail.google.com',
  'docs.google.com',
  'www.notion.so',
  'notion.so',
])
const E2E_MOCK_RESPONSE_KEY = 'ape_e2e_mock_response'
const E2E_MOCK_INTENT_KEY = 'ape_e2e_mock_intent'
const E2E_ENHANCE_REQUESTS_KEY = 'ape_e2e_enhance_requests'
const E2E_MOCK_DELAY_MS_KEY = 'ape_e2e_mock_delay_ms'
const E2E_MOCK_CLARIFICATION_KEY = 'ape_e2e_mock_clarification'
const E2E_CLARIFICATION_REQUESTS_KEY = 'ape_e2e_clarification_requests'
const ENHANCE_CACHE_TTL_MS = 120_000
const MAX_ENHANCE_CACHE_ENTRIES = 24

const cachedSettings = {
  data: null as Awaited<ReturnType<typeof settingsStore.get>> | null,
}
const cachedRules = {
  data: null as UserRule[] | null,
}
const cachedProviderConfig = new Map<ProviderType, ProviderServiceConfig>()
const cachedProviderApiKeys = new Map<ProviderType, string | null>()
const cachedSkills = new Map<string, PromptSkill | null>()
const cachedTemplates = new Map<string, Template | null>()
const enhancedPromptCache = new Map<string, { result: EnhanceOutput; expireAt: number; createdAt: number }>()
const inFlightEnhancements = new Map<string, Promise<EnhanceOutput>>()

interface CachedProviderConfig {
  model: string
  temperature: number
  maxTokens: number
}

const clearCaches = (keys: string[]) => {
  if (keys.includes(STORAGE_KEYS.settings)) cachedSettings.data = null
  if (keys.includes(STORAGE_KEYS.rules)) cachedRules.data = null
  if (keys.includes(STORAGE_KEYS.providerConfigs)) cachedProviderConfig.clear()
  if (keys.includes(STORAGE_KEYS.providerKeys)) cachedProviderApiKeys.clear()
  if (keys.includes(STORAGE_KEYS.providerKeys) || keys.includes(STORAGE_KEYS.providerConfigs)) {
    inFlightEnhancements.clear()
    enhancedPromptCache.clear()
  }
  if (keys.includes(STORAGE_KEYS.skills)) cachedSkills.clear()
  if (keys.includes(STORAGE_KEYS.templates)) cachedTemplates.clear()
}

const getContentScriptEntry = (): string => {
  const [entry] = chrome.runtime.getManifest().content_scripts?.[0]?.js ?? []
  return entry ?? 'src/content/index.ts'
}

const isInjectableUrl = (url?: string): boolean =>
  Boolean(url) && !RESTRICTED_URL_PREFIXES.some((prefix) => url?.startsWith(prefix))

const isSupportedPageUrl = (url?: string): boolean => {
  if (!isInjectableUrl(url)) return false
  try {
    const parsedUrl = new URL(url as string)
    return isSupportedAiChatPage(parsedUrl.hostname, parsedUrl.pathname) || SUPPORTED_UTILITY_HOSTS.has(parsedUrl.hostname)
  } catch {
    return false
  }
}

const getActiveTab = async (): Promise<chrome.tabs.Tab> => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    throw appError('NO_ACTIVE_EDITOR', '鏈壘鍒版椿鍔ㄦ爣绛鹃〉')
  }
  return tab
}

const ensureContentScript = async (tab: Pick<chrome.tabs.Tab, 'id' | 'url'>): Promise<void> => {
  if (!tab.id || !isInjectableUrl(tab.url)) {
    throw appError('PERMISSION_DENIED', '当前页面不支持扩展注入')
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'APE_PING' })
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: [getContentScriptEntry()],
    })
  }
}

const openPromptLibrary = async (): Promise<void> => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab?.windowId !== undefined && chrome.sidePanel?.open) {
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId })
      return
    } catch (error) {
      logger.warn('sidePanel.open failed; falling back to tab', error)
    }
  }
  await chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') })
}

const sendToActiveTab = async (message: unknown): Promise<void> => {
  const tab = await getActiveTab()
  const tabId = tab.id
  if (!tabId) {
    throw appError('NO_ACTIVE_EDITOR', '鏈壘鍒版椿鍔ㄦ爣绛鹃〉')
  }
  await ensureContentScript(tab)
  await chrome.tabs.sendMessage(tabId, message)
}

const getCachedSettings = async () => {
  if (!cachedSettings.data) {
    cachedSettings.data = await settingsStore.get()
  }
  return cachedSettings.data
}

const getCachedRules = async () => {
  if (!cachedRules.data) {
    cachedRules.data = await ruleStore.getAll()
  }
  return cachedRules.data
}

const getCachedProviderConfig = async (provider: ProviderType) => {
  const cached = cachedProviderConfig.get(provider)
  if (cached) {
    return cached
  }
  const config = await providerConfigStore.getByProvider(provider)
  cachedProviderConfig.set(provider, config)
  return config
}

const getCachedSkill = async (id: string) => {
  if (!cachedSkills.has(id)) {
    cachedSkills.set(id, await skillStore.getById(id))
  }
  return cachedSkills.get(id) ?? null
}

const getCachedTemplate = async (id: string) => {
  if (!cachedTemplates.has(id)) {
    cachedTemplates.set(id, await templateStore.getById(id))
  }
  return cachedTemplates.get(id) ?? null
}

const emitTabMessage = async (tabId: number | undefined, message: unknown) => {
  if (!tabId) return
  try {
    await chrome.tabs.sendMessage(tabId, message)
  } catch {
    // ignore detached content-script sessions
  }
}

const createPartialEmitter = (tabId: number | undefined, requestId?: string) => {
  let latest = ''
  let timer: ReturnType<typeof setTimeout> | undefined
  let sending: Promise<void> | undefined

  const flush = async (): Promise<void> => {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
    if (sending) {
      await sending
    }
    if (!latest) return
    const partial = latest
    latest = ''
    sending = emitTabMessage(tabId, {
      type: 'APE_ENHANCE_STREAM',
      requestId,
      partial,
    })
    try {
      await sending
    } finally {
      sending = undefined
    }
    if (latest) await flush()
  }

  const push = (partial: string) => {
    latest = partial
    if (timer !== undefined) return
    timer = setTimeout(() => {
      timer = undefined
      void flush()
    }, 50)
  }

  return { push, flush }
}

const ensureContentScriptOnSupportedTab = async (tabId: number, url?: string): Promise<void> => {
  if (!isSupportedPageUrl(url)) return
  try {
    await ensureContentScript({ id: tabId, url })
  } catch (error) {
    // A tab can disappear or be replaced while navigation is in progress.
    // This is a best-effort reliability path; the manifest content script still
    // handles the normal document_idle injection.
    logger.warn('supported tab content script sync skipped', error)
  }
}

const ensureContentScriptsOnOpenTabs = async (): Promise<void> => {
  const tabs = await chrome.tabs.query({})
  await Promise.all(
    tabs
      .filter((tab): tab is chrome.tabs.Tab & { id: number; url: string } => Boolean(tab.id && isSupportedPageUrl(tab.url)))
      .map((tab) => ensureContentScriptOnSupportedTab(tab.id, tab.url)),
  )
}

const getCachedProviderApiKey = async (provider: ProviderType) => {
  if (!cachedProviderApiKeys.has(provider)) {
    const key = await keyStore.getDecrypted(provider)
    cachedProviderApiKeys.set(provider, key)
  }
  return cachedProviderApiKeys.get(provider) ?? null
}

const fastHash = (value: string) => {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(36)
}

const normalizeEnabledRuleSignature = (rules: UserRule[]) =>
  rules
    .filter((rule) => rule.enabled)
    .map((rule) => `${rule.id}:${rule.updatedAt}`)
    .sort()
    .join('|')

const trimEnhanceCache = () => {
  if (enhancedPromptCache.size <= MAX_ENHANCE_CACHE_ENTRIES) {
    return
  }
  for (const [key] of enhancedPromptCache) {
    enhancedPromptCache.delete(key)
    if (enhancedPromptCache.size <= MAX_ENHANCE_CACHE_ENTRIES) {
      break
    }
  }
}

const providerNeedsApiKey = (config: ProviderServiceConfig) => config.authMode !== 'none'

const assertProviderHostPermission = async (config: ProviderServiceConfig) => {
  if (await hasProviderHostPermission(config.baseUrl)) return
  throw appError(
    'PERMISSION_DENIED',
    '尚未授权扩展访问当前 API 端点。请打开扩展弹窗或设置页，点击“测试连接”并允许该站点权限。',
  )
}

const buildCompletenessRetryPrompt = (
  prompt: PromptBuildResult,
  partialResult: string,
): PromptBuildResult => ({
  ...prompt,
  systemPrompt: `${prompt.systemPrompt}\n\nIMPORTANT: The previous response was cut off by the output-token limit. Return one complete valid JSON object from the beginning. Keep the answer complete and concise enough to fit. Do not refer to this retry.`,
  userPrompt: `${prompt.userPrompt}\n\n上一轮不完整输出（仅用于避免遗漏，不要直接续写残缺 JSON）：\n${partialResult.slice(0, 12_000)}\n\n请从头重新生成完整结果，优先保证结构闭合、要求完整和 JSON 可解析。`,
})

const buildEnhanceCacheKey = (input: {
  sourceText: string
  mode: EnhanceMode
  provider: ProviderType
  providerConfig: CachedProviderConfig
  skill: PromptSkill | null | undefined
  template: Template | null | undefined
  rulesSig: string
  followUpInstruction?: string
  previousEnhancedText?: string
  clarificationContext?: ClarificationAnswer[]
  workflow?: EnhancementWorkflow
}) => {
  const fingerprint = {
    provider: input.provider,
    model: input.providerConfig.model,
    temp: input.providerConfig.temperature,
    maxTokens: input.providerConfig.maxTokens,
    mode: input.mode,
    ruleSig: input.rulesSig,
    skillSig: input.skill ? `${input.skill.id}:${input.skill.updatedAt}` : 'none',
    templateSig: input.template ? `${input.template.id}:${input.template.updatedAt}` : 'none',
    followUpSig: input.followUpInstruction ? fastHash(input.followUpInstruction) : 'none',
    sourceHash: fastHash(input.sourceText),
    prevHash: input.previousEnhancedText ? fastHash(input.previousEnhancedText) : 'none',
    clarificationHash: input.clarificationContext?.length
      ? fastHash(JSON.stringify(input.clarificationContext))
      : 'none',
    workflow: input.workflow ?? 'direct',
  }
  return JSON.stringify(fingerprint)
}

const tryE2EMockEnhance = async (payload: {
  sourceText: string
  mode?: EnhanceMode
  hostname?: string
  followUpInstruction?: string
  previousEnhancedText?: string
  clarificationContext?: ClarificationAnswer[]
  workflow?: EnhancementWorkflow
}) => {
  const state = await chrome.storage.local.get([
    E2E_MOCK_RESPONSE_KEY,
    E2E_MOCK_INTENT_KEY,
    E2E_ENHANCE_REQUESTS_KEY,
    E2E_MOCK_DELAY_MS_KEY,
  ])
  const mockResponse = state[E2E_MOCK_RESPONSE_KEY]
  if (typeof mockResponse !== 'string' || !mockResponse.trim()) {
    return null
  }
  const requests = Array.isArray(state[E2E_ENHANCE_REQUESTS_KEY]) ? state[E2E_ENHANCE_REQUESTS_KEY] : []
  const mockIntent = state[E2E_MOCK_INTENT_KEY]
  const delayMs = Number(state[E2E_MOCK_DELAY_MS_KEY] ?? 0)
  if (Number.isFinite(delayMs) && delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(delayMs, 10_000)))
  }
  await chrome.storage.local.set({
    [E2E_ENHANCE_REQUESTS_KEY]: [
      ...requests,
      {
        sourceText: payload.sourceText,
        mode: payload.mode,
        hostname: payload.hostname,
        followUpInstruction: payload.followUpInstruction,
        previousEnhancedText: payload.previousEnhancedText,
        clarificationContext: payload.clarificationContext,
        workflow: payload.workflow,
        createdAt: new Date().toISOString(),
      },
    ],
  })
  return {
    enhancedPrompt: mockResponse,
    title: 'E2E Mock Prompt',
    summary: 'E2E mock response generated locally without calling any third-party AI API.',
    warnings: [] as string[],
    placeholders: [] as string[],
    intentSummary:
      mockIntent && typeof mockIntent === 'object' && typeof (mockIntent as { intentSummary?: unknown }).intentSummary === 'string'
        ? (mockIntent as { intentSummary: string }).intentSummary
        : '用户希望获得一份可直接执行的结构化结果。',
    missingInformation:
      mockIntent && typeof mockIntent === 'object' && Array.isArray((mockIntent as { missingInformation?: unknown }).missingInformation)
        ? (mockIntent as { missingInformation: unknown[] }).missingInformation.filter((item): item is string => typeof item === 'string')
        : [],
    needsClarification: Boolean(
      mockIntent && typeof mockIntent === 'object' && (mockIntent as { needsClarification?: unknown }).needsClarification === true,
    ),
  }
}

const fallbackClarificationQuestions: ClarificationQuestion[] = [
  {
    id: 'desired-outcome',
    question: '这次你最希望最终结果解决什么问题，怎样才算成功？',
    why: '明确成功标准可以避免优化后的提示词只做表面扩写。',
    placeholder: '例如：输出可直接交给开发执行的接口需求，并通过 5 个验收用例',
    required: true,
  },
  {
    id: 'audience-context',
    question: '结果将由谁使用，处在什么具体场景中？',
    why: '受众和使用场景会直接影响措辞、深度与交付结构。',
    placeholder: '例如：给刚接手项目的后端工程师，用于本周迭代',
    required: true,
  },
  {
    id: 'constraints',
    question: '有哪些必须遵守的限制、技术栈或不能做的事项？',
    why: '约束能减少模型给出看似完整但无法落地的方案。',
    placeholder: '例如：Node.js + PostgreSQL，不新增付费依赖，兼容现有接口',
    required: false,
  },
  {
    id: 'deliverable',
    question: '你希望最终以什么形式交付，篇幅或细节程度如何？',
    why: '交付格式决定最终 Prompt 的结构和输出边界。',
    placeholder: '例如：Markdown，包含代码、测试、错误处理和验收清单',
    required: false,
  },
]

const normalizeEnhanceIntent = (result: EnhanceOutput): EnhanceOutput => {
  const missingInformation = [...new Set((result.missingInformation ?? []).map((item) => item.trim()).filter(Boolean))].slice(0, 6)
  return {
    ...result,
    intentSummary: result.intentSummary?.trim() || result.summary?.trim() || undefined,
    missingInformation,
    needsClarification: result.needsClarification === true || missingInformation.length > 0,
  }
}

const normalizeClarificationQuestions = (result: EnhanceOutput): ClarificationQuestion[] => {
  const structured = result.clarificationQuestions
    ?.filter((item) => item.question.trim())
    .map((item, index) => ({
      ...item,
      id: item.id || `question-${index + 1}`,
      question: item.question.trim(),
      why: item.why?.trim(),
      placeholder: item.placeholder?.trim(),
    }))
    .slice(0, 5)
  if (structured?.length) return structured

  const fromText = result.enhancedPrompt
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)、])\s*/, '').trim())
    .filter((line) => line.length >= 6 && /[?？]$/.test(line))
    .slice(0, 5)
    .map((question, index) => ({
      id: `question-${index + 1}`,
      question,
      required: index < 2,
    }))
  return fromText
}

const tryE2EMockClarification = async (payload: {
  sourceText: string
  mode?: EnhanceMode
  previousAnswers?: ClarificationAnswer[]
}) => {
  const state = await chrome.storage.local.get([
    E2E_MOCK_CLARIFICATION_KEY,
    E2E_CLARIFICATION_REQUESTS_KEY,
    E2E_MOCK_DELAY_MS_KEY,
  ])
  const mock = state[E2E_MOCK_CLARIFICATION_KEY]
  if (!mock || typeof mock !== 'object') return null
  const requests = Array.isArray(state[E2E_CLARIFICATION_REQUESTS_KEY])
    ? state[E2E_CLARIFICATION_REQUESTS_KEY]
    : []
  const delayMs = Number(state[E2E_MOCK_DELAY_MS_KEY] ?? 0)
  if (Number.isFinite(delayMs) && delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(delayMs, 10_000)))
  }
  await chrome.storage.local.set({
    [E2E_CLARIFICATION_REQUESTS_KEY]: [
      ...requests,
      {
        sourceText: payload.sourceText,
        mode: payload.mode,
        previousAnswers: payload.previousAnswers,
        createdAt: new Date().toISOString(),
      },
    ],
  })
  const typed = mock as {
    summary?: unknown
    questions?: unknown
    readyToEnhance?: unknown
    warnings?: unknown
  }
  const questions = Array.isArray(typed.questions)
    ? typed.questions.filter(
        (item): item is ClarificationQuestion =>
          Boolean(item) && typeof item === 'object' && typeof (item as ClarificationQuestion).question === 'string',
      )
    : []
  return {
    summary: typeof typed.summary === 'string' ? typed.summary : '已分析用户意图。',
    questions,
    readyToEnhance: typed.readyToEnhance === true,
    warnings: Array.isArray(typed.warnings)
      ? typed.warnings.filter((item): item is string => typeof item === 'string')
      : [],
  }
}

const clarifyIntent = async (
  payload: {
    sourceText: string
    mode?: EnhanceMode
    skillId?: string
    previousAnswers?: ClarificationAnswer[]
    requestId?: string
  },
  sender?: chrome.runtime.MessageSender,
) => {
  const settings = await getCachedSettings()
  const effectiveMode = payload.mode ?? settings.defaultMode
  const activeProvider = settings.modeProviderStrategy[effectiveMode] ?? settings.provider
  const requestedSkillId = payload.skillId?.trim() || settings.defaultSkillId
  const [providerConfig, skill] = await Promise.all([
    getCachedProviderConfig(activeProvider),
    requestedSkillId ? getCachedSkill(requestedSkillId) : Promise.resolve(null),
  ])
  const prompt = buildClarificationPrompt({
    sourceText: payload.sourceText,
    mode: effectiveMode,
    outputLanguagePolicy: settings.outputLanguagePolicy,
    skill: skill?.enabled ? skill : undefined,
    previousAnswers: payload.previousAnswers,
  })
  const mockResult = await tryE2EMockClarification(payload)
  if (mockResult) return mockResult
  await assertProviderHostPermission(providerConfig)
  const storedApiKey = providerNeedsApiKey(providerConfig) ? await getCachedProviderApiKey(activeProvider) : ''
  if (providerNeedsApiKey(providerConfig) && !storedApiKey) {
    throw appError('API_KEY_LOCKED', '当前 Provider 未解锁或未配置 API Key')
  }
  const apiKey = storedApiKey ?? ''
  const result = await providerMap[activeProvider].enhance({
    apiKey,
    settings,
    config: {
      ...providerConfig,
      maxTokens: Math.min(providerConfig.maxTokens, 900),
      temperature: Math.min(providerConfig.temperature, 0.35),
    },
    prompt,
    onPartial: (partial) => {
      void emitTabMessage(sender?.tab?.id, {
        type: 'APE_CLARIFY_STREAM',
        requestId: payload.requestId,
        partial,
      })
    },
  })
  const parsedQuestions = normalizeClarificationQuestions(result)
  const readyToEnhance = result.readyToEnhance === true
  const questions = readyToEnhance
    ? []
    : parsedQuestions.length > 0
      ? parsedQuestions
      : fallbackClarificationQuestions
  return {
    summary: result.enhancedPrompt,
    questions,
    readyToEnhance: readyToEnhance || questions.length === 0,
    warnings: result.warnings,
  }
}

const enhanceText = async (payload: {
  sourceText: string
  mode?: EnhanceMode
  hostname?: string
  templateId?: string
  skillId?: string
  followUpInstruction?: string
  previousEnhancedText?: string
  clarificationContext?: ClarificationAnswer[]
  workflow?: EnhancementWorkflow
  requestId?: string
}, sender?: chrome.runtime.MessageSender) => {
  const settings = await getCachedSettings()
  const effectiveMode = payload.mode ?? settings.defaultMode
  const preferredProvider = payload.mode ? settings.modeProviderStrategy[payload.mode] : undefined
  const activeProvider = preferredProvider ?? settings.provider

  const requestedSkillId =
    payload.skillId === '__NONE__'
      ? settings.defaultSkillId
      : payload.skillId && payload.skillId.trim()
        ? payload.skillId
        : settings.defaultSkillId

  const [providerConfig, rules, skill, template] = await Promise.all([
    getCachedProviderConfig(activeProvider),
    getCachedRules(),
    requestedSkillId ? getCachedSkill(requestedSkillId) : Promise.resolve(null),
    payload.templateId ? getCachedTemplate(payload.templateId) : Promise.resolve(null),
  ])

  const effectiveSkill = skill?.enabled ? skill : undefined
  const prompt = buildPrompt({
    sourceText: payload.sourceText,
    mode: effectiveMode,
    outputFormat: settings.outputFormat,
    outputLanguagePolicy: settings.outputLanguagePolicy,
    template: template ?? undefined,
    skill: effectiveSkill,
    rules,
    followUpInstruction: payload.followUpInstruction,
    previousEnhancedText: payload.previousEnhancedText,
    clarificationContext: payload.clarificationContext,
  })

  const mockResult = await tryE2EMockEnhance(payload)
  const rawResult =
    mockResult ??
    (await (async () => {
      const optimizedConfig = providerConfig
      const cacheKey = buildEnhanceCacheKey({
        sourceText: payload.sourceText,
        mode: effectiveMode,
        provider: activeProvider,
        providerConfig: {
          model: optimizedConfig.model,
          temperature: optimizedConfig.temperature,
          maxTokens: optimizedConfig.maxTokens,
        },
        skill: effectiveSkill,
        template,
        rulesSig: normalizeEnabledRuleSignature(rules),
        followUpInstruction: payload.followUpInstruction,
        previousEnhancedText: payload.previousEnhancedText,
        clarificationContext: payload.clarificationContext,
        workflow: payload.workflow,
      })

      const cacheItem = enhancedPromptCache.get(cacheKey)
      if (cacheItem && cacheItem.expireAt > Date.now()) {
        return cacheItem.result
      }
      const inFlight = inFlightEnhancements.get(cacheKey)
      if (inFlight) {
        return await inFlight
      }

      const task = (async () => {
        await assertProviderHostPermission(optimizedConfig)
        const storedApiKey = providerNeedsApiKey(optimizedConfig) ? await getCachedProviderApiKey(activeProvider) : ''
        if (providerNeedsApiKey(optimizedConfig) && !storedApiKey) {
          throw appError('API_KEY_LOCKED', '当前 Provider 未解锁或未配置 API Key')
        }
        const apiKey = storedApiKey ?? ''
        const provider = providerMap[activeProvider]
        const partialEmitter = createPartialEmitter(sender?.tab?.id, payload.requestId)
        let enhanceResult = await provider.enhance({
          apiKey,
          settings,
          config: optimizedConfig,
          prompt,
          onPartial: partialEmitter.push,
        })
        if (enhanceResult.truncated) {
          void emitTabMessage(sender?.tab?.id, {
            type: 'APE_ENHANCE_STATUS',
            requestId: payload.requestId,
            message: '检测到模型输出被 Token 上限截断，正在自动扩大预算并重新生成完整结果…',
          })
          const retryConfig = {
            ...optimizedConfig,
            maxTokens: Math.min(Math.max(optimizedConfig.maxTokens * 2, 4_096), 16_384),
          }
          try {
            const recovered = await provider.enhance({
              apiKey,
              settings,
              config: retryConfig,
              prompt: buildCompletenessRetryPrompt(prompt, enhanceResult.enhancedPrompt),
              onPartial: partialEmitter.push,
            })
            enhanceResult = {
              ...recovered,
              warnings: [
                ...recovered.warnings,
                recovered.truncated
                  ? '自动完整性重试后仍触及模型输出上限，请提高 Max Tokens 或缩短输出要求。'
                  : '检测到首次输出截断，系统已自动扩大 Token 预算并重新生成完整结果。',
              ],
            }
          } catch (error) {
            logger.warn('Automatic completeness retry failed', error)
            enhanceResult = {
              ...enhanceResult,
              warnings: [
                ...enhanceResult.warnings,
                '检测到输出截断，但自动完整性重试失败。请提高 Max Tokens、超时时间，或改用上下文更大的模型。',
              ],
            }
          }
        }
        await partialEmitter.flush()
        enhancedPromptCache.set(cacheKey, {
          result: enhanceResult,
          expireAt: Date.now() + ENHANCE_CACHE_TTL_MS,
          createdAt: Date.now(),
        })
        trimEnhanceCache()
        return enhanceResult
      })()
      inFlightEnhancements.set(cacheKey, task)
      try {
        return await task
      } finally {
        inFlightEnhancements.delete(cacheKey)
      }
    })())
  const result = normalizeEnhanceIntent(rawResult)

  let historyId: string | undefined
  if (settings.historyEnabled) {
    const historyItem: HistoryItem = {
      id: crypto.randomUUID(),
      sourceText: settings.storeSourceText ? redactText(payload.sourceText) : '',
      enhancedText: result.enhancedPrompt,
      mode: effectiveMode,
      outputFormat: settings.outputFormat,
      language: settings.outputLanguagePolicy === 'followInput' ? 'followInput' : settings.outputLanguagePolicy,
      templateId: template?.id,
      skillId: effectiveSkill?.id,
      provider: activeProvider,
      providerLabel: providerConfig.label,
      model: providerConfig.model,
      temperature: providerConfig.temperature,
      maxTokens: providerConfig.maxTokens,
      hostname: payload.hostname ?? '',
      createdAt: new Date().toISOString(),
      favorited: false,
      tags: [],
      warnings: result.warnings,
      adopted: false,
      followUpInstruction: payload.followUpInstruction,
      workflow: payload.workflow ?? (payload.clarificationContext?.length ? 'clarify' : 'direct'),
    }
    historyId = historyItem.id
    void historyStore.save(historyItem, settings.historyLimit)
  }

  return { ...result, historyId }
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return
  clearCaches(Object.keys(changes))
})

chrome.runtime.onInstalled.addListener(async () => {
  await runMigrations()
  await ensureSidePanelEnabled()
  await registerContextMenus()
  await getInstallId()
  void ensureContentScriptsOnOpenTabs()
})

chrome.runtime.onStartup.addListener(async () => {
  await ensureSidePanelEnabled()
  await registerContextMenus()
  void ensureContentScriptsOnOpenTabs()
})

chrome.tabs.onActivated.addListener(({ tabId }) => {
  void chrome.tabs
    .get(tabId)
    .then((tab) => ensureContentScriptOnSupportedTab(tabId, tab.url))
    .catch((error) => logger.warn('active tab content script sync skipped', error))
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    void ensureContentScriptOnSupportedTab(tabId, changeInfo.url ?? tab.url)
  }
})

chrome.contextMenus.onClicked.addListener(async (info) => {
  try {
    if (info.menuItemId === CONTEXT_MENU_ID && info.selectionText) {
      await sendToActiveTab({
        type: 'APE_CONTEXT_SELECTION',
        text: info.selectionText,
      })
    }
  } catch (error) {
    logger.error(error)
  }
})

chrome.commands.onCommand.addListener(async (command) => {
  try {
    if (command === COMMANDS.enhanceCurrentInput) {
      await sendToActiveTab({ type: 'APE_RUN_ACTIVE_INPUT' })
    }
    if (command === COMMANDS.openPromptLibrary) {
      await openPromptLibrary()
    }
  } catch (error) {
    logger.error(error)
  }
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const run = async () => {
    if (message?.type === 'APE_ENHANCE_TEXT') {
      const data = await enhanceText(message.payload, _sender)
      sendResponse({ ok: true, data })
      return
    }

    if (message?.type === 'APE_CLARIFY_INTENT') {
      const data = await clarifyIntent(message.payload, _sender)
      sendResponse({ ok: true, data })
      return
    }

    if (message?.type === 'APE_TEST_PROVIDER') {
      const settings = await getCachedSettings()
      const providerType = message.provider as ProviderType
      const providerConfig = await providerConfigStore.getByProvider(providerType)
      await assertProviderHostPermission(providerConfig)
      const apiKey = providerNeedsApiKey(providerConfig) ? await keyStore.getDecrypted(providerType) : ''
      if (providerNeedsApiKey(providerConfig) && !apiKey) {
        throw appError('API_KEY_LOCKED', 'Provider 鏈В閿佹垨鏈厤缃?API Key')
      }
      const data = await providerMap[providerType].testConnection(apiKey ?? '', settings, providerConfig)
      sendResponse({ ok: true, data })
      return
    }

    if (message?.type === 'APE_ENSURE_CONTENT_SCRIPT') {
      const tab = await getActiveTab()
      await ensureContentScriptOnSupportedTab(tab.id as number, tab.url)
      sendResponse({ ok: true, supported: isSupportedPageUrl(tab.url) })
      return
    }

    if (message?.type === 'APE_OPEN_SIDE_PANEL') {
      await openPromptLibrary()
      sendResponse({ ok: true })
      return
    }

    if (message?.type === 'APE_TRIGGER_ACTIVE_INPUT') {
      await sendToActiveTab({
        type: 'APE_RUN_ACTIVE_INPUT',
        mode: message.mode,
        copyOnly: message.copyOnly,
        skillId: message.skillId,
      })
      sendResponse({ ok: true })
      return
    }

    if (message?.type === 'APE_MARK_HISTORY_ADOPTED') {
      const history = await historyStore.getAll()
      const next = history.map((item) =>
        item.id === message.historyId ? { ...item, adopted: true } : item,
      )
      await chrome.storage.local.set({ ape_history: next })
      sendResponse({ ok: true })
      return
    }
  }

  run().catch((error: unknown) => {
    const normalized =
      typeof error === 'object' && error && 'code' in error
        ? error
        : appError('UNKNOWN_ERROR', error instanceof Error ? error.message : '鏈煡閿欒', true, error)
    logger.error(normalized)
    sendResponse({ ok: false, error: normalized })
  })

  return true
})
