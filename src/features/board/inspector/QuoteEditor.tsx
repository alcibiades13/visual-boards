import { useState } from 'react';
import { useT } from '@/i18n';
import type { ID, Quote } from '@/model';
import { useLibrary } from '@/store/libraryStore';
import { inputClass } from './fields';

/** Edits a library quote in place; saved on blur so typing does not rewrite storage on every key. */
export function QuoteEditor({ quoteId }: { quoteId: ID }) {
  const quote = useLibrary((s) => s.quotes.find((q) => q.id === quoteId));
  if (!quote) return null;
  // Remount when the quote changes elsewhere (e.g. edited in the library).
  return <QuoteFields key={`${quote.text}\u0000${quote.author ?? ''}`} quote={quote} />;
}

function QuoteFields({ quote }: { quote: Quote }) {
  const t = useT();
  const [text, setText] = useState(quote.text);
  const [author, setAuthor] = useState(quote.author ?? '');
  const save = () => {
    if (!text.trim()) return setText(quote.text);
    if (text !== quote.text || author !== (quote.author ?? '')) {
      void useLibrary.getState().updateQuote(quote.id, { text: text.trim(), author });
    }
  };
  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        value={text}
        rows={3}
        aria-label={t('inspector.quote')}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        className={`${inputClass} resize-y font-serif text-[14px] leading-snug [field-sizing:content]`}
      />
      <input
        value={author}
        placeholder={t('inspector.author')}
        aria-label={t('inspector.author')}
        onChange={(e) => setAuthor(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className={inputClass}
      />
      <span className="text-[12px] leading-snug text-faint">{t('inspector.quoteEditHint')}</span>
    </div>
  );
}
