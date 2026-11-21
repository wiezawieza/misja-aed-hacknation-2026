/* Agregator: łączy rekordy z wielu zasobów (dostawców) w JEDEN zbiór zbiorczy.
 * Kolejność: walidacja (ten sam walidator co w kreatorze) → licencja → błędy krytyczne → deduplikacja
 * między źródłami (pierwszeństwo ma źródło referencyjne dla danego terytorium) → statystyki.
 * Agregator NIE zmienia danych dostawcy – oznacza je i raportuje (odpowiedzialność zostaje u dostawcy). */
(function () {
  'use strict';
  var V = window.WALIDATOR;

  function wZakresie(r, z) {
    var t = String((z.zakres_referencyjny || {}).terytorialny || '').toLowerCase();
    return !!r.miejscowosc && t.indexOf(String(r.miejscowosc).toLowerCase()) >= 0;
  }

  function zbuduj(opublikowane) {
    opublikowane = opublikowane || [];
    var zrodla = window.ZRODLA.concat(opublikowane.map(function (p) { return p.zrodlo; }));
    var zr = {}; zrodla.forEach(function (z) { zr[z.id] = z; });
    var rek = window.REKORDY.map(function (r) { return Object.assign({}, r); });
    opublikowane.forEach(function (p) { p.rekordy.forEach(function (r) { rek.push(Object.assign({}, r, { _zrodlo: p.zrodlo.id })); }); });

    // walidacja w obrębie zasobu (reguły zbiorowe działają per zasób, jak u dostawcy)
    var wgZr = {};
    rek.forEach(function (r) { (wgZr[r._zrodlo] = wgZr[r._zrodlo] || []).push(r); });
    Object.keys(wgZr).forEach(function (id) {
      var lista = wgZr[id], w = V.walidujZbior(lista);
      lista.forEach(function (r, i) { r._problemy = w.wgWiersza[i + 1] || []; });
      zr[id]._jakosc = { bledy: w.bledy, ostrzezenia: w.ostrzezenia, rekordyZBledami: lista.filter(function (r) { return r._problemy.some(function (p) { return p.poziom === 'blad'; }); }).length };
    });

    rek.forEach(function (r) {
      var z = zr[r._zrodlo];
      r._z = z;
      r._bledy = r._problemy.filter(function (p) { return p.poziom === 'blad'; });
      r._ostrz = r._problemy.filter(function (p) { return p.poziom === 'ostrzezenie'; });
      r._krytyczny = r._bledy.some(function (p) { return (p.pole && V.POLE[p.pole] && V.POLE[p.pole].krytyczne) || p.kod === 'R14'; });
      r._zgodnosc = r._bledy.length ? 'czesciowa' : 'pelna';
      r._licencjaOk = V.licencjaKompatybilna(r.licencja);
      r._zweryfikowany = V.czyZweryfikowany(r);
      r._lat = Number(r.szerokosc_geograficzna); r._lon = Number(r.dlugosc_geograficzna);
      r._id = (r.regon_dostawcy || (z.instytucja && z.instytucja.id) || z.id) + ':' + r.id;
      r._demo = !!z.demo;
      var powod = '';
      if (z.status_integracji === 'wykluczono_licencja' || !r._licencjaOk) powod = 'licencja ' + r.licencja + ' niekompatybilna z CC BY 4.0';
      else if (z.status_integracji !== 'zintegrowano') powod = z.powod || 'źródło niezintegrowane';
      else if (r._krytyczny) powod = 'błąd krytyczny: ' + r._bledy.filter(function (p) { return (p.pole && V.POLE[p.pole] && V.POLE[p.pole].krytyczne) || p.kod === 'R14'; }).map(function (p) { return p.komunikat; }).join(' ');
      r._wAgregacie = !powod;
      r._powod = powod;
    });

    // deduplikacja między źródłami: < 10 m i różne zasoby
    var siatka = {}, dup = 0;
    rek.filter(function (r) { return r._wAgregacie; }).forEach(function (r) {
      var gx = Math.floor(r._lat / 0.0002), gy = Math.floor(r._lon / 0.0002), konflikt = null;
      for (var dx = -1; dx <= 1 && !konflikt; dx++) for (var dy = -1; dy <= 1 && !konflikt; dy++) {
        (siatka[(gx + dx) + ':' + (gy + dy)] || []).forEach(function (o) {
          if (!konflikt && o._zrodlo !== r._zrodlo && V.haversine(r._lat, r._lon, o._lat, o._lon) < 10) konflikt = o;
        });
      }
      if (konflikt) {
        var pr = function (x) { return (wZakresie(x, x._z) ? 4 : 0) + (x._zweryfikowany ? 2 : 0) + (x.data_aktualizacji > (x === r ? konflikt : r).data_aktualizacji ? 1 : 0); };
        var przegrany = pr(r) > pr(konflikt) ? konflikt : r, wygrany = przegrany === r ? konflikt : r;
        przegrany._wAgregacie = false; przegrany._duplikatZ = wygrany._id; przegrany._powod = 'duplikat rekordu ' + wygrany._id + ' (pierwszeństwo: źródło referencyjne dla terytorium / nowsza weryfikacja)';
        dup++;
        if (przegrany === r) return;
      }
      var k = gx + ':' + gy; (siatka[k] = siatka[k] || []).push(r);
    });

    var wA = rek.filter(function (r) { return r._wAgregacie; });
    var dost = {}; wA.forEach(function (r) { dost[r.dostawca] = 1; });
    zrodla.forEach(function (z) {
      z._wAgregacie = wA.filter(function (r) { return r._zrodlo === z.id; }).length;
      z._wszystkie = rek.filter(function (r) { return r._zrodlo === z.id; }).length || z.liczba_rekordow || 0;
    });
    return {
      rekordy: rek, zrodla: zrodla, wAgregacie: wA,
      stat: {
        aed: wA.length, dostawcow: Object.keys(dost).length, zweryfikowanych: wA.filter(function (r) { return r._zweryfikowany; }).length,
        aktywnych: wA.filter(function (r) { return r.status === 'aktywny'; }).length,
        realnych: wA.filter(function (r) { return !r._demo; }).length,
        zgodnychWzorca: wA.filter(function (r) { return r._zgodnosc === 'pelna'; }).length,
        wykluczonychLic: rek.filter(function (r) { return !r._licencjaOk; }).length + (window.OSM_AED || []).length,
        odrzuconych: rek.filter(function (r) { return r._krytyczny && r._licencjaOk; }).length, duplikatow: dup,
        zrodelWykrytych: zrodla.length, zrodelZintegrowanych: zrodla.filter(function (z) { return z.status_integracji === 'zintegrowano'; }).length,
        osm: (window.OSM_AED || []).length
      }
    };
  }
  window.AGREGATOR = { zbuduj: zbuduj };
})();
