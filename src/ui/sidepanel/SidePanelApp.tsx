import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { importSkillsFromGithubUrl } from '@/core/skills/github-import'
import { parseSkillTextMany } from '@/core/skills/skill-parser'
import { historyStore } from '@/core/storage/history-store'
import { ruleStore } from '@/core/storage/rule-store'
import { savedPromptStore } from '@/core/storage/saved-prompt-store'
import { skillStore } from '@/core/storage/skill-store'
import { templateStore } from '@/core/storage/template-store'
import type { HistoryItem, PromptSkill, SavedPrompt, Template, UserRule } from '@/shared/types'
import { Button } from '@/ui/components/Button'
import { Field } from '@/ui/components/Field'
import { Select } from '@/ui/components/Select'
import { Textarea } from '@/ui/components/Textarea'

type TabKey = 'history' | 'templates' | 'rules' | 'skills' | 'prompts'

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const highlight = (text: string, query: string): ReactNode => {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) return text
  const matcher = new RegExp(`(${escapeRegExp(trimmedQuery)})`, 'gi')
  return text.split(matcher).map((part, index) =>
    part.toLowerCase() === trimmedQuery.toLowerCase() ? <mark key={`${part}-${index}`}>{part}</mark> : part,
  )
}

export const SidePanelApp = () => {
  const [tab, setTab] = useState<TabKey>('history')
  const [query, setQuery] = useState('')
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [rules, setRules] = useState<UserRule[]>([])
  const [skills, setSkills] = useState<PromptSkill[]>([])
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([])
  const [draftTitle, setDraftTitle] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [skillImportSource, setSkillImportSource] = useState('')
  const [skillImportMode, setSkillImportMode] = useState<'github' | 'paste'>('github')
  const [skillSort, setSkillSort] = useState<'updated' | 'usage' | 'rating'>('updated')
  const [skillTag, setSkillTag] = useState('all')
  const [conflictStrategy, setConflictStrategy] = useState<'overwrite' | 'rename' | 'skip'>('rename')
  const [selectedSkillId, setSelectedSkillId] = useState<string>('')

  const refresh = useCallback(async () => {
    const [nextHistory, nextTemplates, nextRules, nextSkills, nextSavedPrompts] = await Promise.all([
      historyStore.getAll(),
      templateStore.getAll(),
      ruleStore.getAll(),
      skillStore.getAll(),
      savedPromptStore.getAll(),
    ])
    setHistory(nextHistory)
    setTemplates(nextTemplates)
    setRules(nextRules)
    setSkills(nextSkills)
    setSavedPrompts(nextSavedPrompts)
    if (!selectedSkillId && nextSkills[0]) {
      setSelectedSkillId(nextSkills[0].id)
    }
  }, [selectedSkillId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const filteredHistory = useMemo(
    () =>
      history.filter((item) =>
        [item.hostname, item.enhancedText, item.sourceText, item.model ?? '', item.skillId ?? '']
          .join(' ')
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [history, query],
  )

  const filteredSavedPrompts = useMemo(
    () =>
      savedPrompts.filter((item) =>
        [item.title, item.content, item.category, item.tags.join(' '), item.note ?? '', item.hostname ?? '']
          .join(' ')
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [savedPrompts, query],
  )

  const availableTags = useMemo(
    () => ['all', ...new Set(skills.flatMap((item) => item.tags))],
    [skills],
  )

  const filteredSkills = useMemo(() => {
    const base = skills.filter((item) => {
      const matchesQuery = [item.name, item.description, item.tags.join(' '), item.author]
        .join(' ')
        .toLowerCase()
        .includes(query.toLowerCase())
      const matchesTag = skillTag === 'all' ? true : item.tags.includes(skillTag)
      return matchesQuery && matchesTag
    })

    return [...base].sort((a, b) => {
      if (skillSort === 'usage') return b.usageCount - a.usageCount
      if (skillSort === 'rating') return b.rating - a.rating
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
  }, [skills, query, skillSort, skillTag])

  const selectedSkill = useMemo(
    () => skills.find((item) => item.id === selectedSkillId) ?? null,
    [skills, selectedSkillId],
  )

  const tabHelp = useMemo(() => {
    const helpMap: Record<TabKey, { title: string; body: string }> = {
      history: {
        title: '历史记录',
        body: '查看每次增强使用的 Provider、模型、Skill 和结果，可用于回溯、对比和复用。',
      },
      templates: {
        title: '提示词模板库',
        body: '这里内置了一批热门实用模板，可直接复制、编辑或作为你自己的提示词起点。',
      },
      rules: {
        title: '规则库',
        body: '给所有增强过程追加固定规则，例如输出格式、语气要求、禁用事项等。',
      },
      skills: {
        title: 'Skill 库',
        body: '管理内置与自定义 Skill，可搜索、筛选、编辑、导入，并在设置页设为默认 Skill。',
      },
      prompts: {
        title: '个人提示词库',
        body: '保存你手动积累的好提示词，支持搜索、复制和复用，不会和模板库混用。',
      },
    }
    return helpMap[tab]
  }, [tab])

  const createTemplate = async () => {
    if (!draftTitle || !draftBody) return
    await templateStore.save({
      id: crypto.randomUUID(),
      title: draftTitle,
      description: '用户自定义模板',
      category: '自定义',
      mode: 'detailed',
      content: draftBody,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    setDraftTitle('')
    setDraftBody('')
    await refresh()
  }

  const createRule = async () => {
    if (!draftTitle || !draftBody) return
    await ruleStore.save({
      id: crypto.randomUUID(),
      title: draftTitle,
      content: draftBody,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    setDraftTitle('')
    setDraftBody('')
    await refresh()
  }

  const resolveConflict = (incoming: PromptSkill, existingList: PromptSkill[]): PromptSkill | null => {
    const conflict = existingList.find((item) => item.id === incoming.id || item.name === incoming.name)
    if (!conflict) return incoming
    if (conflictStrategy === 'skip') return null
    if (conflictStrategy === 'overwrite') {
      return {
        ...incoming,
        versions: [...conflict.versions, ...incoming.versions],
      }
    }
    const suffix = crypto.randomUUID().slice(0, 8)
    return {
      ...incoming,
      id: `${incoming.id}-${suffix}`,
      name: `${incoming.name} (imported)`,
    }
  }

  const commitImportedSkills = async (incomingSkills: PromptSkill[]) => {
    let workingList = skills
    let importedCount = 0
    for (const incoming of incomingSkills) {
      const resolved = resolveConflict(incoming, workingList)
      if (!resolved) continue
      await skillStore.save(resolved)
      workingList = [...workingList.filter((item) => item.id !== resolved.id), resolved]
      importedCount += 1
    }
    if (importedCount > 0) {
      alert(`已导入 ${importedCount} 个 Skill`)
    }
    await refresh()
  }

  const importSkill = async () => {
    try {
      const imported =
        skillImportMode === 'github'
          ? await importSkillsFromGithubUrl(skillImportSource)
          : parseSkillTextMany(skillImportSource, 'paste')
      await commitImportedSkills(imported)
      setSkillImportSource('')
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error))
    }
  }

  const importSkillFromFile = async (file: File) => {
    try {
      const text = await file.text()
      const parsed = parseSkillTextMany(text, 'upload')
      await commitImportedSkills(parsed)
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error))
    }
  }

  const saveEditedSkill = async (patch: Partial<PromptSkill>) => {
    if (!selectedSkill) return
    await skillStore.save({ ...selectedSkill, ...patch, updatedAt: new Date().toISOString() })
    await refresh()
  }

  const rollbackSkillVersion = async (versionId: string) => {
    if (!selectedSkill) return
    const target = selectedSkill.versions.find((item) => item.versionId === versionId)
    if (!target) return
    await skillStore.save({
      ...selectedSkill,
      version: target.version,
      promptTemplate: target.promptTemplate,
      description: target.description,
      variables: target.variables,
      triggerConditions: target.triggerConditions,
      intentRequirements: target.intentRequirements ?? selectedSkill.intentRequirements,
      updatedAt: new Date().toISOString(),
    })
    await refresh()
  }

  return (
    <div className="app-shell sidepanel-shell">
      <div className="page-header asset-hero">
        <div className="brand-lockup">
          <div className="brand-mark">库</div>
          <div>
          <div className="eyebrow">Prompt assets</div>
          <h1 className="page-title">Prompt 资产中心</h1>
          <div className="page-subtitle">把历史、模板、个人提示词、规则和 Skill 组织成可复用资产。</div>
          </div>
        </div>
      </div>

      <div className="tab-row">
        {[
          ['history', '历史'],
          ['templates', '模板'],
          ['prompts', '提示词库'],
          ['rules', '规则'],
          ['skills', 'Skills'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`tab ${tab === value ? 'active' : ''}`.trim()}
            onClick={() => setTab(value as TabKey)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="page-help" style={{ marginBottom: 16 }}>
        <div className="page-help-title">{tabHelp.title}</div>
        <div className="page-help-body">{tabHelp.body}</div>
      </div>

      {(tab === 'history' || tab === 'skills' || tab === 'prompts') && (
        <div className="search-row">
          <input
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              tab === 'history'
                ? '搜索域名、模型、Skill、原始提示词、优化结果'
                : tab === 'prompts'
                  ? '搜索标题、内容、标签、分类、备注'
                  : '搜索 Skill 名称、描述、标签、作者'
            }
          />
        </div>
      )}

      {tab === 'history' ? (
        <section className="card section-card">
          <div className="table-list">
            {filteredHistory.map((item) => (
              <article className="list-item" key={item.id}>
                <div className="list-item-header">
                  <div>
                    <h3 className="list-item-title">{item.hostname || '未知来源'}</h3>
                    <div className="list-item-meta">
                      {item.workflow === 'clarify' ? '追问模式' : '直接增强'} · {item.mode} · {item.providerLabel ?? item.provider} · {item.model ?? 'unknown model'} ·{' '}
                      {new Date(item.createdAt).toLocaleString('zh-CN')}
                    </div>
                  </div>
                  <div className="button-row">
                    <Button onClick={() => void navigator.clipboard.writeText(item.enhancedText)}>复制结果</Button>
                    <Button variant="danger" onClick={() => void historyStore.remove(item.id).then(refresh)}>
                      删除
                    </Button>
                  </div>
                </div>
                {item.sourceText ? (
                  <div className="list-item-body" style={{ marginBottom: 10 }}>
                    <strong>原始提示词：</strong>
                    {'\n'}
                    {item.sourceText}
                  </div>
                ) : null}
                <div className="list-item-body">
                  <strong>优化后提示词：</strong>
                  {'\n'}
                  {item.enhancedText}
                </div>
                <div className="inline-note">
                  Skill：{item.skillId ?? '未指定'} ｜ 温度：{item.temperature ?? '-'} ｜ Max Tokens：{item.maxTokens ?? '-'}
                  ｜ 已采纳：{item.adopted ? '是' : '否'}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {tab === 'prompts' ? (
        <section className="card section-card">
          <div className="table-list">
            {filteredSavedPrompts.map((item) => (
              <article className="list-item" key={item.id}>
                <div className="list-item-header">
                  <div>
                    <h3 className="list-item-title">{item.title}</h3>
                    <div className="list-item-meta">
                      {item.category} · {item.hostname ?? '未知来源'} · {new Date(item.createdAt).toLocaleString('zh-CN')}
                    </div>
                  </div>
                  <div className="button-row">
                    <Button
                      onClick={() =>
                        void navigator.clipboard.writeText(item.content).then(() => savedPromptStore.incrementUsage(item.id).then(refresh))
                      }
                    >
                      复制
                    </Button>
                    <Button variant="danger" onClick={() => void savedPromptStore.remove(item.id).then(refresh)}>
                      删除
                    </Button>
                  </div>
                </div>
                <div className="list-item-body">{item.content}</div>
                <div className="inline-note">
                  标签：{item.tags.join(', ') || '无'} ｜ 备注：{item.note || '无'} ｜ 使用次数：{item.usageCount}
                </div>
              </article>
            ))}
            {filteredSavedPrompts.length === 0 ? (
              <div className="muted">暂无保存的个人提示词。可在网页小球面板中点击“保存提示词”。</div>
            ) : null}
          </div>
        </section>
      ) : null}

      {tab === 'templates' ? (
        <section className="card section-card">
          <div className="page-help" style={{ marginBottom: 16 }}>
            <div className="page-help-title">{'\u6a21\u677f\u5e93\u600e\u4e48\u7528\uff1f'}</div>
            <div className="page-help-body">{'\u8fd9\u91cc\u5185\u7f6e\u4e86\u4e00\u6279\u70ed\u95e8\u6a21\u677f\u3002\u6bcf\u4e2a\u6a21\u677f\u90fd\u4f1a\u663e\u793a\u9002\u7528\u573a\u666f\u548c GitHub \u6765\u6e90\uff0c\u4f60\u53ef\u4ee5\u4e00\u952e\u590d\u5236\u540e\u76f4\u63a5\u7c98\u8d34\u5230\u804a\u5929\u8f93\u5165\u6846\u4e2d\u4f7f\u7528\u3002'}</div>
          </div>
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <Field label="\u6a21\u677f\u540d\u79f0">
              <input className="input" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} />
            </Field>
            <Field label="\u6a21\u5f0f">
              <Select value="detailed" disabled>
                <option value="detailed">{'\u8be6\u7ec6'}</option>
              </Select>
            </Field>
          </div>
          <Field label="\u6a21\u677f\u5185\u5bb9">
            <Textarea value={draftBody} onChange={(event) => setDraftBody(event.target.value)} />
          </Field>
          <div className="button-row" style={{ marginTop: 16 }}>
            <Button variant="primary" onClick={() => void createTemplate()}>{'\u4fdd\u5b58\u6a21\u677f'}</Button>
          </div>

          <div className="table-list" style={{ marginTop: 16 }}>
            {templates.map((item) => (
              <article className="list-item template-card" key={item.id}>
                <div className="list-item-header template-card-top">
                  <div>
                    <div className="template-badges">
                      <span className="template-badge template-badge-category">{item.category}</span>
                      <span className="template-badge">{item.builtin ? '热门内置' : '自定义模板'}</span>
                    </div>
                    <h3 className="list-item-title">{item.title}</h3>
                    <div className="list-item-meta">
                      {item.mode} {' · '} {item.sourceName ? '已标注来源' : '未标注来源'}
                    </div>
                  </div>
                  <div className="button-row template-actions">
                    <Button
                      className="template-copy-btn"
                      variant="primary"
                      onClick={() => void navigator.clipboard.writeText(item.content)}
                    >
                      {'\u4e00\u952e\u590d\u5236'}
                    </Button>
                    {!item.builtin ? (
                      <Button variant="danger" onClick={() => void templateStore.remove(item.id).then(refresh)}>{'\u5220\u9664'}</Button>
                    ) : null}
                  </div>
                </div>
                <div className="inline-note template-summary" style={{ marginBottom: 10 }}>
                  {item.description}
                </div>
                {item.usageHint ? (
                  <div className="template-usage">
                    <strong>{'\u9002\u7528\u573a\u666f'}</strong>
                    <span>{item.usageHint}</span>
                  </div>
                ) : null}
                <div className="list-item-body template-content-block">{item.content}</div>
                {item.sourceName || item.sourceUrl ? (
                  <div className="template-source">
                    <strong>{'\u6765\u6e90'}</strong>
                    {item.sourceUrl ? (
                      <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                        {item.sourceName ?? item.sourceUrl}
                      </a>
                    ) : (
                      item.sourceName
                    )}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {tab === 'rules' ? (
        <section className="card section-card">
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <Field label="规则名称">
              <input className="input" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} />
            </Field>
            <Field label="状态">
              <Select value="enabled" disabled>
                <option value="enabled">启用</option>
              </Select>
            </Field>
          </div>
          <Field label="规则内容">
            <Textarea value={draftBody} onChange={(event) => setDraftBody(event.target.value)} />
          </Field>
          <div className="button-row" style={{ marginTop: 16 }}>
            <Button variant="primary" onClick={() => void createRule()}>
              保存规则
            </Button>
          </div>

          <div className="table-list" style={{ marginTop: 16 }}>
            {rules.map((item) => (
              <article className="list-item" key={item.id}>
                <div className="list-item-header">
                  <div>
                    <h3 className="list-item-title">{item.title}</h3>
                    <div className="list-item-meta">{item.enabled ? '启用中' : '已停用'}</div>
                  </div>
                  <div className="button-row">
                    <Button
                      onClick={() =>
                        void ruleStore
                          .save({ ...item, enabled: !item.enabled, updatedAt: new Date().toISOString() })
                          .then(refresh)
                      }
                    >
                      {item.enabled ? '停用' : '启用'}
                    </Button>
                    <Button variant="danger" onClick={() => void ruleStore.remove(item.id).then(refresh)}>
                      删除
                    </Button>
                  </div>
                </div>
                <div className="list-item-body">{item.content}</div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {tab === 'skills' ? (
        <section className="card section-card">
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <Field label="导入方式">
              <Select value={skillImportMode} onChange={(event) => setSkillImportMode(event.target.value as 'github' | 'paste')}>
                <option value="github">GitHub 仓库 / 文件链接</option>
                <option value="paste">粘贴 JSON / YAML</option>
              </Select>
            </Field>
            <Field label="冲突处理">
              <Select
                value={conflictStrategy}
                onChange={(event) =>
                  setConflictStrategy(event.target.value as 'overwrite' | 'rename' | 'skip')
                }
              >
                <option value="rename">重命名导入</option>
                <option value="overwrite">覆盖已有 Skill</option>
                <option value="skip">跳过导入</option>
              </Select>
            </Field>
          </div>

          <Field label={skillImportMode === 'github' ? 'GitHub 链接' : 'Skill 配置文本'}>
            {skillImportMode === 'github' ? (
              <input
                className="input"
                value={skillImportSource}
                onChange={(event) => setSkillImportSource(event.target.value)}
                placeholder="https://github.com/owner/repo/blob/main/prompt-skill.yaml"
              />
            ) : (
              <Textarea
                value={skillImportSource}
                onChange={(event) => setSkillImportSource(event.target.value)}
                placeholder="粘贴合法 JSON / YAML Skill 配置"
              />
            )}
          </Field>

          <div className="button-row" style={{ marginTop: 16 }}>
            <Button variant="primary" onClick={() => void importSkill()}>
              立即导入
            </Button>
            <label className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center' }}>
              本地上传 JSON / YAML
              <input
                hidden
                type="file"
                accept=".json,.yaml,.yml"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void importSkillFromFile(file)
                }}
              />
            </label>
          </div>

          <div className="grid-2" style={{ marginTop: 16, marginBottom: 16 }}>
            <Field label="分类筛选">
              <Select value={skillTag} onChange={(event) => setSkillTag(event.target.value)}>
                {availableTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag === 'all' ? '全部标签' : tag}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="排序方式">
              <Select value={skillSort} onChange={(event) => setSkillSort(event.target.value as 'updated' | 'usage' | 'rating')}>
                <option value="updated">最近更新</option>
                <option value="usage">使用频率</option>
                <option value="rating">评分</option>
              </Select>
            </Field>
          </div>

          <div className="grid-2">
            <div className="table-list">
              {filteredSkills.map((item) => (
                <article
                  className="list-item"
                  key={item.id}
                  style={{
                    borderColor: item.id === selectedSkillId ? '#93c5fd' : undefined,
                    boxShadow: item.id === selectedSkillId ? '0 0 0 3px rgba(147,197,253,0.24)' : undefined,
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedSkillId(item.id)}
                >
                  <div className="list-item-header">
                    <div>
                      <h3 className="list-item-title">{highlight(item.name, query)}</h3>
                      <div className="list-item-meta">
                        {item.author} · v{item.version} · {new Date(item.updatedAt).toLocaleDateString('zh-CN')}
                      </div>
                    </div>
                    <div className="status-pill">
                      <span className={`status-dot ${item.enabled ? '' : 'warn'}`.trim()} />
                      {item.enabled ? '启用' : '停用'}
                    </div>
                  </div>
                  <div className="list-item-body">{highlight(item.description, query)}</div>
                  <div className="inline-note">
                    标签：{item.tags.join(', ')} ｜ 评分：{item.rating.toFixed(1)} ｜ 使用次数：{item.usageCount}
                  </div>
                </article>
              ))}
            </div>

            <div className="card section-card" style={{ minHeight: 520 }}>
              {selectedSkill ? (
                <>
                  <h2 className="section-title">Skill 编辑</h2>
                  <div className="grid-2">
                    <Field label="名称">
                      <input
                        className="input"
                        value={selectedSkill.name}
                        onChange={(event) => void saveEditedSkill({ name: event.target.value })}
                      />
                    </Field>
                    <Field label="版本">
                      <input
                        className="input"
                        value={selectedSkill.version}
                        onChange={(event) => void saveEditedSkill({ version: event.target.value })}
                      />
                    </Field>
                  </div>
                  <div className="grid-2" style={{ marginTop: 16 }}>
                    <Field label="作者">
                      <input
                        className="input"
                        value={selectedSkill.author}
                        onChange={(event) => void saveEditedSkill({ author: event.target.value })}
                      />
                    </Field>
                    <Field label="来源仓库">
                      <input
                        className="input"
                        value={selectedSkill.repoUrl}
                        onChange={(event) => void saveEditedSkill({ repoUrl: event.target.value })}
                      />
                    </Field>
                  </div>
                  <Field label="描述">
                    <Textarea
                      value={selectedSkill.description}
                      onChange={(event) => void saveEditedSkill({ description: event.target.value })}
                    />
                  </Field>
                  <Field label="提示词模板">
                    <Textarea
                      value={selectedSkill.promptTemplate}
                      onChange={(event) => void saveEditedSkill({ promptTemplate: event.target.value })}
                    />
                  </Field>
                  <Field label="触发条件（每行一条）">
                    <Textarea
                      value={selectedSkill.triggerConditions.join('\n')}
                      onChange={(event) =>
                        void saveEditedSkill({
                          triggerConditions: event.target.value
                            .split('\n')
                            .map((item) => item.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </Field>
                  <Field label="关键意图字段（每行一条）">
                    <Textarea
                      value={(selectedSkill.intentRequirements ?? []).join('\n')}
                      placeholder="例如：goal\ntechnicalStack\nexpectedOutput\nacceptanceCriteria"
                      onChange={(event) =>
                        void saveEditedSkill({
                          intentRequirements: event.target.value
                            .split('\n')
                            .map((item) => item.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </Field>
                  <div className="button-row" style={{ marginTop: 12 }}>
                    <Button onClick={() => void saveEditedSkill({ enabled: !selectedSkill.enabled })}>
                      {selectedSkill.enabled ? '停用' : '启用'}
                    </Button>
                    {!selectedSkill.builtin ? (
                      <Button variant="danger" onClick={() => void skillStore.remove(selectedSkill.id).then(refresh)}>
                        删除
                      </Button>
                    ) : null}
                  </div>
                  <h3 className="section-title" style={{ marginTop: 18 }}>
                    版本历史 / 回滚
                  </h3>
                  <div className="table-list">
                    {selectedSkill.versions.map((version) => (
                      <article className="list-item" key={version.versionId}>
                        <div className="list-item-header">
                          <div>
                            <h4 className="list-item-title">v{version.version}</h4>
                            <div className="list-item-meta">
                              {new Date(version.updatedAt).toLocaleString('zh-CN')}
                            </div>
                          </div>
                          <Button onClick={() => void rollbackSkillVersion(version.versionId)}>回滚到此版本</Button>
                        </div>
                        <div className="list-item-body">{version.description}</div>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <div className="muted">请选择一个 Skill 查看或编辑。</div>
              )}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}
