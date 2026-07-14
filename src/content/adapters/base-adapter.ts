import type { EditableAdapter, EditorSnapshot } from '@/shared/types'

export abstract class BaseEditableAdapter implements EditableAdapter {
  abstract kind: EditableAdapter['kind']
  abstract canWrite: boolean
  constructor(protected readonly element: HTMLElement) {}

  getElement(): HTMLElement {
    return this.element
  }

  focus(): void {
    this.element.focus()
  }

  abstract getLabel(): string
  abstract getText(): string
  abstract replaceText(nextText: string): Promise<boolean>
  abstract insertText(nextText: string): Promise<boolean>
  abstract snapshot(): EditorSnapshot
  abstract restore(snapshot: EditorSnapshot): Promise<boolean>
}
