export function Segmented<V extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: V;
  onChange(value: V): void;
  options: [V, string][];
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-md bg-surface-2 p-0.5 text-[13px]">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className="h-7 rounded-[5px] px-2.5 text-muted transition-colors duration-(--vb-fast) aria-checked:bg-surface aria-checked:text-ink aria-checked:shadow-soft"
        >
          {text}
        </button>
      ))}
    </div>
  );
}
