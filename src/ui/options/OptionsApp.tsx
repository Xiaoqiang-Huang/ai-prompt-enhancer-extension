import { useEffect, useMemo, useState } from 'react'
import { requestProviderHostPermission } from '@/background/permissions'
import { historyStore } from '@/core/storage/history-store'
import { keyStore } from '@/core/storage/key-store'
import { providerConfigStore } from '@/core/storage/provider-config-store'
import { ruleStore } from '@/core/storage/rule-store'
import { savedPromptStore } from '@/core/storage/saved-prompt-store'
import { settingsStore } from '@/core/storage/settings-store'
import { skillStore } from '@/core/storage/skill-store'
import { templateStore } from '@/core/storage/template-store'
import type {
  AppExportBundle,
  EnhanceMode,
  LanguageCode,
  PromptSkill,
  ProviderServiceConfig,
  ProviderType,
  Settings,
} from '@/shared/types'
import { Button } from '@/ui/components/Button'
import { Field } from '@/ui/components/Field'
import { Select } from '@/ui/components/Select'
import { Switch } from '@/ui/components/Switch'
import { Toast } from '@/ui/components/Toast'

const modeOptions: Array<{ label: string; value: EnhanceMode }> = [
  { label: '简洁', value: 'concise' },
  { label: '详细', value: 'detailed' },
  { label: '分步骤', value: 'stepByStep' },
  { label: '编程', value: 'coding' },
  { label: '商业', value: 'business' },
  { label: '英文优化', value: 'english' },
]

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

const languageOptions: Array<{ label: string; value: LanguageCode }> = [
  { label: '中文', value: 'zh-CN' },
  { label: 'English', value: 'en' },
]

export const OptionsApp = () => {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [providerConfigs, setProviderConfigs] = useState<ProviderServiceConfig[]>([])
  const [skills, setSkills] = useState<PromptSkill[]>([])
  const [apiKey, setApiKey] = useState('')
  const [toast, setToast] = useState('')

  const refresh = async () => {
    const [nextSettings, nextConfigs, nextSkills] = await Promise.all([
      settingsStore.get(),
      providerConfigStore.getAll(),
      skillStore.getAll(),
    ])
    setSettings(nextSettings)
    setProviderConfigs(nextConfigs)
    setSkills(nextSkills.filter((item) => item.enabled))
  }

  useEffect(() => {
    void refresh()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.location.hash === '#provider-settings') {
      window.setTimeout(() => {
        document.getElementById('provider-settings')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 60)
    }
  }, [settings])

  const currentConfig = useMemo(
    () => providerConfigs.find((item) => item.provider === settings?.provider),
    [providerConfigs, settings?.provider],
  )

  const patchSettings = async (patch: Partial<Settings>) => {
    const next = await settingsStore.set(patch)
    setSettings(next)
    setToast('设置已保存')
  }

  const patchProviderConfig = async (patch: Partial<ProviderServiceConfig>) => {
    if (!currentConfig) return
    const next = { ...currentConfig, ...patch }
    const saved = await providerConfigStore.save(next)
    setProviderConfigs(saved)
    setToast('Provider 高级设置已保存')
  }

  const saveKey = async () => {
    if (!settings) return
    if (!(await requestProviderHostPermission(currentConfig?.baseUrl ?? ''))) {
      setToast('未授权访问当前 API 端点，请允许该站点权限后重试')
      return
    }
    if (currentConfig?.authMode === 'none') {
      setToast('API 端点权限已授权；当前 Provider 无需 API Key，可直接测试连接')
      return
    }
    if (!apiKey.trim()) {
      setToast('请先填写 API Key')
      return
    }
    await keyStore.save(settings.provider, apiKey.trim())
    setApiKey('')
    setToast('API Key 已本地加密保存，当前会话可直接使用')
  }

  const testConnection = async () => {
    if (!settings) return
    if (!(await requestProviderHostPermission(currentConfig?.baseUrl ?? ''))) {
      setToast('未授权访问当前 API 端点，无法测试连接')
      return
    }
    const result = (await chrome.runtime.sendMessage({
      type: 'APE_TEST_PROVIDER',
      provider: settings.provider,
    })) as { ok: boolean; data?: { message: string }; error?: { message: string } }
    setToast(result.ok ? (result.data?.message ?? '测试完成') : (result.error?.message ?? '测试失败'))
  }

  const exportData = async () => {
    if (!settings) return
    const bundle: AppExportBundle = {
      exportedAt: new Date().toISOString(),
      version: '0.2.0',
      settings,
      providerConfigs,
      templates: await templateStore.getAll(),
      skills: await skillStore.getAll(),
      rules: await ruleStore.getAll(),
      savedPrompts: await savedPromptStore.getAll(),
      history: await historyStore.getAll(),
    }
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'ai-prompt-enhancer-export.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const clearData = async () => {
    await historyStore.clear()
    setToast('历史记录已清空')
  }

  if (!settings || !currentConfig) return null

  return (
    <div className="app-shell options-shell">
      <div className="page-header product-hero">
        <div className="brand-lockup">
          <div className="brand-mark brand-mark-large">✦</div>
          <div>
          <div className="eyebrow">Local prompt workspace</div>
          <h1 className="page-title">AI Prompt Enhancer</h1>
          <div className="page-subtitle">
            不只改写文字：先理解意图，再用你选择的 Skill 和模型构建可执行提示词。
          </div>
          </div>
        </div>
        <span className="status-pill">
          <span className="status-dot" />
          本地配置中心
        </span>
      </div>

      <section className="card section-card" style={{ marginBottom: 16 }}>
        <h2 className="section-title">此页面怎么用</h2>
        <div className="page-help-body">
          推荐顺序：先选择 Provider → 填 API Key 并保存 → 选择默认 Skill → 调整绿色小球行为 → 回到网页体验增强。
        </div>
      </section>

      <section className="workflow-card workflow-card-wide" style={{ marginBottom: 16 }}>
        <div className="workflow-copy">
          <div className="eyebrow">Default workflow</div>
          <h2>选择默认增强路径</h2>
          <p>目标清楚时直接增强；需求模糊、交付重要或约束较多时，先通过一到多轮追问确认意图。</p>
        </div>
        <div className="workflow-segment workflow-segment-wide" role="group" aria-label="默认增强路径">
          <button
            type="button"
            data-active={settings.enhancementWorkflow === 'direct'}
            onClick={() => void patchSettings({ enhancementWorkflow: 'direct' })}
          >
            <strong>⚡ 直接增强</strong>
            <span>一次生成，适合目标明确的日常请求</span>
          </button>
          <button
            type="button"
            data-active={settings.enhancementWorkflow === 'clarify'}
            onClick={() => void patchSettings({ enhancementWorkflow: 'clarify' })}
          >
            <strong>◌ 追问模式</strong>
            <span>先确认目标、场景、约束与验收标准</span>
          </button>
        </div>
      </section>

      <div className="grid-2">
        <div className="panel-stack">
          <section id="provider-settings" className="card section-card">
            <h2 className="section-title">Provider 与高级参数</h2>
            <div className="grid-2">
              <Field label="默认 Provider">
                <Select value={settings.provider} onChange={(event) => void patchSettings({ provider: event.target.value as ProviderType })}>
                  {providerOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="默认优化模式">
                <Select value={settings.defaultMode} onChange={(event) => void patchSettings({ defaultMode: event.target.value as EnhanceMode })}>
                  {modeOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid-2" style={{ marginTop: 16 }}>
              <Field label="默认 Skill">
                <Select value={settings.defaultSkillId ?? ''} onChange={(event) => void patchSettings({ defaultSkillId: event.target.value || undefined })}>
                  <option value="">不使用 Skill</option>
                  {skills.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="当前 Provider 预置模型数">
                <input className="input" value={String(currentConfig.models.length)} disabled />
              </Field>
            </div>

            <div className="grid-2" style={{ marginTop: 16 }}>
              <Field label="基础 URL / 端点">
                <input className="input" value={currentConfig.baseUrl} onChange={(event) => void patchProviderConfig({ baseUrl: event.target.value })} />
              </Field>
              <Field label="当前模型">
                <input className="input" value={currentConfig.model} onChange={(event) => void patchProviderConfig({ model: event.target.value })} />
              </Field>
            </div>

            <div className="grid-2" style={{ marginTop: 16 }}>
              <Field label="认证方式">
                <Select
                  value={currentConfig.authMode}
                  onChange={(event) =>
                    void patchProviderConfig({
                      authMode: event.target.value as ProviderServiceConfig['authMode'],
                    })
                  }
                >
                  <option value="bearer">Bearer Token（OpenAI 兼容）</option>
                  <option value="api-key">API Key Header</option>
                  <option value="x-api-key">X-API-Key Header</option>
                  <option value="query-key">URL Query Key（Gemini）</option>
                  <option value="none">无需认证（Ollama / 本地服务）</option>
                </Select>
              </Field>
              <Field label="自定义 Key Header">
                <input
                  className="input"
                  value={currentConfig.apiKeyHeader ?? ''}
                  disabled={!['api-key', 'x-api-key'].includes(currentConfig.authMode)}
                  onChange={(event) => void patchProviderConfig({ apiKeyHeader: event.target.value })}
                  placeholder={currentConfig.authMode === 'x-api-key' ? 'x-api-key' : 'api-key'}
                />
              </Field>
            </div>

            <div className="grid-2" style={{ marginTop: 16 }}>
              <Field label="可用模型列表（逗号分隔）">
                <input
                  className="input"
                  value={currentConfig.models.join(', ')}
                  onChange={(event) =>
                    void patchProviderConfig({
                      models: event.target.value
                        .split(',')
                        .map((item) => item.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </Field>
              <Field label="API Key">
                <input
                  className="input"
                  type="password"
                  value={apiKey}
                  disabled={currentConfig.authMode === 'none'}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={currentConfig.authMode === 'none' ? '当前端点无需认证' : '仅本地加密保存'}
                />
              </Field>
            </div>

            <div className="grid-2" style={{ marginTop: 16 }}>
              <Field label="Temperature">
                <input className="input" type="number" step="0.1" min="0" max="2" value={currentConfig.temperature} onChange={(event) => void patchProviderConfig({ temperature: Number(event.target.value) || 0 })} />
              </Field>
              <Field label="最大输出 Token 数（建议 4096+）">
                <input className="input" type="number" min="128" value={currentConfig.maxTokens} onChange={(event) => void patchProviderConfig({ maxTokens: Number(event.target.value) || 4096 })} />
              </Field>
            </div>

            <div className="grid-2" style={{ marginTop: 16 }}>
              <Field label="超时时间（ms）">
                <input className="input" type="number" min="1000" value={currentConfig.timeoutMs} onChange={(event) => void patchProviderConfig({ timeoutMs: Number(event.target.value) || 90000 })} />
              </Field>
              <Field label="重试次数">
                <input className="input" type="number" min="0" max="5" value={currentConfig.retryCount} onChange={(event) => void patchProviderConfig({ retryCount: Number(event.target.value) || 0 })} />
              </Field>
            </div>

            <div className="page-help" style={{ marginTop: 16 }}>
              <div className="page-help-title">第三方 API 兼容策略</div>
              <div className="page-help-body">
                调用失败时会自动尝试端点补全、流式/非流式、max_tokens/max_completion_tokens、移除 Temperature、合并 System 消息等兼容模式。测试连接现在会真实调用当前模型，而不是只检查 Key 是否存在。
              </div>
            </div>

            <div className="grid-2" style={{ marginTop: 16 }}>
              <Field label="按场景指定默认 Provider">
                <Select
                  value={settings.modeProviderStrategy[settings.defaultMode] ?? settings.provider}
                  onChange={(event) =>
                    void patchSettings({
                      modeProviderStrategy: {
                        ...settings.modeProviderStrategy,
                        [settings.defaultMode]: event.target.value as ProviderType,
                      },
                    })
                  }
                >
                  {providerOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="button-row" style={{ marginTop: 16 }}>
              <Button variant="primary" onClick={() => void saveKey()}>保存 API Key</Button>
              <Button onClick={() => void testConnection()}>测试连接</Button>
            </div>
          </section>

          <section className="card section-card">
            <h2 className="section-title">输出语言与策略</h2>
            <div className="grid-2">
              <Field label="界面语言">
                <Select value={settings.language} onChange={(event) => void patchSettings({ language: event.target.value as LanguageCode })}>
                  {languageOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="优化结果语言">
                <Select
                  value={settings.outputLanguagePolicy}
                  onChange={(event) => void patchSettings({ outputLanguagePolicy: event.target.value as Settings['outputLanguagePolicy'] })}
                >
                  <option value="followInput">跟随输入</option>
                  <option value="zh-CN">固定中文</option>
                  <option value="en">固定英文</option>
                </Select>
              </Field>
            </div>
          </section>
        </div>

        <div className="panel-stack">
          <section className="card section-card">
            <h2 className="section-title">绿色加速小球</h2>
            <div className="switch-row">
              <div>
                <div className="field-label">显示主增强小球</div>
                <div className="inline-note">点击主小球会直接执行提示词增强，不再先弹出大面板。</div>
              </div>
              <Switch
                checked={settings.launcher.enabled}
                onChange={(next) => void patchSettings({ launcher: { ...settings.launcher, enabled: next } })}
              />
            </div>

            <div className="switch-row">
              <div>
                <div className="field-label">显示 3 个功能小球</div>
                <div className="inline-note">在主小球旁显示导出、保存、提示词库 3 个功能小球；关闭后只保留主增强小球。</div>
              </div>
              <Switch
                checked={settings.launcher.secondaryActionsEnabled}
                onChange={(next) =>
                  void patchSettings({ launcher: { ...settings.launcher, secondaryActionsEnabled: next } })
                }
              />
            </div>

            <div className="grid-2" style={{ marginTop: 16 }}>
              <Field label="位置">
                <Select
                  value={settings.launcher.position}
                  onChange={(event) =>
                    void patchSettings({ launcher: { ...settings.launcher, position: event.target.value as Settings['launcher']['position'] } })
                  }
                >
                  <option value="above">上方（推荐）</option>
                  <option value="left">左侧</option>
                  <option value="right">右侧</option>
                  <option value="floating">浮动</option>
                </Select>
              </Field>
              <Field label="颜色">
                <input className="input" value={settings.launcher.color} onChange={(event) => void patchSettings({ launcher: { ...settings.launcher, color: event.target.value } })} />
              </Field>
            </div>

            <div className="grid-2" style={{ marginTop: 16 }}>
              <Field label="尺寸（px）">
                <input className="input" type="number" min="16" max="48" value={settings.launcher.size} onChange={(event) => void patchSettings({ launcher: { ...settings.launcher, size: Number(event.target.value) || 24 } })} />
              </Field>
              <Field label="透明度（0-1）">
                <input className="input" type="number" step="0.05" min="0.1" max="1" value={settings.launcher.opacity} onChange={(event) => void patchSettings({ launcher: { ...settings.launcher, opacity: Number(event.target.value) || 1 } })} />
              </Field>
            </div>
          </section>

          <section className="card section-card">
            <h2 className="section-title">历史记录与隐私</h2>
            <div className="switch-row">
              <div>
                <div className="field-label">启用本地历史</div>
                <div className="inline-note">保存增强结果、模型、参数、Skill 与时间等元信息，便于回溯与复用。</div>
              </div>
              <Switch checked={settings.historyEnabled} onChange={(next) => void patchSettings({ historyEnabled: next })} />
            </div>

            <div className="switch-row">
              <div>
                <div className="field-label">保存原始输入（脱敏后）</div>
                <div className="inline-note">关闭后仅保留优化结果与元信息，不再保存原始文本。</div>
              </div>
              <Switch checked={settings.storeSourceText} onChange={(next) => void patchSettings({ storeSourceText: next })} />
            </div>

            <div className="switch-row">
              <div>
                <div className="field-label">显式触发</div>
                <div className="inline-note">不会自动替换输入，必须先展示对比并由用户确认。</div>
              </div>
              <Switch checked={settings.explicitTriggerOnly} onChange={(next) => void patchSettings({ explicitTriggerOnly: next })} />
            </div>

            <div className="switch-row">
              <div>
                <div className="field-label">敏感信息检测</div>
                <div className="inline-note">检测到密码、API Key、JWT 等内容时阻止增强。</div>
              </div>
              <Switch checked={settings.detectSensitiveText} onChange={(next) => void patchSettings({ detectSensitiveText: next })} />
            </div>

            <Field label="历史上限">
              <input className="input" type="number" min={50} max={1000} value={settings.historyLimit} onChange={(event) => void patchSettings({ historyLimit: Number(event.target.value) || 200 })} />
            </Field>

            <div className="button-row" style={{ marginTop: 16 }}>
              <Button onClick={() => void exportData()}>导出数据</Button>
              <Button variant="danger" onClick={() => void clearData()}>清空历史</Button>
            </div>
          </section>
        </div>
      </div>

      <Toast message={toast} />
    </div>
  )
}
