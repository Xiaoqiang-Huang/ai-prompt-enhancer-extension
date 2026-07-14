import { BaseEditableAdapter } from '@/content/adapters/base-adapter'
import type { EditorSnapshot } from '@/shared/types'

type NativeElement = HTMLInputElement | HTMLTextAreaElement

export class NativeInputAdapter extends BaseEditableAdapter {
  kind = 'native' as const
  canWrite = true

  private get input(): NativeElement {
    return this.element as NativeElement
  }

  getLabel(): string {
    return this.element instanceof HTMLTextAreaElement ? 'textarea' : 'input'
  }

  getText(): string {
    return this.input.value
  }

  private updateValue(nextText: string): void {
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(this.input), 'value')
    descriptor?.set?.call(this.input, nextText)
    this.input.dispatchEvent(new Event('input', { bubbles: true }))
    this.input.dispatchEvent(new Event('change', { bubbles: true }))
  }

  async replaceText(nextText: string): Promise<boolean> {
    this.updateValue(nextText)
    return true
  }

  async insertText(nextText: string): Promise<boolean> {
    const start = this.input.selectionStart ?? this.input.value.length
    const end = this.input.selectionEnd ?? this.input.value.length
    const current = this.input.value
    this.updateValue(`${current.slice(0, start)}${nextText}${current.slice(end)}`)
    const caret = start + nextText.length
    this.input.setSelectionRange(caret, caret)
    return true
  }

  snapshot(): EditorSnapshot {
    return {
      text: this.input.value,
      selectionStart: this.input.selectionStart ?? undefined,
      selectionEnd: this.input.selectionEnd ?? undefined,
    }
  }

  async restore(snapshot: EditorSnapshot): Promise<boolean> {
    this.updateValue(snapshot.text)
    if (snapshot.selectionStart !== undefined && snapshot.selectionEnd !== undefined) {
      this.input.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd)
    }
    return true
  }
}
