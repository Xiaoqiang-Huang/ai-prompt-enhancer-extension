import {
  computeLauncherClusterLayout,
  resolveLauncherAnchorRect,
  type LauncherClusterLayout,
  type LauncherCompanionSize,
} from '@/content/overlay/launcher-layout'
import type { EditableAdapter } from '@/shared/types'

type LauncherState = 'idle' | 'working' | 'done' | 'error'

export class FloatingButton {
  private host: HTMLButtonElement
  private size = 24
  private opacity = 0.92
  private color = '#22c55e'
  private position: 'left' | 'right' | 'floating' = 'right'
  private companionOffset = 0

  constructor(private readonly onClick: () => void) {
    if (!document.getElementById('ape-launcher-style')) {
      const style = document.createElement('style')
      style.id = 'ape-launcher-style'
      style.textContent = `
        @keyframes ape-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes ape-pulse { 0% { transform: scale(1); } 50% { transform: scale(1.14); } 100% { transform: scale(1); } }
        @keyframes ape-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-2px); } 75% { transform: translateX(2px); } }
        [data-ape-testid="launcher"]:hover { transform: translateY(-2px) scale(1.06); filter: saturate(1.08); }
        [data-ape-testid="launcher"]:focus-visible { outline: 3px solid rgba(31,157,104,.25); outline-offset: 3px; }
      `
      document.documentElement.appendChild(style)
    }
    this.host = document.createElement('button')
    this.host.type = 'button'
    this.host.dataset.apeTestid = 'launcher'
    this.host.dataset.apeRoot = 'launcher'
    this.host.textContent = '\u26a1'
    this.host.title = '增强提示词'
    this.host.setAttribute('aria-label', '增强提示词')
    Object.assign(this.host.style, {
      position: 'fixed',
      zIndex: '2147483646',
      border: '1px solid rgba(34,197,94,0.18)',
      background: this.color,
      color: '#ffffff',
      borderRadius: '999px',
      width: `${this.size}px`,
      height: `${this.size}px`,
      fontSize: '12px',
      fontWeight: '600',
      padding: '0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: String(this.opacity),
      boxShadow: '0 14px 30px rgba(34,197,94,0.22)',
      cursor: 'pointer',
      transition: 'transform 0.18s ease, background 0.18s ease, opacity 0.18s ease',
      boxSizing: 'border-box',
    } satisfies Partial<CSSStyleDeclaration>)
    this.host.style.display = 'none'
    this.host.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      this.onClick()
    })
    document.documentElement.appendChild(this.host)
  }

  configure(input: {
    size: number
    opacity: number
    color: string
    position: 'left' | 'right' | 'floating'
    companionOffset?: number
  }) {
    this.size = input.size
    this.opacity = input.opacity
    this.color = input.color
    this.position = input.position
    this.companionOffset = input.companionOffset ?? 0
    this.host.style.width = `${this.size}px`
    this.host.style.height = `${this.size}px`
    this.host.style.background = this.color
    this.host.style.opacity = String(this.opacity)
    this.host.style.fontSize = `${Math.max(11, Math.floor(this.size * 0.48))}px`
  }

  setState(state: LauncherState, tooltip?: string): void {
    this.host.title = tooltip ?? ''
    this.host.style.animation = ''
    if (state === 'working') {
      this.host.style.animation = 'ape-spin 1s linear infinite'
      this.host.style.background = this.color
    } else if (state === 'done') {
      this.host.style.animation = 'ape-pulse 0.45s ease-in-out 2'
      this.host.style.background = this.color
    } else if (state === 'error') {
      this.host.style.background = '#ef4444'
      this.host.style.animation = 'ape-shake 0.28s linear 2'
    } else {
      this.host.style.background = this.color
    }
  }

  update(
    adapter: EditableAdapter | null,
    companion?: LauncherCompanionSize,
  ): LauncherClusterLayout | null {
    if (!adapter) {
      this.host.style.display = 'none'
      return null
    }
    const anchorRect = resolveLauncherAnchorRect(adapter.getElement())
    const fallbackCompanion = this.companionOffset > 0
      ? { width: this.companionOffset, height: this.size }
      : undefined
    const next = computeLauncherClusterLayout(
      anchorRect,
      this.size,
      this.position,
      companion ?? fallbackCompanion,
    )
    this.host.style.display = 'inline-flex'
    this.host.style.top = `${next.launcher.top}px`
    this.host.style.left = `${next.launcher.left}px`
    this.host.dataset.apePlacement = next.side
    return next
  }

  hide(): void {
    this.host.style.display = 'none'
  }

}
