import {
  computeLauncherClusterLayout,
  computeLauncherPosition,
  resolveLauncherAnchorRect,
  type LauncherPoint,
} from '@/content/overlay/launcher-layout'

const mockRect = (element: Element, rect: Partial<DOMRect>) => {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      x: rect.left ?? 0,
      y: rect.top ?? 0,
      top: rect.top ?? 0,
      left: rect.left ?? 0,
      right: rect.right ?? 0,
      bottom: rect.bottom ?? 0,
      width: rect.width ?? ((rect.right ?? 0) - (rect.left ?? 0)),
      height: rect.height ?? ((rect.bottom ?? 0) - (rect.top ?? 0)),
      toJSON: () => ({}),
    }),
  })
}

const domRect = (
  left: number,
  right: number,
  top: number,
  bottom: number,
) => ({
  left,
  right,
  top,
  bottom,
  width: right - left,
  height: bottom - top,
  x: left,
  y: top,
  toJSON: () => ({}),
}) as DOMRect

const overlaps = (
  point: LauncherPoint,
  width: number,
  height: number,
  rect: DOMRect,
) => !(
  point.left + width <= rect.left ||
  point.left >= rect.right ||
  point.top + height <= rect.top ||
  point.top >= rect.bottom
)

describe('launcher layout', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
  })

  it('uses ChatGPT outer composer rect instead of textarea rect', () => {
    document.body.innerHTML = `
      <form id="composer-form">
        <div>
          <textarea id="prompt-textarea" data-testid="prompt-textarea"></textarea>
        </div>
      </form>
    `

    const form = document.getElementById('composer-form') as HTMLElement
    const textarea = document.getElementById('prompt-textarea') as HTMLTextAreaElement
    mockRect(form, { left: 40, right: 980, top: 500, bottom: 580, width: 940, height: 80 })
    mockRect(textarea, { left: 60, right: 900, top: 518, bottom: 560, width: 840, height: 42 })

    const rect = resolveLauncherAnchorRect(textarea, 'chatgpt.com')

    expect(rect.right).toBe(980)
    expect(rect.left).toBe(40)
  })

  it('rejects a page-wide form shell and anchors to the actual editable', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 })
    document.body.innerHTML = `
      <form id="page-form">
        <textarea id="message"></textarea>
      </form>
    `

    const form = document.getElementById('page-form') as HTMLElement
    const textarea = document.getElementById('message') as HTMLTextAreaElement
    mockRect(form, { left: 0, right: 1200, top: 40, bottom: 760, width: 1200, height: 720 })
    mockRect(textarea, { left: 300, right: 800, top: 600, bottom: 660, width: 500, height: 60 })

    const rect = resolveLauncherAnchorRect(textarea, 'chatgpt.com')

    expect(rect.left).toBe(300)
    expect(rect.right).toBe(800)
  })

  it('anchors to the visible editable frame when the input owns an internal scrollbar', () => {
    document.body.innerHTML = `
      <form id="composer-form">
        <textarea id="prompt-textarea"></textarea>
      </form>
    `

    const form = document.getElementById('composer-form') as HTMLElement
    const textarea = document.getElementById('prompt-textarea') as HTMLTextAreaElement
    mockRect(form, { left: 40, right: 980, top: 20, bottom: 780, width: 940, height: 760 })
    mockRect(textarea, { left: 300, right: 900, top: 420, bottom: 500, width: 600, height: 80 })
    Object.defineProperties(textarea, {
      scrollHeight: { configurable: true, value: 1200 },
      clientHeight: { configurable: true, value: 80 },
    })

    const rect = resolveLauncherAnchorRect(textarea, 'chatgpt.com')

    expect(rect.left).toBe(300)
    expect(rect.top).toBe(420)
    expect(rect.right).toBe(900)
  })

  it('keeps the entire launcher cluster to the right when it fits', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1400 })
    const anchor = domRect(300, 900, 400, 500)
    const layout = computeLauncherClusterLayout(anchor, 24, 'right', { width: 88, height: 24 })

    expect(layout.side).toBe('right')
    expect(layout.launcher.left).toBeGreaterThanOrEqual(anchor.right + 8)
    expect(layout.dock).toBeDefined()
    expect(overlaps(layout.launcher, 24, 24, anchor)).toBe(false)
    expect(overlaps(layout.dock!, 88, 24, anchor)).toBe(false)
  })

  it('keeps the launcher cluster above the input when above is selected', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1400 })
    const anchor = domRect(300, 900, 400, 500)
    const layout = computeLauncherClusterLayout(anchor, 24, 'above', { width: 88, height: 24 })

    expect(layout.side).toBe('above')
    expect(layout.launcher.top + 24).toBeLessThanOrEqual(anchor.top - 8)
    expect(layout.dock).toBeDefined()
    expect(overlaps(layout.launcher, 24, 24, anchor)).toBe(false)
    expect(overlaps(layout.dock!, 88, 24, anchor)).toBe(false)
  })

  it('uses below as the safe fallback when there is no room above', () => {
    const anchor = domRect(300, 900, 12, 72)
    const layout = computeLauncherClusterLayout(anchor, 24, 'above', { width: 88, height: 24 })

    expect(layout.side).toBe('below')
    expect(layout.launcher.top).toBeGreaterThanOrEqual(anchor.bottom + 8)
    expect(overlaps(layout.launcher, 24, 24, anchor)).toBe(false)
    expect(overlaps(layout.dock!, 88, 24, anchor)).toBe(false)
  })

  it('moves the entire cluster to the left when the right side is too narrow', () => {
    const anchor = domRect(300, 950, 400, 500)
    const layout = computeLauncherClusterLayout(anchor, 24, 'right', { width: 88, height: 24 })

    expect(layout.side).toBe('left')
    expect(layout.launcher.left + 24).toBeLessThanOrEqual(anchor.left - 8)
    expect(overlaps(layout.launcher, 24, 24, anchor)).toBe(false)
    expect(overlaps(layout.dock!, 88, 24, anchor)).toBe(false)
  })

  it('moves the cluster above instead of clamping it into a viewport-wide input', () => {
    const anchor = domRect(20, 980, 400, 500)
    const layout = computeLauncherClusterLayout(anchor, 24, 'right', { width: 88, height: 24 })

    expect(layout.side).toBe('above')
    expect(layout.launcher.top + 24).toBeLessThanOrEqual(anchor.top - 8)
    expect(overlaps(layout.launcher, 24, 24, anchor)).toBe(false)
    expect(overlaps(layout.dock!, 88, 24, anchor)).toBe(false)
  })

  it('falls back to left side when right side overflows viewport', () => {
    const next = computeLauncherPosition(domRect(920, 980, 400, 460), 24, 'right', 0)

    expect(next.left).toBeLessThan(920)
  })
})
