/* Walidator wzorcowego zakresu danych AED.
 * JEDEN KOD, JEDNA PRAWDA: wszystkie pola, typy, słowniki i zakresy pochodzą z window.SCHEMAT
 * (wygenerowanego 1:1 z pliku schemat/aed-schema.json). Ten sam walidator sprawdza:
 *  – pliki wgrywane przez dostawców w kreatorze „Zostań dostawcą”,
 *  – rekordy pobrane z zasobów dane.gov.pl podczas agregacji.
 * Kody reguł (R01…R20) odpowiadają arkuszowi „Walidacja” w pliku wzorcowy-zakres-danych-AED.xlsx. */
(function () {
  'use strict';
  var S = window.SCHEMAT;
  var POLA = S.fields.map(function (f) { return f.name; });
  var POLE = {};
  S.fields.forEach(function (f) { POLE[f.name] = f; });
  var LIC = {};
  S.licencje.forEach(function (l) { LIC[l.kod] = l; });
  var DZIS = new Date().toISOString().slice(0, 10);

  function bezPL(s) { return String(s).replace(/ł/g, 'l').replace(/Ł/g, 'L').normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function klucz(s) { return bezPL(String(s).trim().toLowerCase()).replace(/[\s\-.]+/g, '_').replace(/[^a-z0-9_/]/g, ''); }

  /* Popularne nazwy kolumn spotykane w istniejących zasobach (np. Krosno, Marki, Przemyśl) */
  var ALIASY = { lat: 'szerokosc_geograficzna', latitude: 'szerokosc_geograficzna', szerokosc: 'szerokosc_geograficzna', y: 'szerokosc_geograficzna',
    lon: 'dlugosc_geograficzna', lng: 'dlugosc_geograficzna', long: 'dlugosc_geograficzna', longitude: 'dlugosc_geograficzna', dlugosc: 'dlugosc_geograficzna', x: 'dlugosc_geograficzna',
    nazwa: 'nazwa_lokalizacji', lokalizacja: 'nazwa_lokalizacji', name: 'nazwa_lokalizacji', kod: 'kod_pocztowy', postcode: 'kod_pocztowy', miasto: 'miejscowosc', city: 'miejscowosc',
    ulica: 'adres', telefon: 'telefon_kontaktowy', phone: 'telefon_kontaktowy', numer_id: 'id', identyfikator: 'id', godziny: 'godziny_dostepnosci', opening_hours: 'godziny_dostepnosci' };
  var SYNONIMY = { '1': 'tak', 'true': 'tak', t: 'tak', yes: 'tak', y: 'tak', prawda: 'tak', '0': 'nie', 'false': 'nie', n: 'nie', no: 'nie', falsz: 'nie',
    '24h': '24/7', calodobowo: '24/7', calodobowy: '24/7', zawsze: '24/7', w_godzinach: 'godziny', serwis: 'w_serwisie', wycofany: 'nieaktywny',
    cc0: 'CC0-1.0', cc_by: 'CC-BY-4.0', cc_by_40: 'CC-BY-4.0', odbl: 'ODbL-1.0' };

  function haversine(a1, o1, a2, o2) {
    var R = 6371000, r = Math.PI / 180, dA = (a2 - a1) * r, dO = (o2 - o1) * r;
    var x = Math.sin(dA / 2) * Math.sin(dA / 2) + Math.cos(a1 * r) * Math.cos(a2 * r) * Math.sin(dO / 2) * Math.sin(dO / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function regonOk(s) {
    var w9 = [8, 9, 2, 3, 4, 5, 6, 7], w14 = [2, 4, 8, 5, 0, 9, 7, 3, 6, 1, 2, 4, 8];
    var w = s.length === 9 ? w9 : s.length === 14 ? w14 : null;
    if (!w || !/^\d+$/.test(s)) return false;
    var sum = 0; for (var i = 0; i < w.length; i++) sum += (+s[i]) * w[i];
    var k = sum % 11; if (k === 10) k = 0;
    return k === +s[s.length - 1];
  }
  function dataISO(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCMonth() === +m[2] - 1 ? s : null;
  }
  function naprawDate(s) {
    var m = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/.exec(s);
    if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    m = /^(\d{4})[./](\d{1,2})[./](\d{1,2})$/.exec(s);
    if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
    return null;
  }
  function licencjaKompatybilna(kod) { return !!(LIC[kod] && LIC[kod].kompatybilna); }
  function czyZweryfikowany(r) {
    var d = dataISO(String(r.data_ostatniej_kontroli || ''));
    if (!d || d > DZIS) return false;
    var dni = (new Date(DZIS) - new Date(d)) / 864e5;
    return dni <= (S.okres_waznosci_weryfikacji_miesiace || 12) * 30.44;
  }

  /* ---- walidacja jednego wiersza (reguły na poziomie pola) ---- */
  function walidujWiersz(r, nr) {
    var out = [], braki = [];
    function add(pole, poziom, kod, kom, poprawka) { out.push({ wiersz: nr, pole: pole, poziom: poziom, kod: kod, komunikat: kom, wartosc: r[pole], poprawka: poprawka || null }); }
    var liczby = {};
    S.fields.forEach(function (f) {
      var v = r[f.name] == null ? '' : String(r[f.name]).trim();
      var c = f.constraints || {};
      if (v === '') {
        if (c.required) add(f.name, 'blad', 'R04', 'Brak wartości w polu wymaganym „' + f.title + '”.');
        else if (f.wymagalnosc === 'zalecane') braki.push(f.title);
        return;
      }
      if (c.maxLength && v.length > c.maxLength) add(f.name, 'blad', 'R04', 'Tekst dłuższy niż ' + c.maxLength + ' znaków.');
      if (f.type === 'number') {
        var s = v, fix = null;
        if (/^-?\d+,\d+$/.test(s)) { s = s.replace(',', '.'); fix = {}; fix[f.name] = s; add(f.name, 'blad', 'R05', 'Przecinek dziesiętny – wymagana kropka (' + v + ' → ' + s + ').', fix); }
        var n = Number(s);
        if (s === '' || !isFinite(n)) { add(f.name, 'blad', 'R05', '„' + v + '” nie jest liczbą.'); return; }
        liczby[f.name] = n;
        var dec = (s.split('.')[1] || '').length;
        if (dec < 5) add(f.name, 'ostrzezenie', 'R06', 'Tylko ' + dec + ' miejsc po przecinku – zalecane min. 5 (dokładność ok. 1 m).');
        return;
      }
      if (f.type === 'integer') { if (!/^-?\d+$/.test(v) || (c.minimum != null && (+v < c.minimum || +v > c.maximum))) add(f.name, 'blad', 'R04', 'Wartość „' + v + '” – wymagana liczba całkowita z zakresu ' + c.minimum + '…' + c.maximum + '.'); return; }
      if (f.type === 'date') {
        if (!dataISO(v)) {
          var nd = naprawDate(v), fx = null;
          if (nd && dataISO(nd)) { fx = {}; fx[f.name] = nd; }
          add(f.name, 'blad', 'R08', 'Data „' + v + '” – wymagany format RRRR-MM-DD' + (fx ? ' (→ ' + nd + ')' : '') + '.', fx);
          return;
        }
        if (/kontroli|instalacji|aktualizacji/.test(f.name) && v > DZIS) add(f.name, 'blad', 'R08', 'Data z przyszłości (' + v + ').');
        return;
      }
      if (c.enum) {
        if (c.enum.indexOf(v) >= 0) return;
        var k = klucz(v), trafienie = null;
        c.enum.forEach(function (e) { if (klucz(e) === k) trafienie = e; });
        if (!trafienie && SYNONIMY[k] && c.enum.indexOf(SYNONIMY[k]) >= 0) trafienie = SYNONIMY[k];
        var fe = null; if (trafienie) { fe = {}; fe[f.name] = trafienie; }
        add(f.name, 'blad', 'R10', '„' + v + '” spoza słownika' + (trafienie ? ' (→ ' + trafienie + ')' : ' – dozwolone: ' + c.enum.slice(0, 6).join(', ') + (c.enum.length > 6 ? '…' : '')) + '.', fe);
        return;
      }
      if (c.pattern && !(new RegExp(c.pattern)).test(v)) {
        var fp = null, kod = 'R04', kom = 'Niepoprawny format „' + v + '”.';
        if (f.name === 'kod_pocztowy') { kod = 'R09'; kom = 'Kod pocztowy „' + v + '” – wymagany format NN-NNN.'; var dg = v.replace(/\D/g, ''); if (dg.length === 5) { fp = { kod_pocztowy: dg.slice(0, 2) + '-' + dg.slice(2) }; } }
        else if (f.name === 'telefon_kontaktowy') { kod = 'R17'; kom = 'Telefon „' + v + '” – wymagany format +48XXXXXXXXX.'; var t = v.replace(/\D/g, ''); if (t.length === 9) fp = { telefon_kontaktowy: '+48' + t }; else if (t.length === 11 && t.indexOf('48') === 0) fp = { telefon_kontaktowy: '+' + t }; }
        else if (f.name === 'godziny_dostepnosci') { kod = 'R11'; kom = 'Godziny „' + v + '” – wymagana składnia np. „Mo-Fr 08:00-16:00; Sa 09:00-13:00”.'; }
        else if (f.name === 'regon_dostawcy') { kod = 'R18'; kom = 'REGON musi mieć 9 lub 14 cyfr.'; }
        add(f.name, 'blad', kod, kom, fp);
        return;
      }
      if (f.name === 'regon_dostawcy' && !regonOk(v)) add(f.name, 'blad', 'R18', 'REGON „' + v + '” – niepoprawna suma kontrolna.');
    });
    // R07 – zamienione współrzędne
    var la = liczby.szerokosc_geograficzna, lo = liczby.dlugosc_geograficzna;
    if (la != null && lo != null) {
      var fS = POLE.szerokosc_geograficzna.constraints, fD = POLE.dlugosc_geograficzna.constraints;
      var okLa = la >= fS.minimum && la <= fS.maximum, okLo = lo >= fD.minimum && lo <= fD.maximum;
      if (!okLa && !okLo && lo >= fS.minimum && lo <= fS.maximum && la >= fD.minimum && la <= fD.maximum) {
        add('szerokosc_geograficzna', 'blad', 'R07', 'Zamienione współrzędne (szerokość ' + la + ', długość ' + lo + ') – zamień kolumny.', { szerokosc_geograficzna: String(lo), dlugosc_geograficzna: String(la) });
      } else {
        if (!okLa) add('szerokosc_geograficzna', 'blad', 'R06', 'Szerokość ' + la + ' poza Polską (' + fS.minimum + '–' + fS.maximum + ').');
        if (!okLo) add('dlugosc_geograficzna', 'blad', 'R06', 'Długość ' + lo + ' poza Polską (' + fD.minimum + '–' + fD.maximum + ').');
      }
    }
    // R04 – warunkowo wymagane godziny
    if (String(r.dostepnosc || '').trim() === 'godziny' && !String(r.godziny_dostepnosci || '').trim()) add('godziny_dostepnosci', 'blad', 'R04', 'Dostępność „godziny” wymaga podania godzin dostępności.');
    // R15 – spójność
    var di = dataISO(String(r.data_instalacji || '')), dk = dataISO(String(r.data_ostatniej_kontroli || ''));
    if (di && dk && di > dk) add('data_instalacji', 'blad', 'R15', 'Data instalacji późniejsza niż data ostatniej kontroli.');
    if (r.status === 'aktywny') {
      var de = dataISO(String(r.data_waznosci_elektrod || '')), db = dataISO(String(r.data_waznosci_baterii || ''));
      if (de && de < DZIS) add('data_waznosci_elektrod', 'ostrzezenie', 'R15', 'Status „aktywny”, ale elektrody straciły ważność ' + de + '.');
      if (db && db < DZIS) add('data_waznosci_baterii', 'ostrzezenie', 'R15', 'Status „aktywny”, ale bateria straciła ważność ' + db + '.');
    }
    // R16 – licencja
    if (r.licencja && LIC[r.licencja] && !LIC[r.licencja].kompatybilna) add('licencja', 'ostrzezenie', 'R16', 'Licencja ' + r.licencja + ' niekompatybilna z CC BY 4.0 – rekord nie trafi do zbioru zbiorczego.');
    // R19 – dane osobowe
    ['nazwa_lokalizacji', 'opis_lokalizacji', 'instrukcja_dostepu', 'uwagi'].forEach(function (p) {
      var v = String(r[p] || '');
      if (/(^|\D)\d{11}(\D|$)/.test(v) || /[a-z]+\.[a-z]+@(gmail|wp|o2|onet|interia)\./i.test(v)) add(p, 'ostrzezenie', 'R19', 'Możliwe dane osobowe (PESEL / prywatny e-mail) – usuń przed publikacją.');
    });
    // R20 – pola zalecane
    if (braki.length) add(null, 'ostrzezenie', 'R20', 'Brak pól zalecanych: ' + braki.join(', ') + '.');
    return out;
  }

  /* ---- walidacja całego zasobu (reguły zbiorowe R12–R14) ---- */
  function walidujZbior(wiersze) {
    var wg = {}, wszystkie = [];
    wiersze.forEach(function (r, i) { wg[i + 1] = walidujWiersz(r, i + 1); });
    var ids = {};
    wiersze.forEach(function (r, i) {
      var id = String(r.id || '').trim(); if (!id) return;
      if (ids[id]) wg[i + 1].push({ wiersz: i + 1, pole: 'id', poziom: 'blad', kod: 'R12', komunikat: 'Identyfikator „' + id + '” powtarza się (wiersz ' + ids[id] + ').', wartosc: id, poprawka: null });
      else ids[id] = i + 1;
    });
    var pts = wiersze.map(function (r) { var a = Number(String(r.szerokosc_geograficzna).replace(',', '.')), o = Number(String(r.dlugosc_geograficzna).replace(',', '.')); return (isFinite(a) && isFinite(o) && a > 40 && o > 10 && a < 60 && o < 30) ? [a, o] : null; });
    // R13 – duplikaty lokalizacji (siatka ~50 m)
    var siatka = {};
    pts.forEach(function (p, i) {
      if (!p) return;
      var gx = Math.floor(p[0] / 0.0005), gy = Math.floor(p[1] / 0.0005);
      for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) {
        (siatka[(gx + dx) + ':' + (gy + dy)] || []).forEach(function (j) {
          var d = haversine(p[0], p[1], pts[j][0], pts[j][1]);
          var innyAdres = String(wiersze[i].adres || '') !== String(wiersze[j].adres || '');
          if (d < 5 || (d < 0.5 && innyAdres)) wg[i + 1].push({ wiersz: i + 1, pole: 'szerokosc_geograficzna', poziom: 'ostrzezenie', kod: 'R13', komunikat: (d < 0.5 ? 'Identyczne współrzędne' : 'Lokalizacja ' + d.toFixed(1) + ' m') + ' jak wiersz ' + (j + 1) + (innyAdres ? ' przy innym adresie' : '') + ' – możliwy duplikat lub błąd lokalizacji.', wartosc: '', poprawka: null });
        });
      }
      var key = gx + ':' + gy; (siatka[key] = siatka[key] || []).push(i);
    });
    // R14 – punkty odstające względem tej samej miejscowości
    var grupy = {};
    pts.forEach(function (p, i) { if (!p) return; var m = klucz(wiersze[i].miejscowosc || ''); if (!m) return; (grupy[m] = grupy[m] || []).push(i); });
    Object.keys(grupy).forEach(function (m) {
      var g = grupy[m]; if (g.length < 3) return;
      var med = function (arr) { var s = arr.slice().sort(function (a, b) { return a - b; }); return s[Math.floor(s.length / 2)]; };
      var mA = med(g.map(function (i) { return pts[i][0]; })), mO = med(g.map(function (i) { return pts[i][1]; }));
      g.forEach(function (i) {
        var d = haversine(pts[i][0], pts[i][1], mA, mO);
        if (d > 30000) wg[i + 1].push({ wiersz: i + 1, pole: 'szerokosc_geograficzna', poziom: 'blad', kod: 'R14', komunikat: 'Punkt odstaje o ' + Math.round(d / 1000) + ' km od pozostałych punktów miejscowości „' + wiersze[i].miejscowosc + '” – sprawdź współrzędne.', wartosc: '', poprawka: null });
      });
    });
    Object.keys(wg).forEach(function (k) { wszystkie = wszystkie.concat(wg[k]); });
    return { wgWiersza: wg, problemy: wszystkie,
      bledy: wszystkie.filter(function (p) { return p.poziom === 'blad'; }).length,
      ostrzezenia: wszystkie.filter(function (p) { return p.poziom === 'ostrzezenie'; }).length,
      doPoprawy: wszystkie.filter(function (p) { return p.poprawka; }).length };
  }

  function zastosujPoprawki(wiersze, problemy) {
    var n = 0;
    problemy.forEach(function (p) { if (p.poprawka) { Object.keys(p.poprawka).forEach(function (k) { wiersze[p.wiersz - 1][k] = p.poprawka[k]; }); n++; } });
    return n;
  }

  /* ---- odczyt plików CSV / XLSX ---- */
  function wykryjSeparator(linia) {
    var best = ',', max = -1;
    [',', ';', '\t'].forEach(function (s) { var c = 0, q = false; for (var i = 0; i < linia.length; i++) { if (linia[i] === '"') q = !q; else if (!q && linia[i] === s) c++; } if (c > max) { max = c; best = s; } });
    return best;
  }
  function parsujCSV(text, sep) {
    var rows = [], row = [], f = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
      else if (ch === '"') q = true;
      else if (ch === sep) { row.push(f); f = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
      else f += ch;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    return rows;
  }
  function mapujNaglowek(naglowek, problemyPliku) {
    var mapa = [], uzyte = {};
    naglowek.forEach(function (h, i) {
      var k = klucz(h);
      if (POLE[k]) { mapa[i] = k; uzyte[k] = 1; if (k !== h) problemyPliku.push({ poziom: 'ostrzezenie', kod: 'R02', komunikat: 'Kolumna „' + h + '” rozpoznana jako „' + k + '” (nazwa nieznormalizowana).' }); }
      else if (ALIASY[k] && !uzyte[ALIASY[k]]) { mapa[i] = ALIASY[k]; uzyte[ALIASY[k]] = 1; problemyPliku.push({ poziom: 'ostrzezenie', kod: 'R02', komunikat: 'Kolumna „' + h + '” zmapowana na „' + ALIASY[k] + '” (alias).' }); }
      else if (String(h).trim()) problemyPliku.push({ poziom: 'ostrzezenie', kod: 'R02', komunikat: 'Kolumna „' + h + '” spoza wzorca – pominięta.' });
    });
    S.fields.forEach(function (f) { if (f.constraints && f.constraints.required && !uzyte[f.name]) problemyPliku.push({ poziom: 'blad', kod: 'R02', komunikat: 'Brak wymaganej kolumny „' + f.name + '” – dodaj ją (może być pusta tylko w polach niewymaganych).' }); });
    return mapa;
  }
  function wierszeZTabeli(tab, problemyPliku) {
    var naglowek = tab[0] || [];
    var mapa = mapujNaglowek(naglowek, problemyPliku);
    var wiersze = [];
    for (var r = 1; r < tab.length; r++) {
      var row = tab[r];
      if (!row || row.every(function (c) { return String(c == null ? '' : c).trim() === ''; })) continue;
      var o = {}; POLA.forEach(function (p) { o[p] = ''; });
      row.forEach(function (c, i) { if (mapa[i]) o[mapa[i]] = String(c == null ? '' : c).trim(); });
      wiersze.push(o);
    }
    return wiersze;
  }
  function czytajTekst(buf, problemyPliku) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, ''); }
    catch (e) {
      problemyPliku.push({ poziom: 'ostrzezenie', kod: 'R01', komunikat: 'Plik nie jest w UTF-8 – odczytano jako Windows-1250 i przekonwertowano. Zapisz plik jako „CSV UTF-8”.' });
      return new TextDecoder('windows-1250').decode(buf);
    }
  }
  function wczytajCSVTekst(text, problemyPliku) {
    var sep = wykryjSeparator(text.split(/\r?\n/)[0] || '');
    if (sep !== ',') problemyPliku.push({ poziom: 'ostrzezenie', kod: 'R03', komunikat: 'Separator „' + (sep === '\t' ? 'tabulator' : sep) + '” zamiast przecinka – rozpoznano automatycznie.' });
    return { wiersze: wierszeZTabeli(parsujCSV(text, sep), problemyPliku), format: 'CSV', separator: sep };
  }
  function wczytajBufor(nazwa, buf) {
    var problemyPliku = [], wynik;
    if (/\.(xlsx|xls|ods)$/i.test(nazwa)) {
      if (!window.XLSX) throw new Error('Brak biblioteki XLSX');
      var wb = XLSX.read(buf, { type: 'array', cellDates: true });
      var arkusz = null;
      wb.SheetNames.forEach(function (n) {
        if (arkusz) return;
        var t = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' });
        var nag = (t[0] || []).map(klucz);
        if (nag.indexOf('id') >= 0 && nag.indexOf('szerokosc_geograficzna') >= 0) arkusz = n;
      });
      arkusz = arkusz || wb.SheetNames[0];
      var tab = XLSX.utils.sheet_to_json(wb.Sheets[arkusz], { header: 1, raw: true, defval: '' }).map(function (row) {
        return row.map(function (c) { return c instanceof Date ? new Date(c.getTime() - c.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : c; });
      });
      if (wb.SheetNames.length > 1) problemyPliku.push({ poziom: 'ostrzezenie', kod: 'R02', komunikat: 'Skoroszyt ma ' + wb.SheetNames.length + ' arkusze – użyto arkusza „' + arkusz + '” (nagłówek zgodny ze wzorcem).' });
      wynik = { wiersze: wierszeZTabeli(tab, problemyPliku), format: 'XLSX', separator: null };
    } else {
      wynik = wczytajCSVTekst(czytajTekst(buf, problemyPliku), problemyPliku);
    }
    wynik.problemyPliku = problemyPliku;
    return wynik;
  }

  /* ---- godziny dostępności (podzbiór składni OSM opening_hours) ---- */
  var DNI = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  function dostepnyTeraz(r, teraz) {
    teraz = teraz || new Date();
    if (r.dostepnosc === '24/7') return { stan: 'otwarte', opis: 'całodobowo' };
    var g = String(r.godziny_dostepnosci || '').trim();
    if (r.dostepnosc !== 'godziny' || !g) return { stan: 'nieznane', opis: 'brak danych o godzinach' };
    var dzien = DNI[teraz.getDay()], min = teraz.getHours() * 60 + teraz.getMinutes(), otwarte = false, pasuje = false;
    g.split(';').forEach(function (cz) {
      var m = /^\s*([A-Za-z,\-]+)\s+(.+)$/.exec(cz); if (!m) return;
      var dniOk = m[1].split(',').some(function (z) {
        var p = z.split('-'); var a = DNI.indexOf(p[0]), b = DNI.indexOf(p[1] || p[0]); var d = DNI.indexOf(dzien);
        if (a < 0 || b < 0) return false; var A = (a + 6) % 7, B = (b + 6) % 7, D = (d + 6) % 7; return A <= B ? (D >= A && D <= B) : (D >= A || D <= B);
      });
      if (!dniOk) return; pasuje = true;
      m[2].split(',').forEach(function (zak) { var t = /(\d\d):(\d\d)-(\d\d):(\d\d)/.exec(zak); if (t && min >= +t[1] * 60 + +t[2] && min < +t[3] * 60 + +t[4]) otwarte = true; });
    });
    return { stan: otwarte ? 'otwarte' : 'zamkniete', opis: g + (pasuje ? '' : ' (dziś zamknięte)') };
  }

  window.WALIDATOR = { POLA: POLA, POLE: POLE, LIC: LIC, klucz: klucz, haversine: haversine, regonOk: regonOk, walidujWiersz: walidujWiersz, walidujZbior: walidujZbior,
    zastosujPoprawki: zastosujPoprawki, wczytajBufor: wczytajBufor, wczytajCSVTekst: wczytajCSVTekst, licencjaKompatybilna: licencjaKompatybilna,
    czyZweryfikowany: czyZweryfikowany, dostepnyTeraz: dostepnyTeraz, DZIS: DZIS };
})();
