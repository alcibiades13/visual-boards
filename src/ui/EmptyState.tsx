export function EmptyState({ title, body }: { title?: string; body: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      {title && <p className="font-serif text-xl italic">{title}</p>}
      <p className="mt-2 max-w-sm text-muted">{body}</p>
    </div>
  );
}
