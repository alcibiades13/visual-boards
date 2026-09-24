Visual Boards — Blueprint v1.1
Sep 24, 2026 · @Bane
1. Svrha i principi
Visual Boards je lični alat za prikupljanje i komponovanje vizuelne inspiracije: fotografija, citata i kratkih tekstova. Isti sadržaj se prikazuje na više načina (inspiration wall, vision board, moodboard, gallery wall), bez ponovnog pravljenja boarda.
The user brings the inspiration. The app helps them compose it.
Ciljni korisnik u v1: jedna osoba (vlasnik), prvenstveno na desktopu, uz punu upotrebljivost na tabletu i telefonu. Nema naloga, nema servera, sve se čuva lokalno. Arhitektura mora dozvoliti kasniji prelazak na više korisnika bez prepisivanja editora (sekcija 13).
Principi koji odlučuju sporove:
1. Sadržaj i raspored su odvojeni. Promena layouta nikad ne briše ništa, ni sadržaj ni ručno podešene pozicije.
2. Ubacivanje sadržaja mora biti bez trenja: 100 slika ili 50 citata odjednom, paste iz clipboarda, drag iz browsera.
3. Drag & drop je primarna interakcija, ali znači različite stvari u različitim layoutima (sekcija 5).
4. Jedna komponenta kartice pokriva sliku, citat, overlay, flip i polaroid (sekcija 6).
5. Distinktivne stvari (beskonačni wall, flip, citat preko slike) su u MVP-u. Standardne editor funkcije (crop, grupe, snapping) dolaze posle.
6. Sadržaj je u fokusu. UI je miran, editorijalni, sa minimumom hroma.
7. Nije Canva: nema hiljada templatea, nema AI generisanja slika ili teksta.
2. Scope po fazama
MVP je aplikacija koju vlasnik može svakodnevno da koristi za inspiration wall i vision board. Faza 2 dodaje generisane kompozicije i poliranje editora. Faza 3 je prelazak na javni proizvod.
MVP (lična upotreba):
• Dashboard sa boardovima: create, rename, duplicate, delete
• Library: bulk upload slika (100+), thumbnailovi, multi-select, favorite, filter „neiskorišćeno“, sort
• Bulk import citata sa preview-om i prepoznavanjem autora
• Paste slike iz clipboarda i drag slike iz drugog taba/foldera direktno na board
• Flow layout Masonry wall: beskonačna visina, reorder drag-om, podesiv broj kolona i razmak, sekcije sa naslovima
• Canvas layout Freeform: pomeranje, resize, z-order, lock
• Kartica: slika, citat, citat preko slike (pozicija + efekat čitljivosti), flip (slika napred, citat pozadi), caption
• Layout switching bez gubitka podataka
• Osnovni stil: pozadina boarda, font citata, radius, senka, border
• Undo/redo
• Export PNG (vidljivi deo ili ceo board), JSON backup/restore celog library-ja
• Presentation mode (bez editora, flip i fullscreen rade)
• Responsive: desktop, tablet, telefon (sekcija 8)
Faza 2 (poliranje i generatori):
• Generatori kompozicija: Gallery Wall (presets), Polaroid, Photobook stranice, Shuffle
• Crop, rotacija, grupe, snapping i alignment guides
• Izvlačenje palete boja, sort po boji, predlog pozadine
• Export kao wallpaper (telefon, desktop) i PDF
• Linkovi na karticama, slideshow
• Pozadine zidova (gips, beton, drvo, papir), okviri
• Suggest readable position za overlay
• Kolekcije i tagovi u library-ju
Faza 3 (javni proizvod):
• Nalozi, sync u cloud, deljenje linkom (private / unlisted / public)
• Share-sheet na telefonu, browser ekstenzija za brzo čuvanje
Non-goals: društvena mreža, komentari, lajkovi, real-time kolaboracija, AI generisanje slika ili teksta, video, 3D zidovi, marketplace, templatei za Instagram i slično.
3. Tech stack
Aplikacija je local-first PWA bez backenda: React + TypeScript u browseru, podaci i slike u IndexedDB. Tako nema naloga, troškova hostinga ni kasnjenja, a radi i offline.
Sloj
Izbor
Zašto
Build
Vite + React 18 + TypeScript (strict)
Brz dev, nema potrebe za serverom kao kod Next.js
Stanje
Zustand + Immer (sa patches)
Jednostavno; Immer patches daju undo/redo besplatno
Baza
Dexie (IndexedDB)
Blobovi slika + JSON boardova lokalno, sa upitima i verzijama šeme
Drag & drop
dnd-kit
Radi mišem i dodirom, podržava sortable liste (masonry reorder) i slobodan drag
Render boarda
DOM + CSS transform, ne <canvas>
Flip animacije, tekst, fontovi i overlay efekti su trivijalni u DOM-u
Obrada slika
Web Worker + createImageBitmap + OffscreenCanvas
Resize i thumbnailovi ne blokiraju UI
HEIC
heic2any, lazy-load samo kad zatreba
iPhone fotografije
Stilovi
Tailwind CSS + CSS varijable za teme
Brzo, konzistentno, lako za agenta
Fontovi
Self-hosted preko @fontsource
Export i offline rad bez eksternih zahteva
Export
modern-screenshot (ili html-to-image)
DOM u PNG; slike su lokalni blobovi, pa nema CORS problema
PWA
vite-plugin-pwa
Instalacija na telefon/tablet, offline
Testovi
Vitest (layout engine, parseri), Playwright (smoke)
Layout algoritmi su čiste funkcije i moraju imati testove
Trajnost podataka: na prvom pokretanju pozvati navigator.storage.persist() da browser ne obriše podatke pri nedostatku prostora. Export/import JSON+ZIP backupa je obavezan u MVP-u, jer je lokalni storage jedina kopija.
Sinhronizacija između uređaja u v1 ne postoji. Prelazak na tablet ili telefon ide preko backup fajla. Ako se to pokaže kao smetnja, najmanji korak je Supabase sync (sekcija 13).
Pristup podacima ide isključivo kroz repository sloj (BoardRepo, AssetRepo, QuoteRepo). Komponente nikad ne pozivaju Dexie direktno. Tako se kasnije IndexedDB zamenjuje ili dopunjuje cloud backendom bez diranja UI-ja.
4. Data model
Sadržaj (items, redosled, stil) je zajednički za sve layoute. Svaki layout pamti samo svoj raspored u layouts[layoutId]. To je temelj nedestruktivnog prebacivanja layouta.
type ID = string;        // nanoid
type ISODate = string;

// ---------- Library (deli se između svih boardova) ----------

interface ImageAsset {
  id: ID;
  fileName: string;
  width: number;          // posle resize-a
  height: number;
  fullBlobId: ID;         // max 2400px dugu stranu, WebP/JPEG
  thumbBlobId: ID;        // ~480px, za library i brz prikaz
  hash: string;           // za detekciju duplikata pri uploadu
  palette?: string[];     // faza 2: dominantne boje (hex)
  favorite: boolean;
  tags: string[];
  createdAt: ISODate;
  ownerId?: ID;           // prazno u v1, popunjava se u fazi 3
}

interface Quote {
  id: ID;
  text: string;
  author?: string;
  favorite: boolean;
  tags: string[];
  createdAt: ISODate;
  ownerId?: ID;
}

// ---------- Board ----------

interface Board {
  id: ID;
  schemaVersion: number;
  title: string;                       // npr. "Vision Board — Autumn 2026"
  preset: 'blank' | 'wall' | 'vision' | 'moodboard' | 'gallery';  // samo početna podešavanja
  items: BoardItem[];                  // redosled = redosled u flow layoutima
  sections: Section[];
  activeLayout: LayoutId;
  layouts: Partial<Record<LayoutId, LayoutState>>;
  theme: BoardTheme;
  coverItemId?: ID;
  createdAt: ISODate;
  updatedAt: ISODate;
  ownerId?: ID;
}

interface Section { id: ID; title: string; }   // "Health", "Travel", "Mart 2026"...

// ---------- Kartica: jedna komponenta za sve ----------

interface BoardItem {
  id: ID;
  sectionId?: ID;
  front: Face;
  back?: Face;            // postoji => flip kartica
  caption?: string;       // ispod slike (polaroid stil)
  link?: string;          // faza 2
  style: ItemStyle;
  addedAt: ISODate;       // za "living board" razdelnike po mesecima
}

type Face =
  | { kind: 'image'; assetId: ID; focal?: { x: number; y: number }; overlay?: TextOverlay }
  | { kind: 'quote'; quoteId: ID; textStyle?: TextStyle }
  | { kind: 'text';  text: string; textStyle?: TextStyle };   // lokalni tekst, nije u library-ju

interface TextOverlay {
  source: { quoteId: ID } | { text: string };
  position: 'tl' | 'tc' | 'tr' | 'cl' | 'c' | 'cr' | 'bl' | 'bc' | 'br';
  effect: 'shadow' | 'dark-gradient' | 'light-gradient' | 'panel' | 'blur' | 'outline' | 'none';
  intensity: number;      // 0..1
  textStyle?: TextStyle;
}

interface TextStyle {
  font: FontId;
  size: 'auto' | number;  // 'auto' = uklopi u karticu
  weight: 400 | 500 | 600 | 700;
  italic: boolean;
  align: 'left' | 'center' | 'right';
  color: string;
  background?: string;
}

interface ItemStyle {
  aspect: 'original' | '1:1' | '4:5' | '3:4' | '3:2' | '16:9';
  radius: number;
  shadow: 'none' | 'soft' | 'lifted';
  border?: { width: number; color: string };
  frame?: FrameId;        // faza 2
}

// ---------- Layout state (po layoutu) ----------

type LayoutId = 'masonry' | 'freeform' | 'gallery-wall' | 'polaroid' | 'photobook';

interface LayoutState {
  params: LayoutParams;                     // tipizirano po layoutu, vidi sekciju 5
  placements: Record<ID, Placement>;        // koristi se u canvas layoutima
  overrides: Record<ID, FlowOverride>;      // koristi se u flow layoutima
}

interface Placement { x: number; y: number; w: number; h: number; rotation: number; z: number; locked?: boolean; }
interface FlowOverride { span?: 1 | 2 | 3; }   // kartica šira preko više kolona

interface BoardTheme {
  background: { kind: 'color'; value: string } | { kind: 'gradient'; value: string } | { kind: 'image'; assetId: ID };
  gap: number;
  defaultFont: FontId;
}
Pravila referenci:
• Kartica referencira sliku i citat iz library-ja, ne kopira ih. Izmena citata u library-ju menja ga svuda.
• Brisanje slike ili citata koji se koristi: prvo dijalog „Koristi se na 3 boarda“. Ako korisnik potvrdi, kartice sa tom referencom prikazuju diskretan placeholder, ne pucaju.
• Kartica se nikad ne briše automatski. Kad se doda na board, dobija placement u svakom canvas layoutu tek kad se taj layout prvi put otvori.
• Indeks upotrebe (assetId → boardId[]) se računa iz boardova, ne čuva se ručno.
Dexie tabele: boards, assets, quotes, blobs (id + Blob). Svaka promena šeme ide kroz Dexie version().upgrade(), a schemaVersion u boardu omogućava migraciju starih backup fajlova.
5. Layout sistem
Postoje dve porodice layouta i editor uvek zna u kojoj je. Flow layout računa pozicije iz redosleda; canvas layout čuva pozicije koje je korisnik postavio. Generatori (faza 2) samo popunjavaju canvas pozicije jednim klikom.
Layout
Porodica
Šta znači drag
Inspektor prikazuje
Faza
Masonry wall
flow
premesti u redosledu
kolone, razmak, span kartice
MVP
Freeform
canvas
pomeri na x/y
pozicija, veličina, z-order, lock
MVP
Gallery Wall
canvas + generator
pomeri na x/y
preset, razmak, okvir, zid
2
Polaroid
canvas + generator
pomeri na x/y
rotacija, caption
2
Photobook
canvas + generator, po stranama
pomeri unutar strane
raspored strane, margine
2
Contact sheet / Film strip
flow
premesti u redosledu
veličina ćelije
kasnije
Zajednički interfejs
interface LayoutEngine<P> {
  id: LayoutId;
  family: 'flow' | 'canvas';
  defaultParams: P;
  // Čista funkcija: isti ulaz = isti izlaz. Pokrivena unit testovima.
  compute(input: {
    items: BoardItem[];
    sections: Section[];
    sizes: Record<ID, { w: number; h: number }>;   // prirodne dimenzije kartica
    params: P;
    state: LayoutState;
    viewportWidth: number;
  }): ComputedLayout;
}

interface ComputedLayout {
  rects: Record<ID, { x: number; y: number; w: number; h: number; rotation: number; z: number }>;
  headers: { sectionId: ID; y: number; h: number }[];
  width: number;
  height: number;    // za wall: raste sa sadržajem
}
Renderer ne zna koji je layout aktivan. On samo crta rects kroz CSS transform. Novi layout = novi fajl sa LayoutEngine implementacijom, bez izmena editora.
Masonry wall (MVP)
• Algoritam: shortest-column. Svaka kartica ide u trenutno najnižu kolonu. Kartica sa span: 2 zauzima dve susedne kolone i staje na visinu više od njih.
• Visine su poznate unapred. Slike imaju width/height u asset-u, pa layout ne skače dok se slike učitavaju. Visina citat kartice se meri jednom (skriveni DOM element ili canvas.measureText) i kešira po quoteId + širina + stil.
• Kolone: columns: number | 'auto'. Auto računa broj iz minColumnWidth (npr. 260px) i širine ekrana: 4–6 na desktopu, 3 na tabletu, 2 na telefonu.
• Sekcije: svaka sekcija počinje novim masonry blokom ispod naslova preko cele širine. Kartice bez sekcije idu u prvi blok.
• Beskonačna visina: visina = najviša kolona + padding. Na dnu uvek stoji drop zona „Dodaj još“.
• Reorder: tokom draga računa se najbliži indeks umetanja prema poziciji pokazivača nad izračunatim rect-ovima, layout se preračuna sa placeholderom na tom mestu, a ostale kartice se animirano pomeraju (FLIP tehnika, 200ms).
• Virtualizacija: renderuju se samo kartice čiji rect seče viewport ± jedan ekran. Cilj: 1000 kartica bez trzanja skrola.
• Living board: opcija „Razdelnici po mesecima“ prikazuje naslov meseca iz addedAt kao automatsku sekciju.
Freeform (MVP)
• Board ima logičku veličinu: preset (1920×1080, A4, 9:19.5 telefon, kvadrat) ili auto visinu koja raste kad se kartica spusti ispod dna.
• Koordinate su u logičkim jedinicama. Zoom i pan su samo prikaz i ne menjaju podatke.
• Resize uz Shift čuva proporcije; za slike je očuvanje proporcija podrazumevano.
Prebacivanje layouta
1. Flow → canvas, prvi put: placements se popunjavaju iz trenutno izračunatih flow rect-ova. Korisnik vidi isti raspored i nastavlja da ga slobodno menja.
2. Canvas → flow → canvas: canvas placements ostaju netaknuti.
3. Kartica dodata dok je aktivan drugi layout: u canvas layoutu dobija mesto u prvom slobodnom prostoru ispod postojećeg sadržaja.
4. Redosled items menja samo flow reorder ili lista slojeva. Pomeranje u canvasu ne menja redosled.
Generatori (faza 2)
Generator je čista funkcija (items, params, seed) → Record<ID, Placement> koja upisuje placements u svoj canvas layout. Gallery Wall preseti: 3×3, 2 velike + 4 male, centralna slika, salon wall, horizontalni i vertikalni niz. Shuffle poziva generator sa 4 različita seed-a i prikazuje 4 mini pregleda; korisnik bira jedan. Ako je korisnik već ručno menjao raspored, ponovno generisanje traži potvrdu i ide u undo istoriju.
6. Kartice
Svaki element na boardu je BoardItem sa jednom ili dve strane, i sve ga crta jedna komponenta <Card>. Nema posebnih komponenti za „quote element“, „flip element“ ili „polaroid element“.
Šta korisnik vidi
Kako je modelovano
Obična slika
front: image
Citat kartica
front: quote
Citat preko slike
front: image + overlay
Flip kartica
front: image, back: quote (ili bilo koja kombinacija)
Polaroid
front: image + caption + stil okvira
Naslov ili beleška
front: text
Kako se pravi (bez menija i formi)
• Citat preko slike: prevući citat iz library-ja i spustiti ga na sliku. Pojavljuje se mali izbor: „Stavi preko slike“ ili „Stavi na poleđinu“. Isti izbor postoji u inspektoru.
• Flip: u inspektoru „Dodaj poleđinu“, pa izabrati citat iz library-ja ili upisati tekst.
• Obrnuto: „Ukloni overlay“ i „Ukloni poleđinu“ vraćaju karticu u običnu sliku, citat ostaje u library-ju.
Overlay citata
• Pozicija: mreža 3×3 kao vizuelni birač (devet tačkica preko umanjene slike), ne padajuća lista.
• Efekti čitljivosti: senka teksta, tamni gradijent, svetli gradijent, providni panel, blur panel (backdrop-filter), outline, bez efekta. Klizač „Intenzitet“ 0–100%. Gradijent kreće od ivice na kojoj je tekst.
• Veličina teksta auto: tekst se smanjuje dok ne stane u najviše 60% površine slike, sa minimalnom čitljivom veličinom. Ako ni tada ne staje, prikazuje se upozorenje u inspektoru.
• Faza 2, „Predloži poziciju“: slika se podeli na 9 zona, za svaku se izračuna varijansa osvetljenosti na umanjenoj verziji, i predloži se najmirnija zona. Samo predlog, ne automatska promena.
Flip
• Klik ili tap okreće karticu (CSS 3D rotateY, 450ms, ease-out). Ponovni klik vraća.
• U editoru flip radi samo na dugme u uglu kartice (ikonica okretanja), jer običan klik služi za selekciju. U presentation modu i na zidu u režimu gledanja okreće ceo klik.
• prefers-reduced-motion: umesto rotacije kratak crossfade.
• Na tastaturi: fokusirana kartica + Enter ili razmak okreće. Kartica ima aria-pressed i opis obe strane.
Stil kartice
Odnos stranica (original, 1:1, 4:5, 3:4, 3:2, 16:9) seče sliku kroz object-fit: cover sa podesivom tačkom fokusa (focal). To je „laki crop“ za MVP; pravi crop sa pravougaonikom dolazi u fazi 2. Ostalo: radius, senka (none / soft / lifted), border, a u fazi 2 okviri (tanki crni, beli passe-partout, drvo, zlatni).
7. Library i ubacivanje sadržaja
Library je jedna za sve boardove i uvek je vidljiva pored boarda. Ubacivanje 100 slika ili 50 citata mora trajati jedan potez i nekoliko sekundi.
Upload slika
Izvori: dugme Upload (multi-select), drag fajlova ili foldera bilo gde u prozor, paste iz clipboarda (Ctrl/Cmd+V), drag slike iz drugog browser taba. Ako je drop direktno na board, slike idu i u library i na board na mestu spuštanja.
Pipeline po slici, u Web Workeru, najviše 4 paralelno:
1. HEIC → JPEG ako treba (lazy-load konvertera).
2. Ispravljanje EXIF orijentacije (createImageBitmap sa imageOrientation: 'from-image').
3. Resize na max 2400px duže strane, WebP kvalitet ~0.85 (JPEG fallback).
4. Thumbnail ~480px.
5. Hash za duplikate. Duplikat se ne dodaje ponovo; korisnik dobija obaveštenje „3 slike su već u library-ju“.
6. Upis u IndexedDB; thumbnail se pojavljuje u library-ju odmah po završetku te slike, ne na kraju celog batcha.
Tokom uploada: traka napretka („37/120“), mogućnost otkazivanja, a editor ostaje potpuno upotrebljiv.
Pregled slika u library-ju
• Veliki thumbnailovi u masonry mreži; klizač veličine (2–4 kolone u panelu).
• Selekcija: klik, Shift+klik za opseg, Cmd/Ctrl+klik za pojedinačne, „Izaberi sve“. Na dodir: dug pritisak ulazi u režim selekcije.
• Drag više selektovanih slika odjednom na board; u masonry-ju se umeću redom na mesto spuštanja.
• Filteri: sve / neiskorišćene na ovom boardu / favoriti. Sort: najnovije, najstarije, naziv; u fazi 2 po boji.
• Znak na thumbnailu ako je slika već na trenutnom boardu.
• Akcije nad selekcijom: dodaj na board, favorite, obriši (sa upozorenjem o upotrebi).
• Dugme „Dodaj sve neiskorišćene na kraj“ za brzo punjenje walla.
Bulk import citata
Modal sa velikim tekst poljem levo i živim preview-om desno („Prepoznato: 24 citata, 17 sa autorom“).
Pravila parsiranja:
• Podrazumevano: prazan red razdvaja citate. Preklopnik „Svaki red je citat“.
• Autor se prepoznaje na kraju citata u formatima | Autor, — Autor, – Autor, - Autor i u zasebnom poslednjem redu koji počinje crticom.
• Spoljni navodnici ("", „“, “”, «») se uklanjaju.
• Duplikati u odnosu na library se označavaju u preview-u i podrazumevano preskaču.
• U preview-u se svaki citat može ispraviti ili isključiti pre importa.
Parser je čista funkcija sa unit testovima za sve navedene formate.
Pregled citata u library-ju
Lista kartica sa pretragom po tekstu i autoru, favoritima i filterom „neiskorišćeni“. Citat se prevlači na prazan deo boarda (nova citat kartica) ili na sliku (overlay / poleđina). Dugme „Nasumičan citat“ ubacuje slučajni neiskorišćeni citat, što pomaže kod brzog komponovanja.
Paleta boja (faza 2)
Pri uploadu se iz thumbnaila izvuku 5 dominantnih boja (median cut ili k-means na ~2000 piksela). Koristi se za sort library-ja po boji, „color story“ raspored u kome kartice prelaze iz toplih u hladne tonove, i za predlog pozadine boarda i boje teksta koji se slažu sa sadržajem.
8. Editor UX
Desktop je primarno okruženje, ali tablet i telefon nisu suženi desktop: imaju sopstveni raspored istih funkcija. Sve funkcije MVP-a moraju raditi na sva tri, uz manje precizne kontrole na telefonu.
Dashboard i kreiranje
• Mreža boardova sa naslovnom slikom (cover ili prve 4 slike), nazivom, brojem slika i citata i vremenom izmene.
• „Novi board“: jedno polje za naziv i 4 velike kartice za početak (Inspiration Wall, Vision Board, Moodboard, Prazan). Enter i ulaziš u editor. Preset samo bira početni layout, sekcije i pozadinu, sve se kasnije menja.
• Vision Board preset nudi opcione sekcije (Zdravlje, Putovanja, Posao, Odnosi, Kreativnost, Dom) koje se mogu preimenovati ili obrisati.
• Prazan board prikazuje jasan poziv: „Ubaci slike ili prevuci iz library-ja“.
Desktop (≥ 1200px)
┌───────────────────────────────────────────────────────────┐
│ ←  Autumn 2026      [Masonry ▾]   Undo Redo   View  Export │
├─────────────┬─────────────────────────────┬─────────────┤
│ LIBRARY      │                             │ INSPEKTOR    │
│ Slike|Citati │          BOARD              │ (samo kad je │
│ filter/sort  │                             │  nešto       │
│ thumbnailovi │                             │  selektovano)│
│ + Upload     │                             │              │
└─────────────┴─────────────────────────────┴─────────────┘
• Library levo (širina se menja prevlačenjem, može se sakriti), board u sredini, inspektor desno samo kad postoji selekcija. Bez selekcije inspektor prikazuje podešavanja boarda (layout parametri, pozadina, razmak).
• Nema donjeg toolbara: sve boardske postavke su u inspektoru bez selekcije, što štedi vertikalni prostor.
• Prečice: Delete, Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z, Cmd/Ctrl+C/V/D, strelice (1px) i Shift+strelice (10px) u freeformu, F za flip selektovane kartice, Space+drag za pan, Cmd/Ctrl+scroll za zoom, Esc za poništavanje selekcije.
• Hover na kartici: suptilno podizanje senke i mali toolbar (flip, overlay, obriši).
Tablet (768–1199px)
• Library je fioka sa leve strane koja se otvara dugmetom i ostaje otvorena dok se prevlači.
• Inspektor je plutajući panel pored selektovane kartice ili donji sheet u portret orijentaciji.
• Olovka i prst rade kao miš: drag, pinch za zoom, dva prsta za pan.
Telefon (< 768px)
• Board na ceo ekran. Dole horizontalna traka library-ja (slike/citati tabovi); prevlačenje iz trake na board ili tap na thumbnail za „dodaj na kraj“.
• Plutajuće dugme „+“: upload iz galerije, kamera, uvoz citata, novi tekst.
• Selekcija: tap. Kontekstni toolbar iznad donjeg ruba: flip, overlay, stil, obriši. Detalji u donjem sheetu.
• Masonry reorder: dug pritisak, pa drag. Freeform: drag za pomeranje, ručke za resize minimum 44×44px.
• Promena layouta i podešavanja boarda su u meniju naslova.
Režimi
• Edit i View prekidač u zaglavlju. View je isti board bez library-ja i inspektora; klik okreće flip kartice, dvoklik otvara karticu preko celog ekrana.
• Presentation mode (sekcija 9) je View preko celog ekrana bez ikakvog UI-ja.
Vizuelni pravac
Miran, editorijalni UI: neutralna pozadina (topla bela / grafitna u tamnoj temi), jedan akcentni ton, serif za naslove boardova i citate, sans-serif za UI. Hrom je tanak i tih, sadržaj je najkontrastniji element na ekranu. Svetla i tamna tema prate sistem. Animacije kratke (150–250ms), bez razigranih efekata. Ne sme izgledati kao Canva, enterprise dashboard ili AI generator.
9. Export i prikaz
MVP izvozi PNG i pravi backup; wallpaper i PDF dolaze u fazi 2. Interaktivnost se ne „spljoštava“ u fajl: ona živi u View i Presentation modu.
PNG export (MVP)
• Opcije: vidljivi deo, ceo board, ili samo selektovane kartice. Rezolucija 1×, 2×, 3×.
• Flip kartice se izvoze sa prednjom stranom; opcija „Poleđine umesto lica“.
• Za dug wall: render u segmentima od najviše ~8000px visine koji se spajaju, uz upozorenje ako rezultat prelazi ograničenje browsera (~16k px po strani na nekim uređajima), sa ponudom da se izveze kao više fajlova.
• Tokom exporta se koriste pune slike (fullBlobId), ne thumbnailovi, a fontovi se čekaju preko document.fonts.ready.
Backup (MVP, obavezno)
• „Izvezi sve“ pravi jedan .zip sa data.json (boardovi, citati, meta slika) i folderom slika. „Uvezi“ vraća sve, sa izborom spoji / zameni.
• Podsetnik u dashboardu ako backup nije rađen duže od 30 dana i ima novih izmena.
• Ovo je ujedno način prenosa između računara, tableta i telefona u v1.
Presentation mode (MVP)
• Board preko celog ekrana (Fullscreen API), bez UI-ja; Esc izlazi.
• Wall se lagano skroluje mišem ili dodirom; freeform se uklapa u ekran.
• Klik okreće flip kartice, dvoklik otvara karticu preko celog ekrana sa strelicama za sledeću i prethodnu.
Faza 2
• Wallpaper export: preseti za iPhone i Android lock screen, iPad i desktop 16:9 / 16:10. Prikaz „safe zona“ za sat i ikonice preko pregleda. Korisnik bira deo boarda pomeranjem i zumiranjem okvira.
• PDF: za Photobook po stranama; za ostale layoute jedna strana ili više strana A4/Letter.
• Slideshow: kartica po kartica, automatska smena (5–15s) ili ručno, sa okretanjem flip kartica. Zamišljeno za jutarnju rutinu uz vision board.
10. Poznate zamke i zabrane
Ovo su greške koje agent najverovatnije napravi ako mu se eksplicitno ne zabrane. Svaka je ovde jer kasnije košta više dana prepravke.
Zabranjeno
Umesto toga
Zašto
Masonry preko CSS columns ili grid-template-rows: masonry
JS shortest-column algoritam, apsolutno pozicioniranje
CSS kolone ređaju odozgo nadole po koloni i ruše redosled; CSS masonry nije svuda podržan
Jedan transform / x-y po elementu
layouts[layoutId].placements
Inače prebacivanje layouta briše ručni rad
Poseban editor ili komponenta po layoutu
Jedan renderer + LayoutEngine po layoutu
Novi layout ne sme menjati editor
Posebne komponente za flip, overlay, polaroid
Jedna <Card> sa front / back / overlay
Manje koda, sve kombinacije rade automatski
backElementId koji pokazuje na drugi element
back: Face unutar kartice
Nema „siročeta“ ni skrivenih elemenata
Originalne slike u prikazu i library-ju
Thumbnail u library-ju i na zidu, full samo u zumu, fullscreen i exportu
100 fotografija od 5MB ubija memoriju telefona
Upload bez resize-a
Resize + EXIF + HEIC u Workeru pre upisa
Veličina baze, rotirane slike, iPhone
URL.createObjectURL bez revokeObjectURL
Keš object URL-ova sa oslobađanjem
Curenje memorije na dugim wallovima
Direktni Dexie pozivi iz komponenti
Repository sloj
Kasniji prelazak na cloud
Undo kao snimci celog stanja
Immer patches, grupisanje drag-a u jedan korak
Memorija i tačnost
Undo koji obuhvata library
Undo samo za board; brisanje iz library-ja traži potvrdu
Konfuzno ponašanje između boardova
Upis u bazu na svaki pomeraj miša
Debounce ~500ms + upis na visibilitychange / pagehide
Performanse i gubitak podataka pri zatvaranju taba
localStorage za podatke
IndexedDB (Dexie)
Ograničenje od ~5MB, sinhrono
Google Fonts sa CDN-a
@fontsource, self-hosted
Export i offline
Hover kao jedini način za akciju
Vidljiva dugmad ili tap/long-press ekvivalent
Tablet i telefon nemaju hover
Hardkodovane boje
CSS varijable (svetla/tamna tema)
Teme i kasnije brendiranje
Ostala pravila za kod:
• TypeScript strict, bez any u modelu podataka.
• Layout engine, parser citata i generatori su čiste funkcije sa unit testovima, bez zavisnosti od React-a i DOM-a.
• Svaka promena šeme ima Dexie migraciju i test da se stari backup učitava.
• Interakcije moraju biti dostupne tastaturom na desktopu; kartice imaju smislene aria oznake.
11. Milestone-ovi
MVP se gradi u 8 koraka. Svaki se završava aplikacijom koja radi i može se koristiti, a sledeći počinje tek kad su svi kriterijumi ispunjeni. Svaki milestone mora raditi na desktopu, tabletu i telefonu (proveriti u DevTools na 1440px, 1024px i 390px), a M7 služi samo za finalno poliranje.
M0 — Temelj
[ ] Vite + React + TS strict, Tailwind, Zustand, Dexie, Vitest, Playwright podešeni
[ ] Tipovi iz sekcije 4 u src/model/, repository sloj sa Dexie implementacijom
[ ] Tema (svetla/tamna) preko CSS varijabli, self-hosted fontovi (1 serif, 1 sans)
[ ] navigator.storage.persist() na prvom pokretanju
M1 — Library i upload
[ ] Upload 100 JPEG slika od ~5MB: UI ostaje responzivan, thumbnailovi se pojavljuju postepeno, ukupno ispod ~60s na prosečnom laptopu
[ ] HEIC sa iPhone-a se učitava; slike snimljene uspravno nisu rotirane
[ ] Duplikati se prepoznaju i preskaču uz obaveštenje
[ ] Paste slike iz clipboarda i drag fajlova u prozor rade
[ ] Multi-select (Shift, Cmd/Ctrl, long-press), favorite, brisanje sa potvrdom
[ ] Bulk import citata: svi formati iz sekcije 7 prepoznati, preview sa izmenom pre importa; parser pokriven testovima
[ ] Posle osvežavanja stranice sve je i dalje tu
M2 — Boardovi i backup
[ ] Dashboard: create (sa presetom), rename, duplicate, delete, cover
[ ] Autosave sa debounce-om; zatvaranje taba odmah posle izmene ne gubi izmenu
[ ] Export svega u .zip i import nazad u praznu bazu daje identično stanje
M3 — Masonry wall
[ ] Drag jedne ili više slika iz library-ja na zid, na tačno mesto spuštanja
[ ] Nema vertikalnih rupa većih od razmaka; redosled se čuva
[ ] Reorder drag-om sa animiranim pomeranjem ostalih kartica, mišem i dodirom
[ ] Kolone auto/ručno, razmak, span 1–3; sekcije sa naslovima; razdelnici po mesecima
[ ] 1000 kartica: skrol bez trzanja, layout se ne pomera dok se slike učitavaju
[ ] „Dodaj sve neiskorišćene“ i filter „neiskorišćene“ rade
M4 — Kartice
[ ] Citat kartica sa stilom teksta; tekst kartica za naslove i beleške
[ ] Citat spušten na sliku nudi „preko slike“ / „na poleđinu“
[ ] Overlay: 9 pozicija, 7 efekata, intenzitet, auto veličina teksta
[ ] Flip u View modu na klik, u Edit modu na dugme; reduced-motion radi
[ ] Aspect ratio + fokusna tačka, radius, senka, border, caption
[ ] Izmena citata u library-ju se vidi na svim karticama koje ga koriste
M5 — Freeform i prebacivanje layouta
[ ] Pomeranje, resize (proporcije za slike), z-order, lock, duplicate, delete
[ ] Zoom i pan (točkić, pinch, Space+drag)
[ ] Test scenario: složi freeform ručno → prebaci na masonry → promeni redosled → vrati na freeform: freeform raspored je identičan
[ ] Prvi ulazak u freeform posle masonry-ja prikazuje isti raspored kao masonry
[ ] Kartica dodata u masonry-ju se pojavljuje u freeformu ispod postojećeg sadržaja
M6 — Undo/redo i inspektor
[ ] Undo/redo za sve izmene boarda, 100 koraka; ceo drag je jedan korak
[ ] Inspektor kontekstualan: kartica / više kartica / board bez selekcije
[ ] Sve prečice iz sekcije 8
M7 — Responsive poliranje
[ ] Tablet: library fioka, inspektor kao plutajući panel ili sheet
[ ] Telefon: donja traka library-ja, plutajuće „+“, kontekstni toolbar, ručke ≥ 44px
[ ] Ceo scenario iz sekcije 12 (kriterijum uspeha) izvodljiv na telefonu bez zumiranja stranice
M8 — Export, prikaz, PWA
[ ] PNG: vidljivo / ceo board / selekcija, 1–3×; wall od 300 kartica se izvozi tačno
[ ] Presentation mode sa flipom i fullscreen prikazom kartice
[ ] Aplikacija se instalira kao PWA i otvara offline
12. Prompt za coding agenta
Ovaj dokument izvezi kao docs/BLUEPRINT.md u repo, pa agentu (Claude Code, Cursor, Codex) daj prompt ispod. Prompt je na engleskom jer agent piše kod i komentare na engleskom; UI tekstovi idu kroz i18n fajl, sa engleskim i srpskim.
Kriterijum uspeha celog MVP-a (na desktopu i na telefonu, bez uputstva): napravi board „Autumn 2026“ → ubaci 50 slika odjednom → uvezi 20 citata odjednom → prevuci 30 slika i 8 citata na wall → stavi 3 citata preko slika i 3 na poleđinu → promeni redosled → prebaci u freeform i sredi ručno → vrati se na masonry i nazad bez gubitka → izvezi PNG → napravi backup.
You are building "Visual Boards", a local-first web app for collecting photos and
quotes and composing them into inspiration walls, vision boards and moodboards.
The full specification is in docs/BLUEPRINT.md. Read it completely before writing
any code. It is the source of truth; if something here conflicts with it, the
blueprint wins, and you tell me about the conflict.

## Context
- Single user, no accounts, no backend. All data lives in IndexedDB.
- Primary device is a desktop browser, but every feature must work on tablet
  (1024px) and phone (390px) with touch. Phone is not a shrunk desktop; follow
  section 8 of the blueprint.
- The app must later become multi-user with cloud sync (section 13). Keep all
  persistence behind the repository layer so that is possible without touching UI.

## Stack (do not substitute without asking)
Vite, React 18, TypeScript strict, Zustand + Immer (patches for undo), Dexie,
dnd-kit, Tailwind + CSS variables, @fontsource, modern-screenshot, heic2any
(lazy), vite-plugin-pwa, Vitest, Playwright.

## Architecture rules (non-negotiable)
1. Content and arrangement are separate. Board.items holds content and order;
   Board.layouts[layoutId] holds per-layout placements/overrides. Switching
   layouts must never overwrite another layout's data.
2. Every layout implements the LayoutEngine interface (section 5) as a pure
   function. One renderer draws ComputedLayout.rects via CSS transforms. No
   per-layout editors.
3. One <Card> component renders every item: front/back faces, overlay, caption.
   No separate flip/overlay/polaroid components.
4. Masonry uses a JS shortest-column algorithm with absolute positioning. Never
   CSS columns or CSS masonry.
5. Images: resize + EXIF fix + thumbnail in a Web Worker before storing. The
   library and walls display thumbnails; full images only for zoom, fullscreen
   and export. Revoke object URLs you no longer need.
6. Components never call Dexie directly; use the repositories.
7. Layout engines, the quote parser and generators are pure, DOM-free and
   unit-tested.
8. Respect every item in the "Known pitfalls" table (section 10).

## How to work
- Build milestone by milestone (section 11), in order. Do not start the next
  milestone until every checkbox of the current one passes.
- At the start of each milestone, write a short plan (files, components, tests)
  and then implement it.
- At the end of each milestone: run typecheck, lint and tests; write a Playwright
  smoke test for the milestone's main flow; check the UI at 1440, 1024 and 390px;
  then stop and report: what was built, which checkboxes pass, anything you
  simplified or deferred, and any open questions.
- Keep a CHANGELOG.md and a docs/DECISIONS.md with short notes on any decision
  not covered by the blueprint.
- When the blueprint is ambiguous, choose the simplest option consistent with
  its principles (section 1), note it in DECISIONS.md, and continue. Ask me only
  if the choice would be expensive to reverse.
- Do not add features outside the current milestone, even small ones.

## Design
Calm, editorial, content-first. Warm neutral background, one accent color,
serif for board titles and quotes, sans-serif for UI, light and dark themes
following the system. Thin, quiet chrome; short animations (150-250ms).
It must not look like Canva, an enterprise dashboard or an AI generator.

Start with Milestone 0.
Kako koristiti: posle svakog milestone-a proveri kriterijume sam (5–10 minuta klikanja), pa napiši „Continue with Milestone N“ ili opiši šta ne valja. Ako agent počne da gubi kontekst u dugoj sesiji, otvori novu sesiju sa istim promptom i dodaj „Milestones 0–N are done, see CHANGELOG.md“.
13. Put ka javnom proizvodu
Prelazak na više korisnika dodaje backend, ali ne menja editor, model ni layout engine. To je moguće zato što su podaci iza repository sloja i što model već ima ownerId.
Šta se menja
Kako
Nalozi
Supabase Auth (email link + Google/Apple)
Podaci
Postgres tabele koje odgovaraju Dexie tabelama; board kao JSONB dokument, asseti i citati kao redovi
Slike
Supabase Storage (ili Cloudflare R2), full i thumbnail kao zasebni objekti; klijentski resize ostaje
Sync
IndexedDB ostaje lokalni keš i radi offline; izmene se šalju u pozadini, konflikti po boardu „poslednja izmena pobeđuje“ uz čuvanje prethodne verzije
Prvi login
Postojeći lokalni podaci se jednim klikom podižu na nalog
Deljenje
/b/{publicId}, private / unlisted / public; javni prikaz koristi isti renderer u View modu
Brzo čuvanje
Share target u PWA na telefonu, kasnije browser ekstenzija
Troškovi
Limit prostora po korisniku; ovde se odlučuje o besplatnom i plaćenom planu
Šta tada treba ponovo proveriti: export slika sa drugog domena (CORS na storage-u), GDPR i brisanje naloga sa svim slikama, rate limit uploada, i onboarding za nekoga ko nije autor aplikacije (prazan board mora sam da objašnjava šta se radi).
Ime: „Visual Boards“ je radni naziv i dovoljno dobar za ličnu upotrebu. Pre javnog lansiranja treba ime koje se može zaštiti i za koje je slobodan domen.