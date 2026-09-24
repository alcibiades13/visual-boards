import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'quiet' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-bg hover:opacity-90',
  quiet: 'border border-line bg-surface text-ink hover:border-faint',
  ghost: 'text-muted hover:bg-surface-2 hover:text-ink',
  danger: 'bg-danger text-bg hover:opacity-90',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'quiet', size = 'md', className = '', type = 'button', ...rest },
  ref,
) {
  const sizing = size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-9 px-3.5 text-sm';
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-[background-color,color,opacity,border-color] duration-(--vb-fast) disabled:pointer-events-none disabled:opacity-40 ${sizing} ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
});

export function IconButton({ label, className = '', ...rest }: ButtonProps & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted transition-colors duration-(--vb-fast) hover:bg-surface-2 hover:text-ink disabled:opacity-40 ${className}`}
      {...rest}
    />
  );
}
