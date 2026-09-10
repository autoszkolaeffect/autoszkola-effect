# Auto Szkoła Efekt — design specification

Source: Figma Make file `4qU5cSVNZ8Nk55jU1oTlC1` ("Auto School Landing Page").
Extracted from the rendered prototype. The Make app styles every element inline, so the
values below are the design's literal computed values, not approximations.

## 1. Design tokens

### Colours

| Token         | Value     | Use                                                                    |
| ------------- | --------- | ---------------------------------------------------------------------- |
| `--navy`      | `#001633` | page background, dark cards, text on light/yellow                      |
| `--navy-deep` | `#000D1F` | footer background                                                      |
| `--blue`      | `#0A4295` | section background, cards, panels                                      |
| `--red`       | `#D62828` | primary CTA, active nav pill, accents, "praktyczny" category           |
| `--yellow`    | `#F5EB18` | headings in cards, stats, links, secondary CTA, "teoretyczny" category |
| `--orange`    | `#F77F00` | third accent (top stripe, 4th instructor card)                         |
| `--paper`     | `#FAFAFA` | body text on dark, and the one light section background                |

Alpha variants actually used on `#FAFAFA`: `.9 .85 .82 .8 .75 .7 .65 .6 .55 .45 .4 .35`.
On white: `rgba(255,255,255,.25 / .2 / .15 / .12 / .1 / .08)`.
On navy: `rgba(0,22,51,.55)`; hero overlay `rgba(0,22,51,.82 -> .75 -> .92)`.
On blue: `rgba(10,66,149,.4)` (stat tiles).
On yellow: `rgba(245,235,24,.6 / .35 / .3)`.

### Typography

- Display: `"Brygada 1918", Georgia, serif` — all h1–h4, buttons, author names, stat numbers, "Czytaj →".
- Body: `"Average Sans", Arial, sans-serif` — everything else.
- Both are Google Fonts. Weights used: 400 and 700.
- `body { font-family: var(--font-body); color: #FAFAFA; background: #001633; }`
- `h1,h2,h3,h4 { font-family: var(--font-display); }`

### Recurring type scale

- Page h1: `clamp(2rem, 5vw, 3.2rem)` / 700
- Hero h1: `clamp(2.4rem, 6vw, 4.2rem)` / 700 / line-height 1.1
- Section h2: `clamp(1.8rem, 4vw, 2.6rem)` / 700
- CTA h2: `clamp(1.6rem, 4vw, 2.4rem)` / 700
- Article h1: `clamp(1.7rem, 4vw, 2.5rem)` / 700 / line-height 1.2
- Contact column h2 `1.4rem`; instructor name `1.35rem`; article h2 `1.2rem`;
  feature h3 `1.1rem`; blog card h2 `1.1rem` (line-height 1.35)
- Lead paragraph `1.05rem` / line-height 1.7; body copy `0.92–1rem` / 1.65–1.78
- Eyebrow / label: `0.72–0.85rem`, uppercase, `letter-spacing .08–.15em`

### Shape

Square corners everywhere. The only radius in the design is `2px`, on nav pills and the
phone button. Emphasis comes from coloured edges, not shadows or rounding:
`border-left: 3–4px`, `border-top: 3–4px`, `border-bottom: 3–4px`, and a 48x5px rule above
section headings.

## 2. Chrome

### Nav (sticky, `z-index: 100`)

```
nav  { background:#001633; border-bottom:3px solid #D62828; position:sticky; top:0 }
  inner { max-width:1200px; margin:0 auto; padding:0 1.5rem;
          display:flex; align-items:center; justify-content:space-between; height:72px }
  logo button { background:none; border:none; padding:0; cursor:pointer }
    img { height:48px; display:block }
  links (.hidden-mobile) { display:flex; gap:.25rem }
    link      { background:transparent; color:#FAFAFA; border:2px solid transparent;
                font-family:body; font-size:.95rem; font-weight:400; letter-spacing:.04em;
                padding:.5rem 1.25rem; border-radius:2px; transition:.15s }
    link[current] { background:#D62828; border-color:#D62828; font-weight:700 }
    phone a   { margin-left:1rem; background:#F5EB18; color:#001633; font-weight:700;
                font-size:.9rem; padding:.5rem 1.25rem; border-radius:2px }
  burger (.show-mobile) { display:none; border:2px solid #FAFAFA; color:#FAFAFA;
                font-size:1.25rem; padding:.3rem .6rem; border-radius:2px }
```

The burger label is `☰`, and `✕` while the drawer is open.

Breakpoint: `@media (max-width: 768px) { .hidden-mobile{display:none!important} .show-mobile{display:block!important} }`

Open mobile drawer (below the bar, inside `<nav>`):

```
panel { background:#0A4295; padding:1rem 1.5rem; display:flex; flex-direction:column; gap:.5rem }
  item { background:transparent; color:#FAFAFA; border-bottom:1px solid rgba(255,255,255,.15);
         font-family:body; font-size:1.05rem; font-weight:400; padding:.6rem 0; text-align:left }
  item[current] { background:#D62828; font-weight:700 }
```

The drawer has no phone CTA.

### Footer

```
footer { background:#000D1F; border-top:3px solid #0A4295; padding:3rem 1.5rem 2rem }
  grid { max-width:1100px; margin:0 auto 2.5rem;
         display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:2.5rem }
  col1: logo img{height:44px;margin-bottom:1rem;display:block}
        p{font-family:body;font-size:.88rem;color:rgba(250,250,250,.55);line-height:1.7}
  col heading { font-family:display; font-weight:700; font-size:.9rem; color:#F5EB18;
                text-transform:uppercase; letter-spacing:.1em; margin-bottom:1rem }
  col2 links { display:block; color:rgba(250,250,250,.6); font-family:body; font-size:.9rem;
               padding:.25rem 0; text-align:left }
  col3 body  { font-family:body; font-size:.88rem; color:rgba(250,250,250,.6); line-height:2 }
  bottom { border-top:1px solid rgba(255,255,255,.08); padding-top:1.5rem;
           font-family:body; font-size:.8rem; color:rgba(250,250,250,.35); text-align:center }
```

Footer columns: brand blurb, `NAWIGACJA` (the four nav links), `KONTAKT` (address, phone, e-mail).

Brand blurb: "Lider rynku szkół jazdy w Łodzi od ponad 20 lat. Najwyższa zdawalność
potwierdzona rankingiem WORD 2023."
Bottom line: "© 2024 Auto Szkoła Efekt Łódź. Wszelkie prawa zastrzeżone."

## 3. Home (Strona główna)

### 3.1 Hero

```
section { position:relative; overflow:hidden; padding:5rem 1.5rem 4rem;
          text-align:center; background:#001633 }
  img.bg  { position:absolute; inset:0; width:100%; height:100%;
            object-fit:cover; object-position:center 55% }
  overlay { position:absolute; inset:0;
            background:linear-gradient(rgba(0,22,51,.82) 0%, rgba(0,22,51,.75) 60%, rgba(0,22,51,.92) 100%) }
  stripe  { position:absolute; top:0; left:0; right:0; height:8px;
            background:linear-gradient(to right,#D62828 33%,#F5EB18 33%,#F5EB18 66%,#F77F00 66%) }
  content { max-width:820px; margin:0 auto; position:relative }
```

- Badge: `display:inline-block; background:#D62828; color:#FAFAFA; font-family:body;
font-size:.8rem; font-weight:700; letter-spacing:.15em; text-transform:uppercase;
padding:.35rem 1rem; margin-bottom:1.5rem` — "Ranking Urzędu Miasta Łodzi · I–III kw. 2022"
- h1, three lines, middle one yellow:
  `1. miejsce w Łodzi` / `<span style="color:#F5EB18">w zdawalności prawa jazdy</span>` / `kategorii B`
- Lead paragraph: `font-size:1.15rem; line-height:1.7; color:rgba(250,250,250,.82);
margin:0 auto 2.5rem; max-width:620px`
  "Urząd Miasta Łodzi opublikował ranking oparty na danych łódzkiego WORD za pierwsze trzy
  kwartały 2022 r. Auto Szkoła Efekt zajęła **1. miejsce z wynikiem 46,30%** - najlepszym
  spośród wszystkich szkół jazdy w mieście." The bold run is `<strong style="color:#F5EB18">`.
- Buttons row: `display:flex; gap:1rem; justify-content:center; flex-wrap:wrap`
  - primary: `background:#D62828; color:#FAFAFA; font-family:display; font-weight:700;
font-size:1rem; border:none; padding:.9rem 2rem; letter-spacing:.04em` — "Zapisz się na kurs →"
  - ghost: `background:transparent; color:#F5EB18; border:2px solid #F5EB18`, same metrics
    — "Poznaj instruktorów"

### 3.2 Stats strip (inside the hero section, below the content)

```
wrap { max-width:900px; margin:4rem auto 0; display:grid; grid-template-columns:repeat(3,1fr);
       gap:1px; background:rgba(255,255,255,.12); border:1px solid rgba(255,255,255,.12) }
tile { background:rgba(10,66,149,.4); padding:1.75rem 1rem; text-align:center }
  value { font-family:display; font-size:clamp(2rem,4vw,2.8rem); font-weight:700;
          color:#F5EB18; line-height:1 }
  label { font-family:body; font-size:.85rem; color:rgba(250,250,250,.7); margin-top:.4rem;
          text-transform:uppercase; letter-spacing:.1em }
```

`46,30%` / zdawalność kat. B · 2022 — `20+` / lat doświadczenia — `5000+` / absolwentów

### 3.3 "Dlaczego warto wybrać nas?" — the one light section

```
section { background:#FAFAFA; color:#001633; padding:5rem 1.5rem }
  inner  { max-width:1100px; margin:0 auto }
  header { margin-bottom:3rem }
    rule { width:48px; height:5px; background:#D62828; margin-bottom:1.25rem }
    h2   { color:#001633 }
  grid  { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:1.5rem }
  card  { background:#001633; color:#FAFAFA; padding:2rem; border-left:4px solid #D62828;
          transition:transform .15s; cursor:default }
    emoji { font-size:2rem; margin-bottom:.75rem }
    h3    { font-family:display; font-size:1.1rem; font-weight:700; color:#F5EB18; margin-bottom:.6rem }
    p     { font-family:body; font-size:.92rem; line-height:1.65; color:rgba(250,250,250,.8) }
```

Six cards (emoji, title, body):

1. 🏆 **Najwyższa zdawalność w Łodzi** — Ranking Urzędu Miasta Łodzi (dane WORD, I–III kw. 2022) - 1. miejsce z wynikiem 46,30%. Żadna inna szkoła jazdy w Łodzi nie osiągnęła lepszego wyniku w kategorii B.
2. 👨‍🏫 **Doświadczeni instruktorzy** — Nasz zespół to instruktorzy ze średnim stażem 11 lat. Każdy posiada aktualne uprawnienia i stale podnosi kwalifikacje.
3. 📱 **Nowoczesna teoria online** — Dostęp do platformy e-learningowej 24/7. Ucz się przepisów i rozwiązuj testy egzaminacyjne w dowolnym miejscu i czasie.
4. 🚗 **Nowoczesna flota pojazdów** — Szkolimy na nowych samochodach z podwójnymi pedałami. Wszystkie pojazdy są serwisowane co 10 000 km i posiadają klimatyzację.
5. 📅 **Elastyczne godziny jazd** — Harmonogram dostosowany do Twoich potrzeb - jazdy rano, wieczorem, a nawet w weekendy. Kurs zaczynasz kiedy chcesz.
6. 💳 **Raty bez odsetek** — Opłatę za kurs możesz rozłożyć na wygodne raty. Akceptujemy płatności gotówkowe, przelewem i kartą.

### 3.4 "Opinie kursantów" — carousel

```
section { background:#0A4295; padding:5rem 1.5rem; overflow:hidden }
  rule (48x5) is #F5EB18 here; h2 colour #FAFAFA
  track { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:1.25rem }
  card(active)   { background:#001633;           border-top:3px solid #F5EB18;             opacity:1 }
  card(inactive) { background:rgba(0,22,51,.55); border-top:3px solid rgba(245,235,24,.35); opacity:.65 }
  card { padding:1.75rem; transition:opacity .3s }
    stars { color:#F5EB18; font-size:1.1rem; letter-spacing:2px }
    quote { font-family:body; font-size:.95rem; line-height:1.7;
            color:rgba(250,250,250,.85); margin:.75rem 0 1rem; font-style:italic }
    author{ font-family:display; font-weight:700; color:#F5EB18; font-size:.9rem }
  controls { display:flex; align-items:center; gap:1rem; margin-top:2rem }
    arrow { background:transparent; border:2px solid rgba(245,235,24,.6); color:#F5EB18;
            font-size:1.1rem; width:40px; height:40px; display:flex; align-items:center;
            justify-content:center }
    dots  { display:flex; gap:.5rem }
      dot(active)   { width:24px; height:8px; background:#F5EB18 }
      dot(inactive) { width:8px;  height:8px; background:rgba(245,235,24,.3) }
      dot { border:none; padding:0; transition:.3s }
```

Arrows are `‹` and `›`. Stars render as `★★★★★`.

Entry animation:
`@keyframes fadeSlide { from{opacity:0;transform:translateX(32px)} to{opacity:1;transform:translateX(0)} }`
applied as `.testimonial-card { animation: fadeSlide .4s ease both }`.

Three cards are visible at a time; the leftmost is the active one. It auto-advances, and the
dot count equals the number of opinions.

Seed opinions (4, all 5 stars):

- **Marta K.** — "Zdałam za pierwszym razem! Pan Marek tłumaczył wszystko tak spokojnie i konkretnie. Polecam każdemu, kto boi się egzaminu."
- **Damian R.** — "Świetna szkoła, profesjonalne podejście. Teoria online i elastyczne godziny jazd to ogromny plus. Zdałem po 3 miesiącach."
- **Zofia M.** — "Pani Anna była niesamowicie cierpliwa. Bałam się jazdy, ale po kursie czuję się pewnie za kierownicą. Szczerze polecam!"
- **Kamil T.** — "Bardzo dobre przygotowanie do WORD. Instruktorzy znają na pamięć ulubione miejsca egzaminatorów. Zdałem bez problemów."

### 3.5 Closing CTA band

```
section { background:#D62828; padding:4rem 1.5rem; text-align:center }
  h2 { color:#FAFAFA; margin-bottom:1rem }
  p  { font-family:body; font-size:1.05rem; color:rgba(250,250,250,.9); margin-bottom:2rem }
  button { background:#F5EB18; color:#001633; font-family:display; font-weight:700;
           font-size:1.05rem; border:none; padding:1rem 2.5rem; letter-spacing:.04em }
```

Copy: "Gotowy, żeby zdać za pierwszym razem?" /
"Zadzwoń lub wypełnij formularz - odpowiadamy w ciągu 24 godzin." / "Kontakt i zapisy →"

## 4. Page header band (Instruktorzy / Blog / Kontakt)

```
section { background:#0A4295; padding:4rem 1.5rem 3rem; border-bottom:4px solid ACCENT }
  inner { max-width:900px (1100px on Blog); margin:0 auto }
  rule  { width:48px; height:5px; background:ACCENT; margin-bottom:1.25rem }
  h1    { clamp(2rem,5vw,3.2rem); color:#FAFAFA; margin-bottom:1rem }
  p     { font-family:body; font-size:1.05rem; color:rgba(250,250,250,.8);
          line-height:1.7; max-width:580px }
```

ACCENT is `#F5EB18` on Instruktorzy and Blog, `#D62828` on Kontakt.

Copy:

- **Nasi instruktorzy** — "Doświadczony, certyfikowany i empatyczny zespół - to nasz sekret wysokiej zdawalności. Poznaj ludzi, którzy przeprowadzą Cię przez kurs."
- **Blog** — "Praktyczne porady od naszych instruktorów - kruczki egzaminu praktycznego, newralgiczne miejsca w Łodzi i omówienie tematów z teorii." The paragraph has `margin-bottom:2rem`; filter chips follow it inside the band.
- **Kontakt** — "Zapraszamy do kontaktu - zapiszemy Cię na kurs, odpowiemy na pytania i pomożemy wybrać odpowiedni termin."

## 5. Instruktorzy

```
section { padding:4rem 1.5rem; max-width:1100px; margin:0 auto }
  grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:2rem }
  card { background:#0A4295; overflow:hidden; transition:transform .2s }
    photo { position:relative; overflow:hidden; height:280px }
      img   { width:100%; height:100%; object-fit:cover; display:block }
      scrim { position:absolute; left:0; right:0; bottom:0; height:40%;
              background:linear-gradient(transparent, rgba(0,22,51,.9)) }
      badge { position:absolute; bottom:.75rem; left:1rem; background:ACCENT; color:ON_ACCENT;
              font-family:body; font-size:.75rem; font-weight:700; letter-spacing:.1em;
              text-transform:uppercase; padding:.25rem .6rem }
    body { padding:1.5rem }
      h2   { font-family:display; font-size:1.35rem; font-weight:700; color:#FAFAFA; margin-bottom:.25rem }
      exp  { font-family:body; font-size:.82rem; color:#F5EB18; letter-spacing:.08em;
             text-transform:uppercase; margin-bottom:1rem }
      p    { font-family:body; font-size:.92rem; line-height:1.68; color:rgba(250,250,250,.8) }
    footrule { height:4px; background:ACCENT }
```

ACCENT cycles by card index: `#F5EB18` (navy text) → `#D62828` → `#0A4295` → `#F77F00`
(white text on the last three) → repeat.

Seed instructors (name · badge · experience · bio):

1. **Marek Kowalski** · Instruktor kat. B · 14 lat doświadczenia — Certyfikowany instruktor nauki jazdy z 14-letnim stażem. Specjalista od techniki defensywnej i bezpiecznej jazdy w warunkach miejskich. Przeprowadził ponad 1200 kursantów przez egzamin państwowy.
2. **Anna Wiśniewska** · Instruktor kat. B i BE · 9 lat doświadczenia — Pasjonatka bezpiecznej jazdy z 9-letnim doświadczeniem. Znana z cierpliwości i skutecznych metod pracy z kursantami pierwszorazowymi. Zdawalność jej kursantów wynosi 78%.
3. **Piotr Nowak** · Instruktor kat. B · 11 lat doświadczenia — Były funkcjonariusz policji drogowej - perfekcjonista w zakresie przepisów ruchu drogowego. Przygotowuje kursantów gruntownie zarówno do teorii, jak i egzaminu praktycznego.
4. **Katarzyna Jabłońska** · Instruktor kat. B · 6 lat doświadczenia — Młoda, energiczna instruktorka z dyplomem psychologii transportu. Stosuje nowoczesne metody dydaktyczne i indywidualnie dopasowuje tempo nauki do każdego kursanta.
5. **Tomasz Zieliński** · Instruktor kat. B i B+E · 18 lat doświadczenia — Nestor naszego zespołu z 18-letnim stażem. Wychował kilka pokoleń kierowców w Łodzi. Specjalizuje się w nauce jazdy z przyczepą oraz w zaawansowanej technice jazdy.

## 6. Blog

### 6.1 Filter chips (inside the header band)

```
row  { display:flex; gap:.5rem; flex-wrap:wrap }
chip(on)  { background:#F5EB18; color:#001633; border:2px solid #F5EB18; font-weight:700 }
chip(off) { background:transparent; color:rgba(250,250,250,.7);
            border:2px solid rgba(255,255,255,.25); font-weight:400 }
chip { font-family:body; font-size:.85rem; padding:.4rem 1rem; transition:.15s }
```

Chips: `Wszystkie`, `Egzamin praktyczny`, `Egzamin teoretyczny` — derived from the categories
actually in use.

### 6.2 Card grid

```
section { padding:4rem 1.5rem; max-width:1100px; margin:0 auto }
grid    { display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:1.75rem }
article { background:#0A4295; cursor:pointer; display:flex; flex-direction:column;
          border-top:4px solid CATEGORY_COLOUR; transition:transform .18s }
  body { padding:1.75rem; flex:1 }
    badge { display:inline-block; background:CATEGORY_COLOUR; color:CATEGORY_TEXT;
            font-family:body; font-size:.72rem; font-weight:700; letter-spacing:.1em;
            text-transform:uppercase; padding:.25rem .6rem; margin-bottom:1rem }
    h2    { font-family:display; font-size:1.1rem; font-weight:700; color:#FAFAFA;
            margin-bottom:.75rem; line-height:1.35 }
    p     { font-family:body; font-size:.88rem; line-height:1.65; color:rgba(250,250,250,.7) }
  meta { padding:1rem 1.75rem; border-top:1px solid rgba(255,255,255,.1);
         display:flex; justify-content:space-between; align-items:center }
    date { font-family:body; font-size:.78rem; color:rgba(250,250,250,.4) }
    cta  { font-family:display; font-weight:700; font-size:.85rem; color:#F5EB18 }
```

Date reads `12 marca 2024 · 7 min`; the CTA reads `Czytaj →`.
Category colours: `Egzamin praktyczny` → `#D62828` with white text; `Egzamin teoretyczny` →
`#F5EB18` with navy text.

### 6.3 Article view

```
wrap { max-width:760px; margin:0 auto; padding:3rem 1.5rem 5rem }
back { background:none; border:none; color:#F5EB18; font-family:body; font-size:.9rem;
       padding:0; margin-bottom:2.5rem }
badge{ display:inline-block; background:CATEGORY_COLOUR; color:CATEGORY_TEXT; font-family:body;
       font-size:.75rem; font-weight:700; letter-spacing:.12em; text-transform:uppercase;
       padding:.3rem .75rem; margin-bottom:1.25rem }
h1   { clamp(1.7rem,4vw,2.5rem); line-height:1.2; color:#FAFAFA; margin-bottom:1rem }
meta { font-family:body; font-size:.85rem; color:rgba(250,250,250,.45);
       margin-bottom:2.5rem; display:flex; gap:1.5rem }
rule { width:100%; height:3px; background:CATEGORY_COLOUR; margin-bottom:2.5rem }
lead { font-family:body; font-size:1.05rem; line-height:1.75; color:rgba(250,250,250,.75);
       font-style:italic; margin-bottom:2.5rem }
section-block { margin-bottom:2rem }
  h2 { font-family:display; font-size:1.2rem; font-weight:700; color:#F5EB18; margin-bottom:.65rem }
  p  { font-family:body; font-size:1rem; line-height:1.78; color:rgba(250,250,250,.82) }
```

Back link reads `← Wróć do bloga`; meta is two spans, `8 stycznia 2024` and `5 min czytania`.

This maps 1:1 onto rendered markdown: the excerpt is the italic lead, `##` becomes the gold h2,
paragraphs take the body style. No images anywhere inside an article.

## 7. Kontakt

```
wrap { max-width:1100px; margin:0 auto; padding:4rem 1.5rem }
cols { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr));
       gap:3rem; align-items:start }
```

Column headings: `font-family:display; font-size:1.4rem; font-weight:700; color:#F5EB18`
("Telefony", "Adres", "Formularz kontaktowy").

**Telefony** — repeatable rows:

```
row { display:flex; justify-content:space-between; align-items:center;
      padding:.85rem 1rem; background:#0A4295; margin-bottom:.5rem;
      border-left:3px solid #D62828 }
  label { font-family:body; font-size:.85rem; color:rgba(250,250,250,.65);
          text-transform:uppercase; letter-spacing:.08em }
  value { font-family:display; font-weight:700; font-size:1.05rem; color:#FAFAFA; text-decoration:none }
```

**Adres**:

```
card { background:#0A4295; padding:1.25rem; border-left:3px solid #F5EB18;
       font-family:body; line-height:1.8; color:rgba(250,250,250,.85) }
  strong { color:#FAFAFA; display:block; margin-bottom:.25rem }
  hours  { font-size:.85rem; color:rgba(250,250,250,.6); margin-top:.5rem; display:block }
```

Content: Auto Szkoła Efekt / Al. Kardynała Stefana Wyszyńskiego 97/83 / Łódź /
`Pon–Pt: 8:00–18:00 · Sob: 9:00–14:00`

**Map**: `div{overflow:hidden;border:2px solid #0A4295} > iframe{border:0;display:block}`,
a Google Maps embed pointed at the address.

**Formularz kontaktowy**:

```
form  { display:flex; flex-direction:column; gap:1rem }
label { display:block; font-family:body; font-size:.8rem; color:rgba(250,250,250,.6);
        letter-spacing:.08em; text-transform:uppercase; margin-bottom:.4rem }
field { width:100%; background:#001633; border:1px solid rgba(255,255,255,.2); color:#FAFAFA;
        font-family:body; font-size:.95rem; padding:.75rem 1rem; outline:none;
        transition:border-color .15s; box-sizing:border-box }
textarea { field + resize:vertical }
select   { field + cursor:pointer }
submit { background:#D62828; color:#FAFAFA; font-family:display; font-weight:700;
         font-size:1rem; border:none; padding:1rem 2rem; letter-spacing:.05em;
         align-self:flex-start }
```

Layout: full-width name; then a `display:grid; grid-template-columns:1fr 1fr; gap:1rem` row
holding e-mail + phone; then the select; then the textarea; then the button
("Wyślij wiadomość →").

Fields (label · type · placeholder · required):

- `IMIĘ I NAZWISKO *` · text · `Jan Kowalski` · required
- `E-MAIL *` · email · `jan@example.com` · required
- `TELEFON` · tel · `600 000 000` · optional
- `INTERESUJE MNIE KURS` · select · `Kategoria B`, `Kategoria B+E`, `Kurs doszkalający`, `Inny`
- `WIADOMOŚĆ *` · textarea · `Napisz, kiedy chcesz zacząć kurs i czy masz jakieś pytania...` · required

The prototype has no submitted state; ours adds one in the same visual language.

## 8. Assets

- Logo — wordmark "Efekt L / AUTO SZKOŁA": red and blue box lettering on white, used at
  48px (nav) and 44px (footer) height.
- Hero photo — rear three-quarter shot of a grey hatchback in the school's livery, sitting
  under the navy gradient at `object-position: center 55%`.
- Five instructor portraits — 280px-tall cover crops. In production these are admin-uploaded.
