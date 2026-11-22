# Instrukcja dla jury – Misja AED (zespół Zapachowy)

Ten sam tekst jest w prototypie, w zakładce **„Dla jury”** (`prototyp/index.html#/jury`).
Nie trzeba niczego instalować ani konfigurować.

## Gdzie co jest

| Plik / katalog | Zawartość |
|---|---|
| `prototyp/index.html` | **Klikalny prototyp** (otwórz w przeglądarce) |
| `wzorcowy-zakres-danych-AED.xlsx` | Wzorcowy zakres danych: arkusze Schemat, Przykladowe_dane, Slowniki, Walidacja |
| `schemat/aed-schema.json` | Ten sam wzorzec w formie maszynowej (Frictionless Table Schema) – **jedno źródło prawdy** dla walidatora i pliku XLSX |
| `schemat/szablon-AED.csv`, `schemat/przyklad-AED.csv` | Pusty szablon CSV i przykład zgodny ze wzorcem |
| `logo/logo.svg`, `logo.png`, `logo.jpg`, `logo.pdf` | Logotyp akcji „Serce na Mapie” (+ wersje mono, negatyw, pionowa, sygnet) |
| `ksiega-znaku.pdf` | Księga znaku (8 stron) |
| `prezentacja/index.html`, `prezentacja/prezentacja.pdf` | Prezentacja (10 slajdów) z prawdziwymi zrzutami ekranu |
| `README.md`, `OGRANICZENIA.md` | Opis rozwiązania i uczciwa lista ograniczeń |
| `WYKAZ-INTEGRACJA.md` | Raport z integracji Wykazu AED z kodem źródłowym portalu dane.gov.pl (MCOD); repozytorium: https://github.com/wiezawieza/misja-aed-portal-wykaz |
| `dane/zrodla-surowe/` | Surowe pliki pobrane z API dane.gov.pl (dowód, że agregujemy prawdziwe zasoby) |

## Kroki

### 1. Uruchom prototyp
Wybierz **jeden** sposób:
- **A (najprościej, zero instalacji):** kliknij dwukrotnie `prototyp/index.html` (otwiera się od razu w przeglądarce).
- **B (Windows, jedno kliknięcie):** `URUCHOM.bat` – uruchomi serwer (Node.js lub Python, jeśli są) albo otworzy plik bezpośrednio.
- **C (jedna komenda):** w katalogu projektu `npm start` (Node.js, **bez** `npm install` – serwer bez zależności) lub `py -m http.server 8080`, a potem adres `http://localhost:8080/prototyp/`.

**Oczekiwany rezultat:** strona „Każda minuta bez defibrylacji…”, liczniki (163 AED w zbiorze zbiorczym, w tym 73 rzeczywiste z dane.gov.pl i 90 DEMO; 7 dostawców; 52 zweryfikowane), mapa Polski z punktami. Mapa podkładowa wymaga internetu; bez internetu punkty i wszystkie funkcje działają nadal.

### 2. Agregacja wielu rozproszonych źródeł ze wskazaniem zakresu referencyjnego
Zakładka **„Wzorcowy zbiór”** → tabela **„Źródła i ich zakres referencyjny”**. Rozwiń „raport harmonizacji” przy każdym źródle.

**Oczekiwany rezultat:** 10 źródeł. Cztery **prawdziwe** zasoby z dane.gov.pl (Urząd Miasta Krosna, Urząd Miejski w Przemyślu, Urząd Miasta Marki, Urząd Miasta Legionowo) – zintegrowane, z linkami do zbiorów w portalu. Urząd m.st. Warszawy – wykryty, ale **niedostępny** (zasób to API z obowiązkowym tokenem). Stowarzyszenie (CC BY-NC) i OpenStreetMap (ODbL) – **wykluczone** z powodu licencji. Trzy źródła **DEMO** (syntetyczne, oznaczone). Każde źródło ma zakres terytorialny, przedmiotowy i czasowy.

### 3. Jeden zbiór od wszystkich dysponentów
W tym samym widoku: sekcja **„Zbiór zbiorczy – przeglądanie i eksport”**. Użyj filtrów **Źródło** i **Licencja**, wyszukiwarki i stronicowania. Kliknij globalny ID rekordu.

**Oczekiwany rezultat:** wszystkie rekordy w jednej tabeli; każdy ma globalny identyfikator `REGON:id`, dostawcę, licencję i ocenę zgodności ze wzorcem; klik przenosi do karty AED na mapie.

### 4. Wzorcowy zakres danych (schemat)
Otwórz `wzorcowy-zakres-danych-AED.xlsx` oraz zakładkę **„Wzorcowy zakres”**.

**Oczekiwany rezultat:** 34 kolumny z typem, wymagalnością (wymagane / zalecane / opcjonalne), słownikiem, przykładem i opisem; 20 przykładowych wierszy z listami rozwijanymi; słowniki (status, dostępność, licencje z kompatybilnością, województwa, kategorie obiektów); reguły walidacji R01–R20. Tabela w prototypie jest generowana z `schemat/aed-schema.json` – z tego samego pliku generowany jest XLSX i działa walidator.
**Sprawdzenie „jeden kod, jedna prawda”:** wgraj arkusz XLSX w kreatorze (krok 4) – 20 przykładowych wierszy przechodzi walidację z **0 błędów**.

### 5. Onboarding dostawcy z oświadczeniem o odpowiedzialności
Zakładka **„Zostań dostawcą”**. Krok 1: kliknij „Wypełnij danymi DEMO” → Dalej. Krok 2: zaznacz punkty oświadczenia i podpisz → Dalej. Krok 3: uzupełnij terytorium → Dalej. Krok 4: „Użyj przykładu z typowymi błędami”.

**Oczekiwany rezultat:** bez kompletnego oświadczenia przycisk „Dalej” jest zablokowany; REGON jest sprawdzany sumą kontrolną; licencje niekompatybilne są nieaktywne do wyboru.
*Skrót:* `prototyp/index.html#/dostawca?demo=bledy` otwiera od razu krok 5 z wczytanym plikiem z błędami.

### 6. Walidacja na żywo, wiersz po wierszu
Krok 5 kreatora. Kliknij **„Popraw automatycznie (6)”**, potem popraw w tabeli pozostałe komórki (np. status „sprawny” → „aktywny”, pusta nazwa, zduplikowany id, punkt w złym mieście, brak godzin).

**Oczekiwany rezultat:** 11 błędów i 1 ostrzeżenie (przecinek dziesiętny, zamienione współrzędne, zły kod pocztowy, status spoza słownika, brak godzin, data DD.MM.RRRR, „TAK”, duplikat id, punkt 290 km od miejscowości, brak nazwy, telefon, licencja niekompatybilna). Liczniki i podświetlenia zmieniają się po każdej zmianie komórki; przy 0 błędów odblokowuje się „Dalej”.

### 7. Podgląd i symulacja publikacji jako zasób w dane.gov.pl
Krok 6 (podgląd: mapa punktów, metadane zbioru, kompletność, stopień otwartości, pobranie znormalizowanego CSV) → krok 7 → **„Opublikuj zasób jako … (symulacja)”**.

**Oczekiwany rezultat:** kolejne etapy portalu (zbiór danych → zasób → przetworzenie danych tabelarycznych → zgłoszenie do agregatora), karta zasobu z nazwą organizacji-dostawcy, licencją, odpowiedzialnością, przykładowym adresem i odpowiedzią API w formacie `api.dane.gov.pl`. Przycisk „Zobacz swoje AED na mapie” pokazuje nowe punkty w zbiorze zbiorczym. Odznaka „Jesteśmy Sercem na Mapie” do pobrania.

### 8. Mapa AED z filtrami i kartą AED
Zakładka **„Mapa AED”**. Filtry: status (aktywny / w serwisie / nieaktywny / brak danych), tylko 24/7, dostęp publiczny, zweryfikowane / niezweryfikowane, dostawca. Kliknij punkt. Przycisk „Widok listy” to dostępna alternatywa mapy.

**Oczekiwany rezultat:** karta AED ze **wszystkimi polami wzorca**, źródłem (link do zbioru i zasobu w dane.gov.pl), licencją, zakresem referencyjnym, **datą weryfikacji**, informacją „dostępny teraz” i wynikiem walidacji rekordu. Oznaczenia DEMO / dane rzeczywiste.

### 9. Licencje
Zakładka „Wzorcowy zbiór” → filtr **Licencja** = `CC-BY-NC-4.0` i zaznacz „pokaż także rekordy spoza zbioru”. Na mapie zaznacz „pokaż rekordy spoza zbioru”.

**Oczekiwany rezultat:** licencja zbioru zbiorczego **CC BY 4.0**, licencja źródłowa zachowana przy każdym rekordzie. Rekordy CC BY-NC (12) są oznaczone jako niekompatybilne, widoczne tylko po włączeniu opcji i **nie trafiają do eksportu**. Tabela kompatybilności licencji (CC0, CC BY – tak; CC BY-SA, NC, ND, ODbL – nie) jest w zakładce „Wzorcowy zakres” i w arkuszu Slowniki.

### 10. Formaty maszynowo czytelne
Zakładka „Wzorcowy zbiór” → przyciski **CSV / XLSX / JSON / GeoJSON / datapackage.json**.

**Oczekiwany rezultat:** natychmiastowe pobranie plików z rekordami zbioru zbiorczego (pola wzorca + pola agregatora: zasób źródłowy, zakres referencyjny, weryfikacja, zgodność licencji). Brak PDF/DOC dla danych.

### 11. Widok dla służb – najbliższy działający AED
Zakładka **„Dla służb”** (domyślnie: Sejm RP, ul. Wiejska 4). Wybierz inne miejsce, „Moja lokalizacja” lub kliknij mapę; włącz „tylko dostępne teraz”.

**Oczekiwany rezultat:** 10 najbliższych AED (bez nieaktywnych i w serwisie) posortowanych po odległości, z czasem dojścia i „tam i z powrotem”, godzinami, stanem „dostępny teraz”, informacją o kodzie do szafki i statusie weryfikacji.

### 12. Nazwa akcji, hasło, logotyp, księga znaku
Zakładka **„Akcja”**, pliki `logo/` i `ksiega-znaku.pdf`.

**Oczekiwany rezultat:** 3 propozycje nazw z hasłami i uzasadnieniem wyboru („Serce na Mapie – Twoje dane. Czyjeś życie.”); logotyp wektorowy (serce-pinezka z linią EKG) w wersjach kolor / mono / czarna / negatyw / pionowa / sygnet; eksporty SVG, PNG, JPG, PDF; księga znaku z koncepcją, kolorami HEX/RGB/CMYK, polem ochronnym, minimalną wielkością i 8 przykładami niedozwolonego użycia; materiały akcji (naklejka, plakat, odznaka, post). Logo służy **akcji dla dostawców danych**, a nie prototypowi.

### 13. WCAG 2.1 AA i responsywność
Naciśnij **Tab** na początku strony (pojawi się „Przejdź do treści”), poruszaj się klawiaturą; zwęź okno do szerokości telefonu (lub tryb urządzenia w DevTools, 375 px).

**Oczekiwany rezultat:** widoczny fokus, etykiety pól, komunikaty walidacji ogłaszane (`aria-live`), status przekazany tekstem i kolorem, kontrast ≥ 4,5:1, menu mobilne, brak przewijania w poziomie, karta AED zamykana Esc.

### 14. Zgodność z mechanizmami dane.gov.pl
Strona startowa → sekcja **„Jak to działa”**; README → sekcja „Zgodność z dane.gov.pl”.

**Oczekiwany rezultat:** wskazany precedens z portalu (15 255 zbiorów „ceny ofertowe mieszkań” od 6 971 instytucji typu `developer` – każdy deweloper to osobny dostawca publikujący wg jednego wzorca; materiały bazy wiedzy dla deweloperów i starostów); odwzorowanie pojęć portalu (instytucja = dostawca, zbiór danych, zasób, API `/1.4/resources/{id}/data`, dane tabelaryczne z Table Schema, częstotliwość aktualizacji, stopień otwartości, „Zgłoś uwagę”); prototyp **nie publikuje** niczego w portalu – publikuje dostawca.

### 15. Wykaz AED w portalu dane.gov.pl (uruchomienie lokalne)
Uruchomienie oficjalnego frontendu portalu dane.gov.pl z osadzonym Wykazem AED:
1. Przejdź do folderu frontendu portalu: `cd portal-wykaz/frontend` (lub sklonuj repozytorium: `git clone https://github.com/wiezawieza/misja-aed-portal-wykaz.git`).
2. Uruchom serwer lokalny: `npm run start:local` (lub `npm install --legacy-peer-deps && npm run start:local`).
3. Otwórz w przeglądarce adres: **`http://localhost:4200/pl/wykaz-aed`**.

**Oczekiwany rezultat:** pełny interfejs portalu dane.gov.pl z pozycją „Wykaz AED” w menu głównym; tabela wzorcowa (34 kolumny ze schematu, 163 rekordy: 73 prawdziwe + 90 DEMO, 52 zweryfikowane, 7 dostawców), filtry na żywo, wyszukiwarka, sortowanie, stronicowanie, eksport CSV i JSON oraz panel administracyjny opisujący proces zasilania zasobu. Raport techniczny w `WYKAZ-INTEGRACJA.md`.

### 16. Prezentacja
Otwórz `prezentacja/index.html` (strzałki ← →) lub `prezentacja/prezentacja.pdf`.

**Oczekiwany rezultat:** 10 slajdów: problem, architektura zgodna z dane.gov.pl, wzorcowy zakres, onboarding, agregacja i licencje, wykaz w kodzie portalu dane.gov.pl, akcja i logo, dostępność, demo i ograniczenia – ze zrzutami z działającego prototypu i portalu.

## Wykorzystanie AI

Zgodnie z regulaminem: przy przygotowaniu rozwiązania korzystaliśmy z asystenta AI (generowanie i przegląd kodu, redakcja tekstów, wsparcie przy projektowaniu znaku). Koncepcja, decyzje projektowe, weryfikacja danych i finalna praca są autorskim rozwiązaniem zespołu **Zapachowy** (1 osoba).
