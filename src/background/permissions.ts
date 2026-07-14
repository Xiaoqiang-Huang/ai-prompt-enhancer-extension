export const ensureSidePanelEnabled = async (): Promise<void> => {
  if (chrome.sidePanel?.setPanelBehavior) {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })
  }
}

export const toHostPermissionPattern = (baseUrl: string): string => {
  try {
    const url = new URL(baseUrl.trim())
    if (!['http:', 'https:'].includes(url.protocol)) return ''
    return `${url.protocol}//${url.host}/*`
  } catch {
    return ''
  }
}

export const hasProviderHostPermission = async (baseUrl: string): Promise<boolean> => {
  const origin = toHostPermissionPattern(baseUrl)
  if (!origin) return false
  return await chrome.permissions.contains({ origins: [origin] })
}

export const requestProviderHostPermission = async (baseUrl: string): Promise<boolean> => {
  const origin = toHostPermissionPattern(baseUrl)
  if (!origin) return false
  if (await chrome.permissions.contains({ origins: [origin] })) return true
  return await chrome.permissions.request({ origins: [origin] })
}
