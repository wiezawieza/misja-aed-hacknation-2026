# -*- coding: utf-8 -*-
"""
Generuje logotyp akcji „Serce na Mapie” jako WEKTOROWE SVG (tekst zamieniony na krzywe –
plik nie zależy od zainstalowanych fontów) oraz eksporty PNG/JPG/PDF (Chrome headless + Pillow).
Krój: Poppins (SIL Open Font License 1.1) – narzedzia/fonty/.
"""
import os, subprocess, sys, shutil
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = os.path.join(ROOT, 'narzedzia', 'fonty')
OUT = os.path.join(ROOT, 'logo')
os.makedirs(OUT, exist_ok=True)

RED, NAVY, GREEN, WHITE = '#D0142C', '#13294B', '#007A50', '#FFFFFF'

# --- Sygnet: serce, którego dolny wierzchołek jest szpilką pinezki; przez serce biegnie linia EKG;
#     pod szpilką pierścień „tu jestem” – punkt na mapie. Siatka 100 x 128.
HEART = ('M50 116 C43 104 6 77 6 42 C6 22 20 8 34 8 C42 8 47 12 50 18 '
         'C53 12 58 8 66 8 C80 8 94 22 94 42 C94 77 57 104 50 116 Z')
ECG = 'M15 51 H35 L41.5 38 L49.5 69 L58 27 L64.5 51 H85'
RING = dict(cx=50, cy=120.5, rx=19, ry=4.6)


def sygnet(heart=RED, line=WHITE, ring=NAVY, x=0, y=0, s=1.0, with_ring=True):
    g = f'<g transform="translate({x:.2f} {y:.2f}) scale({s:.4f})">'
    if with_ring:
        g += (f'<ellipse cx="{RING["cx"]}" cy="{RING["cy"]}" rx="{RING["rx"]}" ry="{RING["ry"]}" fill="none" '
              f'stroke="{ring}" stroke-width="3.2"/>')
    g += f'<path d="{HEART}" fill="{heart}"/>'
    g += (f'<path d="{ECG}" fill="none" stroke="{line}" stroke-width="7" stroke-linecap="round" '
          f'stroke-linejoin="round"/>')
    return g + '</g>'


class Tekst:
    def __init__(self, path):
        self.f = TTFont(path)
        self.gs = self.f.getGlyphSet()
        self.cmap = self.f.getBestCmap()
        self.upm = self.f['head'].unitsPerEm
        self.hmtx = self.f['hmtx']

    def width(self, txt, size, track=0):
        sc = size / self.upm
        return sum(self.hmtx[self.cmap[ord(c)]][0] * sc + track for c in txt) - track

    def path(self, txt, size, x, y, track=0):
        """Zwraca atrybut d ścieżki tekstu; (x,y) = początek linii bazowej."""
        sc = size / self.upm
        pen = SVGPathPen(self.gs)
        cx = x
        for c in txt:
            gn = self.cmap[ord(c)]
            tp = TransformPen(pen, (sc, 0, 0, -sc, cx, y))
            self.gs[gn].draw(tp)
            cx += self.hmtx[gn][0] * sc + track
        return pen.getCommands()


BOLD = Tekst(os.path.join(FONTS, 'Poppins-Bold.ttf'))
SEMI = Tekst(os.path.join(FONTS, 'Poppins-SemiBold.ttf'))
MED = Tekst(os.path.join(FONTS, 'Poppins-Medium.ttf'))


def svg(w, h, body, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" width="{w:.0f}" height="{h:.0f}" '
            f'role="img" aria-labelledby="t"><title id="t">{title}</title>{body}</svg>\n')


def logo_poziome(c1=RED, c2=NAVY, heart=RED, line=WHITE, ring=NAVY, bg=None):
    # sygnet 100x128 w skali 1.0; dwa wiersze tekstu wyrównane do sygnetu
    size = 50
    body = ''
    W, H = 360, 132
    if bg:
        body += f'<rect width="{W}" height="{H}" fill="{bg}"/>'
    body += sygnet(heart, line, ring, 2, 2, 1.0)
    body += f'<path d="{BOLD.path("Serce", size, 118, 62)}" fill="{c1}"/>'
    body += f'<path d="{BOLD.path("na Mapie", size, 118, 114)}" fill="{c2}"/>'
    return W, H, body


def logo_pionowe(c1=RED, c2=NAVY):
    size = 40
    txt1, txt2 = 'Serce', ' na Mapie'
    w1, w2 = BOLD.width(txt1, size), BOLD.width(txt2, size)
    W = max(w1 + w2, 130) + 20
    H = 196
    sx = (W - 100 * 1.15) / 2
    body = sygnet(RED, WHITE, NAVY, sx, 4, 1.15)
    tx = (W - (w1 + w2)) / 2
    body += f'<path d="{BOLD.path(txt1, size, tx, 186)}" fill="{c1}"/>'
    body += f'<path d="{BOLD.path(txt2, size, tx + w1, 186)}" fill="{c2}"/>'
    return W, H, body


def haslo(c=NAVY, acc=RED):
    size = 34
    t1, t2 = 'Twoje dane. ', 'Czyjeś życie.'
    w1, w2 = SEMI.width(t1, size), SEMI.width(t2, size)
    W, H = w1 + w2 + 8, 48
    body = f'<path d="{SEMI.path(t1, size, 4, 36)}" fill="{c}"/><path d="{SEMI.path(t2, size, 4 + w1, 36)}" fill="{acc}"/>'
    return W, H, body


def zapisz(name, w, h, body, title):
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
        f.write(svg(w, h, body, title))


T = 'Serce na Mapie – logotyp akcji'
zapisz('logo.svg', *logo_poziome(), T)
zapisz('logo-mono.svg', *logo_poziome(NAVY, NAVY, NAVY, WHITE, NAVY), T + ' (wersja monochromatyczna)')
zapisz('logo-czarne.svg', *logo_poziome('#000', '#000', '#000', WHITE, '#000'), T + ' (wersja czarna)')
zapisz('logo-negatyw.svg', *logo_poziome(WHITE, WHITE, WHITE, RED, WHITE), T + ' (negatyw – na ciemne tło)')
zapisz('logo-negatyw-czerwone-tlo.svg', *logo_poziome(WHITE, WHITE, WHITE, RED, WHITE, bg=RED), T + ' (negatyw na czerwieni)')
zapisz('logo-pionowe.svg', *logo_pionowe(), T + ' (układ pionowy)')
zapisz('sygnet.svg', 104, 130, sygnet(RED, WHITE, NAVY, 2, 2, 1.0), 'Serce na Mapie – sygnet')
zapisz('sygnet-mono.svg', 104, 130, sygnet(NAVY, WHITE, NAVY, 2, 2, 1.0), 'Serce na Mapie – sygnet mono')
zapisz('sygnet-negatyw.svg', 104, 130, sygnet(WHITE, RED, WHITE, 2, 2, 1.0), 'Serce na Mapie – sygnet negatyw')
zapisz('sygnet-favicon.svg', 100, 120, sygnet(RED, WHITE, NAVY, 0, 0, 1.0, with_ring=False), 'Serce na Mapie – sygnet uproszczony (favicon)')
zapisz('haslo.svg', *haslo(), 'Hasło akcji: Twoje dane. Czyjeś życie.')
zapisz('haslo-negatyw.svg', *haslo(WHITE, WHITE), 'Hasło akcji (negatyw)')

# --- Eksporty rastrowe i PDF przez Chrome headless
CHROME = None
for p in [r'C:\Program Files\Google\Chrome\Application\chrome.exe', r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe']:
    if os.path.exists(p):
        CHROME = p
        break
TMP = os.path.join(ROOT, 'narzedzia', '_tmp')
os.makedirs(TMP, exist_ok=True)


def chrome(args):
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
                    f'--user-data-dir={os.path.join(TMP, "profil")}'] + args, check=True, capture_output=True, timeout=120)


def eksport(svgname, base, scale=6, bg_jpg='#FFFFFF'):
    src = open(os.path.join(OUT, svgname), encoding='utf-8').read()
    import re
    w, h = [float(v) for v in re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', src).groups()]
    W, H = int(w * scale), int(h * scale)
    inner = src.replace(f'width="{w:.0f}" height="{h:.0f}"', f'width="{W}" height="{H}"')
    html = os.path.join(TMP, base + '.html')
    open(html, 'w', encoding='utf-8').write(
        f'<!doctype html><meta charset="utf-8"><style>@page{{size:{W}px {H}px;margin:0}}html,body{{margin:0;padding:0;background:transparent}}'
        f'svg{{display:block}}</style>{inner}')
    url = 'file:///' + html.replace('\\', '/')
    png = os.path.join(OUT, base + '.png')
    chrome([f'--screenshot={png}', f'--window-size={W},{H}', '--default-background-color=00000000', url])
    chrome([f'--print-to-pdf={os.path.join(OUT, base + ".pdf")}', '--no-pdf-header-footer', url])
    from PIL import Image
    im = Image.open(png).convert('RGBA')
    bg = Image.new('RGBA', im.size, bg_jpg)
    bg.alpha_composite(im)
    bg.convert('RGB').save(os.path.join(OUT, base + '.jpg'), quality=95)


if CHROME:
    eksport('logo.svg', 'logo')
    eksport('sygnet.svg', 'sygnet', scale=8)
    eksport('logo-pionowe.svg', 'logo-pionowe')
    eksport('logo-negatyw.svg', 'logo-negatyw', bg_jpg=NAVY)
    print('Eksport PNG/JPG/PDF: OK (', CHROME, ')')
else:
    print('Brak Chrome/Edge – pominięto eksport rastrowy', file=sys.stderr)
print('SVG zapisane w', OUT)
