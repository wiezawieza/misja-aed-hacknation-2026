/* Kreator „Zostań dostawcą danych” – onboarding dostawcy zgodny z zasadami dane.gov.pl:
 * dane publikuje INSTYTUCJA (dostawca), która składa oświadczenie o odpowiedzialności; my tylko
 * walidujemy i standaryzujemy plik LOKALNIE (plik nie opuszcza komputera) i symulujemy publikację. */
(function () {
  'use strict';
  var APP = window.APP, V = window.WALIDATOR, S = window.SCHEMAT, esc = APP.esc, $ = APP.$, $$ = APP.$$;
  var KROKI = ['Organizacja', 'Oświadczenie', 'Zbiór i zakres', 'Plik', 'Walidacja', 'Podgląd', 'Publikacja'];
  var K = APP.kreator = { krok: 1, max: 1, org: { nazwa: '', typ: 'local', regon: '', email: '', osoba: '', stanowisko: '', www: '' },
    osw: {}, meta: { tytul: '', opis: '', czest: 'Co miesiąc', licencja: 'CC-BY-4.0', teryt: '', kategorie: [], sposob: 'plik' },
    plik: null, wiersze: [], problemyPliku: [], wynik: null, pub: null };
  var OSW = [
    'jest dysponentem (właścicielem lub zarządcą) wskazanych urządzeń AED albo działa w imieniu dysponenta i ma prawo udostępnić dane o nich;',
    'ponosi wyłączną odpowiedzialność za poprawność, kompletność i aktualność publikowanych danych w zadeklarowanym zakresie referencyjnym – w szczególności za lokalizację, dostępność i status urządzeń;',
    'zobowiązuje się aktualizować zasób z zadeklarowaną częstotliwością oraz publikować zmianę statusu AED (serwis, demontaż) nie później niż w ciągu 3 dni roboczych;',
    'będzie rozpatrywać uwagi odbiorców zgłaszane mechanizmem „Zgłoś uwagę” w dane.gov.pl;',
    'dane nie zawierają danych osobowych (poza służbowymi danymi kontaktowymi obiektu) ani kodów dostępu do szafek AED;',
    'udostępnia dane na wskazanej licencji, zgodnie z ustawą z dnia 11 sierpnia 2021 r. o otwartych danych i ponownym wykorzystywaniu informacji sektora publicznego.'
  ];
  var TYPY = { local: 'samorządowa', state: 'państwowa', private: 'prywatna (przedsiębiorca)', other: 'inna (np. organizacja pozarządowa)' };
  var CZEST = ['Codziennie', 'Co tydzień', 'Co miesiąc', 'Co kwartał', 'Co pół roku', 'Co roku'];

  function regon9(p8) { var w = [8, 9, 2, 3, 4, 5, 6, 7], s = 0; for (var i = 0; i < 8; i++) s += (+p8[i]) * w[i]; s %= 11; return p8 + (s === 10 ? 0 : s); }
  function slug(s) { return V.klucz(s).replace(/_/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40).replace(/-$/, '') || 'dostawca'; }
  function okKrok(n) {
    if (n === 1) return K.org.nazwa.trim().length > 2 && V.regonOk(K.org.regon.trim()) && /.+@.+\..+/.test(K.org.email);
    if (n === 2) return OSW.every(function (_, i) { return K.osw[i]; }) && (K.osw.podpis || '').trim().length > 3;
    if (n === 3) return K.meta.tytul.trim() && K.meta.teryt.trim();
    if (n === 4) return K.wiersze.length > 0 && !K.problemyPliku.some(function (p) { return p.poziom === 'blad'; });
    if (n === 5) return K.wynik && K.wynik.bledy === 0;
    if (n === 6) return true;
    return true;
  }

  APP.widok('dostawca', 'Zostań dostawcą danych', function (main, params) {
    var demo = params.get('demo');
    if (demo && !K._demoZaladowane) {
      K._demoZaladowane = true;
      K.org = { nazwa: 'Gmina Demonstracyjna (DEMO)', typ: 'local', regon: regon9('11122233'), email: 'aed@gmina-demo.example', osoba: 'Anna Przykładowa', stanowisko: 'Sekretarz Gminy', www: 'https://gmina-demo.example' };
      OSW.forEach(function (_, i) { K.osw[i] = true; }); K.osw.podpis = 'Anna Przykładowa, Sekretarz Gminy';
      K.meta = { tytul: 'Defibrylatory AED – Gmina Demonstracyjna (DEMO)', opis: 'Lokalizacje i stan urządzeń AED w obiektach gminnych. Zasób zgodny z wzorcowym zakresem danych AED (#SerceNaMapie).', czest: 'Co miesiąc', licencja: 'CC-BY-4.0', teryt: 'Gmina Demonstracyjna – obiekty gminne', kategorie: ['urzad', 'szkola', 'obiekt_sportowy', 'kultura'], sposob: 'plik' };
      wczytajTekst(demo === 'poprawny' ? 'przyklad-poprawny.csv' : 'przyklad-z-bledami.csv', demo === 'poprawny' ? window.PRZYKLADY.poprawny : window.PRZYKLADY.z_bledami);
      K.max = demo === 'poprawny' ? 6 : 5; K.krok = +params.get('krok') || K.max; K.max = Math.max(K.max, K.krok);
    }
    main.innerHTML = '<div class="wrap section"><p class="eyebrow">Onboarding dostawcy danych</p><h1>Zostań dostawcą danych o AED</h1>' +
      '<p class="muted">Kreator przygotowuje zasób zgodny z wzorcowym zakresem i prowadzi przez publikację w dane.gov.pl. <b>Dane publikuje Twoja instytucja</b> – to ona odpowiada za ich jakość. Plik jest sprawdzany wyłącznie w przeglądarce.</p>' +
      '<nav aria-label="Kroki kreatora"><ol class="stepper">' + KROKI.map(function (k, i) {
        var n = i + 1, cls = n === K.krok ? 'active' : n < K.krok || n <= K.max - 1 ? 'done' : '';
        return '<li class="' + cls + '"><button data-krok="' + n + '"' + (n > K.max ? ' disabled' : '') + (n === K.krok ? ' aria-current="step"' : '') + '><span>Krok ' + n + '</span><b>' + k + '</b></button></li>';
      }).join('') + '</ol></nav><div id="krok"></div></div>';
    $$('[data-krok]').forEach(function (b) { b.onclick = function () { idz(+b.dataset.krok); }; });
    rysujKrok();
  });

  function idz(n) { K.krok = n; K.max = Math.max(K.max, n); APP.route(); var h = document.querySelector('#krok h2'); if (h) { h.setAttribute('tabindex', '-1'); h.focus(); } }
  function nawigacja(n) {
    return '<div class="btns" style="margin-top:20px;justify-content:space-between">' + (n > 1 ? '<button class="btn" id="wstecz">‹ Wstecz</button>' : '<span></span>') +
      (n < 7 ? '<button class="btn btn-primary" id="dalej"' + (okKrok(n) ? '' : ' disabled aria-disabled="true"') + '>Dalej: ' + KROKI[n] + ' ›</button>' : '') + '</div>';
  }
  function podepnijNawigacje(n) {
    var w = $('#wstecz'); if (w) w.onclick = function () { idz(n - 1); };
    var d = $('#dalej'); if (d) d.onclick = function () { if (okKrok(n)) idz(n + 1); };
  }
  function odswiezDalej(n) { var d = $('#dalej'); if (d) { var ok = okKrok(n); d.disabled = !ok; d.setAttribute('aria-disabled', String(!ok)); } }

  function rysujKrok() {
    var el = $('#krok'), n = K.krok, h = '';
    if (n === 1) {
      h = '<div class="card"><h2>1. Rejestracja organizacji (instytucja = dostawca)</h2><p class="note">W dane.gov.pl konto <b>instytucji</b> zakłada administrator portalu na wniosek dostawcy; dane publikują jej redaktorzy w panelu lub automatycznie (harwester). Formularz przygotowuje ten wniosek – symulacja.</p>' +
        '<div class="grid g2"><div><label class="f" for="o-nazwa">Pełna nazwa instytucji *</label><input type="text" id="o-nazwa" data-o="nazwa" value="' + esc(K.org.nazwa) + '" autocomplete="organization" required></div>' +
        '<div><label class="f" for="o-typ">Typ instytucji (jak w dane.gov.pl)</label><select id="o-typ" data-o="typ">' + Object.keys(TYPY).map(function (t) { return '<option value="' + t + '"' + (K.org.typ === t ? ' selected' : '') + '>' + TYPY[t] + '</option>'; }).join('') + '</select></div>' +
        '<div><label class="f" for="o-regon">REGON *</label><input type="text" id="o-regon" data-o="regon" inputmode="numeric" value="' + esc(K.org.regon) + '" aria-describedby="regon-h"><p class="hint" id="regon-h" aria-live="polite"></p></div>' +
        '<div><label class="f" for="o-email">E-mail instytucji (do uwag odbiorców) *</label><input type="email" id="o-email" data-o="email" value="' + esc(K.org.email) + '" autocomplete="email"></div>' +
        '<div><label class="f" for="o-osoba">Osoba odpowiedzialna za dane</label><input type="text" id="o-osoba" data-o="osoba" value="' + esc(K.org.osoba) + '"></div>' +
        '<div><label class="f" for="o-st">Stanowisko</label><input type="text" id="o-st" data-o="stanowisko" value="' + esc(K.org.stanowisko) + '"></div></div>' +
        '<p class="hint">Dla testu użyj przycisku poniżej (wypełnia fikcyjną gminę DEMO z poprawnym REGON-em).</p><button class="btn btn-sm" id="wypelnij">Wypełnij danymi DEMO</button>' + nawigacja(1) + '</div>';
      el.innerHTML = h;
      var regonInfo = function () { var r = K.org.regon.trim(); $('#regon-h').textContent = !r ? '9 lub 14 cyfr – sprawdzamy sumę kontrolną.' : V.regonOk(r) ? '✔ Poprawny REGON (suma kontrolna OK).' : '✖ Niepoprawny REGON – sprawdź cyfry.'; };
      $$('[data-o]').forEach(function (i) { i.addEventListener('input', function () { K.org[i.dataset.o] = i.value; regonInfo(); odswiezDalej(1); }); });
      $('#wypelnij').onclick = function () { K.org = { nazwa: 'Gmina Demonstracyjna (DEMO)', typ: 'local', regon: regon9('11122233'), email: 'aed@gmina-demo.example', osoba: 'Anna Przykładowa', stanowisko: 'Sekretarz Gminy', www: '' }; rysujKrok(); };
      regonInfo();
    }
    if (n === 2) {
      h = '<div class="card"><h2>2. Oświadczenie o odpowiedzialności za dane</h2><p>Zgodnie z zasadami dane.gov.pl <b>za jakość, aktualność i poprawność danych odpowiada wyłącznie dostawca</b>. Jeśli AED w danej lokalizacji jest błędny, konsekwencje ponosi dostawca – dlatego bez tego oświadczenia nie można przejść dalej.</p>' +
        '<fieldset class="declaration"><legend>Oświadczenie dostawcy danych</legend><p><b>' + esc(K.org.nazwa || '[nazwa instytucji]') + '</b>, jako dostawca danych w portalu dane.gov.pl, oświadcza, że:</p>' +
        OSW.map(function (t, i) { return '<label class="chk"><input type="checkbox" data-osw="' + i + '"' + (K.osw[i] ? ' checked' : '') + '><span>' + (i + 1) + '. ' + esc(t) + '</span></label>'; }).join('') +
        '<label class="f" for="podpis">Podpis: imię, nazwisko i stanowisko osoby upoważnionej *</label><input type="text" id="podpis" value="' + esc(K.osw.podpis || (K.org.osoba ? K.org.osoba + ', ' + K.org.stanowisko : '')) + '">' +
        '<p class="hint">Data złożenia: ' + V.DZIS + '. W portalu oświadczenie trafia do opisu zbioru (warunki wykorzystania) i jest widoczne dla odbiorców.</p></fieldset>' +
        '<div class="btns" style="margin-top:10px"><button class="btn btn-sm" id="pobierz-osw">Pobierz treść oświadczenia (TXT)</button></div>' + nawigacja(2) + '</div>';
      el.innerHTML = h;
      if (!K.osw.podpis && $('#podpis').value) K.osw.podpis = $('#podpis').value;
      $$('[data-osw]').forEach(function (c) { c.onchange = function () { K.osw[c.dataset.osw] = c.checked; odswiezDalej(2); }; });
      $('#podpis').oninput = function () { K.osw.podpis = this.value; odswiezDalej(2); };
      $('#pobierz-osw').onclick = function () { APP.pobierz('oswiadczenie-dostawcy-AED.txt', (K.org.nazwa || '[instytucja]') + ', jako dostawca danych w portalu dane.gov.pl, oświadcza, że:\n' + OSW.map(function (t, i) { return (i + 1) + '. ' + t; }).join('\n') + '\n\nPodpis: ' + (K.osw.podpis || '') + '\nData: ' + V.DZIS + '\n'); };
    }
    if (n === 3) {
      if (!K.meta.tytul) K.meta.tytul = 'Defibrylatory AED – ' + K.org.nazwa;
      if (!K.meta.opis) K.meta.opis = 'Lokalizacje i stan urządzeń AED, za które odpowiada ' + K.org.nazwa + '. Zasób zgodny z wzorcowym zakresem danych AED (#SerceNaMapie).';
      var kat = S.fields.filter(function (f) { return f.name === 'kategoria_obiektu'; })[0];
      h = '<div class="card"><h2>3. Zbiór danych, licencja i zakres referencyjny</h2><p class="muted">Metadane w strukturze dane.gov.pl: zbiór danych (kategoria, słowa kluczowe, częstotliwość, licencja) → zasób.</p>' +
        '<div class="grid g2"><div><label class="f" for="m-t">Tytuł zbioru danych *</label><input type="text" id="m-t" data-m="tytul" value="' + esc(K.meta.tytul) + '"></div>' +
        '<div><label class="f" for="m-c">Częstotliwość aktualizacji</label><select id="m-c" data-m="czest">' + CZEST.map(function (c) { return '<option' + (K.meta.czest === c ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></div></div>' +
        '<label class="f" for="m-o">Opis zbioru</label><textarea id="m-o" data-m="opis">' + esc(K.meta.opis) + '</textarea>' +
        '<p class="small"><b>Kategoria:</b> Zdrowie (HEAL) · <b>Słowa kluczowe:</b> AED, defibrylator, zdrowie, SerceNaMapie · <b>Format zasobu:</b> CSV (UTF-8)</p>' +
        '<fieldset><legend>Licencja (domyślnie CC BY 4.0)</legend>' + S.licencje.map(function (l) {
          return '<label class="chk"><input type="radio" name="lic" value="' + l.kod + '"' + (K.meta.licencja === l.kod ? ' checked' : '') + (l.kompatybilna ? '' : ' disabled') + '> <b>' + l.kod + '</b> – ' + esc(l.nazwa) + (l.kompatybilna ? '' : ' <span class="badge b-err">niekompatybilna z agregatem</span>') + '</label>';
        }).join('') + '<p class="hint">Licencje niekompatybilne są zablokowane: zasób na takiej licencji można opublikować w dane.gov.pl, ale nie wejdzie do zbioru zbiorczego.</p></fieldset>' +
        '<fieldset><legend>Zakres referencyjny – za co ręczy dostawca</legend><label class="f" for="m-z">Terytorium *</label><input type="text" id="m-z" data-m="teryt" placeholder="np. gmina Wieliczka – wszystkie obiekty gminne" value="' + esc(K.meta.teryt) + '">' +
        '<p class="f">Rodzaje obiektów</p><div class="grid g3">' + kat.constraints.enum.map(function (k) { return '<label class="chk"><input type="checkbox" data-kat="' + k + '"' + (K.meta.kategorie.indexOf(k) >= 0 ? ' checked' : '') + '> ' + esc(kat.slownik_etykiety[k]) + '</label>'; }).join('') + '</div>' +
        '<p class="hint">W swoim zakresie referencyjnym dane dostawcy mają pierwszeństwo przy deduplikacji w zbiorze zbiorczym.</p></fieldset>' +
        '<fieldset><legend>Sposób publikacji w dane.gov.pl</legend><label class="chk"><input type="radio" name="spos" value="plik"' + (K.meta.sposob === 'plik' ? ' checked' : '') + '> plik CSV dodany jako zasób w panelu instytucji</label><label class="chk"><input type="radio" name="spos" value="harwester"' + (K.meta.sposob === 'harwester' ? ' checked' : '') + '> automatycznie – harwester (import z systemu dostawcy, np. XML / DCAT-AP) – zalecane przy częstych zmianach</label></fieldset>' +
        nawigacja(3) + '</div>';
      el.innerHTML = h;
      $$('[data-m]').forEach(function (i) { i.addEventListener('input', function () { K.meta[i.dataset.m] = i.value; odswiezDalej(3); }); });
      $$('input[name=lic]').forEach(function (r) { r.onchange = function () { K.meta.licencja = r.value; }; });
      $$('input[name=spos]').forEach(function (r) { r.onchange = function () { K.meta.sposob = r.value; }; });
      $$('[data-kat]').forEach(function (c) { c.onchange = function () { K.meta.kategorie = $$('[data-kat]:checked').map(function (x) { return x.dataset.kat; }); }; });
    }
    if (n === 4) {
      h = '<div class="card"><h2>4. Wgraj plik z danymi (CSV lub XLSX)</h2><p class="muted">Plik zostaje na Twoim komputerze – walidacja działa w przeglądarce. Nagłówki zgodne ze wzorcem (kolejność dowolna); popularne aliasy rozpoznamy.</p>' +
        '<div class="drop" id="drop"><p><b>Przeciągnij tutaj plik</b> albo</p><label class="btn btn-dark" for="plik">Wybierz plik CSV / XLSX</label><input type="file" id="plik" accept=".csv,.txt,.xlsx,.xls" class="sr-only"></div>' +
        '<div class="btns" style="margin-top:14px"><span class="small"><b>Nie masz pliku?</b></span><button class="btn btn-sm" id="ex-bl">Użyj przykładu z typowymi błędami</button><button class="btn btn-sm" id="ex-ok">Użyj poprawnego przykładu</button>' +
        '<a class="btn btn-sm" href="../wzorcowy-zakres-danych-AED.xlsx" download>Szablon XLSX</a><a class="btn btn-sm" href="../schemat/szablon-AED.csv" download>Szablon CSV</a></div>' +
        '<div id="plik-info" aria-live="polite" style="margin-top:14px">' + infoPliku() + '</div>' + nawigacja(4) + '</div>';
      el.innerHTML = h;
      var drop = $('#drop');
      ['dragenter', 'dragover'].forEach(function (e) { drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.add('over'); }); });
      ['dragleave', 'drop'].forEach(function (e) { drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.remove('over'); }); });
      drop.addEventListener('drop', function (ev) { if (ev.dataTransfer.files[0]) wczytajPlik(ev.dataTransfer.files[0]); });
      $('#plik').onchange = function () { if (this.files[0]) wczytajPlik(this.files[0]); };
      $('#ex-bl').onclick = function () { wczytajTekst('przyklad-z-bledami.csv', window.PRZYKLADY.z_bledami); po(); };
      $('#ex-ok').onclick = function () { wczytajTekst('przyklad-poprawny.csv', window.PRZYKLADY.poprawny); po(); };
    }
    if (n === 5) { rysujWalidacje(el); }
    if (n === 6) {
      var w = K.wiersze, wer = w.filter(V.czyZweryfikowany).length;
      var komplet = Math.round(100 * w.reduce(function (s, r) { return s + S.fields.filter(function (f) { return f.wymagalnosc !== 'opcjonalne'; }).filter(function (f) { return String(r[f.name] || '') !== ''; }).length; }, 0) / (w.length * S.fields.filter(function (f) { return f.wymagalnosc !== 'opcjonalne'; }).length));
      h = '<div class="card"><h2>6. Podgląd przed publikacją</h2><div class="grid g2" style="align-items:start"><div><div id="pmapa" class="map-mini" role="region" aria-label="Podgląd punktów z pliku"></div></div>' +
        '<div class="resource-card"><div class="rc-head"><b>Zbiór danych (podgląd w strukturze dane.gov.pl)</b><span class="badge b-demo">przed publikacją</span></div><div class="rc-body"><dl class="kv">' +
        '<dt>Instytucja (dostawca)</dt><dd><b>' + esc(K.org.nazwa) + '</b> (' + esc(TYPY[K.org.typ]) + ', REGON ' + esc(K.org.regon) + ')</dd><dt>Zbiór danych</dt><dd>' + esc(K.meta.tytul) + '</dd><dt>Kategoria</dt><dd>Zdrowie</dd><dt>Słowa kluczowe</dt><dd>AED, defibrylator, zdrowie, SerceNaMapie</dd>' +
        '<dt>Licencja</dt><dd>' + APP.bLic(K.meta.licencja) + '</dd><dt>Częstotliwość</dt><dd>' + esc(K.meta.czest) + '</dd><dt>Zakres referencyjny</dt><dd>' + esc(K.meta.teryt) + '</dd>' +
        '<dt>Zasób</dt><dd>aed-' + slug(K.org.nazwa) + '.csv · CSV UTF-8 · ' + w.length + ' wierszy</dd><dt>Stopień otwartości</dt><dd>' + APP.gwiazdki(3) + ' (CSV – format otwarty, maszynowo czytelny)</dd>' +
        '<dt>Kompletność (pola wymagane + zalecane)</dt><dd>' + komplet + '%</dd><dt>Zweryfikowane AED</dt><dd>' + wer + ' z ' + w.length + ' (kontrola ≤ 12 mies.)</dd><dt>Oświadczenie</dt><dd>złożone: ' + esc(K.osw.podpis) + ', ' + V.DZIS + '</dd></dl></div></div></div>' +
        '<div class="btns" style="margin-top:14px"><button class="btn btn-dark btn-sm" id="pob-csv">Pobierz znormalizowany plik CSV (do panelu dane.gov.pl)</button><button class="btn btn-sm" id="pob-rap">Pobierz raport walidacji (JSON)</button></div>' + nawigacja(6) + '</div>';
      el.innerHTML = h;
      var pm = APP.nowaMapa($('#pmapa'), { scrollWheelZoom: false }), pts = [];
      w.forEach(function (r) { var a = +r.szerokosc_geograficzna, o = +r.dlugosc_geograficzna; if (isFinite(a) && isFinite(o)) { pts.push([a, o]); L.circleMarker([a, o], { radius: 7, color: '#fff', weight: 2, fillColor: (APP.STATUS[r.status] || APP.STATUS['']).kolor, fillOpacity: 0.95 }).bindTooltip(esc(r.nazwa_lokalizacji)).addTo(pm); } });
      if (pts.length) pm.fitBounds(pts, { padding: [30, 30] });
      $('#pob-csv').onclick = function () { APP.pobierz('aed-' + slug(K.org.nazwa) + '.csv', APP.csv(w, V.POLA), 'text/csv;charset=utf-8'); };
      $('#pob-rap').onclick = function () { APP.pobierz('raport-walidacji-' + slug(K.org.nazwa) + '.json', JSON.stringify({ plik: K.plik, data: V.DZIS, schemat: S.name + ' ' + S.version, wiersze: w.length, bledy: K.wynik.bledy, ostrzezenia: K.wynik.ostrzezenia, problemy: K.wynik.problemy }, null, 1), 'application/json'); };
    }
    if (n === 7) { rysujPublikacje(el); }
    podepnijNawigacje(n);
  }

  function po() { K.max = Math.max(K.max, 5); rysujKrok(); APP.toast('Plik wczytany: ' + K.wiersze.length + ' wierszy. Przejdź do walidacji.'); }
  function infoPliku() {
    if (!K.plik) return '<p class="muted">Nie wybrano pliku.</p>';
    var w = V.walidujZbior(K.wiersze);
    return '<div class="note"><b>' + esc(K.plik.nazwa) + '</b> · ' + esc(K.plik.format) + ' · ' + K.wiersze.length + ' wierszy danych' + (K.problemyPliku.length ? '<ul class="small">' + K.problemyPliku.map(function (p) { return '<li><span class="badge ' + (p.poziom === 'blad' ? 'b-err' : 'b-warn') + '">' + p.kod + '</span> ' + esc(p.komunikat) + '</li>'; }).join('') + '</ul>' : '') +
      '<p style="margin:6px 0 0">Wstępny wynik: <b>' + w.bledy + '</b> błędów, <b>' + w.ostrzezenia + '</b> ostrzeżeń.</p></div>';
  }
  function wczytajTekst(nazwa, tekst) {
    var pp = []; var r = V.wczytajCSVTekst(tekst.replace(/^\uFEFF/, ''), pp);
    K.plik = { nazwa: nazwa, format: 'CSV' }; K.wiersze = r.wiersze; K.problemyPliku = pp; K.wynik = V.walidujZbior(K.wiersze); K.pub = null;
  }
  function wczytajPlik(f) {
    var rd = new FileReader();
    rd.onload = function () {
      try { var r = V.wczytajBufor(f.name, new Uint8Array(rd.result)); K.plik = { nazwa: f.name, format: r.format }; K.wiersze = r.wiersze; K.problemyPliku = r.problemyPliku; K.wynik = V.walidujZbior(K.wiersze); K.pub = null; po(); }
      catch (e) { APP.toast('Nie udało się odczytać pliku: ' + e.message); }
    };
    rd.readAsArrayBuffer(f);
  }

  /* ---------- Krok 5: walidacja na żywo, edycja komórek, autokorekta ---------- */
  function rysujWalidacje(el) {
    K.wynik = V.walidujZbior(K.wiersze);
    var tylko = !!K._tylkoProblemy;
    el.innerHTML = '<div class="card"><h2>5. Walidacja na żywo według wzorcowego zakresu</h2>' +
      '<div id="podsum" aria-live="polite"></div>' +
      '<div class="btns" style="margin:12px 0"><button class="btn btn-primary btn-sm" id="autofix">Popraw automatycznie</button><label class="chk"><input type="checkbox" id="tylko"' + (tylko ? ' checked' : '') + '> pokaż tylko wiersze z problemami</label></div>' +
      '<div class="grid" style="grid-template-columns:minmax(0,1fr)"><div><h3>Lista problemów (wiersz po wierszu)</h3><div class="issues" id="lista-probl"></div></div>' +
      '<div><h3>Dane – kliknij komórkę, aby poprawić (walidacja przy każdej zmianie)</h3><div class="table-wrap" style="max-height:460px"><table id="siatka"><thead><tr><th>Wiersz</th>' + V.POLA.map(function (p) { return '<th scope="col">' + p + '</th>'; }).join('') + '</tr></thead><tbody>' +
      K.wiersze.map(function (r, i) { return '<tr data-w="' + (i + 1) + '"><th scope="row">' + (i + 1) + '</th>' + V.POLA.map(function (p) { return '<td data-f="' + p + '"><input class="cell" aria-label="Wiersz ' + (i + 1) + ', ' + p + '" data-r="' + i + '" data-p="' + p + '" value="' + esc(r[p]) + '"></td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table></div></div></div>' + nawigacja(5) + '</div>';
    var timer = null;
    $$('#siatka input.cell').forEach(function (inp) {
      inp.addEventListener('input', function () { K.wiersze[+inp.dataset.r][inp.dataset.p] = inp.value; clearTimeout(timer); timer = setTimeout(odswiez, 200); });
    });
    $('#autofix').onclick = function () {
      var n = V.zastosujPoprawki(K.wiersze, K.wynik.problemy);
      $$('#siatka input.cell').forEach(function (inp) { inp.value = K.wiersze[+inp.dataset.r][inp.dataset.p]; });
      odswiez(); APP.toast('Zastosowano ' + n + ' poprawek automatycznych. Pozostałe błędy wymagają decyzji dostawcy.');
    };
    $('#tylko').onchange = function () { K._tylkoProblemy = this.checked; odswiez(); };
    odswiez();
  }
  function odswiez() {
    var w = K.wynik = V.walidujZbior(K.wiersze);
    var zlymi = {}; w.problemy.forEach(function (p) { if (p.poziom === 'blad') zlymi[p.wiersz] = 1; });
    $('#podsum').innerHTML = '<div class="summary"><span class="badge b-gray">' + K.wiersze.length + ' wierszy</span><span class="badge ' + (w.bledy ? 'b-err' : 'b-ok') + '">' + w.bledy + ' błędów</span><span class="badge b-warn">' + w.ostrzezenia + ' ostrzeżeń</span><span class="badge b-blue">' + w.doPoprawy + ' do autokorekty</span><span class="badge ' + (w.bledy ? 'b-err' : 'b-ok') + '">' + (K.wiersze.length - Object.keys(zlymi).length) + ' / ' + K.wiersze.length + ' wierszy bez błędów</span>' +
      (w.bledy ? '<span class="small">Publikacja zablokowana do czasu usunięcia błędów (ostrzeżenia nie blokują).</span>' : '<span class="small"><b>Plik zgodny ze wzorcem – możesz przejść dalej.</b></span>') + '</div>';
    $('#autofix').disabled = !w.doPoprawy; $('#autofix').textContent = 'Popraw automatycznie (' + w.doPoprawy + ')';
    var grup = {}; w.problemy.forEach(function (p) { (grup[p.wiersz] = grup[p.wiersz] || []).push(p); });
    $('#lista-probl').innerHTML = Object.keys(grup).length ? '<ul>' + Object.keys(grup).sort(function (a, b) { return a - b; }).map(function (k) {
      return grup[k].map(function (p) {
        return '<li><b>Wiersz ' + k + '</b>' + (p.pole ? ' · <code>' + p.pole + '</code>' : '') + ' · <span class="badge ' + (p.poziom === 'blad' ? 'b-err' : 'b-warn') + '">' + p.kod + ' ' + (p.poziom === 'blad' ? 'błąd' : 'ostrzeżenie') + '</span> ' + esc(p.komunikat) +
          (p.poprawka ? ' <button class="btn btn-sm" data-fix="' + k + '|' + esc(JSON.stringify(p.poprawka)) + '">Popraw</button>' : '') + '</li>';
      }).join('');
    }).join('') + '</ul>' : '<p style="padding:10px">Brak problemów – plik w pełni zgodny ze wzorcem.</p>';
    $$('[data-fix]').forEach(function (b) {
      b.onclick = function () {
        var i = b.dataset.fix.indexOf('|'), nr = +b.dataset.fix.slice(0, i), fx = JSON.parse(b.dataset.fix.slice(i + 1));
        Object.keys(fx).forEach(function (k) { K.wiersze[nr - 1][k] = fx[k]; var inp = document.querySelector('input.cell[data-r="' + (nr - 1) + '"][data-p="' + k + '"]'); if (inp) inp.value = fx[k]; });
        odswiez();
      };
    });
    $$('#siatka td').forEach(function (td) { td.classList.remove('cell-err', 'cell-warn'); td.removeAttribute('title'); });
    $$('#siatka tbody tr').forEach(function (tr) { var nr = +tr.dataset.w; tr.className = zlymi[nr] ? 'err' : (grup[nr] ? 'warn' : ''); tr.hidden = K._tylkoProblemy && !grup[nr]; });
    w.problemy.forEach(function (p) {
      if (!p.pole) return;
      var td = document.querySelector('#siatka tr[data-w="' + p.wiersz + '"] td[data-f="' + p.pole + '"]');
      if (td) { td.classList.add(p.poziom === 'blad' ? 'cell-err' : 'cell-warn'); td.title = (td.title ? td.title + ' | ' : '') + p.kod + ': ' + p.komunikat; }
    });
    odswiezDalej(5);
  }

  /* ---------- Krok 7: symulacja publikacji w dane.gov.pl ---------- */
  function rysujPublikacje(el) {
    if (K.pub) { el.innerHTML = kartaPublikacji(); podepnijPublikacje(); return; }
    el.innerHTML = '<div class="card"><h2>7. Publikacja w dane.gov.pl (symulacja)</h2><p class="note warn">Prototyp <b>nie wysyła</b> danych do produkcyjnego portalu – publikacji dokonuje dostawca w swoim panelu instytucji. Poniżej odwzorowanie kolejnych kroków portalu.</p>' +
      '<ol class="progress" id="post" style="list-style:none;padding:0"></ol><div class="btns"><button class="btn btn-primary" id="publikuj">Opublikuj zasób jako ' + esc(K.org.nazwa) + ' (symulacja)</button></div>' + nawigacja(7) + '</div>';
    $('#publikuj').onclick = publikuj;
    if (APP.params.get('publikuj')) publikuj();
  }
  function publikuj() {
    var etapy = ['Utworzenie zbioru danych „' + K.meta.tytul + '” w instytucji ' + K.org.nazwa, 'Dodanie zasobu aed-' + slug(K.org.nazwa) + '.csv (licencja ' + K.meta.licencja + ', oświadczenie w warunkach wykorzystania)', 'Weryfikacja formatu pliku przez portal', 'Przetworzenie danych tabelarycznych – API /1.4/resources/{id}/data', 'Zgłoszenie zasobu do agregatora (słowo kluczowe SerceNaMapie)'];
    var post = $('#post'); $('#publikuj').disabled = true; var i = 0;
    (function krok() {
      if (i > 0) post.children[i - 1].innerHTML = '<span class="badge b-ok">✔</span> ' + esc(etapy[i - 1]);
      if (i < etapy.length) { var li = document.createElement('li'); li.innerHTML = '<span class="badge b-gray">…</span> ' + esc(etapy[i]); post.appendChild(li); i++; setTimeout(krok, APP.params.get('publikuj') ? 60 : 450); return; }
      var dsId = 90000 + Math.floor(Math.random() * 9000), resId = 3000000 + Math.floor(Math.random() * 90000), id = 'pub-' + resId;
      var zr = { id: id, typ: 'opublikowane w prototypie', demo: true, instytucja: { id: null, nazwa: K.org.nazwa, typ: K.org.typ, regon: K.org.regon, miasto: '' },
        zbior: { id: dsId, tytul: K.meta.tytul, url: '', czestotliwosc: K.meta.czest, zweryfikowano: V.DZIS, zmodyfikowano: V.DZIS, kategorie: ['Zdrowie'] },
        zasob: { id: resId, tytul: 'aed-' + slug(K.org.nazwa) + '.csv', format: 'csv', url: '', pobranie: '', data_danych: V.DZIS, stopien_otwartosci: 3 },
        licencja: K.meta.licencja, zakres_referencyjny: { terytorialny: K.meta.teryt, przedmiotowy: (K.meta.kategorie.join(', ') || 'AED dostawcy'), czasowy: 'stan na ' + V.DZIS },
        status_integracji: 'zintegrowano', powod: '', raport_harmonizacji: ['Zasób przygotowany w kreatorze – zgodny ze wzorcem (0 błędów walidacji).', 'Oświadczenie o odpowiedzialności: ' + K.osw.podpis + ', ' + V.DZIS], data_pobrania: V.DZIS };
      var rek = K.wiersze.map(function (r) { var o = Object.assign({}, r); o.dostawca = o.dostawca || K.org.nazwa; o.licencja = o.licencja || K.meta.licencja; o.regon_dostawcy = o.regon_dostawcy || K.org.regon; return o; });
      APP.opublikowane = APP.opublikowane.filter(function (p) { return p.zrodlo.instytucja.nazwa !== K.org.nazwa; });
      APP.opublikowane.push({ zrodlo: zr, rekordy: rek }); APP.zapiszOpublikowane(); APP.przelicz();
      K.pub = { dsId: dsId, resId: resId, id: id, n: rek.length };
      $('#krok').innerHTML = kartaPublikacji(); podepnijPublikacje();
      APP.toast('Symulacja: zasób opublikowany, ' + rek.length + ' AED dodanych do zbioru zbiorczego.');
    })();
  }
  function kartaPublikacji() {
    var p = K.pub, url = 'https://dane.gov.pl/pl/dataset/' + p.dsId + ',' + slug(K.meta.tytul) + '/resource/' + p.resId;
    var rek = APP.agregat.rekordy.filter(function (r) { return r._zrodlo === p.id; });
    return '<div class="card"><h2>7. Zasób opublikowany (symulacja)</h2><div class="resource-card"><div class="rc-head"><span><b>' + esc(K.org.nazwa) + '</b> · instytucja – dostawca danych</span><span class="badge b-demo">SYMULACJA – nie wysłano do portalu</span></div><div class="rc-body">' +
      '<h3>' + esc(K.meta.tytul) + '</h3><dl class="kv"><dt>Zasób</dt><dd>aed-' + slug(K.org.nazwa) + '.csv (CSV, ' + p.n + ' wierszy)</dd><dt>Adres (przykładowy)</dt><dd><code>' + esc(url) + '</code></dd>' +
      '<dt>API zasobu</dt><dd><code>GET https://api.dane.gov.pl/1.4/resources/' + p.resId + '/data</code></dd><dt>Licencja</dt><dd>' + APP.bLic(K.meta.licencja) + '</dd><dt>Częstotliwość</dt><dd>' + esc(K.meta.czest) + '</dd>' +
      '<dt>Odpowiedzialność</dt><dd>' + esc(K.org.nazwa) + ' – oświadczenie: ' + esc(K.osw.podpis) + '</dd><dt>W zbiorze zbiorczym</dt><dd><b>' + rek.filter(function (r) { return r._wAgregacie; }).length + '</b> z ' + rek.length + ' AED</dd></dl>' +
      '<div class="btns" style="margin-top:12px"><a class="btn btn-primary" href="#/mapa?dostawca=' + encodeURIComponent(K.org.nazwa) + '">Zobacz swoje AED na mapie</a><button class="btn" id="odznaka">Pobierz odznakę „Jesteśmy Sercem na Mapie”</button><button class="btn btn-sm" id="nowy">Rozpocznij od nowa</button></div></div></div>' +
      '<h3 style="margin-top:18px">Odpowiedź API zasobu (format api.dane.gov.pl, symulacja)</h3><pre class="code">' + esc(JSON.stringify(APP.apiOdpowiedz(p.resId, rek.slice(0, 1), rek.length), null, 2)) + '</pre></div>';
  }
  function podepnijPublikacje() {
    $('#odznaka').onclick = function () {
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="120" viewBox="0 0 360 120"><rect width="360" height="120" rx="16" fill="#007A50"/><rect x="8" y="8" width="344" height="104" rx="10" fill="#fff"/>' +
        '<g transform="translate(22 18) scale(0.62)"><path d="M50 116 C43 104 6 77 6 42 C6 22 20 8 34 8 C42 8 47 12 50 18 C53 12 58 8 66 8 C80 8 94 22 94 42 C94 77 57 104 50 116 Z" fill="#D0142C"/><path d="M15 51 H35 L41.5 38 L49.5 69 L58 27 L64.5 51 H85" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></g>' +
        '<text x="96" y="52" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="700" fill="#13294B">Jesteśmy Sercem na Mapie</text><text x="96" y="80" font-family="Segoe UI, Arial, sans-serif" font-size="14" fill="#13294B">Nasze AED są w dane.gov.pl · #SerceNaMapie</text></svg>';
      APP.pobierz('odznaka-serce-na-mapie.svg', svg, 'image/svg+xml');
    };
    $('#nowy').onclick = function () { K.krok = 1; K.max = 1; K.plik = null; K.wiersze = []; K.wynik = null; K.pub = null; K._demoZaladowane = false; location.hash = '#/dostawca'; APP.route(); };
  }
})();
