import { useMemo, useState } from 'react';
import { useT } from '@/i18n';
import { parseQuotes, quoteKey } from '@/import/quoteParser';
import { createQuote } from '@/model';
import { useLibrary } from '@/store/libraryStore';
import { toast } from '@/store/toastStore';
import { Button } from '@/ui/Button';
import { Modal } from '@/ui/Modal';

interface RowEdit {
  text?: string;
  author?: string;
  include?: boolean;
}

/**
 * Bulk quote import (blueprint §7): a big text field on the left and a live,
 * editable preview on the right. Duplicates are flagged and skipped by default.
 */
export function QuoteImportDialog({ onClose }: { onClose(): void }) {
  const t = useT();
  const existing = useLibrary((s) => s.quotes);
  const [text, setText] = useState('');
  const [eachLine, setEachLine] = useState(false);
  // Edits are keyed by the parsed row, so they survive typing elsewhere in the text.
  const [edits, setEdits] = useState<Record<string, RowEdit>>({});

  const rows = useMemo(() => {
    const known = new Set(existing.map((q) => quoteKey(q.text)));
    const seen = new Set<string>();
    return parseQuotes(text, { eachLine }).map((parsed, index) => {
      const key = `${index}\u0000${parsed.text}\u0000${parsed.author ?? ''}`;
      const k = quoteKey(parsed.text);
      const duplicate = known.has(k) || seen.has(k);
      seen.add(k);
      const edit = edits[key] ?? {};
      return {
        key,
        duplicate,
        text: edit.text ?? parsed.text,
        author: edit.author ?? parsed.author ?? '',
        include: edit.include ?? !duplicate,
      };
    });
  }, [text, eachLine, existing, edits]);

  const included = rows.filter((r) => r.include && r.text.trim());
  const withAuthor = rows.filter((r) => r.author.trim()).length;
  const edit = (key: string, patch: RowEdit) => setEdits((all) => ({ ...all, [key]: { ...all[key], ...patch } }));

  const submit = async () => {
    const quotes = included.map((r) => createQuote(r.text.trim(), r.author.trim() || undefined));
    await useLibrary.getState().addQuotes(quotes);
    toast(t('import.done', { count: quotes.length }));
    onClose();
  };

  return (
    <Modal
      size="wide"
      title={t('import.title')}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" disabled={!included.length} onClick={() => void submit()}>
            {t('import.submit', { count: included.length })}
          </Button>
        </>
      }
    >
      <div className="grid h-full min-h-0 grid-rows-[minmax(10rem,40%)_1fr] gap-4 p-0.5 md:grid-cols-2 md:grid-rows-1">
        <div className="flex min-h-0 flex-col gap-2">
          <textarea
            data-autofocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('import.placeholder')}
            aria-label={t('import.title')}
            spellCheck={false}
            className="min-h-0 flex-1 resize-none rounded-lg border border-line bg-bg p-3 font-serif text-[15px] leading-relaxed placeholder:text-faint"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={eachLine}
                onChange={(e) => setEachLine(e.target.checked)}
                className="accent-(--vb-accent)"
              />
              {t('import.eachLine')}
            </label>
            <span className="text-[12px] text-faint">{t('import.hint')}</span>
          </div>
        </div>

        <div className="flex min-h-0 flex-col">
          <p className="pb-2 text-[13px] font-medium" data-testid="import-summary" aria-live="polite">
            {rows.length ? t('import.recognized', { count: rows.length, authors: withAuthor }) : t('import.empty')}
          </p>
          <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {rows.map((row) => (
              <li
                key={row.key}
                data-testid="import-row"
                className={`flex gap-3 rounded-lg border border-line p-2.5 transition-opacity duration-(--vb-fast) ${row.include ? '' : 'opacity-50'}`}
              >
                <input
                  type="checkbox"
                  checked={row.include}
                  aria-label={t('import.include')}
                  onChange={(e) => edit(row.key, { include: e.target.checked })}
                  className="mt-1.5 self-start accent-(--vb-accent)"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <textarea
                    value={row.text}
                    aria-label={t('import.text')}
                    rows={Math.min(6, Math.max(1, Math.ceil(row.text.length / 36)))}
                    onChange={(e) => edit(row.key, { text: e.target.value })}
                    className="w-full resize-none rounded border border-transparent bg-transparent px-1 font-serif [field-sizing:content] text-[14px] leading-snug hover:border-line focus:border-line"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-faint">—</span>
                    <input
                      value={row.author}
                      placeholder={t('import.author')}
                      aria-label={t('import.author')}
                      onChange={(e) => edit(row.key, { author: e.target.value })}
                      className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 text-[12px] text-muted placeholder:text-faint hover:border-line focus:border-line"
                    />
                    {row.duplicate && (
                      <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">
                        {t('import.duplicate')}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Modal>
  );
}
