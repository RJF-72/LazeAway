import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function Panel({
  title,
  right,
  children,
  className = '',
  bodyClassName = '',
}: {
  title?: string
  right?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={`panel flex flex-col ${className}`}>
      {title && (
        <header className="flex items-center justify-between px-3 py-2 border-b border-[#3a3a3a]">
          <h2 className="panel-title">{title}</h2>
          {right}
        </header>
      )}
      <div className={`p-3 ${bodyClassName}`}>{children}</div>
    </section>
  )
}

type Variant = 'default' | 'accent' | 'gantry' | 'danger' | 'ok' | 'warn' | 'ghost'

const variantClass: Record<Variant, string> = {
  default: 'bg-[#2c2c2c] hover:bg-[#383838] border-[#3a3a3a] text-white',
  accent: 'bg-[#ff6b35] hover:bg-[#ff7d4d] border-[#ff6b35] text-black',
  gantry: 'bg-[#3b82f6] hover:bg-[#5a97f7] border-[#3b82f6] text-white',
  danger: 'bg-[#ef4444] hover:bg-[#f25f5f] border-[#ef4444] text-white',
  ok: 'bg-[#22c55e] hover:bg-[#3fd474] border-[#22c55e] text-black',
  warn: 'bg-[#eab308] hover:bg-[#f2bf2b] border-[#eab308] text-black',
  ghost: 'bg-transparent hover:bg-[#2c2c2c] border-[#3a3a3a] text-[#9ca3af]',
}

export function Btn({
  variant = 'default',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizeClass =
    size === 'lg'
      ? 'px-5 py-3 text-[15px]'
      : size === 'sm'
        ? 'px-2.5 py-1.5 text-xs'
        : 'px-3.5 py-2 text-sm'
  return (
    <button
      className={`btn ${variantClass[variant]} ${sizeClass} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function StatusPill({
  color,
  label,
  pulse = false,
}: {
  color: 'ok' | 'warn' | 'danger' | 'muted' | 'gantry' | 'accent'
  label: string
  pulse?: boolean
}) {
  const map = {
    ok: 'bg-[#22c55e]',
    warn: 'bg-[#eab308]',
    danger: 'bg-[#ef4444]',
    muted: 'bg-[#6b7280]',
    gantry: 'bg-[#3b82f6]',
    accent: 'bg-[#ff6b35]',
  }
  return (
    <span className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-[#161616] border border-[#3a3a3a]">
      <span className={`w-2.5 h-2.5 rounded-full ${map[color]} ${pulse ? 'live-dot' : ''}`} />
      <span className="text-[11px] font-semibold tracking-wide uppercase">{label}</span>
    </span>
  )
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider text-[#9ca3af] font-semibold">
        {label}
      </span>
      {children}
      {hint && <span className="text-[10px] text-[#6b7280]">{hint}</span>}
    </label>
  )
}
