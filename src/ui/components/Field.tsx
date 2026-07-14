import type { PropsWithChildren } from 'react'

export const Field = ({ label, children }: PropsWithChildren<{ label: string }>) => (
  <label className="field">
    <span className="field-label">{label}</span>
    {children}
  </label>
)
