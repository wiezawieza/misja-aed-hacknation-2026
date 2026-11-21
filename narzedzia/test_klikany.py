# -*- coding: utf-8 -*-
"""Test klikany prototypu od zera (Chrome, świeży profil, bez cache).
Uruchom: py -3.11 narzedzia/test_klikany.py [BASE]   (BASE domyślnie http://localhost:8790/prototyp/index.html)
Wymaga: selenium, Chrome. Wynik: PASS/FAIL na każdy krok + błędy konsoli."""
import os, sys, time, shutil, tempfile, json
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8790/prototyp/index.html'
TMP = tempfile.mkdtemp(prefix='aed-test-')
DL = os.path.join(TMP, 'dl'); os.makedirs(DL)
o = Options()
o.binary_location = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
o.add_argument('--headless=new'); o.add_argument('--window-size=1440,1000')
o.add_argument('--user-data-dir=' + os.path.join(TMP, 'profil'))
o.set_capability('goog:loggingPrefs', {'browser': 'ALL'})
o.add_experimental_option('prefs', {'download.default_directory': DL, 'download.prompt_for_download': False})
d = webdriver.Chrome(options=o)
d.execute_cdp_cmd('Browser.setDownloadBehavior', {'behavior': 'allow', 'downloadPath': DL.replace('/', '\\')})
wyniki = []

def krok(nazwa, f):
    try:
        r = f(); wyniki.append((nazwa, True, r))
    except Exception as e:
        wyniki.append((nazwa, False, repr(e)[:300]))

def q(s): return d.find_element(By.CSS_SELECTOR, s)
def qa(s): return d.find_elements(By.CSS_SELECTOR, s)
def klik(s):
    e = q(s); d.execute_script('arguments[0].scrollIntoView({block:"center",behavior:"instant"})', e); time.sleep(0.9); e.click(); time.sleep(0.4)
def hash_(h): d.execute_script('location.hash=arguments[0]', h); time.sleep(1.2)
def pliki(): return sorted(os.listdir(DL))
def czekaj_plik(rozsz, t=8, prefix=''):
    for _ in range(t * 5):
        z = [f for f in os.listdir(DL) if f.startswith(prefix) and f.endswith(rozsz) and not f.endswith('.crdownload')]
        if z: return z[-1]
        time.sleep(0.2)
    raise AssertionError('brak pliku ' + rozsz + '; są: ' + str(pliki()))

d.get(BASE); time.sleep(2)
krok('start: liczniki', lambda: d.find_element(By.TAG_NAME, 'main').text.split('\n')[:0] or d.execute_script('return document.body.innerText').count('163'))
krok('start: tytuł', lambda: d.title)

def mapa():
    hash_('#/mapa'); time.sleep(2)
    ov = d.execute_script('var c=document.querySelector(".leaflet-overlay-pane canvas");if(!c)return 0;var x=c.getContext("2d").getImageData(0,0,c.width,c.height).data,n=0;for(var i=3;i<x.length;i+=4)if(x[i]>0)n++;return n')
    assert ov > 500, 'canvas z punktami pusty: %s' % ov
    return 'pikseli punktow=%s' % ov
krok('mapa: punkty', mapa)

def mapa_karta():
    hash_('#/mapa?aed=000526989:KRO-002'); time.sleep(2)
    t = d.execute_script('return document.body.innerText')
    assert 'Wyspiańskiego' in t, 'brak karty AED'
    return 'karta OK'
krok('mapa: karta AED', mapa_karta)

def mapa_filtr():
    hash_('#/mapa'); time.sleep(1.5)
    c = qa('input[type=checkbox]')
    assert c, 'brak filtrów'
    return 'filtrów=%d' % len(c)
krok('mapa: filtry', mapa_filtr)

def kreator():
    hash_('#/dostawca'); time.sleep(1)
    klik('#wypelnij'); klik('#dalej')                       # 1 -> 2
    for c in qa('[data-osw]'):
        if not c.is_selected(): d.execute_script('arguments[0].click()', c)
    assert q('#podpis').get_attribute('value'), 'brak podpisu'
    klik('#dalej')                                           # 2 -> 3
    q('#m-z').clear(); q('#m-z').send_keys('Gmina Testowa – obiekty gminne'); klik('#dalej')  # 3 -> 4
    klik('#ex-bl'); time.sleep(0.8)
    klik('#dalej')                                           # 4 -> 5
    t = d.execute_script('return document.body.innerText')
    assert 'Lista problemów' in t, 'brak walidacji'
    return 'walidacja widoczna'
krok('kreator 1-5 (przykład z błędami)', kreator)

def blokada():
    assert q('#dalej').get_attribute('disabled') is not None, 'publikacja NIE jest zablokowana mimo błędów'
    return 'Dalej zablokowane przy błędach (OK)'
krok('walidacja: blokada przy błędach', blokada)

def komorka(w, pole, wartosc):
    e = q('input.cell[aria-label="Wiersz %d, %s"]' % (w, pole))
    d.execute_script('arguments[0].scrollIntoView({block:"center",behavior:"instant"})', e); time.sleep(0.3)
    e.click(); e.send_keys(Keys.CONTROL, 'a'); e.send_keys(wartosc); e.send_keys(Keys.TAB); time.sleep(0.4)

def autofix():
    klik('#autofix'); time.sleep(1)
    t = q('#podsum').text
    assert '5 błędów' in t, 'po autofix oczekiwano 5 błędów do ręcznej poprawy: ' + t
    lat9 = q('input.cell[aria-label="Wiersz 9, szerokosc_geograficzna"]').get_attribute('value')
    komorka(5, 'status', 'aktywny'); komorka(6, 'godziny_dostepnosci', 'Mo-Fr 08:00-16:00')
    komorka(9, 'id', 'GDM-0099'); komorka(10, 'szerokosc_geograficzna', lat9); komorka(11, 'nazwa_lokalizacji', 'Punkt testowy')
    t = q('#podsum').text
    assert q('#dalej').get_attribute('disabled') is None, 'Dalej nadal zablokowane po ręcznych poprawkach: ' + t[:300] + ' | ' + q('#lista-probl').text[:400]
    klik('#dalej')
    assert 'Podgląd przed publikacją' in d.execute_script('return document.body.innerText')
    return 'autofix + 5 ręcznych poprawek -> krok 6'
krok('walidacja: autofix i poprawki w siatce', autofix)

def eksport_kreator():
    klik('#pob-csv'); f = czekaj_plik('.csv')
    klik('#pob-rap'); r = czekaj_plik('.json')
    json.load(open(os.path.join(DL, r), encoding='utf-8'))
    return f + ', ' + r
krok('kreator: CSV + raport JSON', eksport_kreator)

def publikacja():
    klik('#dalej'); klik('#publikuj'); time.sleep(4)
    t = d.execute_script('return document.body.innerText')
    assert 'Opublikowano' in t or 'opublikowan' in t.lower(), 'brak potwierdzenia: ' + t[-300:]
    return 'symulacja publikacji OK'
krok('publikacja (symulacja)', publikacja)

def odznaka():
    klik('#odznaka'); time.sleep(1.5); return str(pliki())
krok('odznaka', odznaka)

def mapa_nowy():
    hash_('#/mapa'); time.sleep(2)
    t = d.execute_script('return document.body.innerText')
    return 'Gmina Testowa' in t or 'DEMO' in t
krok('po publikacji: mapa', mapa_nowy)

def ekspo(fmt, rozsz):
    def f():
        hash_('#/zbior'); time.sleep(1.5)
        for fn in os.listdir(DL):
            if (fn.startswith('aed-zbior') or fn.startswith('datapackage')) and fn.endswith(rozsz): os.remove(os.path.join(DL, fn))
        klik('[data-ex="%s"]' % fmt); n = czekaj_plik(rozsz, prefix='datapackage' if fmt == 'meta' else 'aed-zbior'); p = os.path.join(DL, n)
        sz = os.path.getsize(p); assert sz > 1000, 'plik za mały %d' % sz
        extra = ''
        if rozsz == '.json' and fmt == 'json': extra = ' rekordow=%s' % json.load(open(p, encoding='utf-8'))['liczba']
        if fmt == 'meta': extra = ' zasobow=%s' % len(json.load(open(p, encoding='utf-8')).get('resources', []))
        if rozsz == '.xlsx': extra = ' zip=%s' % open(p, 'rb').read(2)
        return '%s %dB%s' % (n, sz, extra)
    return f
for fmt, r in (('csv', '.csv'), ('xlsx', '.xlsx'), ('json', '.json'), ('geojson', '.geojson'), ('meta', '.json')):
    krok('eksport zbioru: ' + fmt, ekspo(fmt, r))

def sluzby():
    hash_('#/sluzby?miejsce=sejm'); time.sleep(2)
    t = d.execute_script('return document.body.innerText')
    assert 'min' in t and ('m' in t), 'brak listy'
    return t[:0] or 'lista OK'
krok('służby: najbliższe AED', sluzby)
for h in ('#/schemat', '#/akcja', '#/jury', '#/zbior'):
    krok('widok ' + h, (lambda h=h: (hash_(h), len(d.execute_script('return document.body.innerText')))[1]))

logi = [l for l in d.get_log('browser') if l['level'] in ('SEVERE',) and 'tile' not in l['message'].lower() and 'openstreetmap' not in l['message'].lower()]
d.quit()
ok = all(w[1] for w in wyniki)
for n, s, r in wyniki: print(('PASS ' if s else 'FAIL '), n, '|', r)
print('BŁĘDY KONSOLI:', logi if logi else 'brak')
print('WYNIK:', 'OK' if ok and not logi else 'SĄ PROBLEMY')
shutil.rmtree(TMP, ignore_errors=True)
