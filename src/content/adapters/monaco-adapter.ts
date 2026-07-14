import { BaseEditableAdapter } from '@/content/adapters/base-adapter'
import type { EditorSnapshot } from '@/shared/types'

export class MonacoAdapter extends BaseEditableAdapter {
  kind = 'monaco' as const
  canWrite = false

  getLabel(): string {
    return 'Monaco'
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
