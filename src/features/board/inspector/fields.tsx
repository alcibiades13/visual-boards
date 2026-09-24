import type { ReactNode } from 'react';

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12px] font-medium tracking-wide text-muted uppercase">{label}</span>
      {children}
      {hint && <span className="text-[12px] leading-snug text-faint">{hint}</span>}
    </div>
  );
}

/** A titled group of fields, separated from the next by a line. */
export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-line pt-4 first:border-t-0 first:pt-0" aria-label={title}>
      <h3 className="font-serif text-[15px]">{title}</h3>
      {children}
    </section>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format = String,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange(value: number): void;
  format?: (v: number) => string;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-w-0 flex-1 accent-(--vb-accent)"
      />
      <span className="w-9 text-right text-[13px] tabular-nums">{format(value)}</span>
    </div>
  );
}

export const inputClass = 'w-full rounded-md border border-line bg-surface px-2 py-1.5 text-[13px] placeholder:text-faint';
export const smallButtonClass =
  'rounded-md border border-line bg-surface px-2.5 py-1.5 text-[13px] font-medium hover:border-faint disabled:opacity-40';
