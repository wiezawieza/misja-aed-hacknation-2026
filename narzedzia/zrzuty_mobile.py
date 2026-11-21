# -*- coding: utf-8 -*-
"""Zrzuty w emulacji telefonu (390x844, DPR 2) – Selenium + Chrome (headless chrome ma minimalną szerokość okna ~500 px)."""
import os, sys, time
from selenium import webdriver
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/prototyp/index.html'
o = webdriver.ChromeOptions()
o.add_argument('--headless=new'); o.add_argument('--hide-scrollbars')
o.add_experimental_option('mobileEmulation', {'deviceMetrics': {'width': 390, 'height': 844, 'pixelRatio': 2}, 'userAgent': 'Mozilla/5.0 (Linux; Android 14) Mobile'})
d = webdriver.Chrome(options=o)
for nazwa, h in [('11-mobile-mapa', '#/mapa'), ('12-mobile-sluzby', '#/sluzby?miejsce=krosno'), ('13-mobile-start', '#/'), ('14-mobile-kreator', '#/dostawca?demo=bledy')]:
    d.get('about:blank'); d.get(BASE + '?m=' + nazwa + h); time.sleep(3.5)
    d.save_screenshot(os.path.join(ROOT, 'prezentacja', 'zrzuty', nazwa + '.png'))
    print(nazwa, d.execute_script('return [innerWidth, document.documentElement.scrollWidth]'))
d.quit()
