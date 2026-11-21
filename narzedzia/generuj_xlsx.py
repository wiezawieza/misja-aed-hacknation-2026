# -*- coding: utf-8 -*-
"""Generuje wzorcowy-zakres-danych-AED.xlsx Z TEGO SAMEGO pliku schemat/aed-schema.json, którego używa walidator
w prototypie (jeden kod, jedna prawda). Arkusze: Schemat, Przykladowe_dane, Slowniki, Walidacja."""
import csv, json, os, re
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = json.load(open(os.path.join(ROOT, 'schemat', 'aed-schema.json'), encoding='utf-8'))
POLA = [f['name'] for f in S['fields']]

NAVY, RED, AMBER, GRAY, GREEN = '13294B', 'D0142C', 'F5C04A', 'D5DCE6', '007A50'
HDR = Font(bold=True, color='FFFFFF')
FILL = lambda c: PatternFill('solid', fgColor=c)
THIN = Border(*(Side(style='thin', color='D5DCE6'),) * 4)
WRAP = Alignment(wrap_text=True, vertical='top')


def naglowek(ws, cols, widths, fill=NAVY):
    ws.append(cols)
    for i, w in enumerate(widths, 1):
        c = ws.cell(row=1, column=i)
        c.font, c.fill, c.alignment, c.border = HDR, FILL(fill), Alignment(wrap_text=True, vertical='center'), THIN
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = 'A2'
    ws.row_dimensions[1].height = 30


wb = Workbook()
wb.properties.title = S['title']
wb.properties.creator = 'Zespół Zapachowy – HackNation 2026 (Misja AED)'
wb.properties.subject = 'Wzorcowy zakres danych AED dla dane.gov.pl, wersja ' + S['version']

# ------------------------------------------------------------------ Arkusz 1: Schemat
ws = wb.active
ws.title = 'Schemat'
naglowek(ws, ['kolumna', 'typ', 'wymagane?', 'słownik wartości / format', 'przykład', 'opis', 'nazwa wyświetlana', 'grupa', 'kolejność'],
         [26, 12, 16, 46, 30, 70, 28, 22, 10])
for i, f in enumerate(S['fields'], 1):
    c = f.get('constraints', {})
    if c.get('enum'):
        slownik = ' | '.join(c['enum'])
    elif f['name'] == 'godziny_dostepnosci':
        slownik = 'składnia OSM opening_hours, np. Mo-Fr 08:00-16:00; Sa 09:00-13:00'
    elif c.get('pattern'):
        slownik = 'wzorzec: ' + c['pattern']
    elif c.get('minimum') is not None:
        slownik = f"zakres {c['minimum']} … {c['maximum']}"
    else:
        slownik = 'tekst' + (f" (max {c['maxLength']} znaków)" if c.get('maxLength') else '')
    typ = {'string': 'tekst', 'number': 'liczba', 'integer': 'liczba całkowita', 'date': 'data RRRR-MM-DD', 'boolean': 'logiczne tak/nie'}[f['type']]
    wym = f['wymagalnosc'] + (' (krytyczne)' if f.get('krytyczne') else '') + (f" – {f['warunek']}" if f.get('warunek') else '')
    ws.append([f['name'], typ, wym, slownik, f['przyklad'], f['opis'], f['title'], f['grupa'], i])
    kolor = {'wymagane': 'FDECEE', 'warunkowo wymagane': 'FDECEE', 'zalecane': 'FFF4DC', 'opcjonalne': 'FFFFFF'}[f['wymagalnosc']]
    for col in range(1, 10):
        cell = ws.cell(row=i + 1, column=col)
        cell.alignment, cell.border = WRAP, THIN
        if col == 3:
            cell.fill = FILL(kolor)
    ws.cell(row=i + 1, column=1).font = Font(bold=True, name='Consolas')
r0 = len(S['fields']) + 3
ws.cell(row=r0, column=1, value='Zasady ogólne').font = Font(bold=True, size=12, color=NAVY)
for j, (k, v) in enumerate([
    ('Kodowanie', S['kodowanie']), ('Separator CSV', 'przecinek (,) – pierwszy wiersz = nazwy kolumn z tej tabeli'),
    ('Układ współrzędnych', S['uklad_wspolrzednych']), ('Format daty', S['format_daty']),
    ('Wartości logiczne', 'tak / nie (małe litery)'), ('Brak wartości', 'pusta komórka (bez „-”, „brak”, „n/d”)'),
    ('Licencja zbioru zbiorczego', 'CC BY 4.0 – licencja źródłowa zachowana przy każdym rekordzie (kolumna licencja)'),
    ('Zweryfikowany', f"data_ostatniej_kontroli nie starsza niż {S['okres_waznosci_weryfikacji_miesiace']} miesięcy"),
    ('Odpowiedzialność', 'Za poprawność, kompletność i aktualność rekordów odpowiada dostawca (kolumna dostawca) publikujący zasób w dane.gov.pl'),
    ('Format publikacji', 'CSV (zalecany) lub XLSX; dodatkowo JSON/GeoJSON – nie PDF/DOC'),
    ('Wersja wzorca', f"{S['version']} z {S['data_wersji']}; plik maszynowy: schemat/aed-schema.json (Frictionless Table Schema)"),
    ('Legenda kolumny „wymagane?”', 'czerwone = wymagane (brak blokuje publikację), żółte = zalecane (obniża ocenę jakości), białe = opcjonalne')], 1):
    ws.cell(row=r0 + j, column=1, value=k).font = Font(bold=True)
    ws.cell(row=r0 + j, column=2, value=v)
    ws.merge_cells(start_row=r0 + j, start_column=2, end_row=r0 + j, end_column=6)
ws.auto_filter.ref = f'A1:I{len(S["fields"]) + 1}'

# ------------------------------------------------------------------ Arkusz 3 (tworzony przed 2, bo 2 się do niego odwołuje): Slowniki
wsS = wb.create_sheet('Slowniki')
naglowek(wsS, ['słownik (kolumna)', 'wartość', 'opis', 'kompatybilna z agregatem CC BY 4.0'], [24, 22, 80, 22])
zakresy = {}
row = 2


def dodaj_slownik(nazwa, wartosci):
    global row
    start = row
    for w, opis, extra in wartosci:
        wsS.append([nazwa, w, opis, extra])
        for col in range(1, 5):
            wsS.cell(row=row, column=col).border = THIN
            wsS.cell(row=row, column=col).alignment = WRAP
        row += 1
    zakresy[nazwa] = f'Slowniki!$B${start}:$B${row - 1}'


F = {f['name']: f for f in S['fields']}
dodaj_slownik('status', [(v, F['status']['slownik_etykiety'][v], '') for v in F['status']['constraints']['enum']])
dodaj_slownik('dostepnosc', [(v, F['dostepnosc']['slownik_etykiety'][v], '') for v in F['dostepnosc']['constraints']['enum']])
dodaj_slownik('licencja', [(l['kod'], l['nazwa'] + ' – ' + l['uzasadnienie'], 'TAK' if l['kompatybilna'] else 'NIE – wykluczana z agregatu') for l in S['licencje']])
dodaj_slownik('tak/nie', [('tak', 'wartość logiczna: prawda', ''), ('nie', 'wartość logiczna: fałsz', '')])
dodaj_slownik('wojewodztwo', [(v, 'województwo ' + v, '') for v in F['wojewodztwo']['constraints']['enum']])
dodaj_slownik('kategoria_obiektu', [(v, F['kategoria_obiektu']['slownik_etykiety'][v], '') for v in F['kategoria_obiektu']['constraints']['enum']])
dodaj_slownik('godziny_dostepnosci – dni', [(d, n, '') for d, n in [('Mo', 'poniedziałek'), ('Tu', 'wtorek'), ('We', 'środa'), ('Th', 'czwartek'), ('Fr', 'piątek'), ('Sa', 'sobota'), ('Su', 'niedziela'), ('PH', 'święta')]])
for r in range(2, row):
    if wsS.cell(row=r, column=4).value == 'TAK':
        wsS.cell(row=r, column=4).fill = FILL('E6F4EE')
    elif str(wsS.cell(row=r, column=4).value).startswith('NIE'):
        wsS.cell(row=r, column=4).fill = FILL('FDECEE')

# ------------------------------------------------------------------ Arkusz 2: Przykladowe_dane (20 wierszy zgodnych ze schematem)
wsP = wb.create_sheet('Przykladowe_dane', 1)
przyklad = list(csv.DictReader(open(os.path.join(ROOT, 'schemat', 'przyklad-AED.csv'), encoding='utf-8')))
txt = open(os.path.join(ROOT, 'prototyp', 'js', 'dane', 'rekordy.js'), encoding='utf-8').read()
rek = json.loads(txt[txt.index('= ') + 2: txt.rstrip().rindex(';')])
extra = [r for r in rek if r['_zrodlo'] in ('demo-fbs', 'demo-ksz', 'demo-pcm') and r['data_ostatniej_kontroli'] and r['data_waznosci_elektrod'] > '2026-11-21'][:8]
wiersze = przyklad[:12] + extra
assert len(wiersze) == 20, len(wiersze)
naglowek(wsP, POLA, [max(12, min(34, len(p) + 4)) for p in POLA])
for i, f in enumerate(S['fields'], 1):
    kol = {'wymagane': RED, 'warunkowo wymagane': RED, 'zalecane': 'B07800', 'opcjonalne': '5B6B82'}[f['wymagalnosc']]
    wsP.cell(row=1, column=i).fill = FILL(kol)
for w in wiersze:
    vals = []
    for f in S['fields']:
        v = w.get(f['name'], '')
        if f['type'] == 'number' and v != '':
            v = float(v)
        elif f['type'] == 'integer' and v != '':
            v = int(v)
        vals.append(v)
    wsP.append(vals)
# daty jako tekst ISO (bez konwersji Excela), współrzędne z 6 miejscami
for r in range(2, 22):
    for i, f in enumerate(S['fields'], 1):
        c = wsP.cell(row=r, column=i)
        c.border = THIN
        if f['type'] == 'number':
            c.number_format = '0.000000'
        if f['type'] in ('date', 'string'):
            c.number_format = '@'
# listy rozwijane wg słowników (pomoc przy wypełnianiu)
for pole, slownik in [('status', 'status'), ('dostepnosc', 'dostepnosc'), ('licencja', 'licencja'), ('wojewodztwo', 'wojewodztwo'), ('kategoria_obiektu', 'kategoria_obiektu'),
                      ('dostep_publiczny', 'tak/nie'), ('wymaga_kodu_dostepu', 'tak/nie'), ('elektrody_pediatryczne', 'tak/nie')]:
    col = get_column_letter(POLA.index(pole) + 1)
    dv = DataValidation(type='list', formula1='=' + zakresy[slownik], allow_blank=True, showErrorMessage=True,
                        errorTitle='Wartość spoza słownika', error='Wybierz wartość ze słownika (arkusz Slowniki).')
    dv.add(f'{col}2:{col}1000')
    wsP.add_data_validation(dv)
wsP.auto_filter.ref = f'A1:{get_column_letter(len(POLA))}21'

# ------------------------------------------------------------------ Arkusz 4: Walidacja
wsW = wb.create_sheet('Walidacja')
naglowek(wsW, ['kod reguły', 'zakres', 'poziom', 'autokorekta w kreatorze', 'reguła walidacji'], [12, 12, 14, 22, 110])
for r in S['reguly_walidacji']:
    wsW.append([r['kod'], r['zakres'], r['poziom'], 'tak' if r['autokorekta'] else 'nie', r['opis']])
for r in range(2, len(S['reguly_walidacji']) + 2):
    for col in range(1, 6):
        wsW.cell(row=r, column=col).border = THIN
        wsW.cell(row=r, column=col).alignment = WRAP
    p = wsW.cell(row=r, column=3)
    p.fill = FILL('FDECEE' if p.value == 'błąd' else 'FFF4DC')
n = len(S['reguly_walidacji']) + 3
wsW.cell(row=n, column=1, value='Skutki').font = Font(bold=True, size=12, color=NAVY)
for j, t in enumerate(['błąd – blokuje publikację wiersza w kreatorze; w agregacji: rekord oznaczony jako „zgodność częściowa” i zgłaszany dostawcy',
                       'błąd w polu krytycznym (id, nazwa, współrzędne) lub R14 – rekord nie trafia do zbioru zbiorczego, dopóki dostawca go nie poprawi',
                       'ostrzeżenie – nie blokuje; obniża ocenę jakości zasobu i jest widoczne na karcie AED',
                       'Walidator: prototyp/js/walidator.js – sterowany plikiem schemat/aed-schema.json (te same reguły, ten sam kod dla kreatora i agregatora)'], 1):
    wsW.cell(row=n + j, column=1, value='•')
    wsW.cell(row=n + j, column=2, value=t)
    wsW.merge_cells(start_row=n + j, start_column=2, end_row=n + j, end_column=5)

wb.move_sheet('Slowniki', offset=0)
order = ['Schemat', 'Przykladowe_dane', 'Slowniki', 'Walidacja']
wb._sheets = [wb[n] for n in order]
wb.active = 0
out = os.path.join(ROOT, 'wzorcowy-zakres-danych-AED.xlsx')
wb.save(out)
print('Zapisano', out, '| arkusze:', wb.sheetnames, '| pól:', len(POLA), '| przykładów:', len(wiersze))
