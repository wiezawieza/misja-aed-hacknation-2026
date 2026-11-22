# -*- coding: utf-8 -*-
"""Księga znaku akcji „Serce na Mapie” – HTML z osadzonymi (inline) wektorowymi SVG logo → PDF (Chrome headless)."""
import os, re, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO = os.path.join(ROOT, 'logo')
TMP = os.path.join(ROOT, 'narzedzia', '_tmp')
os.makedirs(TMP, exist_ok=True)


def svg(name, h=None, w=None, style=''):
    s = open(os.path.join(LOGO, name), encoding='utf-8').read().strip()
    s = re.sub(r'<title id="t">.*?</title>', '', s)
    s = re.sub(r' role="img" aria-labelledby="t"', '', s)
    dim = (f' height="{h}"' if h else '') + (f' width="{w}"' if w else '')
    s = re.sub(r' width="\d+" height="\d+"', dim + (f' style="{style}"' if style else ''), s, count=1)
    return s


def cmyk(hexc):
    r, g, b = [int(hexc[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    k = 1 - max(r, g, b)
    if k == 1:
        return (0, 0, 0, 100)
    return tuple(round(100 * v) for v in ((1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k))


KOLORY = [
    ('Czerwień Serca', '#D0142C', 'kolor wiodący: serce, akcenty, przyciski', 'ok. Pantone 186 C', 'biały tekst 5,5:1 (AA)'),
    ('Granat Zaufania', '#13294B', 'napisy, linie, tła negatywowe', 'ok. Pantone 289 C', 'na białym 14,5:1 (AAA)'),
    ('Zieleń AED', '#007A50', 'kolor wspierający – nawiązanie do znaku AED; naklejki, statusy', 'ok. Pantone 7726 C', 'biały tekst 5,4:1 (AA)'),
    ('Szary Pomocniczy', '#5B6B82', 'teksty drugorzędne', 'ok. Pantone 7545 C', 'na białym 5,4:1 (AA)'),
    ('Tło Jasne', '#F5F7FA', 'tła, karty', '—', 'granat na tle 13,5:1'),
]

kolory_html = ''.join(
    f'<div class="sw"><div class="chip" style="background:{h}"></div><b>{n}</b><table>'
    f'<tr><td>HEX</td><td>{h}</td></tr><tr><td>RGB</td><td>{int(h[1:3],16)} {int(h[3:5],16)} {int(h[5:7],16)}</td></tr>'
    f'<tr><td>CMYK</td><td>{" ".join(str(v) for v in cmyk(h))}</td></tr><tr><td>Pantone</td><td>{p}</td></tr></table>'
    f'<p>{u}</p><p class="mini">Kontrast: {c}</p></div>' for n, h, u, p, c in KOLORY)

LOGO_H = svg('logo.svg', h=110)
zakazy = [
    ('Nie deformuj proporcji', f'<div style="transform:scaleX(1.45) scaleY(.8)">{svg("logo.svg", h=52)}</div>'),
    ('Nie obracaj znaku', f'<div style="transform:rotate(-14deg)">{svg("logo.svg", h=70)}</div>'),
    ('Nie zmieniaj kolorów', f'<div style="filter:hue-rotate(120deg) saturate(1.4)">{svg("logo.svg", h=70)}</div>'),
    ('Nie dodawaj cieni, poświat ani obrysów', f'<div style="filter:drop-shadow(6px 6px 3px rgba(0,0,0,.55)) drop-shadow(0 0 6px #ffd400)">{svg("logo.svg", h=70)}</div>'),
    ('Nie stawiaj na tle o słabym kontraście', f'<div style="background:repeating-linear-gradient(45deg,#e06a7a 0 12px,#c8102e 12px 24px);padding:10px;border-radius:6px">{svg("logo.svg", h=62)}</div>'),
    ('Nie zmieniaj układu ani kroju pisma', '<div style="display:flex;align-items:center;gap:10px;font-family:Georgia,serif;font-style:italic;font-size:24px;color:#13294B;white-space:nowrap">Serce na Mapie' + svg('sygnet.svg', h=56) + '</div>'),
    ('Nie usuwaj linii EKG ani pierścienia', '<svg viewBox="0 0 104 130" height="58"><path d="M50 116 C43 104 6 77 6 42 C6 22 20 8 34 8 C42 8 47 12 50 18 C53 12 58 8 66 8 C80 8 94 22 94 42 C94 77 57 104 50 116 Z" fill="#D0142C"/></svg><span style="font:700 20px Poppins,Segoe UI,sans-serif;color:#13294B;margin-left:6px;white-space:nowrap">Serce na Mapie</span>'),
    ('Nie umieszczaj logo w ramce ani na kształcie', f'<div style="background:#13294B;border-radius:50%;padding:16px 12px;border:4px dashed #D0142C">{svg("logo-negatyw.svg", h=38)}</div>'),
]
zakazy_html = ''.join(f'<div class="dont"><div class="dont-box">{v}</div><p><span class="x">✕</span> {t}</p></div>' for t, v in zakazy)

HTML = f'''<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Księga znaku – Serce na Mapie</title>
<style>
@font-face{{font-family:Poppins;font-weight:400;src:url("fonty/Poppins-Regular.ttf")}}
@font-face{{font-family:Poppins;font-weight:500;src:url("fonty/Poppins-Medium.ttf")}}
@font-face{{font-family:Poppins;font-weight:600;src:url("fonty/Poppins-SemiBold.ttf")}}
@font-face{{font-family:Poppins;font-weight:700;src:url("fonty/Poppins-Bold.ttf")}}
@page{{size:A4 landscape;margin:0}}
*{{box-sizing:border-box}} body{{margin:0;font-family:Poppins,"Segoe UI",Arial,sans-serif;color:#13294B}}
.page{{width:297mm;height:210mm;padding:16mm 18mm 14mm;position:relative;page-break-after:always;overflow:hidden;background:#fff}}
.page:last-child{{page-break-after:auto}}
h1{{font-size:34pt;margin:0 0 6mm;line-height:1.1}} h2{{font-size:22pt;margin:0 0 6mm}} h3{{font-size:13pt;margin:0 0 3mm}}
p{{font-size:10.5pt;line-height:1.55;margin:0 0 3mm}} .mini{{font-size:8.5pt;color:#5B6B82}}
.num{{position:absolute;bottom:8mm;right:18mm;font-size:8.5pt;color:#5B6B82}} .num b{{color:#D0142C}}
.eyebrow{{font-size:9pt;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#D0142C;margin-bottom:3mm}}
.cover{{background:#F5F7FA;display:grid;grid-template-columns:1.1fr .9fr;gap:12mm;align-items:center}}
.cover .slogan{{font-size:28pt;font-weight:700;line-height:1.15}} .cover .slogan span{{color:#D0142C}}
.grid2{{display:grid;grid-template-columns:1fr 1fr;gap:10mm}} .grid3{{display:grid;grid-template-columns:repeat(3,1fr);gap:7mm}} .grid4{{display:grid;grid-template-columns:repeat(4,1fr);gap:6mm}}
.tile{{border:1px solid #D5DCE6;border-radius:4mm;display:grid;place-items:center;padding:8mm;min-height:45mm}}
.tile.dark{{background:#13294B;border-color:#13294B}} .tile.red{{background:#D0142C;border-color:#D0142C}} .cap{{font-size:9pt;margin-top:2mm;color:#5B6B82}}
.sw .chip{{height:26mm;border-radius:3mm;border:1px solid #D5DCE6;margin-bottom:3mm}} .sw table{{font-size:9pt;border-collapse:collapse;width:100%;margin:2mm 0}} .sw td{{padding:1mm 0;border-bottom:1px solid #EEF1F5}} .sw td:first-child{{color:#5B6B82;width:16mm}} .sw p{{font-size:9pt}}
.dont{{border:1px solid #D5DCE6;border-radius:4mm;padding:4mm;}} .dont-box{{height:34mm;display:grid;place-items:center;overflow:hidden}} .dont p{{font-size:9.5pt;margin:2mm 0 0;font-weight:600}} .x{{display:inline-grid;place-items:center;width:6mm;height:6mm;border-radius:50%;background:#D0142C;color:#fff;font-size:8pt;margin-right:1mm}}
.clear{{position:relative;display:inline-block;padding:16mm;border:1.2px dashed #D0142C;background:repeating-linear-gradient(45deg,#FDECEE 0 6px,#fff 6px 12px)}} .clear .in{{background:#fff;outline:1px solid #D0142C}}
.lbl{{position:absolute;font-size:8.5pt;color:#D0142C;font-weight:700}}
.box{{background:#F5F7FA;border-radius:4mm;padding:6mm}}
.anat text{{font-family:Poppins,Segoe UI,sans-serif;font-size:4.2px;fill:#13294B}}
.sticker{{background:#007A50;border-radius:6mm;padding:5mm;width:62mm;color:#fff;text-align:center}} .sticker .in{{background:#fff;border-radius:4mm;padding:4mm;color:#13294B}}
.poster{{background:#13294B;color:#fff;border-radius:3mm;padding:7mm;width:64mm;height:90mm;display:flex;flex-direction:column;justify-content:space-between}} .poster b.big{{font-size:19pt;line-height:1.1}} .poster span{{color:#fff}}
ul{{margin:0;padding-left:5mm;font-size:10.5pt;line-height:1.6}}
</style></head><body>

<section class="page cover"><div><div class="eyebrow">Księga znaku · wersja 1.0 · listopad 2026</div>{svg("logo.svg", h=150)}
<p class="slogan" style="margin-top:10mm">Twoje dane.<br><span>Czyjeś życie.</span></p>
<p>Akcja promocyjna zachęcająca dysponentów defibrylatorów AED – gminy, szkoły, szpitale, firmy i organizacje – do publikowania danych o urządzeniach w portalu <b>dane.gov.pl</b> według wzorcowego zakresu danych.</p></div>
<div style="display:grid;place-items:center">{svg("sygnet.svg", h=330)}</div><div class="num">HackNation 2026 · zadanie „Misja AED – Dane na ratunek” · zespół Zapachowy</div></section>

<section class="page"><div class="eyebrow">01 · Koncepcja</div><h2>Serce, które wskazuje miejsce</h2><div class="grid2"><div>
<p><b>Serce jest jednocześnie pinezką na mapie</b> – jego dolny wierzchołek wskazuje konkretne miejsce, a pierścień pod nim mówi „tu jest AED”. Linia <b>EKG</b> przecinająca serce to rytm, który defibrylator może przywrócić, i puls danych, które muszą być aktualne. Czerwień ratunkowa i granat zaufania łączą pilność z wiarygodnością instytucji. Hasło <b>„Twoje dane. Czyjeś życie.”</b> mówi dysponentowi wprost, że jego odpowiedzialność za dane ma ludzką konsekwencję.</p>
<h3 style="margin-top:6mm">Dlaczego „Serce na Mapie”</h3>
<ul><li><b>Serce na Mapie</b> – „Twoje dane. Czyjeś życie.” – <b>wybrana</b>: nazywa efekt w trzech słowach, daje naturalny znak i odznakę dla dostawcy („Nasz AED jest na mapie”).</li>
<li><b>Minuta Życia</b> – „Każda minuta bez AED odbiera 10% szans” – mocna, ale ogólna i nie mówi o danych.</li>
<li><b>Gdzie AED?</b> – „Odpowiedz, zanim ktoś zapyta” – bezpośrednia, lecz słaba jako marka (znak zapytania, brzmi jak aplikacja).</li></ul>
<p class="mini" style="margin-top:4mm">Logotyp i hasło służą wyłącznie akcji promocyjnej skierowanej do potencjalnych dostawców danych. Nie są znakiem portalu dane.gov.pl ani narzędzia agregującego.</p></div>
<div class="box"><svg class="anat" viewBox="-40 -4 190 140" width="100%">
<ellipse cx="50" cy="120.5" rx="19" ry="4.6" fill="none" stroke="#13294B" stroke-width="3.2"/><path d="M50 116 C43 104 6 77 6 42 C6 22 20 8 34 8 C42 8 47 12 50 18 C53 12 58 8 66 8 C80 8 94 22 94 42 C94 77 57 104 50 116 Z" fill="#D0142C"/>
<path d="M15 51 H35 L41.5 38 L49.5 69 L58 27 L64.5 51 H85" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
<line x1="94" y1="30" x2="112" y2="22" stroke="#5B6B82" stroke-width=".5"/><text x="113" y="20">1. Serce – symbol życia i AED</text>
<line x1="64" y1="51" x2="112" y2="52" stroke="#5B6B82" stroke-width=".5"/><text x="113" y="53">2. Linia EKG – rytm serca</text><text x="113" y="58">i „puls” aktualnych danych</text>
<line x1="52" y1="112" x2="112" y2="96" stroke="#5B6B82" stroke-width=".5"/><text x="113" y="95">3. Szpilka pinezki –</text><text x="113" y="100">konkretna lokalizacja</text>
<line x1="69" y1="121" x2="112" y2="121" stroke="#5B6B82" stroke-width=".5"/><text x="113" y="122">4. Pierścień „tu jest”</text>
<text x="-38" y="134" style="font-size:3.6px;fill:#5B6B82">Siatka konstrukcyjna 100 × 128 j. Krój: Poppins Bold (SIL OFL 1.1), zamieniony na krzywe.</text></svg></div></div><div class="num"><b>Serce na Mapie</b> · księga znaku · 2</div></section>

<section class="page"><div class="eyebrow">02 · Wersje znaku</div><h2>Wersje podstawowe i achromatyczne</h2><div class="grid3">
<div><div class="tile">{svg("logo.svg", h=82)}</div><p class="cap"><b>Podstawowa (kolor)</b> – pierwszy wybór na jasnym tle</p></div>
<div><div class="tile">{svg("logo-mono.svg", h=82)}</div><p class="cap"><b>Monochromatyczna</b> – druk jednobarwny (granat)</p></div>
<div><div class="tile">{svg("logo-czarne.svg", h=82)}</div><p class="cap"><b>Czarna</b> – faks, pieczęć, grawer, druk czarno-biały</p></div>
<div><div class="tile dark">{svg("logo-negatyw.svg", h=82)}</div><p class="cap"><b>Negatyw</b> – na granacie i ciemnych tłach</p></div>
<div><div class="tile red">{svg("logo-negatyw.svg", h=82)}</div><p class="cap"><b>Negatyw na czerwieni</b> – materiały akcyjne</p></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:4mm"><div><div class="tile" style="padding:4mm">{svg("logo-pionowe.svg", h=58)}</div><p class="cap"><b>Pionowa</b></p></div><div><div class="tile">{svg("sygnet.svg", h=75)}</div><p class="cap"><b>Sygnet</b> – awatar, favicon</p></div></div>
</div><div class="num"><b>Serce na Mapie</b> · księga znaku · 3</div></section>

<section class="page"><div class="eyebrow">03 · Kolorystyka</div><h2>Paleta barw</h2><div class="grid4" style="grid-template-columns:repeat(5,1fr)">{kolory_html}</div>
<p class="mini" style="margin-top:5mm">Wartości CMYK wyliczone z RGB (konwersja orientacyjna) – przed drukiem nakładowym potwierdź proofem w docelowym profilu (np. ISO Coated v2 / FOGRA39). Odpowiedniki Pantone orientacyjne. Wszystkie pary tekst/tło używane w materiałach spełniają WCAG 2.1 AA (kontrast ≥ 4,5:1).</p>
<div class="num"><b>Serce na Mapie</b> · księga znaku · 4</div></section>

<section class="page"><div class="eyebrow">04 · Pole ochronne i minimalna wielkość</div><h2>Przestrzeń dla znaku</h2><div class="grid2" style="align-items:center"><div style="text-align:center">
<div class="clear"><div class="in">{svg("logo.svg", h=105)}</div><span class="lbl" style="top:3mm;left:50%">x</span><span class="lbl" style="left:4mm;top:50%">x</span><span class="lbl" style="right:4mm;top:50%">x</span><span class="lbl" style="bottom:3mm;left:50%">x</span></div>
<p class="mini" style="margin-top:4mm">x = wysokość litery „S” w słowie „Serce” (≈ 1/3 wysokości sygnetu)</p></div><div>
<h3>Pole ochronne</h3><p>Wokół znaku zachowaj wolną przestrzeń równą <b>x</b> z każdej strony. W polu ochronnym nie umieszczaj tekstów, krawędzi kadru ani innych znaków. W zestawieniach z logotypami partnerów (np. instytucji – dostawców danych) odstęp wynosi co najmniej <b>2x</b>.</p>
<h3 style="margin-top:6mm">Minimalna wielkość</h3><div style="display:flex;gap:8mm;align-items:flex-end;margin:3mm 0">
<div style="text-align:center">{svg("logo.svg", w=113)}<p class="mini">logo: 30 mm / 120 px</p></div>
<div style="text-align:center">{svg("sygnet.svg", h=30)}<p class="mini">sygnet: 8 mm / 24 px</p></div>
<div style="text-align:center">{svg("sygnet-favicon.svg", h=16)}<p class="mini">16 px – wersja uproszczona</p></div></div>
<p>Poniżej 24 px używaj <b>sygnetu uproszczonego</b> (bez pierścienia) – linia EKG pozostaje czytelna nawet jako favicon 16 px.</p></div></div>
<div class="num"><b>Serce na Mapie</b> · księga znaku · 5</div></section>

<section class="page"><div class="eyebrow">05 · Niedozwolone użycie</div><h2>Czego nie robić ze znakiem</h2><div class="grid4">{zakazy_html}</div>
<p class="mini" style="margin-top:4mm">Używaj wyłącznie oryginalnych plików: logo.svg (wektor), logo.pdf (druk), logo.png (ekran, przezroczyste tło), logo.jpg (białe tło).</p>
<div class="num"><b>Serce na Mapie</b> · księga znaku · 6</div></section>

<section class="page"><div class="eyebrow">06 · Typografia i hasło</div><h2>Krój pisma i zapis hasła</h2><div class="grid2"><div>
<p style="font:700 40pt Poppins;margin:0">Aa Ąą Żż</p><p><b>Poppins</b> (Google Fonts, SIL Open Font License 1.1) – Bold do nagłówków i logotypu, SemiBold do hasła, Regular do tekstów. Pełne wsparcie polskich znaków. Krój zastępczy w dokumentach biurowych: Segoe UI / Arial.</p>
<p style="font:600 20pt Poppins;margin:6mm 0 2mm">Twoje dane. <span style="color:#D0142C">Czyjeś życie.</span></p>
<p>Hasło zapisujemy zawsze w tej formie: dwa zdania, kropki na końcu, druga część w Czerwieni Serca (na ciemnym tle – biel). Hashtag akcji: <b>#SerceNaMapie</b>. Wezwanie do działania: <b>„Opublikuj dane o swoim AED w dane.gov.pl”</b>.</p></div>
<div class="box"><h3>Ton komunikacji</h3><ul><li>Konkretnie: „15 minut na publikację, minuty dla poszkodowanego”.</li><li>Z szacunkiem dla odpowiedzialności dostawcy – nie straszymy, doceniamy.</li><li>Bez żargonu IT: „zasób”, „zbiór danych” tłumaczymy przy pierwszym użyciu.</li><li>Zawsze z odesłaniem do dane.gov.pl i wzorcowego zakresu danych.</li></ul></div></div>
<div class="num"><b>Serce na Mapie</b> · księga znaku · 7</div></section>

<section class="page"><div class="eyebrow">07 · Zastosowania</div><h2>Materiały akcji dla dostawców danych</h2><div class="grid3" style="align-items:start">
<div><div class="sticker"><div class="in">{svg("logo.svg", h=46)}<p style="margin:3mm 0 0;font-weight:700;font-size:12pt">Nasz AED jest na mapie</p><p class="mini" style="margin:0">dane.gov.pl · #SerceNaMapie</p></div></div><p class="cap"><b>Naklejka na drzwi</b> – nagroda dla instytucji, która opublikowała dane</p></div>
<div><div class="poster">{svg("logo-negatyw.svg", h=44)}<b class="big">Twoje dane.<br><span>Czyjeś życie.</span></b><p style="font-size:8.5pt;margin:0">Masz AED? Opublikuj dane o nim w dane.gov.pl według wzorca.<br><b>#SerceNaMapie</b></p></div><p class="cap"><b>Plakat A3/A4</b> – urzędy, szkoły, przychodnie</p></div>
<div><div class="tile" style="min-height:30mm;justify-content:start;padding:5mm"><div style="display:flex;gap:4mm;align-items:center">{svg("sygnet.svg", h=56)}<div><b style="font-size:12pt">Jesteśmy Sercem na Mapie</b><p class="mini" style="margin:0">Nasze AED są w dane.gov.pl</p></div></div></div><p class="cap"><b>Odznaka na stronę www / BIP</b> – generowana w kreatorze po publikacji</p>
<div class="box" style="margin-top:5mm"><p style="margin:0;font-size:9.5pt"><b>Post w mediach społecznościowych:</b> „Ile metrów dzieli Cię od najbliższego AED? Jeśli Twoja instytucja ma defibrylator – pokaż go na wspólnej mapie. Twoje dane. Czyjeś życie. #SerceNaMapie”</p></div></div>
</div><div class="num"><b>Serce na Mapie</b> · księga znaku · 8</div></section>
</body></html>'''

html_path = os.path.join(ROOT, 'narzedzia', 'ksiega-znaku.html')
open(html_path, 'w', encoding='utf-8').write(HTML)
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
out = os.path.join(ROOT, 'ksiega-znaku.pdf')
subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--no-first-run', f'--user-data-dir={os.path.join(TMP, "profil")}', '--no-pdf-header-footer',
                '--virtual-time-budget=3000', f'--print-to-pdf={out}', 'file:///' + html_path.replace('\\', '/')], check=True, capture_output=True, timeout=180)
print('Zapisano', out, os.path.getsize(out), 'B')
