import { BaseEditableAdapter } from '@/content/adapters/base-adapter'
import type { EditorSnapshot } from '@/shared/types'

export class CodeMirrorAdapter extends BaseEditableAdapter {
  kind = 'codemirror' as const
  canWrite = false

  getLabel(): string {
    return 'CodeMirror'
  }
  getText(): string {
    return this.element.textContent?.trim() ?? ''
  }
  async replaceText(): Promise<boolean> {
    return false
  }
  async insertText(): Promise<boolean> {
    return false
  }
  snapshot(): EditorSnapshot {
    return { text: this.getText() }
  }
  async restore(): Promise<boolean> {
    return false
  }
}
