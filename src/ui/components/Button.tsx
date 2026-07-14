import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'

type Variant = 'primary' | 'secondary' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

export const Button = ({
  variant = 'secondary',
  children,
  className = '',
  ...props
}: PropsWithChildren<ButtonProps>) => (
  <button className={`btn btn-${variant} ${className}`.trim()} {...props}>
    {children}
  </button>
)
