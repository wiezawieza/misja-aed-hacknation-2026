# -*- coding: utf-8 -*-
"""Zrzuty ekranu z DZIAŁAJĄCEGO prototypu (Chrome headless) do prezentacji.
Wymaga uruchomionego serwera w katalogu projektu: py -m http.server 8765  (lub podaj BASE jako argument)."""
import os, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'prezentacja', 'zrzuty')
os.makedirs(OUT, exist_ok=True)
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/prototyp/index.html'
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
UJECIA = [
    ('01-start', '#/', 1440, 1000),
    ('02-mapa-karta', '#/mapa?aed=000526989:KRO-002', 1440, 900),
    ('03-kreator-walidacja', '#/dostawca?demo=bledy', 1440, 1100),
    ('04-kreator-podglad', '#/dostawca?demo=poprawny&krok=6', 1440, 1000),
    ('05-kreator-publikacja', '#/dostawca?demo=poprawny&krok=7&publikuj=1', 1440, 1100),
    ('06-zbior-zrodla', '#/zbior', 1440, 1200),
    ('07-sluzby', '#/sluzby?miejsce=sejm', 1440, 1000),
    ('08-schemat', '#/schemat', 1440, 1000),
    ('09-akcja', '#/akcja', 1440, 1100),
    ('10-jury', '#/jury', 1440, 1000),
    ('11-mobile-mapa', '#/mapa', 390, 844),
    ('12-mobile-sluzby', '#/sluzby?miejsce=krosno', 390, 844),
]
only = sys.argv[2:] if len(sys.argv) > 2 else None
for nazwa, hsh, w, h in UJECIA:
    if only and nazwa not in only:
        continue
    out = os.path.join(OUT, nazwa + '.png')
    prof = os.path.join(ROOT, 'narzedzia', '_tmp', 'prof-' + nazwa)
    shutil.rmtree(prof, ignore_errors=True)  # świeży profil = brak starej wersji CSS/JS w pamięci podręcznej
    args = [CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', f'--user-data-dir={prof}', f'--window-size={w},{h}',
            '--virtual-time-budget=9000', f'--screenshot={out}', BASE + hsh]
    if w < 500:
        args.insert(5, '--force-device-scale-factor=2')
    subprocess.run(args, capture_output=True, timeout=120)
    print(nazwa, os.path.exists(out) and os.path.getsize(out))
