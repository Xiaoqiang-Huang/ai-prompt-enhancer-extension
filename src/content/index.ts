import { collectChatMessages, exportConversation } from '@/content/chat-export'
import { detectSensitiveText } from '@/content/detector/sensitive-detector'
import { findBestEditableAdapter, isAiChatHost, resolveEditableAdapter } from '@/content/detector/input-detector'
import { FloatingButton } from '@/content/overlay/floating-button'
import { PreviewDialog } from '@/content/overlay/preview-dialog'
import { QuickActionPanel } from '@/content/overlay/quick-action-panel'
import { savedPromptStore } from '@/core/storage/saved-prompt-store'
import { settingsStore } from '@/core/storage/settings-store'
import { logger } from '@/shared/logger'
import type { EditableAdapter, EnhanceMode, EnhancementWorkflow } from '@/shared/types'

declare global {
  interface Window {
    __APE_CONTENT_APP__?: PromptEnhancerContentApp
  }
}

class PromptEnhancerContentApp {
  private adapter: EditableAdapter | null = null
  private launcherEnabled = true
  private secondaryActionsEnabled = true
  private sensitiveScanEnabled = true
  private defaultWorkflow: EnhancementWorkflow = 'direct'
  private syncTimer: number | null = null
  private mutationObserver = new MutationObserver(() => {
    this.scheduleSync(120)
  })
  private floatingButton = new FloatingButton(() => {
    void this.enhanceCurrentAdapter()
  })
  private previewDialog = new PreviewDialog()
  private quickActionPanel = new QuickActionPanel({
    onExport: (format) => {
      const messages = collectChatMessages()
      if (messages.length === 0) {
        alert('当前页面未检测到可导出的对话线程。')
        return
      }
      exportConversation(format, messages)
    },
    onSavePrompt: (metadata) => {
      const text = this.adapter?.getText().trim()
      if (!text) {
        alert('当前输入框为空，无法保存提示词。')
        return
      }
      const now = new Date().toISOString()
      void savedPromptStore.save({
        id: crypto.randomUUID(),
        title: metadata.title,
        content: text,
        source: 'input',
        tags: metadata.tags,
        category: metadata.category,
        note: metadata.note,
        hostname: location.hostname,
        createdAt: now,
        updatedAt: now,
        usageCount: 0,
      })
      alert('已保存到个人提示词库。')
    },
    onOpenLibrary: () => {
      void chrome.runtime.sendMessage({ type: 'APE_OPEN_SIDE_PANEL' })
    },
  })

  constructor() {
    document.addEventListener('focusin', this.handleFocus, true)
    document.addEventListener('input', this.handleInput, true)
    document.addEventListener('pointerdown', this.handlePointerDown, true)
    document.addEventListener('click', this.handlePointerDown, true)
    document.addEventListener('scroll', this.repositionFloatingButton, true)
    document.addEventListener('visibilitychange', this.handleVisibilityChange, true)
    window.addEventListener('pageshow', this.handlePageShow)
    window.addEventListener('hashchange', this.handlePageShow)
    window.addEventListener('popstate', this.handlePageShow)
    window.addEventListener('resize', this.repositionFloatingButton)
    chrome.storage.onChanged.addListener(this.handleStorageChange)
    this.mutationObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'contenteditable', 'placeholder', 'aria-hidden'],
    })
    void this.loadLauncherConfig().then(() => this.syncActiveAdapter())
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      this.handleMessage(message)
        .then(() => sendResponse({ ok: true }))
        .catch((error) => {
          logger.error(error)
          sendResponse({ ok: false })
        })
      return true
    })
    this.scheduleSync(250)
    this.scheduleSync(1200)
    this.scheduleSync(2500)
  }

  private scheduleSync(delayMs = 0) {
    if (this.syncTimer !== null) {
      window.clearTimeout(this.syncTimer)
    }
    this.syncTimer = window.setTimeout(() => {
      this.syncTimer = null
      this.syncActiveAdapter()
    }, delayMs)
  }

  private hideLauncherControls() {
    this.adapter = null
    this.floatingButton.hide()
    this.quickActionPanel.hide()
  }

  private async loadLauncherConfig() {
    const settings = await settingsStore.get()
    this.launcherEnabled = settings.launcher.enabled
    this.secondaryActionsEnabled = settings.launcher.secondaryActionsEnabled
    this.sensitiveScanEnabled = settings.detectSensitiveText
    this.defaultWorkflow = settings.enhancementWorkflow
    this.floatingButton.configure({
      size: settings.launcher.size,
      opacity: settings.launcher.opacity,
      color: settings.launcher.color,
      position: settings.launcher.position,
      companionOffset: 0,
    })
    this.quickActionPanel.setEnabled(this.secondaryActionsEnabled)
    this.quickActionPanel.setButtonSize(settings.launcher.size)
    if (!this.launcherEnabled) {
      this.floatingButton.hide()
      this.quickActionPanel.hide()
    }
  }

  private syncActiveAdapter() {
    if (!isAiChatHost(location.hostname)) {
      this.hideLauncherControls()
      return
    }

    const nextAdapter =
      resolveEditableAdapter(document.activeElement) ??
      (this.adapter && this.adapter.getElement().isConnected ? this.adapter : null) ??
      findBestEditableAdapter(document)

    if (!nextAdapter || !this.launcherEnabled) {
      this.hideLauncherControls()
      return
    }

    this.adapter = nextAdapter
    const text = this.adapter.getText()
    const sensitive = this.sensitiveScanEnabled ? detectSensitiveText(text, this.adapter.getElement()) : { blocked: false }
    if (sensitive.blocked) {
      this.hideLauncherControls()
      return
    }
    this.layoutLauncherControls()
    this.floatingButton.setState('idle')
  }

  private handleFocus = (event: FocusEvent) => {
    if (!isAiChatHost(location.hostname)) {
      this.hideLauncherControls()
      return
    }
    if (event.target instanceof HTMLElement && event.target.closest('[data-ape-root]')) {
      return
    }
    const nextAdapter = resolveEditableAdapter(event.target)
    if (!nextAdapter || !this.launcherEnabled) {
      this.scheduleSync(80)
      return
    }
    this.adapter = nextAdapter
    const text = this.adapter.getText()
    const sensitive = this.sensitiveScanEnabled ? detectSensitiveText(text, this.adapter.getElement()) : { blocked: false }
    if (sensitive.blocked) {
      this.hideLauncherControls()
      return
    }
    this.layoutLauncherControls()
    this.floatingButton.setState('idle')
  }

  private handleInput = (event: Event) => {
    if (!isAiChatHost(location.hostname)) {
      this.hideLauncherControls()
      return
    }
    if (event.target instanceof HTMLElement && event.target.closest('[data-ape-root]')) return
    const nextAdapter = resolveEditableAdapter(event.target)
    if (nextAdapter) {
      this.adapter = nextAdapter
      const text = this.adapter.getText()
      const sensitive = this.sensitiveScanEnabled ? detectSensitiveText(text, this.adapter.getElement()) : { blocked: false }
      if (sensitive.blocked) {
        this.hideLauncherControls()
        return
      }
      if (this.launcherEnabled) {
        this.layoutLauncherControls()
        this.floatingButton.setState('idle')
      }
    } else {
      this.scheduleSync(120)
    }
  }

  private handlePointerDown = (event: PointerEvent | MouseEvent) => {
    if (event.target instanceof HTMLElement && event.target.closest('[data-ape-root]')) return
    this.quickActionPanel.close()
  }

  private repositionFloatingButton = () => {
    if (!isAiChatHost(location.hostname)) {
      this.hideLauncherControls()
      return
    }
    if (!this.launcherEnabled) return
    if (!this.adapter || !this.adapter.getElement().isConnected) {
      this.scheduleSync(60)
      return
    }
    this.layoutLauncherControls()
  }

  private layoutLauncherControls() {
    const companion = this.secondaryActionsEnabled
      ? this.quickActionPanel.getLayoutSize()
      : undefined
    const layout = this.floatingButton.update(this.adapter, companion)
    if (this.secondaryActionsEnabled && layout?.dock) {
      this.quickActionPanel.updateAt(layout.dock)
    } else {
      this.quickActionPanel.hide()
    }
  }

  private handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      this.scheduleSync(80)
    }
  }

  private handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName !== 'local' || !changes.ape_settings) return
    void this.loadLauncherConfig().then(() => this.syncActiveAdapter())
  }

  private handlePageShow = () => {
    this.scheduleSync(120)
    this.scheduleSync(800)
  }

  private async handleMessage(message: unknown): Promise<void> {
    if (typeof message !== 'object' || !message) return
    const typed = message as {
      type?: string
      text?: string
      mode?: EnhanceMode
      copyOnly?: boolean
      skillId?: string
      requestId?: string
      partial?: string
      message?: string
    }
    if (typed.type === 'APE_PING') {
      return
    }
    if (typed.type === 'APE_ENHANCE_STREAM' && typed.requestId && typeof typed.partial === 'string') {
      this.previewDialog.handleStream(typed.requestId, typed.partial)
      return
    }
    if (typed.type === 'APE_CLARIFY_STREAM' && typed.requestId && typeof typed.partial === 'string') {
      this.previewDialog.handleClarifyStream(typed.requestId, typed.partial)
      return
    }
    if (typed.type === 'APE_ENHANCE_STATUS' && typed.requestId && typed.message) {
      this.previewDialog.handleStatus(typed.requestId, typed.message)
      return
    }
    if (typed.type === 'APE_RUN_ACTIVE_INPUT') {
      await this.enhanceCurrentAdapter(typed.mode, typed.copyOnly, typed.skillId)
    }
    if (typed.type === 'APE_CONTEXT_SELECTION' && typed.text) {
      await this.previewDialog.open({
        sourceText: typed.text,
        adapter: null,
        hostname: location.hostname,
        copyOnly: true,
      })
    }
  }

  private async enhanceCurrentAdapter(mode?: EnhanceMode, copyOnly?: boolean, skillId?: string): Promise<void> {
    if (!isAiChatHost(location.hostname)) {
      this.hideLauncherControls()
      return
    }
    const activeAdapter = resolveEditableAdapter(document.activeElement) ?? findBestEditableAdapter(document)
    if (activeAdapter) {
      this.adapter = activeAdapter
    }
    if (this.adapter && !this.adapter.getElement().isConnected) {
      this.adapter = null
    }
    if (!this.adapter) {
      this.floatingButton.setState('error', 'Focus an input first')
      alert('请先聚焦一个可编辑输入框，再执行提示词增强。')
      return
    }
    const sourceText = this.adapter.getText().trim()
    const sensitive = this.sensitiveScanEnabled ? detectSensitiveText(sourceText, this.adapter.getElement()) : { blocked: false }
    if (sensitive.blocked) {
      this.floatingButton.setState('error', '检测到敏感信息')
      alert('检测到敏感信息，当前输入已被阻止增强。')
      return
    }
    this.quickActionPanel.close()
    this.floatingButton.setState('working')
    await this.previewDialog.open({
      sourceText,
      mode,
      skillId,
      adapter: this.adapter,
      snapshot: this.adapter.snapshot(),
      hostname: location.hostname,
      copyOnly: copyOnly || !this.adapter.canWrite,
      workflow: this.defaultWorkflow,
    })
    this.floatingButton.setState('done')
  }
}

if (!window.__APE_CONTENT_APP__) {
  window.__APE_CONTENT_APP__ = new PromptEnhancerContentApp()
}
