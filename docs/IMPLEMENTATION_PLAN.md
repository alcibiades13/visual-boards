# Visual Boards — Implementacioni plan

Izvor istine je [BLUEPRINT.md](BLUEPRINT.md). Ovaj dokument samo prevodi blueprint u konkretne module, fajlove i redosled rada. Odluke koje blueprint ne pokriva idu u [DECISIONS.md](DECISIONS.md).

## 1. Struktura koda

```
src/
  model/            tipovi iz sekcije 4 + podrazumevane vrednosti, fabrike (createBoard, createItem…)
  data/
    db.ts           Dexie šema (boards, assets, quotes, blobs, meta) + migracije
    repos/          interfejsi BoardRepo / AssetRepo / QuoteRepo / BlobRepo + Dexie implementacije
    backup/         zip export/import (M2)
  layout/           LayoutEngine interfejs, masonry.ts, freeform.ts, registry — čiste funkcije + testovi
  import/           quoteParser.ts — čista funkcija + testovi
  images/           worker za obradu slika, pool (max 4), hash, object-URL keš
  store/            Zustand: boardStore (Immer patches → undo/redo), libraryStore, uiStore
  ui/               primitivna UI dugmad, ikonice, modal, sheet, toast
  features/
    dashboard/      lista boardova, novi board, backup podsetnik
    library/        panel slika i citata, upload, bulk import citata
    board/          BoardView (jedan renderer), Card, drag & drop, virtualizacija
    inspector/      kontekstni inspektor
    export/         PNG export, presentation mode
  i18n/             en.ts, sr.ts + useT()
  styles/           tokens.css (CSS varijable, svetla/tamna tema), Tailwind ulaz
  app/              App, hash ruter, persist() na prvom pokretanju
tests/e2e/          Playwright smoke testovi po milestone-u
```

Pravila koja se proveravaju u code review-u: komponente uvoze samo iz `data/repos` (nikad `dexie`), `layout/` i `import/` ne uvoze React ni DOM, nijedna komponenta nije specifična za layout.

## 2. Ključni tokovi podataka

- **Library**: `AssetRepo`/`QuoteRepo` → `libraryStore` (Zustand, učitava se jednom, ažurira se posle svakog upisa). Nije deo undo istorije.
- **Board**: `BoardRepo.get(id)` → `boardStore.board`. Svaka izmena ide kroz `boardStore.apply(recipe, {group?})` koji koristi `produceWithPatches`; patches i inverse patches idu na undo stek (100 koraka). Drag se grupiše: `beginGroup()` na početku, `endGroup()` na kraju → jedan korak.
- **Čuvanje**: `boardStore` subscribe → debounce 500ms → `BoardRepo.put`. Na `visibilitychange: hidden` i `pagehide` odmah flush.
- **Layout**: `useComputedLayout(board, sizes, viewportWidth)` → `registry[board.activeLayout].compute(...)` → `ComputedLayout`. `BoardView` crta `rects` apsolutno sa `transform: translate()`, ne zna koji je layout.
- **Veličine kartica**: slike iz `width/height` asseta + aspect ratio; citat/tekst kartice mere se jednom skrivenim DOM elementom, keš po `quoteId + širina + stil`.
- **Slike u prikazu**: `useBlobUrl(blobId)` iz ref-counted keša object URL-ova; kad broj referenci padne na 0 i prođe kratak grace period → `revokeObjectURL`.

## 3. Obrada slika (M1)

`images/worker.ts` (module worker): prima `File`/`Blob`, radi
1. HEIC detekcija (magic bytes `ftypheic/heix/mif1`) → `heic2any` (lazy import u main thread-u, jer heic2any zahteva DOM),
2. `createImageBitmap(blob, { imageOrientation: 'from-image' })`,
3. `OffscreenCanvas` resize na max 2400px → `convertToBlob({ type: 'image/webp', quality: 0.85 })` (JPEG fallback ako browser vrati PNG),
4. thumbnail 640px (vidi DECISIONS.md),
5. SHA-256 (`crypto.subtle.digest`) nad originalnim bajtovima → hash.

Pool od 4 workera, red zadataka, `AbortController` za otkazivanje, callback po završenoj slici → upis u bazu → thumbnail odmah vidljiv. Traka napretka „37/120“.

## 4. Milestone-ovi — konkretan rad

### M0 — Temelj
- Vite + React 18 + TS strict, Tailwind v4 (`@tailwindcss/vite`), ESLint (flat config), Vitest, Playwright.
- `src/model/types.ts` — kompletni tipovi iz sekcije 4 (+ `FontId`, `FrameId`, `LayoutParams` po layoutu).
- `src/data/db.ts` + repozitorijumi sa Dexie implementacijom; testovi preko `fake-indexeddb`.
- `styles/tokens.css`: topla bela / grafitna tema preko `prefers-color-scheme`, jedan akcent.
- Fontovi: Newsreader (serif, naslovi i citati), Inter (sans, UI) preko `@fontsource-variable`.
- `navigator.storage.persist()` na prvom pokretanju (zapis u `meta` tabelu).
- Minimalna ljuska aplikacije: hash ruter (`#/`, `#/b/:id`), prazan dashboard, i18n (en/sr).
- Playwright smoke: aplikacija se otvara, nema grešaka u konzoli.

### M1 — Library i upload
- Worker pipeline (sekcija 3 ovde), dedupe po hash-u + toast „N slika je već u library-ju“.
- Library panel: masonry mreža thumbnailova (isti masonry engine), klizač 2–4 kolone, selekcija (klik, Shift, Cmd/Ctrl, long-press), favorite, brisanje sa potvrdom („Koristi se na N boardova“ iz izračunatog indeksa upotrebe), filteri i sort.
- Globalni drop fajlova/foldera (`webkitGetAsEntry` za foldere), paste (Ctrl/Cmd+V), drag slike iz drugog taba (`text/uri-list` → fetch, uz poruku ako CORS blokira).
- `import/quoteParser.ts` + testovi za sve formate; modal sa tekstom levo i živim preview-om desno (izmena, isključivanje, duplikati preskočeni).
- Citati: lista, pretraga, favoriti.

### M2 — Boardovi i backup
- Dashboard: kartice boardova (cover ili 4 slike, brojevi, vreme izmene), „Novi board“ sa 4 preseta, rename/duplicate/delete.
- Autosave + flush na `pagehide`.
- Backup: `fflate` zip (`data.json` + `images/`), import sa izborom spoji/zameni; test round-trip; podsetnik posle 30 dana.

### M3 — Masonry wall
- `layout/masonry.ts`: shortest-column, span 1–3, sekcije kao blokovi preko cele širine, razdelnici po mesecima, auto kolone iz `minColumnWidth`. Testovi: redosled, bez rupa, span, sekcije, determinizam.
- `BoardView` sa virtualizacijom (rect ∩ viewport ± 1 ekran), FLIP animacija 200ms.
- dnd-kit: drag iz library-ja (jedna ili više slika) na indeks umetanja; reorder sa placeholderom; `TouchSensor` sa delay-om za long-press.
- „Dodaj sve neiskorišćene“.

### M4 — Kartice
- Jedna `<Card>`: face renderer (image / quote / text), overlay (9 pozicija, 7 efekata, intenzitet, auto-fit teksta do 60% površine), flip (rotateY 450ms, crossfade za reduced-motion, Enter/Space, `aria-pressed`), caption, aspect + focal, radius/senka/border.
- Drop citata na sliku → popover „Preko slike / Na poleđinu“.

### M5 — Freeform i prebacivanje layouta
- `layout/freeform.ts` + logika prebacivanja (flow → canvas seed iz izračunatih rect-ova; novi itemi u prvi slobodan prostor ispod sadržaja). Test scenario iz blueprinta kao unit test nad store-om.
- Pomeranje, resize ručke (≥44px na dodir), z-order, lock; zoom/pan (točkić, pinch, Space+drag).

### M6 — Undo/redo i inspektor
- Undo/redo je infrastrukturno u store-u od M3; ovde: ograničenje 100 koraka, grupisanje svih drag/resize gestova, UI dugmad, sve prečice.
- Inspektor: kartica / više kartica / board.

### M7 — Responsive poliranje
- Tablet fioka, plutajući inspektor / sheet; telefon: donja traka library-ja, FAB „+“, kontekstni toolbar.

### M8 — Export, prikaz, PWA
- PNG export (`modern-screenshot`) sa full slikama, segmentacija za dugačke zidove, 1–3×.
- Presentation mode (Fullscreen API), lightbox sa strelicama.
- `vite-plugin-pwa`, offline test.

## 5. Proces

Svaki milestone: kratak plan → implementacija → `npm run typecheck && npm run lint && npm test && npm run e2e` → provera na 1440/1024/390px → commit + push → izveštaj i čekanje na „Continue with Milestone N“.

## 6. Ideje iz neformalnog razgovora

Razgovor sa drugim agentom je konzistentan sa blueprintom, a blueprint je već preuzeo većinu ideja i rasporedio ih po fazama. Sledeće nije u MVP-u i ostaje za kasnije (bez koda u MVP-u, ali model ih ne blokira): contact sheet / film strip (flow layout, „kasnije“), zone kao vizuelni blokovi u canvas layoutu (u MVP-u su sekcije samo u flow layoutima), hover efekti kao podesiva interakcija, kolekcije.
