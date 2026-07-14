import { BaseEditableAdapter } from '@/content/adapters/base-adapter'
import type { EditorSnapshot } from '@/shared/types'

export class ContenteditableAdapter extends BaseEditableAdapter {
  kind = 'contenteditable' as const
  canWrite = true

  getLabel(): string {
    return 'contenteditable'
  }

  getText(): string {
    return this.element.innerText
  }

  async replaceText(nextText: string): Promise<boolean> {
    this.element.innerText = nextText
    this.element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: nextText }))
    return true
  }

  async insertText(nextText: string): Promise<boolean> {
    this.focus()
    document.execCommand('insertText', false, nextText)
    return true
  }

  snapshot(): EditorSnapshot {
    return { text: this.element.innerText }
  }

  async restore(snapshot: EditorSnapshot): Promise<boolean> {
    this.element.innerText = snapshot.text
    return true
  }
}
