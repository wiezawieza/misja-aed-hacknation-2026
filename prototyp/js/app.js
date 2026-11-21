/* Misja AED – prototyp. Aplikacja bez kroku budowania (działa po otwarciu index.html z dysku).
 * Widoki: start, mapa, dostawca (kreator.js), zbior, sluzby, schemat, akcja, jury. */
(function () {
  'use strict';
  var V = window.WALIDATOR, S = window.SCHEMAT;
  var LS_KEY = 'misja-aed-opublikowane-v1';
  var APP = window.APP = { agregat: null, opublikowane: [], mapa: null };

  /* ---------- narzędzia ---------- */
  var esc = APP.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var $ = APP.$ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = APP.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var fmt = APP.fmt = function (n) { return Number(n).toLocaleString('pl-PL'); };
  APP.toast = function (msg) { var t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3500); };
  APP.pobierz = function (nazwa, tresc, typ) {
    var blob = tresc instanceof Blob ? tresc : new Blob([tresc], { type: typ || 'text/plain;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nazwa; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  APP.csv = function (rows, cols) {
    var q = function (v) { v = v == null ? '' : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return '﻿' + [cols.join(',')].concat(rows.map(function (r) { return cols.map(function (c) { return q(r[c]); }).join(','); })).join('\r\n');
  };
  APP.xlsx = function (rows, cols, arkusz, nazwa, meta) {
    var ws = XLSX.utils.aoa_to_sheet([cols].concat(rows.map(function (r) { return cols.map(function (c) { return r[c] == null ? '' : r[c]; }); })));
    ws['!cols'] = cols.map(function (c) { return { wch: Math.min(40, Math.max(10, c.length + 2)) }; });
    var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, arkusz);
    if (meta) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meta), 'Metadane');
    var out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    APP.pobierz(nazwa, new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  };
  var STATUS = APP.STATUS = {
    aktywny: { e: 'aktywny', kolor: '#007A50', b: 'b-ok' }, w_serwisie: { e: 'w serwisie', kolor: '#C98A00', b: 'b-warn' },
    nieaktywny: { e: 'nieaktywny', kolor: '#6B7A90', b: 'b-gray' }, '': { e: 'brak danych o statusie', kolor: '#3B5B95', b: 'b-blue' }
  };
  APP.bStatus = function (r) { var s = STATUS[r.status] || STATUS['']; return '<span class="badge ' + s.b + '">● ' + esc(s.e) + '</span>'; };
  APP.bWer = function (r) { return r._zweryfikowany ? '<span class="badge b-ok">✔ zweryfikowany</span>' : '<span class="badge b-warn">? niezweryfikowany</span>'; };
  APP.bDemo = function (r) { return r._demo ? '<span class="badge b-demo">DEMO – dane syntetyczne</span>' : '<span class="badge b-blue">dane.gov.pl – dane rzeczywiste</span>'; };
  APP.bLic = function (kod) { var l = V.LIC[kod]; return l ? '<span class="badge ' + (l.kompatybilna ? 'b-ok' : 'b-err') + '" title="' + esc(l.nazwa) + '">' + esc(kod) + (l.kompatybilna ? ' ✓' : ' ✗') + '</span>' : esc(kod); };
  APP.gwiazdki = function (n) { return '<span class="score" aria-label="' + n + ' z 5 gwiazdek">' + '★★★★★'.slice(0, n) + '<span style="color:#C9D3E3">' + '★★★★★'.slice(n) + '</span></span>'; };

  /* ---------- stan i trwałość (localStorage – tylko wygoda; aplikacja działa bez niego) ---------- */
  try { APP.opublikowane = JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch (e) { APP.opublikowane = []; }
  APP.zapiszOpublikowane = function () { try { localStorage.setItem(LS_KEY, JSON.stringify(APP.opublikowane)); } catch (e) { /* tryb prywatny – trudno */ } };
  APP.przelicz = function () { APP.agregat = window.AGREGATOR.zbuduj(APP.opublikowane); return APP.agregat; };
  APP.przelicz();

  /* ---------- mapa (Leaflet) ---------- */
  // Zabezpieczenie: odroczone przerysowanie warstwy canvas po usunięciu mapy (szybkie przełączanie widoków) nie może rzucać błędu.
  var _redraw = L.Canvas.prototype._redraw;
  L.Canvas.prototype._redraw = function () { if (this._map && this._ctx) _redraw.call(this); };
  APP.nowaMapa = function (el, opcje) {
    if (APP.mapa) { try { APP.mapa.remove(); } catch (e) { } APP.mapa = null; }
    var m = L.map(el, Object.assign({ preferCanvas: true, zoomControl: true, scrollWheelZoom: true }, opcje || {})).setView([52.05, 19.4], 6);
    var warstwa = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; współtwórcy <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> (ODbL)', maxZoom: 19
    }).addTo(m);
    var bledy = 0; warstwa.on('tileerror', function () { if (++bledy === 6) APP.toast('Brak połączenia z serwerem podkładu mapy – punkty AED są widoczne bez podkładu.'); });
    APP.mapa = m;
    return m;
  };
  APP.marker = function (r, opts) {
    var s = STATUS[r.status] || STATUS[''];
    return L.circleMarker([r._lat, r._lon], Object.assign({ radius: 7, color: r._zweryfikowany ? '#13294B' : '#FFFFFF', weight: r._zweryfikowany ? 2.5 : 2, fillColor: s.kolor, fillOpacity: r._wAgregacie ? 0.95 : 0.35, dashArray: r._wAgregacie ? null : '3 3' }, opts || {}));
  };

  /* ---------- router ---------- */
  var WIDOKI = {};
  APP.widok = function (nazwa, tytul, fn) { WIDOKI[nazwa] = { tytul: tytul, fn: fn }; };
  APP.params = new URLSearchParams();
  function route() {
    var h = location.hash.replace(/^#\/?/, ''), cz = h.split('?'), nazwa = cz[0] || '';
    APP.params = new URLSearchParams(cz[1] || '');
    var w = WIDOKI[nazwa] || WIDOKI[''];
    if (APP.mapa) { try { APP.mapa.remove(); } catch (e) { } APP.mapa = null; }
    var main = $('#main');
    main.innerHTML = '';
    w.fn(main, APP.params);
    document.title = w.tytul + ' · Misja AED – prototyp';
    $$('.nav a').forEach(function (a) { var n = a.getAttribute('href').replace(/^#\/?/, ''); if (n === nazwa) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    $('.nav').classList.remove('open'); $('.menu-btn').setAttribute('aria-expanded', 'false');
    var h1 = $('h1', main);
    if (APP._pierwszy) { if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); } window.scrollTo(0, 0); }
    APP._pierwszy = true;
  }
  APP.route = route;

  /* ================= WIDOK: START (landing akcji) ================= */
  APP.widok('', 'Start', function (main) {
    var st = APP.agregat.stat;
    main.innerHTML =
      '<section class="hero"><div class="wrap">' +
      '<div><p class="eyebrow">Misja AED – Dane na ratunek</p>' +
      '<h1>Każda minuta bez defibrylacji to nawet <span style="color:var(--red)">10%</span> mniej szans na przeżycie.</h1>' +
      '<p class="story"><b>3 marca, Warszawa.</b> Fotograf sejmowy doznał zatrzymania krążenia. Świadkowie nie wiedzieli, gdzie jest najbliższy <b>działający i dostępny</b> AED. Dane o defibrylatorach istnieją – ale są rozproszone, niepełne i nikt nie odpowiada za ich aktualność.</p>' +
      '<p>Ten prototyp pokazuje, jak zebrać w <b>dane.gov.pl</b> jeden, otwarty i aktualny zbiór danych o AED – bez zmieniania zasad portalu: <b>dane publikuje dostawca</b> (dysponent AED), a my dostarczamy <b>wzorcowy zakres danych, walidację, standaryzację, agregację i onboarding</b>.</p>' +
      '<div class="btns"><a class="btn btn-primary" href="#/dostawca">Zostań dostawcą danych</a><a class="btn" href="#/mapa">Zobacz mapę AED</a><a class="btn" href="#/jury">Instrukcja dla jury</a></div></div>' +
      '<div><div id="mini" class="map-mini" role="region" aria-label="Podgląd mapy AED z agregatu (lista dostępna w widoku Mapa)"></div><p class="small muted">Podgląd zbioru zbiorczego. Pełna mapa z filtrami: zakładka „Mapa AED”.</p></div>' +
      '</div></section>' +
      '<section class="section"><div class="wrap">' +
      '<h2>Stan zbioru zbiorczego</h2><div class="kpis">' +
      kpi(st.aed, 'AED w zbiorze zbiorczym (CC BY 4.0)', 'red') + kpi(st.dostawcow, 'dostawców danych (instytucji)', '') +
      kpi(st.zweryfikowanych, 'zweryfikowanych (kontrola ≤ 12 mies.)', 'green') + (st.osm ? kpi(st.osm, 'AED znanych tylko z OSM – luka do zamknięcia', 'gray') : kpi(st.realnych, 'rekordów z prawdziwych zasobów dane.gov.pl', 'gray')) +
      '</div><p class="small muted" style="margin-top:8px">W tym ' + fmt(st.realnych) + ' rekordów <b>rzeczywistych</b> z 4 zasobów dane.gov.pl (Krosno, Przemyśl, Marki, Legionowo) oraz rekordy <b>DEMO</b> (syntetyczne, oznaczone). ' +
      fmt(st.zrodelWykrytych) + ' źródeł wykrytych, ' + fmt(st.zrodelZintegrowanych) + ' zintegrowanych. Szczegóły: <a href="#/zbior">Wzorcowy zbiór danych</a>.</p>' +
      '</div></section>' +
      '<section class="section" style="padding-top:0"><div class="wrap">' +
      '<div class="campaign"><div class="logo-box"><img src="../logo/logo.svg" alt="Logotyp akcji Serce na Mapie"></div>' +
      '<div><p class="eyebrow" style="color:#FFB3BD">Akcja promocyjna dla dysponentów AED</p><p class="slogan">Twoje dane. <span>Czyjeś życie.</span></p>' +
      '<p style="margin:0;color:#DDE5F0">Masz AED w urzędzie, szkole, sklepie albo na hali? Opublikuj dane o nim w dane.gov.pl według wzorca – zajmie to kilkanaście minut, a może skrócić czyjeś poszukiwania o kilka.</p></div>' +
      '<div class="btns"><a class="btn btn-primary" href="#/dostawca">Dołącz do akcji</a><a class="btn" href="#/akcja">O akcji i logotypie</a></div></div>' +
      '</div></section>' +
      '<section class="section" style="padding-top:0"><div class="wrap">' +
      '<h2>Jak to działa – zgodnie z mechanizmami dane.gov.pl</h2>' +
      '<p class="muted">Niebieskie etykiety = istniejące mechanizmy portalu (nie zmieniamy ich). Czerwone = to, co dokłada nasze rozwiązanie.</p>' +
      '<p class="note" style="margin-bottom:18px"><b>Ten model już działa w dane.gov.pl:</b> ponad 15 tys. zbiorów „ceny ofertowe mieszkań” publikuje osobno każdy z blisko 7 tys. deweloperów (typ instytucji <i>developer</i>) według jednego wzorca opisanego w bazie wiedzy portalu. Misja AED przenosi ten sam mechanizm na dysponentów defibrylatorów.</p>' +
      '<div class="flow">' +
      flow('portal', 'Instytucja = dostawca', 'Dysponent AED ma konto <b>instytucji</b> w dane.gov.pl i składa <b>oświadczenie o odpowiedzialności</b> za dane.') +
      flow('nasze', 'Kreator + walidator', 'Plik CSV/XLSX sprawdzany lokalnie wg <b>wzorcowego zakresu</b> (R01–R20), z autokorektą formatów.') +
      flow('portal', 'Zbiór danych → zasób', 'Dostawca publikuje <b>zasób</b> w swoim <b>zbiorze danych</b> (kategoria Zdrowie, tag <i>SerceNaMapie</i>, licencja CC BY 4.0).') +
      flow('portal', 'API + dane tabelaryczne', 'Portal udostępnia zasób przez <b>API</b> (<code>/1.4/resources/{id}/data</code>, schemat Table Schema).') +
      flow('nasze', 'Agregator', 'Pobiera zasoby przez API, waliduje, sprawdza <b>licencje</b> i <b>zakres referencyjny</b>, deduplikuje → <b>jeden zbiór zbiorczy</b>.') +
      '</div></div></section>';
    var m = APP.nowaMapa($('#mini'), { scrollWheelZoom: false });
    APP.agregat.wAgregacie.forEach(function (r) { APP.marker(r, { radius: 5 }).bindTooltip(esc(r.nazwa_lokalizacji)).addTo(m); });
  });
  function kpi(v, l, c) { return '<div class="kpi ' + c + '"><div class="v">' + fmt(v) + '</div><div class="l">' + l + '</div></div>'; }
  function flow(t, h, p) { return '<div><span class="tag ' + t + '">' + (t === 'portal' ? 'mechanizm dane.gov.pl' : 'nasze rozwiązanie') + '</span><h3>' + h + '</h3><p class="small" style="margin:0">' + p + '</p></div>'; }

  /* ================= WIDOK: MAPA ================= */
  APP.widok('mapa', 'Mapa AED', function (main, params) {
    var A = APP.agregat, dostawcy = {};
    A.rekordy.forEach(function (r) { dostawcy[r.dostawca] = (dostawcy[r.dostawca] || 0) + (r._wAgregacie ? 1 : 0); });
    main.innerHTML =
      '<h1 class="sr-only">Mapa AED z filtrami</h1>' +
      '<div class="map-layout"><aside aria-label="Filtry mapy">' +
      '<h2 style="font-size:1.15rem">Filtry</h2>' +
      '<fieldset><legend>Status urządzenia</legend>' + ['aktywny', 'w_serwisie', 'nieaktywny', ''].map(function (s) {
        return '<label class="chk"><input type="checkbox" name="st" value="' + s + '" checked><span class="dot" style="background:' + STATUS[s].kolor + '"></span>' + esc(STATUS[s].e) + '</label>';
      }).join('') + '</fieldset>' +
      '<fieldset><legend>Dostępność</legend><label class="chk"><input type="checkbox" id="f247"> tylko całodobowe (24/7)</label><label class="chk"><input type="checkbox" id="fpub"> tylko z dostępem publicznym</label></fieldset>' +
      '<fieldset><legend>Weryfikacja</legend>' + [['', 'wszystkie'], ['tak', 'zweryfikowane (kontrola ≤ 12 mies.)'], ['nie', 'niezweryfikowane']].map(function (o, i) {
        return '<label class="chk"><input type="radio" name="wer" value="' + o[0] + '"' + (i === 0 ? ' checked' : '') + '> ' + o[1] + '</label>';
      }).join('') + '</fieldset>' +
      '<label class="f" for="fdost">Dostawca / źródło</label><select id="fdost"><option value="">wszyscy dostawcy</option>' +
      Object.keys(dostawcy).sort().map(function (d) { return '<option value="' + esc(d) + '">' + esc(d) + ' (' + dostawcy[d] + ')</option>'; }).join('') + '</select>' +
      '<fieldset style="margin-top:12px"><legend>Warstwy</legend><label class="chk"><input type="checkbox" id="fwyk"> pokaż rekordy spoza zbioru (licencja / błąd krytyczny)</label>' +
      '<label class="chk"><input type="checkbox" id="fosm"' + ((window.OSM_AED || []).length ? '' : ' disabled') + '> warstwa OSM – wskazówki luk (ODbL, poza zbiorem)' + ((window.OSM_AED || []).length ? '' : ' <span class="small muted">– niedołączona w tej wersji danych</span>') + '</label></fieldset>' +
      '<p id="licznik" class="small" aria-live="polite"></p>' +
      '<div class="btns"><button class="btn btn-sm" id="lista-btn" aria-expanded="false" aria-controls="lista">Widok listy (dostępny)</button><a class="btn btn-sm" href="#/zbior">Tabela i eksport</a></div>' +
      '<div id="lista" hidden style="margin-top:10px"></div>' +
      '</aside><div class="map-wrap"><div id="mapa" role="region" aria-label="Mapa AED. Kliknij punkt, aby zobaczyć kartę AED. Alternatywa tekstowa: przycisk Widok listy."></div>' +
      '<div class="legend" aria-hidden="true"><div><span class="dot" style="background:#007A50"></span>aktywny</div><div><span class="dot" style="background:#C98A00"></span>w serwisie</div><div><span class="dot" style="background:#6B7A90"></span>nieaktywny</div><div><span class="dot" style="background:#3B5B95"></span>brak danych o statusie</div><div><span class="dot" style="background:#fff;box-shadow:0 0 0 2.5px #13294B"></span>obwódka granatowa = zweryfikowany</div></div>' +
      '<div class="panel" id="karta" role="dialog" aria-modal="false" aria-labelledby="karta-tytul"></div></div></div>';
    var m = APP.nowaMapa($('#mapa'));
    var warstwa = L.layerGroup().addTo(m), osm = L.layerGroup();
    var rend = L.canvas({ padding: 0.5 });
    function filtr() {
      var st = $$('input[name=st]:checked').map(function (i) { return i.value; });
      var wer = $('input[name=wer]:checked').value, d = $('#fdost').value, wyk = $('#fwyk').checked;
      return A.rekordy.filter(function (r) {
        return (r._wAgregacie || wyk) && st.indexOf(STATUS[r.status] ? r.status : '') >= 0 && (!$('#f247').checked || r.dostepnosc === '24/7') &&
          (!$('#fpub').checked || r.dostep_publiczny === 'tak') && (!wer || (wer === 'tak') === r._zweryfikowany) && (!d || r.dostawca === d) && isFinite(r._lat);
      });
    }
    function rysuj() {
      warstwa.clearLayers();
      var lista = filtr();
      lista.forEach(function (r) { APP.marker(r, { renderer: rend }).on('click', function () { pokazKarte(r); }).bindTooltip(esc(r.nazwa_lokalizacji)).addTo(warstwa); });
      $('#licznik').textContent = 'Widoczne: ' + lista.length + ' AED' + ($('#fwyk').checked ? ' (z rekordami spoza zbioru)' : '');
      if (!$('#lista').hidden) rysujListe(lista);
      return lista;
    }
    function rysujListe(lista) {
      $('#lista').innerHTML = '<ul class="issues" style="max-height:340px">' + lista.slice(0, 300).map(function (r) {
        return '<li><button class="btn btn-sm" data-id="' + esc(r._id) + '" style="border:0;padding:0;text-align:left;text-decoration:underline">' + esc(r.nazwa_lokalizacji || '(bez nazwy)') + '</button><br><span class="small muted">' + esc(r.miejscowosc) + ' · ' + esc((STATUS[r.status] || STATUS['']).e) + ' · ' + (r._zweryfikowany ? 'zweryfikowany' : 'niezweryfikowany') + '</span></li>';
      }).join('') + '</ul>';
      $$('#lista button[data-id]').forEach(function (b) { b.onclick = function () { pokazKarte(A.rekordy.filter(function (r) { return r._id === b.dataset.id; })[0], true); }; });
    }
    function pokazKarte(r, przesun) {
      var k = $('#karta');
      k.innerHTML = APP.kartaAED(r);
      k.classList.add('open');
      if (przesun) m.setView([r._lat, r._lon], 16);
      $('#karta-zamknij').onclick = function () { k.classList.remove('open'); };
      var zg = $('#zglos'); if (zg) zg.onclick = function () { APP.zglosUwage(r); };
      $('#karta-zamknij').focus();
    }
    $$('aside input, aside select').forEach(function (el) { el.addEventListener('change', rysuj); });
    $('#fosm').addEventListener('change', function () {
      if (this.checked) {
        if (!osm.getLayers().length) (window.OSM_AED || []).forEach(function (p) { L.circleMarker([p[0], p[1]], { renderer: rend, radius: 3, weight: 0, fillColor: '#7C8BA1', fillOpacity: 0.55, interactive: true }).bindTooltip('OSM (ODbL) – poza zbiorem: ' + esc(p[2] || 'defibrylator')).addTo(osm); });
        osm.addTo(m); osm.eachLayer(function (l) { l.bringToBack(); });
        if (!(window.OSM_AED || []).length) APP.toast('Warstwa OSM nie została dołączona do tej wersji danych.');
      } else m.removeLayer(osm);
    });
    $('#lista-btn').onclick = function () { var l = $('#lista'); l.hidden = !l.hidden; this.setAttribute('aria-expanded', String(!l.hidden)); if (!l.hidden) rysujListe(filtr()); };
    document.addEventListener('keydown', function esck(e) { if (e.key === 'Escape') { var k = $('#karta'); if (k) k.classList.remove('open'); else document.removeEventListener('keydown', esck); } });
    var lista = rysuj();
    var pts = lista.map(function (r) { return [r._lat, r._lon]; });
    if (pts.length) m.fitBounds(pts, { padding: [30, 30] });
    var aed = params.get('aed');
    if (aed) { var r = A.rekordy.filter(function (x) { return x._id === aed; })[0]; if (r) setTimeout(function () { pokazKarte(r, true); }, 50); }
    var dost = params.get('dostawca'); if (dost) { $('#fdost').value = dost; rysuj(); var p2 = filtr().map(function (r) { return [r._lat, r._lon]; }); if (p2.length) m.fitBounds(p2, { padding: [40, 40], maxZoom: 15 }); }
  });

  /* Karta AED – wszystkie pola wzorca + źródło + weryfikacja + jakość */
  APP.kartaAED = function (r) {
    var z = r._z, grupy = {}, h = '';
    S.fields.forEach(function (f) { (grupy[f.grupa] = grupy[f.grupa] || []).push(f); });
    Object.keys(grupy).forEach(function (g) {
      h += '<div class="kv-group">' + esc(g) + '</div><dl class="kv">' + grupy[g].map(function (f) {
        var v = r[f.name], et = f.slownik_etykiety && f.slownik_etykiety[v];
        return '<dt>' + esc(f.title) + (f.wymagalnosc === 'wymagane' ? ' *' : '') + '</dt><dd>' + (v === '' || v == null ? '<span class="muted">— brak danych</span>' : esc(et ? v + ' – ' + et : v)) + '</dd>';
      }).join('') + '</dl>';
    });
    var dt = V.dostepnyTeraz(r);
    var probl = r._problemy.length ? '<ul class="issues" style="max-height:200px">' + r._problemy.map(function (p) {
      return '<li><span class="badge ' + (p.poziom === 'blad' ? 'b-err' : 'b-warn') + '">' + p.kod + '</span> ' + esc(p.komunikat) + '</li>'; }).join('') + '</ul>' : '<p class="badge b-ok">Rekord w pełni zgodny ze wzorcem</p>';
    return '<header><div><h2 id="karta-tytul">' + esc(r.nazwa_lokalizacji || '(bez nazwy)') + '</h2><p class="small muted" style="margin:2px 0 6px">' + esc([r.adres, r.kod_pocztowy, r.miejscowosc].filter(Boolean).join(', ')) + '</p>' +
      '<div class="btns" style="gap:4px">' + APP.bStatus(r) + APP.bWer(r) + APP.bDemo(r) + '</div></div>' +
      '<button class="btn btn-sm close" id="karta-zamknij" aria-label="Zamknij kartę AED">✕</button></header><div class="body">' +
      (r._wAgregacie ? '' : '<p class="note red"><b>Poza zbiorem zbiorczym:</b> ' + esc(r._powod) + '</p>') +
      '<p class="small"><b>Dostępny teraz:</b> ' + (dt.stan === 'otwarte' ? '<span class="badge b-ok">tak</span>' : dt.stan === 'zamkniete' ? '<span class="badge b-err">nie</span>' : '<span class="badge b-gray">nieznane</span>') + ' <span class="muted">' + esc(dt.opis) + '</span></p>' +
      '<div class="kv-group">Źródło i odpowiedzialność</div><dl class="kv">' +
      '<dt>Dostawca (odpowiada za dane)</dt><dd><b>' + esc(r.dostawca) + '</b></dd>' +
      '<dt>Zbiór danych</dt><dd>' + (z.zbior.url ? '<a href="' + esc(z.zbior.url) + '" target="_blank" rel="noopener">' + esc(z.zbior.tytul) + '</a>' : esc(z.zbior.tytul)) + '</dd>' +
      '<dt>Zasób</dt><dd>' + (z.zasob.url ? '<a href="' + esc(z.zasob.url) + '" target="_blank" rel="noopener">zasób ' + esc(z.zasob.id) + ' (' + esc(z.zasob.format) + ')</a>' : esc(z.zasob.tytul)) + '</dd>' +
      '<dt>Licencja rekordu</dt><dd>' + APP.bLic(r.licencja) + '</dd>' +
      '<dt>Zakres referencyjny źródła</dt><dd>' + esc(z.zakres_referencyjny.terytorialny) + '; ' + esc(z.zakres_referencyjny.przedmiotowy) + '; ' + esc(z.zakres_referencyjny.czasowy) + '</dd>' +
      '<dt>Data weryfikacji (kontrola AED)</dt><dd>' + (r.data_ostatniej_kontroli ? esc(r.data_ostatniej_kontroli) + (r._zweryfikowany ? ' – aktualna' : ' – starsza niż 12 mies.') : '<span class="muted">brak – rekord niezweryfikowany</span>') + '</dd>' +
      '<dt>Zasób zweryfikowany w dane.gov.pl</dt><dd>' + esc(z.zbior.zweryfikowano || '—') + '</dd>' +
      '<dt>Pobrano przez agregator</dt><dd>' + esc(z.data_pobrania) + '</dd>' +
      '<dt>Globalny identyfikator</dt><dd><code>' + esc(r._id) + '</code></dd></dl>' +
      h + '<div class="kv-group">Jakość rekordu (walidator R01–R20)</div>' + probl +
      '<div class="btns" style="margin-top:12px"><button class="btn btn-sm btn-dark" id="zglos">Zgłoś uwagę dostawcy</button>' +
      '<a class="btn btn-sm" target="_blank" rel="noopener" href="https://www.openstreetmap.org/directions?route=%3B' + r._lat + '%2C' + r._lon + '#map=18/' + r._lat + '/' + r._lon + '">Prowadź do AED</a></div></div>';
  };
  APP.zglosUwage = function (r) {
    var t = prompt('Zgłoszenie trafi do dostawcy „' + r.dostawca + '” mechanizmem „Zgłoś uwagę” zasobu w dane.gov.pl (symulacja).\nOpisz problem (np. „AED zdemontowany”, „szafka zamknięta”):', 'AED nie znajduje się już w tym miejscu');
    if (t) APP.toast('Symulacja: uwaga przekazana dostawcy „' + r.dostawca + '” (zasób ' + r._z.zasob.id + '). Poprawkę publikuje dostawca.');
  };

  /* ================= WIDOK: WZORCOWY ZBIÓR DANYCH ================= */
  APP.widok('zbior', 'Wzorcowy zbiór danych', function (main) {
    var A = APP.agregat, st = A.stat;
    var dost = {}; A.rekordy.forEach(function (r) { dost[r.dostawca] = 1; });
    main.innerHTML = '<div class="wrap section"><p class="eyebrow">Zbiór zbiorczy · licencja CC BY 4.0</p><h1>Wzorcowy zbiór danych o AED</h1>' +
      '<p class="muted">Jeden zbiór zintegrowany z zasobów wielu dostawców. Każdy rekord zachowuje <b>dostawcę, zasób źródłowy, licencję i zakres referencyjny</b>. Licencja zbioru: <b>CC BY 4.0</b>; rekordy z licencjami niekompatybilnymi są oznaczane i <b>wyłączane z agregacji</b>.</p>' +
      '<div class="kpis">' + kpi(st.aed, 'rekordów w zbiorze zbiorczym', 'red') + kpi(st.zgodnychWzorca, 'w pełni zgodnych ze wzorcem', 'green') + kpi(st.wykluczonychLic, 'wykluczonych – licencja (w tym OSM)', 'gray') + kpi(st.odrzuconych + st.duplikatow, 'odrzuconych – błąd krytyczny / duplikat', '') + '</div>' +
      '<h2 style="margin-top:28px">Źródła i ich zakres referencyjny</h2>' +
      '<div class="table-wrap"><table><thead><tr><th>Dostawca (instytucja)</th><th>Typ</th><th>Zbiór / zasób</th><th>Licencja</th><th>Zakres referencyjny</th><th>Rekordy w zbiorze / w źródle</th><th>Integracja</th></tr></thead><tbody>' +
      A.zrodla.map(function (z) {
        var stan = z.status_integracji === 'zintegrowano' ? '<span class="badge b-ok">zintegrowano</span>' : z.status_integracji === 'niedostepne' ? '<span class="badge b-warn">niedostępne</span>' : '<span class="badge b-err">wykluczono</span>';
        return '<tr><td><b>' + esc(z.instytucja.nazwa) + '</b>' + (z.instytucja.regon ? '<br><span class="small muted">REGON ' + esc(z.instytucja.regon) + '</span>' : '') + '</td><td>' + (z.demo ? '<span class="badge b-demo">DEMO</span>' : z.typ === 'OpenStreetMap' ? '<span class="badge b-gray">OSM</span>' : z.typ === 'opublikowane w prototypie' ? '<span class="badge b-demo">kreator</span>' : '<span class="badge b-blue">dane.gov.pl</span>') + '</td>' +
          '<td>' + (z.zbior.url ? '<a href="' + esc(z.zbior.url) + '" target="_blank" rel="noopener">' + esc(z.zbior.tytul) + '</a>' : esc(z.zbior.tytul)) + '<br><span class="small muted">zasób ' + esc(z.zasob.id) + ' · ' + esc(String(z.zasob.format).toUpperCase()) + ' · aktualizacja: ' + esc(z.zbior.czestotliwosc) + '</span></td>' +
          '<td>' + APP.bLic(z.licencja) + '</td><td class="small">' + esc(z.zakres_referencyjny.terytorialny) + '<br><span class="muted">' + esc(z.zakres_referencyjny.przedmiotowy) + ' · ' + esc(z.zakres_referencyjny.czasowy) + '</span></td>' +
          '<td>' + fmt(z._wAgregacie) + ' / ' + fmt(z._wszystkie) + (z._jakosc ? '<br><span class="small muted">błędy: ' + z._jakosc.bledy + ', ostrzeżenia: ' + z._jakosc.ostrzezenia + '</span>' : '') + '</td>' +
          '<td>' + stan + (z.powod ? '<br><span class="small">' + esc(z.powod) + '</span>' : '') + '<details><summary class="small">raport harmonizacji</summary><ul class="small">' + z.raport_harmonizacji.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></details></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<h2 style="margin-top:28px">Zbiór zbiorczy – przeglądanie i eksport</h2>' +
      '<div class="grid g4" style="align-items:end"><div><label class="f" for="q">Szukaj</label><input type="search" id="q" placeholder="nazwa, miejscowość, adres"></div>' +
      '<div><label class="f" for="zd">Źródło (dostawca)</label><select id="zd"><option value="">wszystkie</option>' + Object.keys(dost).sort().map(function (d) { return '<option>' + esc(d) + '</option>'; }).join('') + '</select></div>' +
      '<div><label class="f" for="zl">Licencja</label><select id="zl"><option value="">wszystkie</option>' + S.licencje.map(function (l) { return '<option value="' + l.kod + '">' + l.kod + (l.kompatybilna ? ' (kompatybilna)' : ' (niekompatybilna)') + '</option>'; }).join('') + '</select></div>' +
      '<div><label class="chk"><input type="checkbox" id="zw"> pokaż także rekordy spoza zbioru</label></div></div>' +
      '<div class="btns" style="margin:14px 0"><span class="small"><b>Eksport (formaty maszynowo czytelne):</b></span><button class="btn btn-sm btn-dark" data-ex="csv">CSV</button><button class="btn btn-sm btn-dark" data-ex="xlsx">XLSX</button><button class="btn btn-sm btn-dark" data-ex="json">JSON</button><button class="btn btn-sm btn-dark" data-ex="geojson">GeoJSON</button><button class="btn btn-sm" data-ex="meta">Metadane i licencje (datapackage.json)</button></div>' +
      '<p id="zinfo" class="small" aria-live="polite"></p><div class="table-wrap" style="max-height:520px"><table><thead><tr><th>Globalny ID</th><th>Nazwa lokalizacji</th><th>Miejscowość</th><th>Województwo</th><th>Status</th><th>Dostępność</th><th>Weryfikacja</th><th>Dostawca</th><th>Licencja</th><th>Zgodność / w zbiorze</th></tr></thead><tbody id="zt"></tbody></table></div><div class="pager" id="zp"></div>' +
      '<h2 style="margin-top:28px">API zbioru (odwzorowanie API dane.gov.pl)</h2><p class="muted small">Zbiór zbiorczy udostępniany tym samym mechanizmem co każdy zasób tabelaryczny portalu – <code>GET /1.4/resources/{id}/data</code> (JSON:API, <code>meta.data_schema</code> w formacie Table Schema, <code>headers_map</code>). Poniżej odpowiedź wygenerowana z bieżącego zbioru (symulacja).</p><pre class="code" id="zapi"></pre></div>';
    var strona = 0, NA = 25;
    function lista() {
      var q = V.klucz($('#q').value || ''), d = $('#zd').value, l = $('#zl').value, w = $('#zw').checked;
      return A.rekordy.filter(function (r) { return (w || r._wAgregacie) && (!d || r.dostawca === d) && (!l || r.licencja === l) && (!q || V.klucz([r.nazwa_lokalizacji, r.miejscowosc, r.adres].join(' ')).indexOf(q) >= 0); });
    }
    function rysuj() {
      var L2 = lista(), od = strona * NA;
      $('#zinfo').textContent = 'Wyniki: ' + L2.length + ' (w zbiorze zbiorczym: ' + L2.filter(function (r) { return r._wAgregacie; }).length + '). Eksport obejmuje wyłącznie rekordy ze zbioru zbiorczego (licencje kompatybilne z CC BY 4.0).';
      $('#zt').innerHTML = L2.slice(od, od + NA).map(function (r) {
        return '<tr' + (r._wAgregacie ? '' : ' class="err"') + '><td><a href="#/mapa?aed=' + encodeURIComponent(r._id) + '"><code>' + esc(r._id) + '</code></a></td><td>' + esc(r.nazwa_lokalizacji) + (r._demo ? ' <span class="badge b-demo">DEMO</span>' : '') + '</td><td>' + esc(r.miejscowosc) + '</td><td>' + esc(r.wojewodztwo) + '</td><td>' + APP.bStatus(r) + '</td><td>' + esc(r.dostepnosc || '—') + '</td><td>' + APP.bWer(r) + '</td><td class="small">' + esc(r.dostawca) + '</td><td>' + APP.bLic(r.licencja) + '</td><td>' +
          (r._wAgregacie ? (r._zgodnosc === 'pelna' ? '<span class="badge b-ok">pełna</span>' : '<span class="badge b-warn" title="' + esc(r._bledy.map(function (p) { return p.komunikat; }).join(' ')) + '">częściowa (' + r._bledy.length + ')</span>') : '<span class="badge b-err" title="' + esc(r._powod) + '">poza zbiorem</span><br><span class="small">' + esc(r._powod).slice(0, 90) + '</span>') + '</td></tr>';
      }).join('') || '<tr><td colspan="10">Brak wyników.</td></tr>';
      var stron = Math.max(1, Math.ceil(L2.length / NA));
      $('#zp').innerHTML = '<button class="btn btn-sm" id="pp"' + (strona ? '' : ' disabled') + '>‹ Poprzednia</button><span class="small">strona ' + (strona + 1) + ' z ' + stron + '</span><button class="btn btn-sm" id="pn"' + (strona < stron - 1 ? '' : ' disabled') + '>Następna ›</button>';
      $('#pp').onclick = function () { strona--; rysuj(); }; $('#pn').onclick = function () { strona++; rysuj(); };
      $('#zapi').textContent = JSON.stringify(APP.apiOdpowiedz('AGREGAT-AED', L2.filter(function (r) { return r._wAgregacie; }).slice(0, 2), L2.filter(function (r) { return r._wAgregacie; }).length), null, 2);
    }
    ['#q', '#zd', '#zl', '#zw'].forEach(function (s) { $(s).addEventListener('input', function () { strona = 0; rysuj(); }); });
    $$('[data-ex]').forEach(function (b) { b.onclick = function () { APP.eksport(b.dataset.ex, lista().filter(function (r) { return r._wAgregacie; })); }; });
    rysuj();
  });

  APP.kolumnyEksportu = V.POLA.concat(S.pola_agregatora.map(function (p) { return p.name; }));
  APP.wierszEksportu = function (r) {
    var o = {}; V.POLA.forEach(function (p) { o[p] = r[p]; });
    o.agregat_id = r._id; o.agregat_id_zasobu = r._z.zasob.id; o.agregat_url_zasobu = r._z.zasob.url || ''; o.agregat_zakres_referencyjny = r._z.zakres_referencyjny.terytorialny + ' – ' + r._z.zakres_referencyjny.przedmiotowy;
    o.agregat_zweryfikowany = r._zweryfikowany ? 'tak' : 'nie'; o.agregat_zgodnosc_wzorca = r._zgodnosc; o.agregat_licencja_kompatybilna = r._licencjaOk ? 'tak' : 'nie'; o.agregat_data_pobrania = r._z.data_pobrania;
    return o;
  };
  APP.eksport = function (fmtx, recs) {
    var rows = recs.map(APP.wierszEksportu), cols = APP.kolumnyEksportu, d = V.DZIS, nazwa = 'aed-zbior-zbiorczy-' + d;
    if (fmtx === 'csv') APP.pobierz(nazwa + '.csv', APP.csv(rows, cols), 'text/csv;charset=utf-8');
    if (fmtx === 'xlsx') APP.xlsx(rows, cols, 'AED', nazwa + '.xlsx', [['Zbiór', 'Zbiór zbiorczy AED (prototyp Misja AED)'], ['Licencja zbioru', 'CC BY 4.0'], ['Data eksportu', d], ['Liczba rekordów', rows.length], ['Uwaga', 'Licencja źródłowa i dostawca zachowane w kolumnach licencja / dostawca / agregat_url_zasobu']]);
    if (fmtx === 'json') APP.pobierz(nazwa + '.json', JSON.stringify({ licencja: 'CC-BY-4.0', data_eksportu: d, liczba: rows.length, rekordy: rows }, null, 1), 'application/json');
    if (fmtx === 'geojson') APP.pobierz(nazwa + '.geojson', JSON.stringify({ type: 'FeatureCollection', features: rows.map(function (o) { return { type: 'Feature', geometry: { type: 'Point', coordinates: [Number(o.dlugosc_geograficzna), Number(o.szerokosc_geograficzna)] }, properties: o }; }) }), 'application/geo+json');
    if (fmtx === 'meta') APP.pobierz('datapackage.json', JSON.stringify({
      name: 'aed-zbior-zbiorczy', title: 'Zbiór zbiorczy AED – prototyp', licenses: [{ name: 'CC-BY-4.0', path: 'https://creativecommons.org/licenses/by/4.0/legalcode.pl' }],
      sources: APP.agregat.zrodla.map(function (z) { return { title: z.instytucja.nazwa + ' – ' + z.zbior.tytul, path: z.zasob.url || z.zbior.url, license: z.licencja, status: z.status_integracji, reason: z.powod || undefined, reference_scope: z.zakres_referencyjny }; }),
      resources: [{ name: 'aed', path: nazwa + '.csv', format: 'csv', encoding: 'utf-8', schema: { fields: S.fields.map(function (f) { return { name: f.name, title: f.title, type: f.type, constraints: f.constraints }; }).concat(S.pola_agregatora.map(function (p) { return { name: p.name, title: p.title, type: p.type }; })) } }]
    }, null, 2), 'application/json');
    APP.toast('Wyeksportowano ' + rows.length + ' rekordów (' + fmtx.toUpperCase() + ').');
  };
  /* Odpowiedź w formacie API dane.gov.pl dla danych tabelarycznych (sprawdzony format: api.dane.gov.pl/1.4/resources/{id}/data) */
  APP.apiOdpowiedz = function (rid, recs, count) {
    var cols = V.POLA, hm = {}; cols.forEach(function (c, i) { hm['col' + (i + 1)] = c; });
    return {
      data: recs.map(function (r, i) {
        var at = {}; cols.forEach(function (c, j) { at['col' + (j + 1)] = { repr: String(r[c] == null ? '' : r[c]), val: r[c] == null ? '' : r[c] }; });
        return { type: 'row', id: 'row-' + (i + 1), attributes: at, relationships: { resource: { data: { type: 'resource', id: String(rid) } } }, meta: { row_no: i + 1, updated_at: V.DZIS + 'T00:00:00Z' } };
      }),
      meta: { count: count, headers_map: hm, data_schema: { fields: cols.map(function (c, i) { var f = V.POLE[c]; return { name: 'col' + (i + 1), type: f.type === 'boolean' ? 'string' : f.type, format: 'default' }; }), missingValues: [''] }, path: '/1.4/resources/' + rid + '/data', language: 'pl' },
      links: { self: 'https://api.dane.gov.pl/1.4/resources/' + rid + '/data?page=1&per_page=2 (symulacja)' }, jsonapi: { version: '1.4' }
    };
  };

  /* ================= WIDOK: DLA SŁUŻB RATOWNICZYCH ================= */
  var MIEJSCA = { sejm: ['Sejm RP, ul. Wiejska 4, Warszawa', 52.2253, 21.0281], krosno: ['Rynek, Krosno', 49.6886, 21.7706], przemysl: ['Rynek, Przemyśl', 49.7838, 22.7678],
    marki: ['Urząd Miasta Marki', 52.3267, 21.1076], krakow: ['Rynek Główny, Kraków', 50.0617, 19.9373], lodz: ['ul. Piotrkowska, Łódź', 51.7656, 19.4573] };
  APP.widok('sluzby', 'Dla służb ratowniczych', function (main, params) {
    main.innerHTML = '<div class="wrap section"><p class="eyebrow">Widok operacyjny (prototyp)</p><h1>Najbliższy działający AED</h1>' +
      '<p class="sos" role="note">To jest prototyp na danych częściowo demonstracyjnych. W nagłym zagrożeniu dzwoń <b>112</b> – dyspozytor poprowadzi resuscytację.</p>' +
      '<div class="grid g2" style="margin-top:16px;align-items:start"><div>' +
      '<fieldset><legend>Miejsce zdarzenia</legend><div class="btns">' + Object.keys(MIEJSCA).map(function (k) { return '<button class="btn btn-sm" data-m="' + k + '">' + esc(MIEJSCA[k][0]) + '</button>'; }).join('') +
      '<button class="btn btn-sm btn-dark" id="geo">📍 Moja lokalizacja</button></div><p class="hint">Możesz też kliknąć miejsce na mapie.</p></fieldset>' +
      '<fieldset><legend>Opcje</legend><label class="chk"><input type="checkbox" id="oteraz"> tylko dostępne teraz (24/7 lub w godzinach otwarcia)</label><label class="chk"><input type="checkbox" id="okod"> pomiń AED wymagające kodu</label><label class="chk"><input type="checkbox" id="onz" checked> uwzględnij AED o nieznanym statusie (oznaczone)</label></fieldset>' +
      '<p id="gdzie" class="small" aria-live="polite"></p><ol class="near-list" id="wyniki" aria-label="AED posortowane według odległości"></ol></div>' +
      '<div><div id="mapa" class="map" style="height:560px;border-radius:12px;border:1px solid var(--line)" role="region" aria-label="Mapa: miejsce zdarzenia i najbliższe AED (lista obok)"></div><p class="small muted">Czas dojścia liczony dla 5 km/h po linii prostej; „tam i z powrotem” – gdy świadek musi przynieść AED do poszkodowanego.</p></div></div></div>';
    var m = APP.nowaMapa($('#mapa')), warstwa = L.layerGroup().addTo(m), punkt = null;
    function ustaw(nazwa, lat, lon) {
      punkt = { nazwa: nazwa, lat: lat, lon: lon }; licz();
    }
    function licz() {
      if (!punkt) return;
      var teraz = $('#oteraz').checked, kod = $('#okod').checked, nz = $('#onz').checked;
      var kand = APP.agregat.wAgregacie.filter(function (r) {
        if (r.status === 'nieaktywny' || r.status === 'w_serwisie') return false;
        if (!r.status && !nz) return false;
        if (kod && r.wymaga_kodu_dostepu === 'tak') return false;
        if (teraz && V.dostepnyTeraz(r).stan !== 'otwarte') return false;
        return true;
      }).map(function (r) { return { r: r, d: V.haversine(punkt.lat, punkt.lon, r._lat, r._lon) }; }).sort(function (a, b) { return a.d - b.d; }).slice(0, 10);
      var osmBlisko = (window.OSM_AED || []).filter(function (p) { return V.haversine(punkt.lat, punkt.lon, p[0], p[1]) < 1000; }).length;
      $('#gdzie').innerHTML = '<b>Miejsce:</b> ' + esc(punkt.nazwa) + '. ' + (osmBlisko ? 'W promieniu 1 km wolontariusze OSM zaznaczyli <b>' + osmBlisko + '</b> AED, których <b>nie ma</b> w otwartym zbiorze z odpowiedzialnością dysponenta – to luka, którą zamyka akcja „Serce na Mapie”.' : '');
      warstwa.clearLayers();
      L.circleMarker([punkt.lat, punkt.lon], { radius: 10, color: '#D0142C', weight: 4, fillColor: '#fff', fillOpacity: 1 }).bindTooltip('Miejsce zdarzenia').addTo(warstwa);
      $('#wyniki').innerHTML = kand.map(function (k, i) {
        var r = k.r, min = k.d / 83.3, dt = V.dostepnyTeraz(r);
        APP.marker(r).bindTooltip((i + 1) + '. ' + esc(r.nazwa_lokalizacji), { permanent: i < 3, direction: 'right' }).addTo(warstwa);
        return '<li><div class="dist">' + (k.d < 1000 ? Math.round(k.d) + ' m' : (k.d / 1000).toFixed(1) + ' km') + '<small>' + Math.ceil(min) + ' min pieszo</small><small>tam i z powrotem: ' + Math.ceil(2 * min) + ' min</small></div>' +
          '<div><b>' + (i + 1) + '. ' + esc(r.nazwa_lokalizacji) + '</b><br><span class="small">' + esc([r.adres, r.miejscowosc].filter(Boolean).join(', ')) + '</span>' +
          (r.opis_lokalizacji ? '<br><span class="small"><b>Gdzie w obiekcie:</b> ' + esc(r.opis_lokalizacji) + '</span>' : '') +
          '<br><span class="small"><b>Godziny:</b> ' + esc(dt.opis) + (r.telefon_kontaktowy ? ' · <b>tel.</b> <a href="tel:' + esc(r.telefon_kontaktowy) + '">' + esc(r.telefon_kontaktowy) + '</a>' : '') + '</span>' +
          '<br><span class="small muted">Dostawca: ' + esc(r.dostawca) + '</span></div>' +
          '<div class="btns" style="flex-direction:column;align-items:flex-end;gap:4px">' + APP.bStatus(r) + (dt.stan === 'otwarte' ? '<span class="badge b-ok">dostępny teraz</span>' : dt.stan === 'zamkniete' ? '<span class="badge b-err">teraz zamknięte</span>' : '<span class="badge b-gray">godziny nieznane</span>') +
          (r.wymaga_kodu_dostepu === 'tak' ? '<span class="badge b-warn">kod: ' + esc(r.instrukcja_dostepu || 'tak') + '</span>' : '') + APP.bWer(r) + (r._demo ? '<span class="badge b-demo">DEMO</span>' : '') + '<a class="small" href="#/mapa?aed=' + encodeURIComponent(r._id) + '">karta AED</a></div></li>';
      }).join('') || '<li>Brak AED spełniających kryteria.</li>';
      var b = [[punkt.lat, punkt.lon]].concat(kand.slice(0, 5).map(function (k) { return [k.r._lat, k.r._lon]; }));
      m.fitBounds(b, { padding: [40, 40], maxZoom: 16 });
    }
    $$('[data-m]').forEach(function (b) { b.onclick = function () { var x = MIEJSCA[b.dataset.m]; ustaw(x[0], x[1], x[2]); }; });
    $('#geo').onclick = function () {
      if (!navigator.geolocation) return APP.toast('Przeglądarka nie udostępnia lokalizacji.');
      navigator.geolocation.getCurrentPosition(function (p) { ustaw('Twoja lokalizacja', p.coords.latitude, p.coords.longitude); }, function () { APP.toast('Nie udało się pobrać lokalizacji – wybierz miejsce z listy.'); });
    };
    m.on('click', function (e) { ustaw('Wskazane na mapie (' + e.latlng.lat.toFixed(4) + ', ' + e.latlng.lng.toFixed(4) + ')', e.latlng.lat, e.latlng.lng); });
    ['#oteraz', '#okod', '#onz'].forEach(function (s) { $(s).addEventListener('change', licz); });
    var x = MIEJSCA[params.get('miejsce') || 'sejm']; ustaw(x[0], x[1], x[2]);
  });

  /* ================= WIDOK: WZORCOWY ZAKRES DANYCH ================= */
  APP.widok('schemat', 'Wzorcowy zakres danych', function (main) {
    var et = { wymagane: 'b-err', zalecane: 'b-warn', opcjonalne: 'b-gray', 'warunkowo wymagane': 'b-err' };
    main.innerHTML = '<div class="wrap section"><p class="eyebrow">Standard dla wszystkich dostawców · wersja ' + esc(S.version) + '</p><h1>Wzorcowy zakres danych AED</h1>' +
      '<p class="muted">Tabela generowana na żywo z <code>schemat/aed-schema.json</code> – tego samego pliku używa walidator i generator XLSX. Format zgodny z <b>Frictionless Table Schema</b>, którego dane.gov.pl używa do opisu danych tabelarycznych (<code>meta.data_schema</code> w API).</p>' +
      '<div class="btns" style="margin-bottom:16px"><a class="btn btn-primary" href="../wzorcowy-zakres-danych-AED.xlsx" download>Pobierz wzorcowy-zakres-danych-AED.xlsx</a><a class="btn" href="../schemat/szablon-AED.csv" download>Szablon CSV (pusty)</a><a class="btn" href="../schemat/przyklad-AED.csv" download>Przykład CSV</a><a class="btn" href="../schemat/aed-schema.json" download>Schemat JSON (Table Schema)</a></div>' +
      '<div class="grid g4" style="margin-bottom:16px">' + [['Kodowanie', S.kodowanie], ['Separator CSV', 'przecinek (,)'], ['Współrzędne', 'WGS 84 / EPSG:4326'], ['Daty', 'RRRR-MM-DD (ISO 8601)']].map(function (x) { return '<div class="card"><div class="small muted">' + x[0] + '</div><b>' + x[1] + '</b></div>'; }).join('') + '</div>' +
      '<div class="table-wrap" style="max-height:640px"><table><thead><tr><th>#</th><th>Kolumna</th><th>Typ</th><th>Wymagane?</th><th>Słownik wartości / format</th><th>Przykład</th><th>Opis</th></tr></thead><tbody>' +
      S.fields.map(function (f, i) {
        var c = f.constraints || {}, sl = c.enum ? c.enum.join(' | ') : c.pattern ? (f.name === 'godziny_dostepnosci' ? 'składnia OSM opening_hours' : '<code>' + esc(c.pattern) + '</code>') : (c.minimum != null ? c.minimum + ' … ' + c.maximum : '');
        return '<tr><td>' + (i + 1) + '</td><td><code><b>' + f.name + '</b></code><br><span class="small muted">' + esc(f.title) + '</span></td><td>' + f.type + (f.type === 'date' ? ' (RRRR-MM-DD)' : f.type === 'boolean' ? ' (tak/nie)' : '') + '</td><td><span class="badge ' + et[f.wymagalnosc] + '">' + f.wymagalnosc + '</span>' + (f.krytyczne ? '<br><span class="small">krytyczne</span>' : '') + '</td><td class="small">' + (c.enum ? esc(sl) : sl) + '</td><td class="small"><code>' + esc(f.przyklad) + '</code></td><td class="small">' + esc(f.opis) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<h2 style="margin-top:28px">Pola dodawane przez agregator</h2><div class="table-wrap"><table><thead><tr><th>Kolumna</th><th>Typ</th><th>Opis</th></tr></thead><tbody>' + S.pola_agregatora.map(function (p) { return '<tr><td><code>' + p.name + '</code></td><td>' + p.type + '</td><td class="small">' + esc(p.opis) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<h2 style="margin-top:28px">Reguły walidacji</h2><div class="table-wrap"><table><thead><tr><th>Kod</th><th>Zakres</th><th>Poziom</th><th>Autokorekta</th><th>Reguła</th></tr></thead><tbody>' + S.reguly_walidacji.map(function (r) { return '<tr><td><b>' + r.kod + '</b></td><td>' + r.zakres + '</td><td><span class="badge ' + (r.poziom === 'błąd' ? 'b-err' : 'b-warn') + '">' + r.poziom + '</span></td><td>' + (r.autokorekta ? 'tak' : '—') + '</td><td class="small">' + esc(r.opis) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<h2 style="margin-top:28px">Licencje i kompatybilność z agregatem CC BY 4.0</h2><div class="table-wrap"><table><thead><tr><th>Kod</th><th>Licencja</th><th>Do agregatu?</th><th>Uzasadnienie</th></tr></thead><tbody>' + S.licencje.map(function (l) { return '<tr><td><code>' + l.kod + '</code></td><td>' + esc(l.nazwa) + '</td><td>' + (l.kompatybilna ? '<span class="badge b-ok">tak</span>' : '<span class="badge b-err">nie – wykluczana</span>') + '</td><td class="small">' + esc(l.uzasadnienie) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
  });

  /* ================= WIDOK: AKCJA ================= */
  APP.widok('akcja', 'Akcja Serce na Mapie', function (main) {
    main.innerHTML = '<div class="wrap section"><p class="eyebrow">Akcja promocyjna dla potencjalnych dostawców danych</p><h1>„Serce na Mapie” – Twoje dane. Czyjeś życie.</h1>' +
      '<p class="note">Logotyp i hasło służą <b>akcji promocyjnej skierowanej do dysponentów AED</b> (gminy, szkoły, szpitale, firmy, organizacje), aby publikowali dane w dane.gov.pl. Nie są znakiem tego prototypu ani portalu.</p>' +
      '<div class="grid g2" style="margin-top:18px;align-items:center"><div class="logo-tile" style="min-height:220px"><img src="../logo/logo.svg" alt="Logotyp Serce na Mapie – serce-pinezka z linią EKG" style="max-height:170px"></div>' +
      '<div><h2>Koncepcja</h2><p>Serce jest jednocześnie <b>pinezką na mapie</b> – jego dolny wierzchołek wskazuje konkretne miejsce, a pierścień pod nim mówi „tu jest”. Linia <b>EKG</b> przecinająca serce to rytm, który AED może przywrócić, i puls danych, które muszą być aktualne. Czerwień ratunkowa i granat zaufania budują przekaz: <b>pilne, ale wiarygodne</b>. Hasło „Twoje dane. Czyjeś życie.” mówi dysponentowi wprost, że jego odpowiedzialność za dane ma ludzką konsekwencję.</p>' +
      '<div class="btns"><a class="btn btn-primary" href="../ksiega-znaku.pdf" target="_blank">Księga znaku (PDF)</a><a class="btn" href="../logo/logo.svg" download>logo.svg</a><a class="btn" href="../logo/logo.png" download>logo.png</a><a class="btn" href="../logo/logo.jpg" download>logo.jpg</a><a class="btn" href="../logo/logo.pdf" download>logo.pdf</a></div></div></div>' +
      '<h2 style="margin-top:28px">Trzy propozycje nazwy – wybór i uzasadnienie</h2><div class="grid g3">' +
      nazwa('Serce na Mapie', 'Twoje dane. Czyjeś życie.', 'Wybrana. Trzy proste słowa nazywają efekt (AED widoczny na wspólnej mapie), naturalnie przekładają się na znak (serce = pinezka) i działają jako odznaka dla dostawcy: „Nasz AED jest na mapie”.', true) +
      nazwa('Minuta Życia', 'Każda minuta bez AED odbiera 10% szans. Pokaż, gdzie jest Twój.', 'Mocny argument medyczny, ale nazwa jest ogólna (używana w wielu kampaniach zdrowotnych) i nie mówi nic o danych ani mapie.') +
      nazwa('Gdzie AED?', 'Odpowiedz, zanim ktoś zapyta.', 'Bardzo bezpośrednia, nawiązuje do historii z 3 marca. Słabsza jako marka: znak zapytania utrudnia odmianę („dołącz do Gdzie AED?”) i wygląda jak nazwa aplikacji.') +
      '</div><h2 style="margin-top:28px">Wersje znaku</h2><div class="grid g4">' +
      tile('logo.svg', 'kolor – podstawowa', '') + tile('logo-mono.svg', 'monochromatyczna', '') + tile('logo-negatyw.svg', 'negatyw', 'dark') + tile('logo-negatyw-czerwone-tlo.svg', 'negatyw na czerwieni', 'red') +
      tile('logo-pionowe.svg', 'układ pionowy', '') + tile('sygnet.svg', 'sygnet', '') + tile('sygnet-favicon.svg', 'sygnet uproszczony (≤ 24 px)', '') + tile('haslo.svg', 'hasło akcji', '') + '</div>' +
      '<h2 style="margin-top:28px">Materiały i mechanika akcji</h2><div class="grid g3" style="align-items:start">' +
      '<div><div class="sticker"><div class="in"><img src="../logo/logo.svg" alt="" style="height:54px"><p style="margin:8px 0 0;font-weight:800">Nasz AED jest na mapie</p><p class="small" style="margin:0">dane.gov.pl · #SerceNaMapie</p></div><p class="small" style="margin:10px 0 0">Naklejka na drzwi obiektu – nagroda za publikację</p></div></div>' +
      '<div class="poster"><img src="../logo/logo-negatyw.svg" alt="" style="height:56px;align-self:flex-start"><p class="big">Twoje dane.<br><span>Czyjeś życie.</span></p><p class="small" style="margin:0">Masz AED? Opublikuj dane o nim w dane.gov.pl według wzorca. To kilkanaście minut – a dla kogoś cenne minuty.<br><b>#SerceNaMapie</b></p></div>' +
      '<div class="card"><h3>Jak dotrzeć do dostawców</h3><ol class="small"><li><b>Pismo do JST i szpitali</b> (ePUAP) z gotowym wzorcem i linkiem do kreatora.</li><li><b>Odznaka „Jesteśmy Sercem na Mapie”</b> do BIP/stron www po publikacji (generowana w kreatorze).</li><li><b>Ranking gmin</b> – % AED opublikowanych wg wzorca; publiczna mapa postępu.</li><li><b>Tag SerceNaMapie</b> w dane.gov.pl – po nim agregator odnajduje zasoby.</li><li><b>Partnerzy:</b> producenci AED i serwisy dopisują do przeglądu „opublikuj w dane.gov.pl”.</li></ol></div></div></div>';
  });
  function nazwa(n, h, u, wyb) { return '<div class="name-option' + (wyb ? ' chosen' : '') + '">' + (wyb ? '<span class="badge b-ok">WYBRANA</span>' : '<span class="badge b-gray">propozycja</span>') + '<h3 style="margin-top:8px">' + n + '</h3><p><b>„' + h + '”</b></p><p class="small muted" style="margin:0">' + u + '</p></div>'; }
  function tile(f, opis, cls) { return '<figure style="margin:0"><div class="logo-tile ' + cls + '"><img src="../logo/' + f + '" alt="Logotyp – ' + opis + '"></div><figcaption class="small" style="margin-top:6px">' + opis + ' · <a href="../logo/' + f + '" download>' + f + '</a></figcaption></figure>'; }

  /* ================= WIDOK: DLA JURY ================= */
  APP.widok('jury', 'Dla jury', function (main) {
    main.innerHTML = '<div class="wrap section"><p class="eyebrow">Instrukcja (to samo co INSTRUKCJA_DLA_JURY.md)</p><h1>Dla jury – gdzie sprawdzić każde wymaganie</h1>' +
      '<p class="muted">Prototyp działa po otwarciu pliku <code>prototyp/index.html</code> (bez instalacji). Alternatywnie jedna komenda w katalogu projektu: <code>python -m http.server 8080</code> i adres <code>http://localhost:8080/prototyp/</code>.</p><ol class="jury">' +
      j('Agregacja wielu rozproszonych źródeł ze wskazaniem zakresu referencyjnego', 'Otwórz <a href="#/zbior">Wzorcowy zbiór danych</a> → tabela „Źródła i ich zakres referencyjny”. Rozwiń „raport harmonizacji”.', '10 źródeł: 4 prawdziwe zasoby dane.gov.pl (Krosno, Przemyśl, Marki, Legionowo) zintegrowane, Warszawa wykryta lecz niedostępna (API z tokenem), OSM i źródło CC BY-NC wykluczone (licencja), 3 źródła DEMO. Każde ze wskazanym zakresem terytorialnym, przedmiotowym i czasowym.') +
      j('Jeden zbiór od wszystkich dysponentów', 'W tym samym widoku: tabela „Zbiór zbiorczy”. Filtr „Źródło” i „Licencja”.', '163 rekordy w jednym zbiorze (73 rzeczywiste z dane.gov.pl + 90 DEMO), każdy z globalnym ID (REGON:id), dostawcą, zasobem źródłowym i licencją.') +
      j('Wzorcowy zakres danych (schemat)', 'Zakładka <a href="#/schemat">Wzorcowy zakres</a> + plik <code>wzorcowy-zakres-danych-AED.xlsx</code> (4 arkusze: Schemat, Przykladowe_dane, Slowniki, Walidacja).', '34 pola z typem, wymagalnością, słownikiem, przykładem i opisem; reguły R01–R20; tabela licencji. Ten sam JSON napędza walidator.') +
      j('Onboarding dostawcy z oświadczeniem o odpowiedzialności', 'Zakładka <a href="#/dostawca">Zostań dostawcą</a> – przejdź kroki 1→7. Skrót: <a href="#/dostawca?demo=bledy">otwórz kreator z plikiem z błędami</a>.', 'Krok 2 blokuje dalszą pracę bez oświadczenia; krok 5 pokazuje błędy wiersz po wierszu z autokorektą; krok 7 symuluje publikację zasobu w zbiorze instytucji i dodaje punkty do mapy.') +
      j('Walidacja na żywo', 'W kroku 5 popraw dowolną komórkę w tabeli (np. kod pocztowy „35100”) lub kliknij „Popraw automatycznie”.', 'Licznik błędów i podświetlenia aktualizują się natychmiast; publikacja odblokowuje się przy 0 błędów.') +
      j('Mapa AED z filtrami i kartą AED', 'Zakładka <a href="#/mapa">Mapa AED</a>: filtry statusu, 24/7, weryfikacji, dostawcy; kliknij punkt.', 'Karta zawiera wszystkie pola wzorca, źródło (link do zasobu dane.gov.pl), licencję, zakres referencyjny, datę weryfikacji i wynik walidacji.') +
      j('Widok dla służb – najbliższy działający AED', 'Zakładka <a href="#/sluzby">Dla służb</a> (domyślnie: Sejm RP, ul. Wiejska 4).', 'Lista 10 AED wg odległości z czasem dojścia, godzinami, stanem „dostępny teraz” i informacją o kodzie.') +
      j('Licencje', 'W <a href="#/zbior">Zbiorze</a> filtr „Licencja” i kolumna „Zgodność / w zbiorze”; na <a href="#/mapa">Mapie</a> włącz „pokaż rekordy spoza zbioru”.', 'Rekordy CC BY-NC (DEMO) i OSM (ODbL) oznaczone jako niekompatybilne i wyłączone z agregatu i eksportu; licencja źródłowa zachowana przy każdym rekordzie.') +
      j('Formaty maszynowo czytelne', 'W <a href="#/zbior">Zbiorze</a> przyciski CSV / XLSX / JSON / GeoJSON / datapackage.json.', 'Pliki pobierają się natychmiast; brak PDF/DOC dla danych.') +
      j('Nazwa akcji, hasło, logotyp, księga znaku', 'Zakładka <a href="#/akcja">Akcja</a>; pliki <code>logo/logo.svg|png|jpg|pdf</code> i <code>ksiega-znaku.pdf</code>.', '3 propozycje nazw z uzasadnieniem wyboru, wersje kolor/mono/negatyw, materiały kampanii; księga z kolorami HEX/RGB/CMYK, polem ochronnym, minimalną wielkością i 6 przykładami niedozwolonego użycia.') +
      j('WCAG 2.1 AA i responsywność', 'Nawiguj klawiszem Tab (link „Przejdź do treści”), zmniejsz okno do szerokości telefonu.', 'Widoczny fokus, kontrast ≥ 4,5:1, etykiety pól, lista jako alternatywa mapy, menu mobilne.') +
      '</ol></div>';
  });
  function j(t, gdzie, ocz) { return '<li><h3>' + t + '</h3><p class="small" style="margin:0">' + gdzie + '</p><p class="expected"><b>Oczekiwany rezultat:</b> ' + ocz + '</p></li>'; }

  /* ---------- start ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    $('.menu-btn').onclick = function () { var n = $('.nav'); n.classList.toggle('open'); this.setAttribute('aria-expanded', String(n.classList.contains('open'))); };
    window.addEventListener('hashchange', route);
    route();
  });
})();
