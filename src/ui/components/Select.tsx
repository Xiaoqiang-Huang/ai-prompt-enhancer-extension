import type { SelectHTMLAttributes } from 'react'

export const Select = (props: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className="select" {...props} />
)
