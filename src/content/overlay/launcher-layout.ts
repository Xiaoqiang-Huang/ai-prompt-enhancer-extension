const SITE_CONTAINER_SELECTORS: Array<{
  match: (hostname: string) => boolean
  selectors: string[]
}> = [
  {
    match: (hostname) => hostname === 'chatgpt.com' || hostname === 'chat.openai.com',
    selectors: [
      '[data-testid="composer"]',
      '[data-testid="composer-container"]',
      '[data-type="unified-composer"]',
      '[class*="composer"]',
      'form',
    ],
  },
  {
    match: (hostname) => hostname === 'claude.ai',
    selectors: [
      '[data-testid*="composer"]',
      '[class*="composer"]',
      'form',
      '[class*="input"]',
    ],
  },
  {
    match: (hostname) => hostname === 'chat.deepseek.com' || hostname.endsWith('.deepseek.com'),
    selectors: [
      '[data-testid*="composer"]',
      '[class*="composer"]',
      '[class*="chat-input"]',
      'form',
      '[class*="input"]',
    ],
  },
]

const FALLBACK_CONTAINER_SELECTORS = [
  '[data-testid*="composer"]',
  '[class*="composer"]',
  '[class*="chat-input"]',
  '[role="form"]',
  'form',
  '[class*="input"]',
  '[class*="editor"]',
].join(', ')

const VIEWPORT_MARGIN = 8
const ANCHOR_GAP = 8
const CONTROL_GAP = 6

const clamp = (value: number, min: number, max: number) => {
  if (max < min) return min
  return Math.max(min, Math.min(max, value))
}

const isUsableRect = (rect: DOMRect) =>
  Number.isFinite(rect.left) &&
  Number.isFinite(rect.top) &&
  rect.width > 0 &&
  rect.height > 0

const containsRect = (container: DOMRect, inner: DOMRect, tolerance = 4) =>
  container.left <= inner.left + tolerance &&
  container.right >= inner.right - tolerance &&
  container.top <= inner.top + tolerance &&
  container.bottom >= inner.bottom - tolerance

const hasInternalScroll = (element: HTMLElement) => {
  const scrollableHeight = element.scrollHeight > element.clientHeight + 4
  const scrollableWidth = element.scrollWidth > element.clientWidth + 4
  const computed = window.getComputedStyle(element)
  const overflowScroll = ['auto', 'scroll', 'overlay'].includes(computed.overflowY) || ['auto', 'scroll', 'overlay'].includes(computed.overflowX)
  return scrollableHeight || scrollableWidth || overflowScroll
}

/**
 * Reject page-wide forms and layout shells. Anchoring to those nodes makes the
 * controls clamp back into the composer when there is no room at the viewport
 * edge, which is the main cause of input text being covered on third-party sites.
 */
const isReasonableAnchor = (candidate: DOMRect, editable: DOMRect) => {
  if (!isUsableRect(candidate) || !containsRect(candidate, editable)) return false

  const editableArea = Math.max(1, editable.width * editable.height)
  const areaRatio = (candidate.width * candidate.height) / editableArea
  const horizontalExpansion = Math.max(0, candidate.width - editable.width)
  const verticalExpansion = Math.max(0, candidate.height - editable.height)
  const viewportWidth = Math.max(1, window.innerWidth)
  const viewportHeight = Math.max(1, window.innerHeight)

  const isPageWideShell =
    candidate.width >= viewportWidth * 0.9 &&
    horizontalExpansion > Math.max(360, editable.width * 0.65)
  const isPageTallShell =
    candidate.height >= viewportHeight * 0.55 &&
    verticalExpansion > Math.max(260, editable.height * 5)

  return areaRatio <= 12 && !isPageWideShell && !isPageTallShell
}

const collectClosestCandidates = (element: HTMLElement, selectors: string[]) => {
  const seen = new Set<HTMLElement>()
  const candidates: HTMLElement[] = []

  for (const selector of selectors) {
    const match = element.closest(selector)
    if (match instanceof HTMLElement && match !== element && !seen.has(match)) {
      seen.add(match)
      candidates.push(match)
    }
  }

  return candidates
}

export const resolveLauncherAnchorRect = (
  element: HTMLElement,
  hostname = window.location.hostname,
): DOMRect => {
  const editableRect = element.getBoundingClientRect()
  if (!isUsableRect(editableRect)) return editableRect

  // When the editable itself owns an internal scrollbar, ancestor rects can
  // move with the scrolled content on SPA composers. Anchor to the visible
  // editable frame instead of chasing a moving form/container.
  if (hasInternalScroll(element)) return editableRect

  const rule = SITE_CONTAINER_SELECTORS.find((item) => item.match(hostname))
  const selectors = rule
    ? [...rule.selectors, ...FALLBACK_CONTAINER_SELECTORS.split(', ')]
    : FALLBACK_CONTAINER_SELECTORS.split(', ')
  const candidates = collectClosestCandidates(element, selectors)
    .map((candidate) => candidate.getBoundingClientRect())
    .filter((rect) => isReasonableAnchor(rect, editableRect))

  return candidates[0] ?? editableRect
}

export interface LauncherPoint {
  left: number
  top: number
}

export interface LauncherCompanionSize {
  width: number
  height: number
}

export interface LauncherClusterLayout {
  launcher: LauncherPoint
  dock?: LauncherPoint
  side: 'right' | 'left' | 'above' | 'below'
}

const buildHorizontalLayout = (
  anchorRect: DOMRect,
  size: number,
  companion: LauncherCompanionSize | undefined,
  side: 'right' | 'left',
): LauncherClusterLayout => {
  const groupHeight = Math.max(size, companion?.height ?? 0)
  const top = clamp(
    anchorRect.top + anchorRect.height / 2 - groupHeight / 2,
    VIEWPORT_MARGIN,
    window.innerHeight - groupHeight - VIEWPORT_MARGIN,
  )
  const launcherTop = top + (groupHeight - size) / 2

  if (side === 'right') {
    const launcherLeft = anchorRect.right + ANCHOR_GAP
    return {
      side,
      launcher: { left: launcherLeft, top: launcherTop },
      dock: companion
        ? {
            left: launcherLeft + size + CONTROL_GAP,
            top: top + (groupHeight - companion.height) / 2,
          }
        : undefined,
    }
  }

  const launcherLeft = anchorRect.left - ANCHOR_GAP - size
  return {
    side,
    launcher: { left: launcherLeft, top: launcherTop },
    dock: companion
      ? {
          left: launcherLeft - CONTROL_GAP - companion.width,
          top: top + (groupHeight - companion.height) / 2,
        }
      : undefined,
  }
}

const buildVerticalLayout = (
  anchorRect: DOMRect,
  size: number,
  companion: LauncherCompanionSize | undefined,
  side: 'above' | 'below',
): LauncherClusterLayout => {
  const groupWidth = size + (companion ? CONTROL_GAP + companion.width : 0)
  const groupHeight = Math.max(size, companion?.height ?? 0)
  const groupLeft = clamp(
    anchorRect.right - groupWidth,
    VIEWPORT_MARGIN,
    window.innerWidth - groupWidth - VIEWPORT_MARGIN,
  )
  const groupTop = side === 'above'
    ? anchorRect.top - ANCHOR_GAP - groupHeight
    : anchorRect.bottom + ANCHOR_GAP

  return {
    side,
    launcher: {
      left: groupLeft,
      top: groupTop + (groupHeight - size) / 2,
    },
    dock: companion
      ? {
          left: groupLeft + size + CONTROL_GAP,
          top: groupTop + (groupHeight - companion.height) / 2,
        }
      : undefined,
  }
}

/**
 * Places the launcher and its three secondary actions as one cluster. The
 * whole cluster must fit outside the input/composer; only when both horizontal
 * sides are unavailable do we move the cluster above or below the composer.
 */
export const computeLauncherClusterLayout = (
  anchorRect: DOMRect,
  size: number,
  position: 'left' | 'right' | 'floating',
  companion?: LauncherCompanionSize,
): LauncherClusterLayout => {
  const groupWidth = size + (companion ? CONTROL_GAP + companion.width : 0)
  const groupHeight = Math.max(size, companion?.height ?? 0)
  const rightSpace = window.innerWidth - VIEWPORT_MARGIN - anchorRect.right - ANCHOR_GAP
  const leftSpace = anchorRect.left - VIEWPORT_MARGIN - ANCHOR_GAP
  const aboveSpace = anchorRect.top - VIEWPORT_MARGIN - ANCHOR_GAP
  const belowSpace = window.innerHeight - VIEWPORT_MARGIN - anchorRect.bottom - ANCHOR_GAP
  const horizontalPreference: Array<'right' | 'left'> =
    position === 'left' ? ['left', 'right'] : ['right', 'left']

  for (const side of horizontalPreference) {
    const available = side === 'right' ? rightSpace : leftSpace
    if (available >= groupWidth) {
      return buildHorizontalLayout(anchorRect, size, companion, side)
    }
  }

  const verticalPreference: Array<'above' | 'below'> =
    aboveSpace >= belowSpace ? ['above', 'below'] : ['below', 'above']
  for (const side of verticalPreference) {
    const available = side === 'above' ? aboveSpace : belowSpace
    if (available >= groupHeight) {
      return buildVerticalLayout(anchorRect, size, companion, side)
    }
  }

  // Pathological full-viewport editors leave no truly external location. Pick
  // the side with the most free space rather than clamping into the text area.
  const fallback = [
    { side: 'right' as const, available: rightSpace },
    { side: 'left' as const, available: leftSpace },
    { side: 'above' as const, available: aboveSpace },
    { side: 'below' as const, available: belowSpace },
  ].sort((a, b) => b.available - a.available)[0]

  return fallback.side === 'right' || fallback.side === 'left'
    ? buildHorizontalLayout(anchorRect, size, companion, fallback.side)
    : buildVerticalLayout(anchorRect, size, companion, fallback.side)
}

export const computeLauncherPosition = (
  anchorRect: DOMRect,
  size: number,
  position: 'left' | 'right' | 'floating',
  companionOffset = 0,
) => {
  const companion = companionOffset > 0
    ? { width: companionOffset, height: size }
    : undefined
  return computeLauncherClusterLayout(anchorRect, size, position, companion).launcher
}
