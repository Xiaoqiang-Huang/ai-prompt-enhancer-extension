import type { TextareaHTMLAttributes } from 'react'

export const Textarea = (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea className="textarea" {...props} />
)
