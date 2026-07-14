import { useEffect, useMemo, useState } from 'react'
import { requestProviderHostPermission } from '@/background/permissions'
import { t } from '@/core/i18n/t'
import { keyStore } from '@/core/storage/key-store'
import { providerConfigStore } from '@/core/storage/provider-config-store'
import { settingsStore } from '@/core/storage/settings-store'
import { skillStore } from '@/core/storage/skill-store'
import type { PromptSkill, ProviderServiceConfig, ProviderType, Settings } from '@/shared/types'
import { Button } from '@/ui/components/Button'
import { Field } from '@/ui/components/Field'
import { Select } from '@/ui/components/Select'

const providerOptions: Array<{ label: string; value: ProviderType }> = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'Google Gemini', value: 'gemini' },
  { label: 'Azure OpenAI', value: 'azureOpenAI' },
  { label: 'Ollama', value: 'ollama' },
  { label: 'DeepSeek', value: 'deepseek' },
  { label: 'Moonshot / Kimi', value: 'moonshot' },
  { label: 'DashScope Qwen', value: 'qwen' },
  { label: 'Zhipu GLM', value: 'zhipu' },
  { label: 'SiliconFlow', value: 'siliconflow' },
  { label: 'Volcengine Ark / Doubao', value: 'volcengine' },
  { label: 'Custom Compatible Endpoint', value: 'custom' },
]

export const PopupApp = () => {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [providerConfigs, setProviderConfigs] = useState<ProviderServiceConfig[]>([])
  const [skills, setSkills] = useState<PromptSkill[]>([])
  const [providerReady, setProviderReady] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [feedback, setFeedback] = useState('')
  const language = settings?.language ?? 'zh-CN'

  useEffect(() => {
    void Promise.resolve(chrome.runtime.sendMessage({ type: 'APE_ENSURE_CONTENT_SCRIPT' }))
      .then((result) => {
        if (result?.supported === false) {
          setFeedback(language === 'en' ? 'This site is not in the automatic support list' : '当前网站不在自动显示小球的支持列表中')
        }
      })
      .catch(() => undefined)
  }, [language])

  useEffect(() => {
    void (async () => {
      const [loadedSettings, loadedProviderConfigs, loadedSkills] = await Promise.all([
        settingsStore.get(),
        providerConfigStore.getAll(),
        skillStore.getAll(),
      ])
      setSettings(loadedSettings)
      setProviderConfigs(loadedProviderConfigs)
      setSkills(loadedSkills.filter((item) => item.enabled))
      const activeConfig = loadedProviderConfigs.find((item) => item.provider === loadedSettings.provider)
      setProviderReady(activeConfig?.authMode === 'none' || Boolean(await keyStore.getDecrypted(loadedSettings.provider)))
    })()
  }, [])

  const currentConfig = useMemo(
    () => providerConfigs.find((item) => item.provider === settings?.provider),
    [providerConfigs, settings?.provider],
  )

  const selectedSkill = useMemo(
    () => skills.find((item) => item.id === settings?.defaultSkillId) ?? null,
    [skills, settings?.defaultSkillId],
  )

  const statusText = useMemo(
    () => (providerReady ? t(language, 'providerReady') : t(language, 'providerLocked')),
    [language, providerReady],
  )

  const helpTitle = language === 'en' ? 'What is this page for?' : '此页面做什么？'
  const helpBody =
    language === 'en'
      ? 'This popup can directly configure API access for the current Provider, choose the default Skill, and quickly open Settings or the Prompt Library.'
      : '这个弹窗可以直接配置当前 Provider 的 API 信息，也可以选择默认 Skill，并快速打开设置页和提示词库。常用场景下不用再专门跳去设置页。'

  const patchProvider = async (provider: ProviderType) => {
    const next = await settingsStore.set({ provider })
    setSettings(next)
    const nextConfig = providerConfigs.find((item) => item.provider === provider)
    setProviderReady(nextConfig?.authMode === 'none' || Boolean(await keyStore.getDecrypted(provider)))
    setFeedback(language === 'en' ? 'Provider switched' : '已切换 Provider')
  }

  const patchDefaultSkill = async (skillId: string) => {
    const next = await settingsStore.set({ defaultSkillId: skillId || undefined })
    setSettings(next)
    setFeedback(
      skillId
        ? language === 'en'
          ? 'Default Skill updated'
          : '默认 Skill 已更新'
        : language === 'en'
          ? 'Default Skill cleared'
          : '已清空默认 Skill',
    )
  }

  const patchWorkflow = async (enhancementWorkflow: Settings['enhancementWorkflow']) => {
    const next = await settingsStore.set({ enhancementWorkflow })
    setSettings(next)
    setFeedback(
      enhancementWorkflow === 'clarify'
        ? language === 'en'
          ? 'Clarify-first mode enabled'
          : '已启用追问模式：先确认意图，再生成提示词'
        : language === 'en'
          ? 'Direct enhancement enabled'
          : '已启用直接增强模式',
    )
  }

  const saveKey = async () => {
    if (!settings) return
    if (!(await requestProviderHostPermission(currentConfig?.baseUrl ?? ''))) {
      setFeedback(language === 'en' ? 'API endpoint permission was denied' : '未授权访问当前 API 端点')
      return
    }
    if (currentConfig?.authMode === 'none') {
      setProviderReady(true)
      setFeedback(language === 'en' ? 'This Provider does not require an API Key' : '当前 Provider 配置为无需 API Key')
      return
    }
    if (!apiKey.trim()) {
      setFeedback(language === 'en' ? 'Please enter API Key first' : '请先填写 API Key')
      return
    }
    await keyStore.save(settings.provider, apiKey.trim())
    setApiKey('')
    setProviderReady(true)
    setFeedback(
      language === 'en'
        ? 'API Key saved locally and available now'
        : 'API Key 已本地保存，当前会话可直接使用',
    )
  }

  const testConnection = async () => {
    if (!settings) return
    if (!(await requestProviderHostPermission(currentConfig?.baseUrl ?? ''))) {
      setFeedback(language === 'en' ? 'API endpoint permission was denied' : '未授权访问当前 API 端点，无法测试连接')
      return
    }
    const result = (await chrome.runtime.sendMessage({
      type: 'APE_TEST_PROVIDER',
      provider: settings.provider,
    })) as { ok: boolean; data?: { message: string }; error?: { message: string } }
    setFeedback(
      result.ok
        ? result.data?.message ?? (language === 'en' ? 'Connection OK' : '测试完成')
        : result.error?.message ?? (language === 'en' ? 'Connection failed' : '测试失败'),
    )
  }

  const providerLabel = 'Provider'
  const apiKeyLabel = currentConfig?.authMode === 'none' ? 'API Key（无需填写）' : 'API Key'
  const modelLabel = language === 'en' ? 'Current model' : '当前模型'
  const endpointLabel = language === 'en' ? 'Endpoint' : '端点'
  const skillLabel = language === 'en' ? 'Default Skill' : '默认 Skill'
  const skillDescription =
    language === 'en'
      ? 'Choose which Skill is used by default when enhancing prompts on web pages.'
      : '选择网页增强时默认使用的 Skill。若不选择，则按系统默认逻辑处理。'
  const apiSectionTitle = language === 'en' ? 'Configure API here' : '在这里直接配置 API'
  const skillSectionTitle = language === 'en' ? 'Choose default Skill' : '在这里选择默认 Skill'
  const saveKeyText = language === 'en' ? 'Save API Key' : '保存 API Key'
  const testText = language === 'en' ? 'Test Connection' : '测试连接'
  const openSettingsText = language === 'en' ? 'Open Settings' : '打开设置'
  const openLibraryText = language === 'en' ? 'Open Prompt Library' : '打开提示词库'
  const quickEntryTitle = language === 'en' ? 'More' : '更多入口'
  const feedbackTitle = language === 'en' ? 'Status' : '状态反馈'
  const noSkillText = language === 'en' ? 'No Skill (use default logic)' : '不使用 Skill（走默认逻辑）'
  const currentSkillText = language === 'en' ? 'Current selection' : '当前选择'
  const workflowTitle = language === 'en' ? 'How should enhancement start?' : '增强前，先了解意图吗？'
  const workflowBody = language === 'en'
    ? 'Direct mode rewrites immediately. Clarify-first mode asks only the missing questions that materially affect the result.'
    : '直接增强适合目标明确的请求；追问模式会先询问真正影响结果的目标、约束和交付标准。'

  return (
    <div className="popup-shell">
      <div className="card popup-card popup-surface">
        <div className="page-header" style={{ marginBottom: 12 }}>
          <div className="brand-lockup">
            <div className="brand-mark">✦</div>
            <div>
            <h1 className="page-title" style={{ fontSize: 20 }}>
              {t(language, 'popupTitle')}
            </h1>
            <div className="page-subtitle">{t(language, 'popupSubtitle')}</div>
            </div>
          </div>
          <span className="status-pill">
            <span className={`status-dot ${providerReady ? '' : 'warn'}`.trim()} />
            {statusText}
          </span>
        </div>

        <section className="workflow-card" style={{ marginBottom: 14 }}>
          <div className="workflow-copy">
            <div className="eyebrow">Enhancement flow</div>
            <h2>{workflowTitle}</h2>
            <p>{workflowBody}</p>
          </div>
          <div className="workflow-segment" role="group" aria-label={workflowTitle}>
            <button
              type="button"
              data-active={settings?.enhancementWorkflow !== 'clarify'}
              onClick={() => void patchWorkflow('direct')}
            >
              <strong>⚡ {language === 'en' ? 'Direct' : '直接增强'}</strong>
              <span>{language === 'en' ? 'Fastest' : '目标明确时更快'}</span>
            </button>
            <button
              type="button"
              data-active={settings?.enhancementWorkflow === 'clarify'}
              onClick={() => void patchWorkflow('clarify')}
            >
              <strong>◌ {language === 'en' ? 'Clarify first' : '先追问意图'}</strong>
              <span>{language === 'en' ? 'More accurate' : '模糊需求更准确'}</span>
            </button>
          </div>
        </section>

        <div className="page-help" style={{ marginBottom: 14 }}>
          <div className="page-help-title">{helpTitle}</div>
          <div className="page-help-body">{helpBody}</div>
        </div>

        <section className="card section-card" style={{ marginBottom: 14, padding: 14 }}>
          <h2 className="section-title" style={{ marginBottom: 12 }}>
            {skillSectionTitle}
          </h2>

          <Field label={skillLabel}>
            <Select value={settings?.defaultSkillId ?? ''} onChange={(event) => void patchDefaultSkill(event.target.value)}>
              <option value="">{noSkillText}</option>
              {skills.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="page-help" style={{ marginTop: 12, marginBottom: 0 }}>
            <div className="page-help-title">{currentSkillText}</div>
            <div className="page-help-body">{selectedSkill ? `${selectedSkill.name} · ${selectedSkill.description}` : skillDescription}</div>
          </div>
        </section>

        <section className="card section-card" style={{ marginBottom: 14, padding: 14 }}>
          <h2 className="section-title" style={{ marginBottom: 12 }}>
            {apiSectionTitle}
          </h2>

          <Field label={providerLabel}>
            <Select value={settings?.provider ?? 'openai'} onChange={(event) => void patchProvider(event.target.value as ProviderType)}>
              {providerOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid-2" style={{ marginTop: 12 }}>
            <Field label={modelLabel}>
              <input className="input" value={currentConfig?.model ?? ''} disabled />
            </Field>
            <Field label={endpointLabel}>
              <input className="input" value={currentConfig?.baseUrl ?? ''} disabled />
            </Field>
          </div>

          <div style={{ marginTop: 12 }}>
            <Field label={apiKeyLabel}>
              <input
                className="input"
                type="password"
                value={apiKey}
                disabled={currentConfig?.authMode === 'none'}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={
                  currentConfig?.authMode === 'none'
                    ? language === 'en' ? 'No API Key required' : '当前端点无需认证'
                    : language === 'en' ? 'Saved locally only' : '仅本地加密保存'
                }
              />
            </Field>
          </div>

          <div className="button-row" style={{ marginTop: 12 }}>
            <Button variant="primary" disabled={currentConfig?.authMode === 'none'} onClick={() => void saveKey()}>
              {saveKeyText}
            </Button>
            <Button onClick={() => void testConnection()}>{testText}</Button>
          </div>

          <div className="page-help" style={{ marginTop: 12, marginBottom: 0 }}>
            <div className="page-help-title">{feedbackTitle}</div>
            <div className="page-help-body">{feedback || (language === 'en' ? 'No action yet' : '还没有执行操作')}</div>
          </div>
        </section>

        <section className="card section-card" style={{ padding: 14 }}>
          <h2 className="section-title" style={{ marginBottom: 12 }}>
            {quickEntryTitle}
          </h2>
          <div style={{ display: 'grid', gap: 10 }}>
            <Button
              variant="secondary"
              onClick={() => {
                chrome.runtime.openOptionsPage()
                window.close()
              }}
            >
              {openSettingsText}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                void chrome.runtime.sendMessage({ type: 'APE_OPEN_SIDE_PANEL' })
                window.close()
              }}
            >
              {openLibraryText}
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
