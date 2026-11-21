# -*- coding: utf-8 -*-
"""
Budowa danych prototypu (uruchamiane raz, przed demem; jury NIE musi tego uruchamiać).

1. Wczytuje SUROWE zasoby AED pobrane z API dane.gov.pl (dane/zrodla-surowe/*) – prawdziwe dane
   4 instytucji (Krosno, Przemyśl, Marki, Legionowo) + metadane zbioru Warszawy (zasób wymaga tokenu API).
2. Harmonizuje je do wzorcowego zakresu (schemat/aed-schema.json) – adaptery per źródło,
   z dziennikiem zmian (raport harmonizacji). NIE poprawiamy merytorycznie danych dostawcy –
   błędy (np. punkt w złym mieście) zostają i są wykazywane przez walidator.
3. Wczytuje warstwę OpenStreetMap (ODbL) – tylko jako warstwa pomocnicza, poza agregatem.
4. Dokłada DANE DEMONSTRACYJNE (syntetyczne, wyraźnie oznaczone „DEMO”) od fikcyjnych dostawców,
   aby pokazać pełny wzorzec (statusy, godziny, weryfikację, niekompatybilną licencję).
5. Zapisuje pliki JS dla prototypu (działa z file:// bez serwera) + przykładowe pliki CSV.
"""
import csv, io, json, random, re, os, datetime, math

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SUR = os.path.join(ROOT, 'dane', 'zrodla-surowe')
OUT_JS = os.path.join(ROOT, 'prototyp', 'js', 'dane')
OUT_PRZYK = os.path.join(ROOT, 'prototyp', 'przyklady')
os.makedirs(OUT_JS, exist_ok=True)
os.makedirs(OUT_PRZYK, exist_ok=True)

SCHEMA = json.load(open(os.path.join(ROOT, 'schemat', 'aed-schema.json'), encoding='utf-8'))
POLA = [f['name'] for f in SCHEMA['fields']]
META = json.load(open(os.path.join(SUR, 'metadane_dane_gov_pl.json'), encoding='utf-8'))
DATA_POBRANIA = '2026-11-21'
random.seed(20260303)  # deterministycznie – 3 marca (dzień zdarzenia z treści zadania)


def pusty():
    return {k: '' for k in POLA}


def ds_url(did, slug):
    return f'https://dane.gov.pl/pl/dataset/{did},{slug}'


zrodla, rekordy = [], []


def dodaj_zrodlo(z, recs):
    z['liczba_rekordow'] = len(recs)
    zrodla.append(z)
    for r in recs:
        r['_zrodlo'] = z['id']
        rekordy.append(r)


def zrodlo_dgp(did, rid, zakres, raport, integracja='zintegrowano', powod=''):
    m = META[str(did)]
    ds, inst = m['dataset'], m['institution']
    res = [r for r in m['resources'] if str(r['id']) == str(rid)][0]
    lic = {'CC0 1.0': 'CC0-1.0', 'CC BY 4.0': 'CC-BY-4.0'}.get(ds['license_name'], ds['license_name'])
    return {
        'id': f'dgp-{rid}', 'typ': 'dane.gov.pl', 'demo': False,
        'instytucja': {'id': inst['id'], 'nazwa': inst['title'], 'typ': inst['institution_type'], 'regon': inst['regon'], 'miasto': inst['city']},
        'zbior': {'id': did, 'tytul': ds['title'], 'url': ds_url(did, ds['slug']), 'czestotliwosc': ds['update_frequency'] or 'brak informacji',
                  'zweryfikowano': (ds.get('verified') or '')[:10], 'zmodyfikowano': (ds.get('modified') or '')[:10], 'kategorie': [c['title'] for c in (ds.get('categories') or [])]},
        'zasob': {'id': rid, 'tytul': res['title'], 'format': res['format'], 'url': f"https://dane.gov.pl/pl/dataset/{did},{ds['slug']}/resource/{rid}",
                  'pobranie': res['download_url'], 'data_danych': res['data_date'], 'stopien_otwartosci': res['openness_score']},
        'licencja': lic, 'zakres_referencyjny': zakres, 'status_integracji': integracja, 'powod': powod,
        'raport_harmonizacji': raport, 'data_pobrania': DATA_POBRANIA,
    }


# ---------------------------------------------------------------- KROSNO (CSV, kolejność lon,lat)
raport = ['Nagłówki z wiodącymi spacjami (" Nazwa", " Adres") – przycięto.',
          'Kolumna „Adres” łączy ulicę, kod i miejscowość – rozdzielono na adres / kod_pocztowy / miejscowosc.',
          'Kolumna „Nazwa” zawiera stałą wartość „Defibrylator” – pominięto; nazwą lokalizacji jest kolumna „Lokalizacja”.',
          'Źródło nie zawiera: statusu, dostępności (24/7/godziny), dostępu publicznego, kodu dostępu, daty kontroli – pola pozostawiono puste (raport braków dla dostawcy).']
recs = []
rows = list(csv.reader(open(os.path.join(SUR, 'krosno_54632.csv'), encoding='utf-8')))
for row in rows[1:]:
    if not row or len(row) < 6:
        continue
    lon, lat, _, lok, adr, nid = [c.strip() for c in row[:6]]
    r = pusty()
    m_ = re.match(r'^(.*?),\s*(\d{2}-\d{3})\s+(.+)$', adr)
    r.update(id=f'KRO-{int(nid):03d}', nazwa_lokalizacji=re.sub(r'\s+', ' ', lok), adres=m_.group(1) if m_ else adr,
             kod_pocztowy=m_.group(2) if m_ else '', miejscowosc=m_.group(3) if m_ else 'Krosno', gmina='Krosno', powiat='Krosno',
             wojewodztwo='podkarpackie', szerokosc_geograficzna=f'{float(lat):.6f}', dlugosc_geograficzna=f'{float(lon):.6f}',
             zrodlo_danych='Zbiór „Defibrylatory zlokalizowane w Mieście Krosno” (dane.gov.pl, zasób 54632)', dostawca='Urząd Miasta Krosna',
             regon_dostawcy='000526989', licencja='CC0-1.0', data_aktualizacji='2024-02-19')
    recs.append(r)
dodaj_zrodlo(zrodlo_dgp(3624, 54632, {'terytorialny': 'miasto Krosno (pow. Krosno, woj. podkarpackie)', 'przedmiotowy': 'AED w obiektach publicznych wskazanych przez Urząd Miasta', 'czasowy': 'stan na 2024-02-19'}, raport), recs)

# ---------------------------------------------------------------- PRZEMYŚL (CSV ; z geometrią JSON)
raport = ['Separator „;” i znacznik BOM – rozpoznano automatycznie.',
          'Współrzędne w kolumnie „geometry” jako JSON {"lat","long"} – przeniesiono do szerokosc/dlugosc.',
          'Nazwa „Defibrylator (AED 9485) w ADM Centrum” – wydzielono nazwę lokalizacji, numer AED przeniesiono do uwag.',
          'Kolumna „description” zawiera ten sam ogólny opis AED dla każdego rekordu – pominięto (brak informacji o miejscu).',
          'Źródło nie zawiera: statusu, dostępności, dostępu publicznego, kodu dostępu, daty kontroli – pola puste (raport braków).']
recs = []
txt = open(os.path.join(SUR, 'przemysl_62095.csv'), encoding='utf-8-sig').read()
for row in csv.DictReader(io.StringIO(txt), delimiter=';'):
    g = json.loads(row['geometry'])['coordinates']
    nm = row['name'].strip()
    mm = re.match(r'^Defibrylator\s*\((AED\s*\d+)\)\s*(w|we|na|przy)?\s*(.*)$', nm)
    r = pusty()
    tel = re.sub(r'[^\d+]', '', row.get('phone') or '')
    if tel and not tel.startswith('+'):
        tel = '+48' + tel[-9:]
    r.update(id=f"PRZ-{row['id']}", nazwa_lokalizacji=(mm.group(3) if mm and mm.group(3) else nm), adres=f"ul. {row['street'].strip()} {row['home_number'].strip()}".strip(),
             kod_pocztowy=row['postcode'].strip(), miejscowosc=row['city'].strip(), gmina='Przemyśl', powiat='Przemyśl', wojewodztwo='podkarpackie',
             szerokosc_geograficzna=f"{float(g['lat']):.6f}", dlugosc_geograficzna=f"{float(g['long']):.6f}", telefon_kontaktowy=tel,
             zrodlo_danych='Zbiór „Lokalizacje AED – Automatycznych Defibrylatorów Zewnętrznych w Przemyślu” (dane.gov.pl, zasób 62095)',
             dostawca='Urząd Miejski w Przemyślu', regon_dostawcy='650900341', licencja='CC0-1.0', data_aktualizacji='2024-11-06',
             uwagi=(f'Numer urządzenia w źródle: {mm.group(1)}' if mm else ''))
    recs.append(r)
dodaj_zrodlo(zrodlo_dgp(4581, 62095, {'terytorialny': 'miasto Przemyśl (woj. podkarpackie)', 'przedmiotowy': 'AED w jednostkach miejskich i obiektach publicznych', 'czasowy': 'stan na 2024-11-06 (deklarowana aktualizacja: codziennie)'}, raport), recs)

# ---------------------------------------------------------------- MARKI (uszkodzony CSV, zamienione współrzędne)
raport = ['Każdy wiersz pliku ujęty w cudzysłów z podwojonymi cudzysłowami wewnątrz – plik nie jest poprawnym CSV (RFC 4180); zdjęto zewnętrzne cudzysłowy.',
          'Nagłówek deklaruje kolejność „Długość, Szerokość”, a wartości mają kolejność „szerokość, długość” – zamieniono, gdy wartość z kolumny „Długość” mieści się w zakresie szerokości dla Polski.',
          'Literówka w skrócie „Al..” – znormalizowano do „al.”. Pozostałe literówki w nazwach ulic pozostawiono (decyzja dostawcy).',
          'Wiersz 7: współrzędne identyczne z rekordem nr 1 zbioru z Krosna (ok. 260 km od Marek) – NIE poprawiono, oznaczone przez walidator jako błąd do wyjaśnienia przez dostawcę.',
          'Źródło nie zawiera: statusu, dostępności, dostępu publicznego, kodu dostępu, daty kontroli – pola puste (raport braków).']
recs = []
lines = open(os.path.join(SUR, 'marki_68353.csv'), encoding='utf-8').read().splitlines()
for ln in lines[1:]:
    ln = ln.strip()
    if not ln:
        continue
    if ln.startswith('"') and ln.endswith('"'):
        ln = ln[1:-1].replace('""', '"')
    row = next(csv.reader([ln]))
    a, b, _, lok, adr, nid = [c.strip() for c in row[:6]]
    a, b = float(a), float(b)
    lat, lon = (a, b) if 49 <= a <= 55 else (b, a)
    adr = adr.replace('Al..', 'al.')
    m_ = re.match(r'^(.*?),\s*(\d{2}-\d{3})\s+(.+)$', adr)
    r = pusty()
    r.update(id=f'MAR-{int(nid):03d}', nazwa_lokalizacji=lok.strip(), adres=m_.group(1) if m_ else adr, kod_pocztowy=m_.group(2) if m_ else '',
             miejscowosc=m_.group(3) if m_ else 'Marki', gmina='Marki', powiat='wołomiński', wojewodztwo='mazowieckie',
             szerokosc_geograficzna=f'{lat:.6f}', dlugosc_geograficzna=f'{lon:.6f}',
             zrodlo_danych='Zbiór „Defibrylatory zlokalizowane na terenie Miasta Marki” (dane.gov.pl, zasób 68353)', dostawca='Urząd Miasta Marki',
             regon_dostawcy='000526009', licencja='CC-BY-4.0', data_aktualizacji='2025-07-10')
    recs.append(r)
dodaj_zrodlo(zrodlo_dgp(4955, 68353, {'terytorialny': 'miasto Marki (pow. wołomiński, woj. mazowieckie)', 'przedmiotowy': 'AED w placówkach miejskich (urząd, szkoły, policja)', 'czasowy': 'stan na 2025-07-10 (jednorazowe udostępnienie)'}, raport), recs)

# ---------------------------------------------------------------- LEGIONOWO (CSV z polami adresowymi TERYT, 2026)
raport = ['Znacznik BOM w pliku UTF-8 – rozpoznano automatycznie.',
          'Adres rozbity na pola cecha_ulicy / nazwa_ulicy / nr_budynku / nr_lokalu (wzorem rejestrów adresowych) – złożono do pola adres („ul. Piłsudskiego 41”).',
          'Kolumna „kod_terc” ma 6 cyfr (140801) zamiast 7-cyfrowego kodu TERYT gminy (brak cyfry rodzaju gminy) – NIE uzupełniano, pole kod_teryt_gminy pozostawiono puste (raport braków dla dostawcy).',
          'Kolumna „kod_simc” (identyfikator miejscowości) nie ma odpowiednika we wzorcu – pominięto.',
          'Zasób jest częścią ogólnego zbioru „Zdrowie” (wiele zasobów) – w wyszukiwarce portalu trudny do znalezienia po frazie „defibrylator”.',
          'Źródło nie zawiera: statusu, dostępności, dostępu publicznego, kodu dostępu, daty kontroli – pola puste (raport braków).']
recs = []
txt = open(os.path.join(SUR, 'legionowo_2625221.csv'), encoding='utf-8-sig').read()
CECHA = {'ulica': 'ul.', 'aleja': 'al.', 'plac': 'pl.', 'osiedle': 'os.', 'rondo': 'rondo'}
for i, row in enumerate(csv.DictReader(io.StringIO(txt)), start=1):
    if not (row.get('nazwa') or '').strip():
        continue
    cecha = CECHA.get(row['cecha_ulicy'].strip().lower(), row['cecha_ulicy'].strip())
    nr = row['nr_budynku'].strip() + (('/' + row['nr_lokalu'].strip()) if row['nr_lokalu'].strip() else '')
    r = pusty()
    r.update(id=f'LEG-{i:03d}', nazwa_lokalizacji=row['nazwa'].strip(), adres=f"{cecha} {row['nazwa_ulicy'].strip()} {nr}".strip(),
             kod_pocztowy=row['kod_pocztowy'].strip(), miejscowosc=row['miejscowosc'].strip(), gmina='Legionowo', powiat='legionowski',
             wojewodztwo='mazowieckie', szerokosc_geograficzna=f"{float(row['szerokosc_geograficzna']):.6f}",
             dlugosc_geograficzna=f"{float(row['dlugosc_geograficzna']):.6f}",
             zrodlo_danych='Zasób „Wykaz defibrylatorów AED wraz z ich lokalizacją w Legionowie” (dane.gov.pl, zasób 2625221)',
             dostawca='Urząd Miasta Legionowo', regon_dostawcy='000524832', licencja='CC0-1.0', data_aktualizacji='2026-09-14')
    recs.append(r)
dodaj_zrodlo(zrodlo_dgp(40593, 2625221, {'terytorialny': 'miasto Legionowo (pow. legionowski, woj. mazowieckie)', 'przedmiotowy': 'AED w urzędach, służbach, szkołach, placówkach medycznych i obiektach publicznych',
                                        'czasowy': 'stan na 2026-09-14 (aktualizacja: nieregularnie)'}, raport), recs)

# ---------------------------------------------------------------- WARSZAWA (zasób = link do API z tokenem)
dodaj_zrodlo(zrodlo_dgp(39512, 2512040, {'terytorialny': 'm.st. Warszawa', 'przedmiotowy': 'AED w lokalizacjach miejskich', 'czasowy': 'data danych 2025-10-10'},
                        ['Zasób w dane.gov.pl wskazuje stronę katalogu miejskiego (HTML), a nie plik danych.',
                         'Dane dostępne wyłącznie przez API miasta po rejestracji i z indywidualnym tokenem użytkownika („Token API – obowiązkowy”).',
                         'Brak możliwości anonimowego, automatycznego pobrania – źródło wykryte, ale NIEZINTEGROWANE.',
                         'Rekomendacja: dostawca publikuje plik CSV wg wzorca jako zasób (lub API bez tokenu) – kreator „Zostań dostawcą”.'],
                        integracja='niedostepne', powod='Dostęp wymaga tokenu API – brak anonimowego pobrania'), [])

# ---------------------------------------------------------------- DEMO (syntetyczne)
MIASTA = {
    'Kraków': (50.0614, 19.9366, '31-0', 'Kraków', 'Kraków', 'małopolskie'),
    'Wrocław': (51.1079, 17.0385, '50-0', 'Wrocław', 'Wrocław', 'dolnośląskie'),
    'Gdańsk': (54.3520, 18.6466, '80-8', 'Gdańsk', 'Gdańsk', 'pomorskie'),
    'Poznań': (52.4064, 16.9252, '61-8', 'Poznań', 'Poznań', 'wielkopolskie'),
    'Łódź': (51.7592, 19.4560, '90-0', 'Łódź', 'Łódź', 'łódzkie'),
    'Katowice': (50.2649, 19.0238, '40-0', 'Katowice', 'Katowice', 'śląskie'),
    'Lublin': (51.2465, 22.5684, '20-0', 'Lublin', 'Lublin', 'lubelskie'),
    'Białystok': (53.1325, 23.1688, '15-0', 'Białystok', 'Białystok', 'podlaskie'),
    'Rzeszów': (50.0412, 21.9991, '35-0', 'Rzeszów', 'Rzeszów', 'podkarpackie'),
    'Olsztyn': (53.7784, 20.4801, '10-0', 'Olsztyn', 'Olsztyn', 'warmińsko-mazurskie'),
    'Szczecin': (53.4285, 14.5528, '70-0', 'Szczecin', 'Szczecin', 'zachodniopomorskie'),
    'Warszawa': (52.2297, 21.0122, '00-0', 'Warszawa', 'Warszawa', 'mazowieckie'),
}
ULICE = ['ul. Kwiatowa', 'ul. Szkolna', 'ul. Ogrodowa', 'ul. Lipowa', 'ul. Polna', 'ul. Słoneczna', 'ul. Krótka', 'ul. Brzozowa', 'ul. Kolejowa',
         'ul. Parkowa', 'ul. Sportowa', 'ul. Długa', 'ul. Spacerowa', 'ul. Zielona', 'ul. Akacjowa', 'ul. Klonowa']
URZ = [('Philips', 'HeartStart FRx'), ('Philips', 'HeartStart HS1'), ('ZOLL', 'AED Plus'), ('ZOLL', 'AED 3'), ('Stryker', 'LIFEPAK CR2'),
       ('Cardiac Science', 'Powerheart G5'), ('Mindray', 'BeneHeart C2'), ('Schiller', 'FRED PA-1'), ('Stryker', 'HeartSine samaritan PAD 360P'), ('Defibtech', 'Lifeline VIEW')]
DZIS = datetime.date(2026, 11, 21)


def d(days_ago):
    return (DZIS - datetime.timedelta(days=days_ago)).isoformat()


def demo_rekord(prefix, i, miasto, nazwa, kat, opis, dostawca, regon, lic, zrodlo, profil):
    lat0, lon0, kod, gm, pw, woj = MIASTA[miasto]
    ang, dist = random.random() * 2 * math.pi, random.uniform(0.004, 0.035)
    lat, lon = lat0 + dist * math.cos(ang), lon0 + dist * math.sin(ang) * 1.6
    prod, mod = random.choice(URZ)
    r = pusty()
    st = random.choices(['aktywny', 'w_serwisie', 'nieaktywny'], [0.82, 0.10, 0.08])[0]
    kontrola = random.choices([random.randint(3, 300), random.randint(400, 900), None], [0.62, 0.25, 0.13])[0]
    inst_days = random.randint(500, 3000)
    dost = profil['dostepnosc']()
    r.update(id=f'{prefix}-{i:03d}', nazwa_lokalizacji=nazwa, kategoria_obiektu=kat, adres=f'{random.choice(ULICE)} {random.randint(1, 120)}',
             kod_pocztowy=f'{kod}{random.randint(10, 99)}', miejscowosc=miasto, gmina=gm, powiat=pw, wojewodztwo=woj,
             szerokosc_geograficzna=f'{lat:.6f}', dlugosc_geograficzna=f'{lon:.6f}', opis_lokalizacji=opis, pietro=str(profil.get('pietro', 0)),
             dostepnosc=dost[0], godziny_dostepnosci=dost[1], dostep_publiczny=profil.get('publiczny', 'tak'),
             wymaga_kodu_dostepu=random.choices(['nie', 'tak'], [0.8, 0.2])[0], producent=prod, model=mod,
             elektrody_pediatryczne=random.choice(['tak', 'nie']), data_instalacji=d(inst_days),
             data_ostatniej_kontroli=d(kontrola) if kontrola else '', data_waznosci_elektrod=(DZIS + datetime.timedelta(days=random.randint(-60, 900))).isoformat(),
             data_waznosci_baterii=(DZIS + datetime.timedelta(days=random.randint(100, 1500))).isoformat(), status=st,
             zrodlo_danych=zrodlo, dostawca=dostawca, regon_dostawcy=regon, licencja=lic, data_aktualizacji=d(random.randint(1, 40)),
             telefon_kontaktowy=f'+48{random.randint(500000000, 899999999)}', uwagi='REKORD DEMONSTRACYJNY – dane syntetyczne, nie używać operacyjnie')
    if r['wymaga_kodu_dostepu'] == 'tak':
        r['instrukcja_dostepu'] = random.choice(['Kod do szafki podaje dyspozytor numeru 112', 'Klucz w portierni / ochrona obiektu'])
    return r


def regon9(prefix8):
    w = [8, 9, 2, 3, 4, 5, 6, 7]
    s = sum(int(c) * w[i] for i, c in enumerate(prefix8)) % 11
    return prefix8 + str(0 if s == 10 else s)


DEMO = [
    dict(prefix='FBS', dostawca='Fundacja „Bicie Serca” (DEMO)', typ='other', regon=regon9('98765432'), lic='CC-BY-4.0', miasta=['Kraków', 'Wrocław', 'Gdańsk', 'Warszawa'], n=32,
         zrodlo='Rejestr szafek AED fundacji (DEMO)', zakres={'terytorialny': 'Kraków, Wrocław, Gdańsk, Warszawa', 'przedmiotowy': 'plenerowe szafki AED fundacji (przestrzeń publiczna)', 'czasowy': 'stan bieżący (aktualizacja co tydzień)'},
         czest='Co tydzień', nazwy=[('Rynek – szafka AED na ścianie kamienicy', 'przestrzen_publiczna', 'Szafka ogrzewana, oznaczona zielonym znakiem AED'),
                                     ('Park miejski – wejście główne', 'przestrzen_publiczna', 'Słupek AED przy tablicy informacyjnej'),
                                     ('Węzeł przesiadkowy – wiata przystankowa', 'transport', 'Szafka na słupie przy kasowniku biletów'),
                                     ('Bulwar nad rzeką – punkt informacyjny', 'przestrzen_publiczna', 'Na zewnętrznej ścianie punktu'),
                                     ('Stadion miejski – kasa biletowa', 'obiekt_sportowy', 'Przy kasie nr 1, od strony parkingu')],
         profil={'dostepnosc': lambda: ('24/7', '')}),
    dict(prefix='KSZ', dostawca='Sieć sklepów „Koszyk” sp. z o.o. (DEMO)', typ='private', regon=regon9('12345678'), lic='CC0-1.0', miasta=['Poznań', 'Łódź', 'Katowice', 'Lublin'], n=30,
         zrodlo='System zarządzania majątkiem sieci (DEMO)', zakres={'terytorialny': 'Poznań, Łódź, Katowice, Lublin', 'przedmiotowy': 'AED w sklepach sieci', 'czasowy': 'stan bieżący (aktualizacja codziennie – API)'},
         czest='Codziennie', nazwy=[('Sklep „Koszyk” – sala sprzedaży', 'handel_uslugi', 'Przy kasach, szafka na ścianie obok wyjścia'),
                                     ('Sklep „Koszyk” – strefa wejścia', 'handel_uslugi', 'Przy wózkach sklepowych, po lewej')],
         profil={'dostepnosc': lambda: ('godziny', random.choice(['Mo-Sa 06:00-22:00; Su 09:00-20:00', 'Mo-Sa 07:00-21:00', 'Mo-Fr 06:00-23:00; Sa 07:00-22:00']))}),
    dict(prefix='PCM', dostawca='Powiatowe Centrum Medyczne (DEMO)', typ='local', regon=regon9('55544433'), lic='CC-BY-4.0', miasta=['Białystok', 'Rzeszów', 'Olsztyn', 'Szczecin'], n=28,
         zrodlo='Ewidencja sprzętu medycznego (DEMO)', zakres={'terytorialny': 'Białystok, Rzeszów, Olsztyn, Szczecin', 'przedmiotowy': 'AED w szpitalach i przychodniach centrum', 'czasowy': 'stan bieżący (aktualizacja co miesiąc)'},
         czest='Co miesiąc', nazwy=[('Szpital – Izba Przyjęć', 'szpital', 'Parter, przy rejestracji Izby Przyjęć'),
                                     ('Przychodnia rejonowa – rejestracja', 'przychodnia', 'Parter, za ladą rejestracji'),
                                     ('Szpital – hol główny', 'szpital', 'Hol główny, obok szatni')],
         profil={'dostepnosc': lambda: random.choice([('24/7', ''), ('godziny', 'Mo-Fr 07:00-20:00'), ('godziny', 'Mo-Fr 08:00-18:00; Sa 08:00-14:00')])}),
    dict(prefix='SRR', dostawca='Stowarzyszenie „Ratujmy Razem” (DEMO)', typ='other', regon=regon9('44433322'), lic='CC-BY-NC-4.0', miasta=['Łódź', 'Gdańsk', 'Kraków'], n=12,
         zrodlo='Mapa społeczności stowarzyszenia (DEMO)', zakres={'terytorialny': 'Łódź, Gdańsk, Kraków', 'przedmiotowy': 'AED zgłoszone przez członków', 'czasowy': 'nieregularnie'},
         czest='Nieregularnie', nazwy=[('Klub osiedlowy – świetlica', 'kultura', 'Przy wejściu do świetlicy'), ('Parafia – kruchta', 'obiekt_sakralny', 'W kruchcie, po prawej stronie')],
         profil={'dostepnosc': lambda: ('godziny', 'Mo-Su 08:00-20:00')}),
]
for dm in DEMO:
    recs = []
    for i in range(1, dm['n'] + 1):
        miasto = dm['miasta'][(i - 1) % len(dm['miasta'])]
        nazwa, kat, opis = dm['nazwy'][(i - 1) % len(dm['nazwy'])]
        recs.append(demo_rekord(dm['prefix'], i, miasto, nazwa, kat, opis, dm['dostawca'], dm['regon'], dm['lic'], dm['zrodlo'], dm['profil']))
    kompat = dm['lic'] in ('CC0-1.0', 'CC-BY-4.0')
    rid = f"DEMO-{dm['prefix']}"
    dodaj_zrodlo({
        'id': f"demo-{dm['prefix'].lower()}", 'typ': 'DEMO (syntetyczne)', 'demo': True,
        'instytucja': {'id': None, 'nazwa': dm['dostawca'], 'typ': dm['typ'], 'regon': dm['regon'], 'miasto': dm['miasta'][0]},
        'zbior': {'id': rid, 'tytul': f"Defibrylatory AED – {dm['dostawca']}", 'url': '', 'czestotliwosc': dm['czest'], 'zweryfikowano': d(random.randint(1, 20)), 'zmodyfikowano': d(2), 'kategorie': ['Zdrowie']},
        'zasob': {'id': rid, 'tytul': 'aed-wzorzec.csv', 'format': 'csv', 'url': '', 'pobranie': '', 'data_danych': d(2), 'stopien_otwartosci': 3},
        'licencja': dm['lic'], 'zakres_referencyjny': dm['zakres'],
        'status_integracji': 'zintegrowano' if kompat else 'wykluczono_licencja',
        'powod': '' if kompat else 'Licencja CC BY-NC 4.0 niekompatybilna z agregatem CC BY 4.0 (zakaz użytku komercyjnego)',
        'raport_harmonizacji': ['Plik zgodny ze wzorcem (kreator „Zostań dostawcą”) – bez mapowania.'], 'data_pobrania': DATA_POBRANIA,
    }, recs)

# ---------------------------------------------------------------- OSM – warstwa pomocnicza (ODbL)
osm_pts = []
osm_path = os.path.join(SUR, 'osm_defibrillator_pl.json')
if os.path.exists(osm_path):
    osm = json.load(open(osm_path, encoding='utf-8'))
    for e in osm.get('elements', []):
        t = e.get('tags', {})
        osm_pts.append([round(e['lat'], 5), round(e['lon'], 5), (t.get('defibrillator:location') or t.get('name') or t.get('operator') or '')[:80],
                        t.get('opening_hours', ''), t.get('access', ''), e['id']])
zrodla.append({
    'id': 'osm', 'typ': 'OpenStreetMap', 'demo': False,
    'instytucja': {'id': None, 'nazwa': 'Społeczność OpenStreetMap (OSMF)', 'typ': 'other', 'regon': '', 'miasto': ''},
    'zbior': {'id': 'osm', 'tytul': 'OpenStreetMap – obiekty emergency=defibrillator w Polsce', 'url': 'https://www.openstreetmap.org/copyright', 'czestotliwosc': 'na bieżąco (wolontariusze)', 'zweryfikowano': '', 'zmodyfikowano': DATA_POBRANIA, 'kategorie': []},
    'zasob': {'id': 'overpass', 'tytul': 'Zapytanie Overpass API', 'format': 'json', 'url': 'https://overpass-api.de/', 'pobranie': '', 'data_danych': DATA_POBRANIA, 'stopien_otwartosci': 3},
    'licencja': 'ODbL-1.0', 'zakres_referencyjny': {'terytorialny': 'Polska', 'przedmiotowy': 'AED zmapowane przez wolontariuszy (bez odpowiedzialności dysponenta)', 'czasowy': f'pobrano {DATA_POBRANIA}'},
    'status_integracji': 'wykluczono_licencja', 'powod': 'ODbL 1.0 (share-alike dla baz danych) – niekompatybilna z CC BY 4.0; tylko warstwa pomocnicza do wskazywania luk',
    'raport_harmonizacji': ['Nie włączono do agregatu – licencja ODbL 1.0 (share-alike) jest niekompatybilna z CC BY 4.0.', 'Rola: wyłącznie warstwa pomocnicza „wskazówki luk” (gdzie mogą być AED nieopublikowane przez dysponentów), z atrybucją © współtwórcy OpenStreetMap.'] + ([] if osm_pts else ['Świadomie BEZ danych: ODbL wymaga udostępniania baz pochodnych na tej samej licencji, więc punkty OSM nie są dystrybuowane w tym prototypie. Pozostaje gotowy konektor (zapytanie node[emergency=defibrillator] w narzedzia/zbuduj_dane.py) – do decyzji prawnej operatora portalu.']),
    'data_pobrania': DATA_POBRANIA, 'liczba_rekordow': len(osm_pts),
})

# ---------------------------------------------------------------- ZAPIS
def js(name, var, obj):
    with open(os.path.join(OUT_JS, name), 'w', encoding='utf-8') as f:
        f.write(f'/* Plik wygenerowany przez narzedzia/zbuduj_dane.py – nie edytuj ręcznie. */\nwindow.{var} = ')
        json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')

js('schemat.js', 'SCHEMAT', SCHEMA)
js('zrodla.js', 'ZRODLA', zrodla)
js('rekordy.js', 'REKORDY', rekordy)
js('osm.js', 'OSM_AED', osm_pts)

# Przykładowe pliki dla kreatora dostawcy (fikcyjna gmina DEMO) – poprawny i z błędami
def zapisz_csv(path, rows, sep=',', enc='utf-8'):
    with open(path, 'w', encoding=enc, newline='') as f:
        w = csv.DictWriter(f, fieldnames=POLA, delimiter=sep)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, '') for k in POLA})

random.seed(7)
gm = dict(prefix='GDM', dostawca='Gmina Demonstracyjna (DEMO)', regon='000000000')
przyk = []
nazwy = [('Urząd Gminy – Biuro Obsługi Interesanta', 'urzad', 'Parter, hol, przy biurze podawczym'), ('Szkoła Podstawowa nr 1', 'szkola', 'Parter, przy sekretariacie'),
         ('Hala sportowa', 'obiekt_sportowy', 'Przy wejściu na trybuny'), ('Ośrodek Zdrowia', 'przychodnia', 'Rejestracja'), ('Biblioteka gminna', 'kultura', 'Przy wypożyczalni'),
         ('Remiza OSP', 'sluzby_ratownicze', 'Szafka zewnętrzna przy bramie garażu'), ('Dworzec autobusowy', 'transport', 'Poczekalnia, ściana przy kasach'),
         ('Basen miejski', 'obiekt_sportowy', 'Przy ratownikach, hala basenowa'), ('Rynek – ratusz', 'przestrzen_publiczna', 'Szafka na ścianie ratusza od strony rynku'),
         ('Centrum kultury', 'kultura', 'Foyer, przy szatni'), ('Przedszkole Samorządowe', 'szkola', 'Korytarz główny'), ('Park – amfiteatr', 'przestrzen_publiczna', 'Słupek AED przy scenie')]
for i, (n, k, o) in enumerate(nazwy, 1):
    r = demo_rekord('GDM', i, 'Rzeszów', n, k, o, 'Gmina Demonstracyjna (DEMO)', regon9('11122233'), 'CC-BY-4.0', 'Ewidencja AED Urzędu Gminy (DEMO)',
                    {'dostepnosc': lambda: random.choice([('24/7', ''), ('godziny', 'Mo-Fr 07:30-15:30')])})
    r['status'] = 'aktywny'
    r['data_ostatniej_kontroli'] = d(random.randint(5, 200))
    przyk.append(r)
zapisz_csv(os.path.join(OUT_PRZYK, 'przyklad-poprawny.csv'), przyk)
# Wersja z typowymi błędami spotykanymi w prawdziwych zasobach (wzorowane na wynikach harmonizacji)
bl = [dict(r) for r in przyk]
bl[1]['szerokosc_geograficzna'] = bl[1]['szerokosc_geograficzna'].replace('.', ',')          # przecinek dziesiętny
bl[2]['szerokosc_geograficzna'], bl[2]['dlugosc_geograficzna'] = bl[2]['dlugosc_geograficzna'], bl[2]['szerokosc_geograficzna']  # zamienione
bl[3]['kod_pocztowy'] = '35100'                                                              # zły format kodu
bl[4]['status'] = 'sprawny'                                                                  # spoza słownika
bl[5]['dostepnosc'] = 'godziny'; bl[5]['godziny_dostepnosci'] = ''                           # brak godzin
bl[6]['data_ostatniej_kontroli'] = '12.03.2026'                                              # zły format daty
bl[7]['dostep_publiczny'] = 'TAK'                                                            # wielkość liter
bl[8]['id'] = bl[7]['id']                                                                    # duplikat id
bl[9]['szerokosc_geograficzna'] = '49.718809'; bl[9]['dlugosc_geograficzna'] = '21.720344'   # punkt w innym mieście (jak w zasobie Marek)
bl[10]['nazwa_lokalizacji'] = ''                                                             # brak nazwy
bl[11]['licencja'] = 'CC-BY-NC-4.0'                                                          # licencja niekompatybilna
bl[0]['telefon_kontaktowy'] = '17 123 45 67'                                                 # format telefonu
zapisz_csv(os.path.join(OUT_PRZYK, 'przyklad-z-bledami.csv'), bl, sep=';')
zapisz_csv(os.path.join(ROOT, 'schemat', 'szablon-AED.csv'), [])
zapisz_csv(os.path.join(ROOT, 'schemat', 'przyklad-AED.csv'), przyk)
with open(os.path.join(OUT_JS, 'przyklady.js'), 'w', encoding='utf-8') as f:
    f.write('/* Wygenerowane: przykładowe pliki dla kreatora (działa bez serwera). */\nwindow.PRZYKLADY = ')
    json.dump({'poprawny': open(os.path.join(OUT_PRZYK, 'przyklad-poprawny.csv'), encoding='utf-8').read(),
               'z_bledami': open(os.path.join(OUT_PRZYK, 'przyklad-z-bledami.csv'), encoding='utf-8').read()}, f, ensure_ascii=False)
    f.write(';\n')

print('źródła:', len(zrodla), '| rekordy:', len(rekordy), '| OSM:', len(osm_pts))
for z in zrodla:
    print(f"  {z['id']:<14} {z['status_integracji']:<20} {z['licencja']:<12} {z['liczba_rekordow']:>5}  {z['instytucja']['nazwa']}")
