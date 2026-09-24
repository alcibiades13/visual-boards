import { useRef, useState } from 'react';
import { useT } from '@/i18n';
import { useLibrary } from '@/store/libraryStore';
import { useLibraryView, type LibraryTab } from '@/store/libraryViewStore';
import { useUpload } from '@/store/uploadStore';
import { Button } from '@/ui/Button';
import { QuoteIcon, UploadIcon } from '@/ui/icons';
import { ImageLibrary } from './ImageLibrary';
import { QuoteImportDialog } from './QuoteImportDialog';
import { QuoteLibrary } from './QuoteLibrary';

/** The library: images and quotes shared by every board. Fills its container. */
export function LibraryPanel() {
  const t = useT();
  const tab = useLibraryView((s) => s.tab);
  const imageCount = useLibrary((s) => s.assets.length);
  const quoteCount = useLibrary((s) => s.quotes.length);
  const fileInput = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const tabs: [LibraryTab, string, number][] = [
    ['images', t('library.tab.images'), imageCount],
    ['quotes', t('library.tab.quotes'), quoteCount],
  ];

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label={t('library.title')}>
      <div className="flex items-end justify-between gap-3 border-b border-line">
        <div role="tablist" className="flex gap-4">
          {tabs.map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => useLibraryView.getState().set({ tab: id })}
              className="-mb-px border-b-2 border-transparent pt-1 pb-2 text-sm text-muted transition-colors duration-(--vb-fast) hover:text-ink aria-selected:border-ink aria-selected:text-ink"
            >
              {label} <span className="ml-0.5 text-[12px] text-faint tabular-nums">{count}</span>
            </button>
          ))}
        </div>
        <div className="pb-1.5">
          {tab === 'images' ? (
            <Button variant="primary" size="sm" onClick={() => fileInput.current?.click()}>
              <UploadIcon size={15} />
              {t('library.upload')}
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={() => setImporting(true)}>
              <QuoteIcon size={15} />
              {t('library.importQuotes')}
            </Button>
          )}
        </div>
      </div>

      <input
        ref={fileInput}
        type="file"
        multiple
        accept="image/*,.heic,.heif"
        hidden
        data-testid="upload-input"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          useUpload.getState().start(files);
        }}
      />

      {tab === 'images' ? <ImageLibrary /> : <QuoteLibrary />}
      {importing && <QuoteImportDialog onClose={() => setImporting(false)} />}
    </section>
  );
}
