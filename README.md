# Misja AED – Dane na ratunek

**Prototyp zespołu Zapachowy (1 osoba) na HackNation 2026 – zadanie Ministerstwa Cyfryzacji / dane.gov.pl.**

Rozwiązanie pomaga zebrać w **dane.gov.pl** ogólnopolski, otwarty i możliwie aktualny zbiór danych o defibrylatorach AED – **bez zmieniania mechaniki portalu i bez wgrywania danych za dostawców**. Dane publikuje dostawca (dysponent AED), który bierze za nie odpowiedzialność. My dostarczamy:

1. **Wzorcowy zakres danych** – 34 pola, słowniki, 20 reguł walidacji (`wzorcowy-zakres-danych-AED.xlsx`, `schemat/aed-schema.json`).
2. **Walidację i standaryzację** – ten sam walidator dla dostawców i dla agregatora (jeden kod, jedna prawda).
3. **Onboarding dostawcy** – kreator w 7 krokach z oświadczeniem o odpowiedzialności za dane.
4. **Agregację** – jeden zbiór zbiorczy z wielu zasobów, z zakresem referencyjnym źródeł, kontrolą licencji i deduplikacją.
5. **Akcję promocyjną „Serce na Mapie” – „Twoje dane. Czyjeś życie.”** – nazwa, hasło, logotyp i księga znaku dla dysponentów AED.

> **Wersja online (GitHub Pages): https://wiezawieza.github.io/misja-aed-hacknation-2026/** – prototyp otwiera się od razu w przeglądarce, bez instalacji. Prezentacja: [/prezentacja/](https://wiezawieza.github.io/misja-aed-hacknation-2026/prezentacja/).

> Szybki start lokalnie: otwórz `prototyp/index.html` (bez instalacji) albo uruchom `npm start` / `py -m http.server 8080` i wejdź na `http://localhost:8080/prototyp/`. Kroki dla jury: [INSTRUKCJA_DLA_JURY.md](INSTRUKCJA_DLA_JURY.md).

---

## Problem, który sprawdziliśmy w praktyce

3 marca w Warszawie fotograf sejmowy doznał zatrzymania krążenia, a świadkowie nie wiedzieli, gdzie jest działający i dostępny AED. Każda minuta bez defibrylacji zmniejsza szansę przeżycia nawet o ok. 10%.

Zapytanie API dane.gov.pl (`/1.4/datasets?q=defibrylator`, 21.11.2026) zwraca **4 zbiory w całym portalu** – i każdy pokazuje inny problem:

| Dostawca | Zasób | Co znaleźliśmy |
|---|---|---|
| Urząd Miasta Krosna (CC0 1.0) | CSV, 21 AED | kolejność „długość, szerokość”, adres + kod + miasto w jednej kolumnie, spacje w nagłówkach |
| Urząd Miejski w Przemyślu (CC0 1.0) | CSV/GeoJSON, 21 AED | separator `;`, BOM, współrzędne jako JSON w kolumnie, ten sam ogólny opis w każdym rekordzie |
| Urząd Miasta Marki (CC BY 4.0) | CSV/XLSX, 8 AED | plik niezgodny z RFC 4180 – **API portalu widzi cały wiersz jako jedną kolumnę**; zamienione współrzędne; AED „z Marek” ma współrzędne z Krosna (293 km) |
| Urząd Miasta Legionowo (CC0 1.0) | CSV, 24 AED | zasób z 2026 r. **ukryty w ogólnym zbiorze „Zdrowie”** – wyszukiwanie „defibrylator” go nie zwraca (znaleziony dopiero przez wyszukiwanie zasobów); dobre pola adresowe, ale 6-cyfrowy „kod_terc” zamiast 7-cyfrowego TERYT |
| Urząd m.st. Warszawy (CC BY 4.0) | link | zasób prowadzi do API z **obowiązkowym tokenem** – brak anonimowego pobrania |

W żadnym źródle nie ma statusu urządzenia, godzin dostępności, informacji o kodzie do szafki ani daty kontroli. Dlatego potrzebny jest **wzorzec + walidacja przed publikacją + agregacja**.

## Zgodność z dane.gov.pl

| Pojęcie portalu | Jak używamy | Gdzie w prototypie |
|---|---|---|
| **Instytucja (dostawca)** | Dysponent AED ma konto instytucji (typy jak w API: `local`, `state`, `private`, `other`), składa oświadczenie o odpowiedzialności | Kreator, kroki 1–2 |
| **Zbiór danych** | Zbiór dostawcy: kategoria Zdrowie (HEAL), słowa kluczowe (w tym `SerceNaMapie`), częstotliwość aktualizacji, licencja | Kreator, krok 3 i 6 |
| **Zasób** | Plik CSV (UTF-8) zgodny ze wzorcem lub import automatyczny (harwester) | Kreator, krok 6–7 |
| **API i dane tabelaryczne** | Format odpowiedzi odwzorowany z prawdziwego `GET api.dane.gov.pl/1.4/resources/68355/data` (JSON:API, `meta.headers_map`, `meta.data_schema` w Table Schema) | Krok 7, „Wzorcowy zbiór” |
| **Licencje** | CC BY 4.0 dla zbioru zbiorczego, licencja źródłowa przy rekordzie; niekompatybilne wykluczane | Wszędzie (filtry, karta, eksport) |
| **Stopień otwartości** | CSV/JSON = 3★; nie przyjmujemy PDF/DOC | Krok 6, eksport |
| **„Zgłoś uwagę”** | Odbiorca zgłasza błąd do dostawcy zasobu (symulacja) | Karta AED |
| **Data weryfikacji** | `verified` zbioru z API portalu + `data_ostatniej_kontroli` rekordu | Karta AED |

**Precedens w portalu – ten sam model już działa.** W bazie wiedzy dane.gov.pl („Przydatne materiały”) są „Udostępnianie danych dotyczących cen mieszkań – informacje dla deweloperów” i „Wzorcowe dokumenty elektroniczne służące do realizacji obowiązków deweloperów mieszkaniowych”, a także „Udostępnianie danych dotyczących rzeczy znalezionych – wskazówki dla starostów”. Sprawdziliśmy przez API (21.11.2026): w portalu jest **15 255 zbiorów** z frazą „ceny ofertowe mieszkań” w tytule (`/1.4/datasets?title[phrase]=…`), publikowanych przez deweloperów – każdy jako **osobna instytucja-dostawca** (typ instytucji `developer`; takich instytucji jest w portalu **6 971**, licencja CC0 1.0, aktualizacja „Codziennie”) według jednego wzorca. Misja AED przenosi ten sprawdzony mechanizm na dysponentów AED: wzorcowy zakres danych + wielu dostawców publikujących własne zbiory + agregacja przez API. Korzystaliśmy też z materiałów „Standardy otwartości danych”, „Przewodnik dla dostawców danych” i „Dane osobowe w portalu danych” (stąd m.in. zakaz danych osobowych i kodów do szafek w oświadczeniu).

**Zasada nadrzędna:** prototyp niczego nie publikuje w produkcyjnym portalu. Publikacja w kroku 7 jest symulacją – w rzeczywistości dostawca dodaje plik w swoim panelu instytucji (lub konfiguruje harwester), a agregator pobiera zasoby przez publiczne API. Agregator **nie poprawia merytorycznie danych dostawcy** – oznacza błędy i odsyła je do dostawcy.

## WYKAZ AED w portalu dane.gov.pl

Jako dopełnienie prototypu przygotowaliśmy pełną integrację Ogólnopolskiego Wykazu AED bezpośrednio w oficjalnym kodzie źródłowym portalu **dane.gov.pl** (MCOD – frontend Angular 18 + backend Python/Django).

🔗 **Osobne repozytorium z działającym portalem:** **https://github.com/wiezawieza/misja-aed-portal-wykaz**  
📖 **Szczegółowy raport i opis integracji:** [WYKAZ-INTEGRACJA.md](WYKAZ-INTEGRACJA.md)

### Kluczowe komponenty portalu wykorzystane w integracji:
- **`DgaInformationPointTableComponent`** (`frontend/src/app/pages/dga-information-point/...`) – komponent tabelaryczny portalu odpowiedzialny za prezentację wykazów wielokolumnowych (osadzający `<app-resource-table-no-filters>`). Na jego wzorcu wdrożono dedykowany widok Wykazu AED (34 kolumny wzorcowe, 163 rekordy, filtry i wyszukiwanie na żywo).
- **`DgaService.getDgaAggregatedData()`** (`frontend/src/app/services/dga.service.ts`) – metoda serwisu frontendowego pobierająca zagregowane dane tabelaryczne z API portalu do widoku wykazu.
- **`create_main_dga_df()`** (`backend/mcod/resources/dga_utils.py`) – kluczowa metoda backendowa łącząca i harmonizująca rozproszone zbiory danych opublikowane przez różne instytucje w jeden spójny DataFrame (`AggregatedDGAInfo`).
- **`create_main_dga_resource_task`** (`backend/mcod/resources/tasks/dga.py`) – zadanie asynchroniczne Celery realizujące cykliczną agregację zasobów od dostawców.

## Funkcjonalności i kroki użytkownika

### Start (landing akcji) – `#/`
Problem (minuta życia, historia z 3 marca), liczniki zbioru zbiorczego (AED, dostawcy, zweryfikowane), mapa, baner akcji „Serce na Mapie” z wezwaniem dla dysponentów, schemat działania z podziałem: mechanizmy portalu vs nasze rozwiązanie.

### Mapa AED – `#/mapa`
1. Ustaw filtry: status (aktywny / w serwisie / nieaktywny / brak danych), 24/7, dostęp publiczny, zweryfikowane / niezweryfikowane, dostawca.
2. Kliknij punkt – karta AED: wszystkie pola wzorca, źródło (zbiór i zasób w dane.gov.pl), licencja, zakres referencyjny, data weryfikacji, „dostępny teraz”, wynik walidacji, „Zgłoś uwagę dostawcy”, „Prowadź do AED”.
3. „Widok listy” – tekstowa alternatywa mapy (dostępność).

### Zostań dostawcą danych – `#/dostawca`
1. **Organizacja** – nazwa, typ instytucji, REGON (suma kontrolna), e-mail, osoba odpowiedzialna.
2. **Oświadczenie** – 6 punktów (prawo do danych, odpowiedzialność za poprawność i aktualność w zakresie referencyjnym, aktualizacja statusu w 3 dni robocze, obsługa uwag, brak danych osobowych i kodów, licencja zgodnie z ustawą o otwartych danych) + podpis. Bez tego nie można przejść dalej.
3. **Zbiór i zakres** – tytuł, opis, częstotliwość, licencja (niekompatybilne zablokowane), zakres referencyjny (terytorium + rodzaje obiektów), sposób publikacji (plik / harwester).
4. **Plik** – CSV lub XLSX (przeciągnij lub wybierz); rozpoznaje aliasy kolumn, średnik, Windows-1250, wybiera właściwy arkusz XLSX. Przykłady: z błędami i poprawny.
5. **Walidacja na żywo** – błędy wiersz po wierszu (kod reguły, pole, komunikat), edycja komórek z natychmiastowym przeliczeniem, autokorekta (pojedynczo lub zbiorczo). Publikacja możliwa przy 0 błędów.
6. **Podgląd** – mapa punktów, metadane w strukturze dane.gov.pl, kompletność, zweryfikowane AED, stopień otwartości; pobranie znormalizowanego CSV i raportu walidacji.
7. **Publikacja (symulacja)** – etapy portalu, karta zasobu z nazwą dostawcy, odpowiedź API, dodanie punktów do zbioru zbiorczego, odznaka „Jesteśmy Sercem na Mapie”.

### Wzorcowy zbiór danych – `#/zbior`
Rejestr źródeł (status integracji, licencja, zakres referencyjny, raport harmonizacji, jakość), tabela zbioru zbiorczego z filtrami (źródło, licencja, wyszukiwarka), eksport CSV / XLSX / JSON / GeoJSON / `datapackage.json`, podgląd API zbioru.

### Dla służb ratowniczych – `#/sluzby`
Miejsce zdarzenia (gotowe punkty, w tym Sejm RP; geolokalizacja; klik w mapę) → 10 najbliższych AED bez nieaktywnych i serwisowanych, z odległością, czasem dojścia (w jedną stronę i tam i z powrotem), godzinami, stanem „dostępny teraz”, kodem do szafki, weryfikacją.

### Wzorcowy zakres – `#/schemat`, Akcja – `#/akcja`, Dla jury – `#/jury`
Tabela wzorca generowana z JSON, reguły, licencje i pliki do pobrania; strona akcji z koncepcją, 3 propozycjami nazw, wersjami znaku i materiałami; instrukcja dla jury.

## Akcja „Serce na Mapie”

| Propozycja | Hasło | Ocena |
|---|---|---|
| **Serce na Mapie** | **Twoje dane. Czyjeś życie.** | **wybrana** |
| Minuta Życia | Każda minuta bez AED odbiera 10% szans. Pokaż, gdzie jest Twój. | mocny argument, ale nazwa ogólna i bez związku z danymi |
| Gdzie AED? | Odpowiedz, zanim ktoś zapyta. | bezpośrednia, słaba jako marka |

**Koncepcja:** serce jest jednocześnie pinezką na mapie – jego wierzchołek wskazuje konkretne miejsce, a pierścień pod nim mówi „tu jest AED”. Linia EKG to rytm, który defibrylator może przywrócić, i puls aktualnych danych. Czerwień ratunkowa i granat zaufania łączą pilność z wiarygodnością. Hasło mówi dysponentowi wprost, że jego odpowiedzialność za dane ma ludzką konsekwencję. Mechanika akcji: pismo do JST i szpitali z linkiem do kreatora, naklejka „Nasz AED jest na mapie”, odznaka do BIP, ranking gmin, tag `SerceNaMapie` w dane.gov.pl, partnerstwo z serwisami AED.

Pliki: `logo/` (SVG z tekstem zamienionym na krzywe, PNG, JPG, PDF; wersje mono, czarna, negatyw, pionowa, sygnet, hasło), `ksiega-znaku.pdf`. Krój: Poppins (SIL OFL 1.1).

## Dane w prototypie

- **Rzeczywiste (73 rekordy w zbiorze zbiorczym):** zasoby dane.gov.pl Krosna (21), Przemyśla (21), Marek (8, z czego 1 odrzucony jako punkt odstający) i Legionowa (24). Surowe pliki i metadane z API: `dane/zrodla-surowe/`.
- **DEMO (syntetyczne, wyraźnie oznaczone, 90 + 12 rekordów):** fikcyjni dostawcy „Fundacja Bicie Serca (DEMO)”, „Sieć sklepów Koszyk (DEMO)”, „Powiatowe Centrum Medyczne (DEMO)” oraz „Stowarzyszenie Ratujmy Razem (DEMO)” na licencji CC BY-NC (pokazuje wykluczenie licencyjne). Każdy rekord DEMO ma w uwagach „REKORD DEMONSTRACYJNY – dane syntetyczne, nie używać operacyjnie”.
- **OpenStreetMap (ODbL):** tylko konektor (warstwa pomocnicza poza zbiorem), **świadomie bez danych** – licencja ODbL (share-alike) jest niezgodna z CC BY 4.0 zbioru zbiorczego.

## Struktura repozytorium

```
prototyp/                 aplikacja (HTML/CSS/JS bez kroku budowania, działa z file://)
  js/walidator.js         walidator sterowany schematem (reguły R01–R20)
  js/agregator.js         agregacja: walidacja, licencje, krytyczne błędy, deduplikacja
  js/app.js, kreator.js   widoki i kreator dostawcy
  js/dane/*.js            dane wygenerowane z narzedzia/zbuduj_dane.py
  vendor/                 Leaflet 1.9.4 (BSD-2), SheetJS CE 0.20.3 (Apache-2.0)
schemat/                  aed-schema.json (jedno źródło prawdy), szablon i przykład CSV
dane/zrodla-surowe/       surowe zasoby z dane.gov.pl + metadane API
logo/                     logotyp i warianty (SVG/PNG/JPG/PDF)
prezentacja/              slajdy HTML + PDF (10 slajdów) + zrzuty ekranu
narzedzia/                skrypty: zbuduj_dane.py, generuj_xlsx.py, generuj_logo.py, generuj_ksiege.py, zrzuty*.py, serwer.mjs
WYKAZ-INTEGRACJA.md       raport z integracji Wykazu AED z kodem źródłowym portalu dane.gov.pl
```

Odtworzenie artefaktów (opcjonalne, Python 3.11 + `pip install openpyxl pillow fonttools`): `py narzedzia/zbuduj_dane.py`, `py narzedzia/generuj_xlsx.py`, `py narzedzia/generuj_logo.py`, `py narzedzia/generuj_ksiege.py`.

## Ograniczenia

Skrót: publikacja w portalu jest symulowana (celowo), część danych to DEMO, agregator działa na migawce danych pobranej skryptem, warstwa OSM to konektor bez danych (ODbL), dostępność sprawdzona ręcznie (bez testów z czytnikiem ekranu). Pełna lista: [OGRANICZENIA.md](OGRANICZENIA.md).

## Wykorzystanie AI

Zgodnie z regulaminem: przy przygotowaniu rozwiązania korzystaliśmy z asystenta AI (generowanie i przegląd kodu, redakcja tekstów, wsparcie przy projektowaniu znaku). Koncepcja, decyzje projektowe, weryfikacja danych i finalna praca są autorskim rozwiązaniem zespołu **Zapachowy** (1 osoba).

## Licencje

Kod i dokumentacja prototypu: CC BY 4.0. Dane źródłowe: zgodnie z licencjami zasobów (CC0 1.0 – Krosno, Przemyśl, Legionowo; CC BY 4.0 – Marki). Podkład mapy: © współtwórcy OpenStreetMap (ODbL). Biblioteki: Leaflet (BSD-2-Clause), SheetJS Community Edition (Apache-2.0). Krój Poppins: SIL Open Font License 1.1 (`narzedzia/fonty/OFL.txt`).
