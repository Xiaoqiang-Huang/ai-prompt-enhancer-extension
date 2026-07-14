export const CONTEXT_MENU_ID = 'ape-enhance-selection'

export const registerContextMenus = async (): Promise<void> => {
  await chrome.contextMenus.removeAll()
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: '增强选中文本',
    contexts: ['selection', 'editable'],
  })
}
