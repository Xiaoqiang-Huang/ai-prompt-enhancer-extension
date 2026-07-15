import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PopupApp } from '@/ui/popup/PopupApp'

const mockRefs = vi.hoisted(() => ({
  runtimeSendMessage: vi.fn(),
  openOptionsPage: vi.fn(),
  getDecrypted: vi.fn(),
  saveKey: vi.fn(),
  settingsSet: vi.fn().mockImplementation(async (patch: Record<string, unknown>) => ({
    language: 'zh-CN',
    provider: (patch.provider as string) ?? 'openai',
    defaultMode: 'detailed',
    enhancementWorkflow: (patch.enhancementWorkflow as 'direct' | 'clarify') ?? 'direct',
    outputFormat: 'markdown',
    outputLanguagePolicy: 'followInput',
    historyEnabled: true,
    historyLimit: 200,
    storeSourceText: true,
    detectSensitiveText: true,
    explicitTriggerOnly: true,
    theme: 'light',
    schemaVersion: 1,
    defaultSkillId: (patch.defaultSkillId as string | undefined) ?? undefined,
    launcher: {
      enabled: true,
      secondaryActionsEnabled: true,
      position: 'right',
      size: 24,
      opacity: 0.92,
      color: '#22c55e',
    },
    modeProviderStrategy: {},
  })),
  permissionContains: vi.fn(),
  permissionRequest: vi.fn(),
}))

vi.mock('@/core/storage/settings-store', () => ({
  settingsStore: {
    get: vi.fn().mockResolvedValue({
      language: 'zh-CN',
      provider: 'openai',
      defaultMode: 'detailed',
      enhancementWorkflow: 'direct',
      outputFormat: 'markdown',
      outputLanguagePolicy: 'followInput',
      historyEnabled: true,
      historyLimit: 200,
      storeSourceText: true,
      detectSensitiveText: true,
      explicitTriggerOnly: true,
      theme: 'light',
      schemaVersion: 1,
      defaultSkillId: 'general-prompt-enhancer-skill',
      launcher: {
        enabled: true,
        secondaryActionsEnabled: true,
        position: 'right',
        size: 24,
        opacity: 0.92,
        color: '#22c55e',
      },
      modeProviderStrategy: {},
    }),
    set: mockRefs.settingsSet,
  },
}))

vi.mock('@/core/storage/provider-config-store', () => ({
  providerConfigStore: {
    getAll: vi.fn().mockResolvedValue([
      {
        provider: 'openai',
        label: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4.1-mini',
        models: ['gpt-4.1-mini'],
        authMode: 'bearer',
        temperature: 0.7,
        maxTokens: 2048,
        timeoutMs: 45000,
        retryCount: 1,
        enabled: true,
      },
    ]),
  },
}))

vi.mock('@/core/storage/skill-store', () => ({
  skillStore: {
    getAll: vi.fn().mockResolvedValue([
      {
        id: 'general-prompt-enhancer-skill',
        name: 'General Prompt Enhancer Skill',
        description: '适用于通用提示词优化',
        tags: ['general'],
        author: 'builtin',
        repoUrl: 'https://example.com',
        version: '1.0.0',
        updatedAt: '2026-07-08T00:00:00.000Z',
        promptTemplate: 'template',
        variables: [],
        triggerConditions: [],
        enabled: true,
        builtin: true,
        rating: 5,
        usageCount: 10,
        sourceType: 'builtin-github',
        versions: [],
      },
      {
        id: 'code-review-skill',
        name: 'Code Review Skill',
        description: '适用于代码审查优化',
        tags: ['code'],
        author: 'builtin',
        repoUrl: 'https://example.com',
        version: '1.0.0',
        updatedAt: '2026-07-08T00:00:00.000Z',
        promptTemplate: 'template',
        variables: [],
        triggerConditions: [],
        enabled: true,
        builtin: true,
        rating: 5,
        usageCount: 8,
        sourceType: 'builtin-github',
        versions: [],
      },
    ]),
  },
}))

vi.mock('@/core/storage/key-store', () => ({
  keyStore: {
    getDecrypted: mockRefs.getDecrypted,
    save: mockRefs.saveKey,
  },
}))

Object.assign(globalThis, {
  chrome: {
    runtime: {
      sendMessage: mockRefs.runtimeSendMessage,
      openOptionsPage: mockRefs.openOptionsPage,
    },
    permissions: {
      contains: mockRefs.permissionContains,
      request: mockRefs.permissionRequest,
    },
  },
})

describe('PopupApp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRefs.runtimeSendMessage.mockResolvedValue({ ok: true, data: { message: 'ok' } })
    mockRefs.getDecrypted.mockResolvedValue(null)
    mockRefs.saveKey.mockResolvedValue(undefined)
    mockRefs.permissionContains.mockResolvedValue(true)
    mockRefs.permissionRequest.mockResolvedValue(true)
  })

  it('renders inline api configuration, skill selector and shortcuts', async () => {
    render(<PopupApp />)

    expect(await screen.findByText('在这里选择默认 Skill')).toBeInTheDocument()
    expect(screen.getByLabelText('默认 Skill')).toBeInTheDocument()
    expect(screen.getByText('General Prompt Enhancer Skill · 适用于通用提示词优化')).toBeInTheDocument()
    expect(screen.getByText('在这里直接配置 API')).toBeInTheDocument()
    expect(screen.getByText('保存 API Key')).toBeInTheDocument()
    expect(screen.getByText('测试连接')).toBeInTheDocument()
    expect(screen.queryByText('本地口令')).not.toBeInTheDocument()
    expect(screen.queryByText('解锁当前会话')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /先追问意图/ })).toBeInTheDocument()
  })

  it('switches to clarify-first workflow inline', async () => {
    render(<PopupApp />)

    fireEvent.click(await screen.findByRole('button', { name: /先追问意图/ }))

    expect(mockRefs.settingsSet).toHaveBeenCalledWith({ enhancementWorkflow: 'clarify' })
  })

  it('updates default skill inline', async () => {
    render(<PopupApp />)

    const skillSelect = (await screen.findByLabelText('默认 Skill')) as HTMLSelectElement
    await waitFor(() => {
      expect(Array.from(skillSelect.options).some((option) => option.value === 'code-review-skill')).toBe(true)
    })

    fireEvent.change(skillSelect, { target: { value: 'code-review-skill' } })

    await waitFor(() => {
      expect(mockRefs.settingsSet).toHaveBeenCalledWith({ defaultSkillId: 'code-review-skill' })
    })
  })

  it('saves api key without local passphrase', async () => {
    render(<PopupApp />)

    const apiKeyInput = (await screen.findByLabelText('API Key')) as HTMLInputElement
    fireEvent.change(apiKeyInput, { target: { value: 'sk-test-123' } })
    fireEvent.click(screen.getByText('保存 API Key'))

    await waitFor(() => {
      expect(mockRefs.saveKey).toHaveBeenCalledWith('openai', 'sk-test-123')
    })
  })
})
