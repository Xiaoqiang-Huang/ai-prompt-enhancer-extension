import type { LauncherPoint } from '@/content/overlay/launcher-layout'

interface QuickActionPanelCallbacks {
  onExport: (format: 'markdown' | 'html' | 'json' | 'txt' | 'pdf') => void
  onSavePrompt: (metadata: { title: string; tags: string[]; category: string; note: string }) => void
  onOpenLibrary: () => void
}

export class QuickActionPanel {
  private static readonly DOCK_GAP = 8
  private host: HTMLDivElement
  private exportBox: HTMLDivElement
  private saveBox: HTMLDivElement
  private titleInput: HTMLInputElement
  private tagsInput: HTMLInputElement
  private categoryInput: HTMLInputElement
  private noteInput: HTMLTextAreaElement
  private exportButton: HTMLButtonElement
  private saveButton: HTMLButtonElement
  private libraryButton: HTMLButtonElement
  private visible = false
  private enabled = true
  private actionSize = 24

  constructor(private readonly callbacks: QuickActionPanelCallbacks) {
    this.host = document.createElement('div')
    this.host.dataset.apeTestid = 'quick-action-panel'
    this.host.dataset.apeRoot = 'quick-action-panel'
    Object.assign(this.host.style, {
      position: 'fixed',
      zIndex: '2147483646',
      display: 'none',
      gap: '8px',
      alignItems: 'center',
      padding: '0',
    } satisfies Partial<CSSStyleDeclaration>)

    this.exportButton = this.createActionBubble('导', '#167352', '导出对话', 'panel-export-toggle', () => {
      this.toggleExport()
    })
    this.saveButton = this.createActionBubble('存', '#b7791f', '保存提示词', 'panel-save-toggle', () => {
      this.toggleSave()
    })
    this.libraryButton = this.createActionBubble('库', '#3f6f61', '打开提示词库', 'panel-library-open', () => {
      this.closePopovers()
      this.callbacks.onOpenLibrary()
    })

    this.exportBox = document.createElement('div')
    this.exportBox.dataset.apeTestid = 'export-box'
    this.exportBox.style.cssText =
      'display:none;position:absolute;padding:10px;border-radius:14px;border:1px solid #d7e4de;background:#fff;box-shadow:0 22px 48px rgba(18,63,53,0.18);gap:8px;flex-wrap:wrap;width:220px;font-family:"Segoe UI Variable","Microsoft YaHei UI",sans-serif;'
    ;['markdown', 'html', 'json', 'txt', 'pdf'].forEach((format) => {
      this.exportBox.appendChild(
        this.createMiniButton(
          format.toUpperCase(),
          `export-${format}`,
          () => {
            this.callbacks.onExport(format as 'markdown' | 'html' | 'json' | 'txt' | 'pdf')
            this.closePopovers()
          },
        ),
      )
    })

    this.saveBox = document.createElement('div')
    this.saveBox.dataset.apeTestid = 'save-box'
    this.saveBox.style.cssText = 'display:none;position:absolute;width:260px;padding:12px;border-radius:14px;border:1px solid #d7e4de;background:#fff;box-shadow:0 22px 48px rgba(18,63,53,0.18);font-family:"Segoe UI Variable","Microsoft YaHei UI",sans-serif;'

    this.titleInput = this.createInput('标题', 'save-title')
    this.tagsInput = this.createInput('标签，逗号分隔', 'save-tags')
    this.categoryInput = this.createInput('分类', 'save-category')
    this.noteInput = this.createTextarea('备注', 'save-note')
    const saveSubmit = this.createMiniButton('保存到提示词库', 'save-submit', () => {
      this.callbacks.onSavePrompt({
        title: this.titleInput.value || '未命名提示词',
        tags: this.tagsInput.value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        category: this.categoryInput.value || '未分类',
        note: this.noteInput.value,
      })
      this.titleInput.value = ''
      this.tagsInput.value = ''
      this.categoryInput.value = ''
      this.noteInput.value = ''
      this.closePopovers()
    })
    saveSubmit.style.width = '100%'
    saveSubmit.style.marginTop = '8px'
    this.saveBox.append(this.titleInput, this.tagsInput, this.categoryInput, this.noteInput, saveSubmit)

    this.host.append(this.exportButton, this.saveButton, this.libraryButton, this.exportBox, this.saveBox)
    document.documentElement.appendChild(this.host)
    this.applyActionSize()
  }

  private createActionBubble(label: string, color: string, title: string, testid: string, onClick: () => void) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.title = title
    button.dataset.apeTestid = testid
    button.dataset.apeRoot = 'quick-action-panel'
    button.style.cssText =
      'border:1px solid rgba(255,255,255,.7);box-shadow:0 9px 22px rgba(18,63,53,0.20);cursor:pointer;color:#fff;font-weight:750;padding:0;display:inline-flex;align-items:center;justify-content:center;line-height:1;box-sizing:border-box;transition:transform .16s ease,filter .16s ease;'
    button.style.background = color
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      onClick()
    })
    return button
  }

  private createMiniButton(label: string, testid: string, onClick: () => void) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.dataset.apeTestid = testid
    button.style.cssText = 'border:1px solid #ccdcd4;background:#fff;color:#20362d;border-radius:10px;padding:8px 10px;font-size:12px;font-weight:700;cursor:pointer;'
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      onClick()
    })
    return button
  }

  private createInput(placeholder: string, testid: string) {
    const input = document.createElement('input')
    input.placeholder = placeholder
    input.dataset.apeTestid = testid
    input.style.cssText = 'width:100%;border:1px solid #ccdcd4;border-radius:10px;padding:8px 10px;font-size:12px;margin-bottom:8px;color:#10231d;background:#fbfdfc;box-sizing:border-box;'
    return input
  }

  private createTextarea(placeholder: string, testid: string) {
    const textarea = document.createElement('textarea')
    textarea.placeholder = placeholder
    textarea.dataset.apeTestid = testid
    textarea.style.cssText = 'width:100%;min-height:72px;border:1px solid #ccdcd4;border-radius:10px;padding:8px 10px;font-size:12px;resize:vertical;color:#10231d;background:#fbfdfc;box-sizing:border-box;'
    return textarea
  }

  private toggleExport() {
    const next = this.exportBox.style.display === 'none'
    this.saveBox.style.display = 'none'
    this.exportBox.style.display = next ? 'flex' : 'none'
    if (next) {
      this.layoutFloatingBox(this.exportBox, 0)
    }
  }

  private toggleSave() {
    const next = this.saveBox.style.display === 'none'
    this.exportBox.style.display = 'none'
    this.saveBox.style.display = next ? 'block' : 'none'
    if (next) {
      this.layoutFloatingBox(this.saveBox, this.actionSize + QuickActionPanel.DOCK_GAP)
      this.titleInput.focus({ preventScroll: true })
    }
  }

  private closePopovers() {
    this.exportBox.style.display = 'none'
    this.saveBox.style.display = 'none'
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) {
      this.hide()
    }
  }

  setButtonSize(size: number): void {
    const next = Math.max(16, Math.min(48, Math.round(size || this.actionSize)))
    if (this.actionSize === next) return
    this.actionSize = next
    this.applyActionSize()
  }

  private applyActionSize() {
    for (const button of [this.exportButton, this.saveButton, this.libraryButton]) {
      button.style.width = `${this.actionSize}px`
      button.style.height = `${this.actionSize}px`
      button.style.borderRadius = `${Math.max(8, Math.floor(this.actionSize / 2))}px`
      button.style.fontSize = `${Math.max(11, Math.floor(this.actionSize * 0.48))}px`
    }
    this.layoutFloatingBox(this.exportBox, 0)
    this.layoutFloatingBox(this.saveBox, this.actionSize + QuickActionPanel.DOCK_GAP)
  }

  contains(target: EventTarget | null): boolean {
    return target instanceof Node && this.host.contains(target)
  }

  updateAt(position: LauncherPoint): void {
    if (!this.enabled) {
      this.hide()
      return
    }
    this.visible = true
    this.host.style.display = 'flex'
    this.host.style.left = `${position.left}px`
    this.host.style.top = `${position.top}px`
  }

  hide(): void {
    this.visible = false
    this.host.style.display = 'none'
    this.closePopovers()
  }

  close(): void {
    if (!this.visible) return
    this.closePopovers()
  }

  getLayoutSize() {
    return {
      width: this.getDockWidth(),
      height: this.getDockHeight(),
    }
  }

  private getDockWidth() {
    return this.actionSize * 3 + QuickActionPanel.DOCK_GAP * 2
  }

  private getDockHeight() {
    return this.actionSize
  }

  private layoutFloatingBox(element: HTMLDivElement, horizontalOffset = 0) {
    const hostRect = this.host.getBoundingClientRect()
    const boxWidth = element === this.saveBox ? 260 : 220
    const boxHeight = Math.max(150, element.scrollHeight)
    const spacing = Math.max(6, Math.round(this.actionSize * 0.6))

    const canOpenBelow = window.innerHeight - hostRect.bottom >= boxHeight + spacing + 4
    if (canOpenBelow) {
      element.style.top = `${this.actionSize + spacing}px`
      element.style.bottom = 'auto'
    } else {
      element.style.top = 'auto'
      element.style.bottom = `${this.actionSize + spacing}px`
    }

    const minRelativeLeft = 8 - hostRect.left
    const maxRelativeLeft = window.innerWidth - 8 - boxWidth - hostRect.left
    const left = Math.max(minRelativeLeft, Math.min(horizontalOffset, maxRelativeLeft))
    element.style.left = `${left}px`
  }
}
