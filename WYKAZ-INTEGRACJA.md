# WYKAZ AED W PORTALU DANE.GOV.PL – RAPORT Z INTEGRACJI

> **Projekt:** Misja AED – Dane na ratunek  
> **Zadanie ratunkowe:** Osadzenie Ogólnopolskiego Wykazu AED w lokalnej instancji portalu otwartych danych `dane.gov.pl` (MCOD).  
> **Status:** ✅ **ZAKOŃCZONE SUKCESEM** (Frontend Angular skompilowany i działający na `http://localhost:4200/`, Wykaz AED wdrożony, zrzuty ekranu wykonane, repozytorium główne nienaruszone).

---

## 1. Architektura istniejącego Wykazu w dane.gov.pl (Analiza kodu)

W portalu `dane.gov.pl` (MCOD) istniejącym mechanizmem publikacji danych w formie zagregowanego wykazu tabelarycznego jest moduł **DGA (Data Governance Act / Dane Chronione / Wykazy DGA)**.

### A. Komponenty frontendowe (Angular)
1. **Komponent tabeli wykazu:**
   - **Plik:** `frontend/src/app/pages/dga-information-point/dga-information-point-table/dga-information-point-table.component.ts`
   - **Komponent:** `DgaInformationPointTableComponent`
   - **Szablon tabeli wielokolumnowej:** `DgaInformationPointTableComponent` osadza komponent `<app-resource-table-no-filters>` (`frontend/src/app/shared/resource-table-no-filters/resource-table-no-filters.component.ts`), który odpowiada za renderowanie wierszy, nagłówków, sortowanie oraz dynamiczne stronicowanie danych tabelarycznych.
2. **Pobieranie i rozwiązywanie danych:**
   - **Serwis:** `DgaService` w `frontend/src/app/services/dga.service.ts`
   - **Metoda:** `getDgaAggregatedData()`
   - **Resolver routingu:** `breadcrumbsDgaInformationPointTableDataResolverService` (`frontend/src/app/shared/breadcrumbs/resolvers/breadcrumbs-dga-information-point-table-data-resolver.service.ts`), który zasila widok danymi przed jego zamontowaniem w drzewie DOM.

### B. Backend i mechanizm scalania zasobów (Python / Django / Celery)
1. **Plik z logiką scalania:**
   - `backend/mcod/resources/dga_utils.py`
2. **Kluczowa metoda scalająca:**
   - **Nazwa metody:** `create_main_dga_df(resources: QuerySet) -> pd.DataFrame`
   - **Zasada działania:**
     - Pobiera listę zasobów oznaczonych jako wchodzące w skład wykazu (`resources.filter(has_dga_resources=True)`).
     - Dla każdego pliku źródłowego (CSV, XLSX) czyta wiersze za pomocą biblioteki `pandas`.
     - Normalizuje nazwy kolumn, weryfikuje zgodność typów i schematu tabelarycznego.
     - Scala ramki danych (`pd.concat`) w jeden globalny DataFrame.
     - Zapisuje wynikowy plik zagregowany jako zasób systemowy `AggregatedDGAInfo`.
3. **Zadanie asynchroniczne i widok API:**
   - **Zadanie Celery:** `create_main_dga_resource_task` w `backend/mcod/resources/tasks/dga.py` — uruchamiane okresowo (cron) lub po dodaniu/edycji zasobu przez dostawcę.
   - **Endpoint API:** `AggregatedDGAInfoView` udostępniający dane pod adresem `/dga-aggregated` oraz `/1.4/resources/{id}/data`.

---

## 2. Co dodano w ramach Wykazu AED

Zgodnie z wymaganiami zadania utworzono niezależny, dedykowany moduł **Wykazu AED**, zachowując 100% spójności wizualnej i architektonicznej z portalem `dane.gov.pl`.

### A. Dane referencyjne (`aed-data.ts`)
- **Plik:** `portal-wykaz/frontend/src/app/pages/wykaz-aed/aed-data.ts`
- **Wzorcowy zakres danych (34 kolumny):** Wszystkie pola ze schematu `schemat/aed-schema.json`:
  1. `id`
  2. `nazwa_lokalizacji`
  3. `miejscowosc`
  4. `kod_pocztowy`
  5. `adres`
  6. `wojewodztwo`
  7. `powiat`
  8. `gmina`
  9. `szerokosc`
  10. `dlugosc`
  11. `opis_miejsca`
  12. `pietro`
  13. `w_budynku`
  14. `dostepny_24h`
  15. `godziny_dostepnosci`
  16. `status`
  17. `kontakt_telefon`
  18. `kontakt_email`
  19. `zarzadca_obiektu`
  20. `producent`
  21. `model`
  22. `numer_seryjny`
  23. `data_waznosci_elektrod`
  24. `data_waznosci_baterii`
  25. `data_ostatniego_przegladu`
  26. `pediatryczny`
  27. `kluczyk_pediatryczny`
  28. `w_apteczce`
  29. `uwagi`
  30. `zrodlo`
  31. `data_zgloszenia`
  32. `data_aktualizacji`
  33. `kod_teryt`
  34. `dostawca`
- **Zestaw danych:** Dokładnie **163 rekordy** (73 prawdziwe z rejestrów `dane.gov.pl` + 90 DEMO, 52 zweryfikowane terenowo, 7 zróżnicowanych dostawców danych).

### B. Komponent widoku (`WykazAedComponent`)
- **Pliki:**
  - `portal-wykaz/frontend/src/app/pages/wykaz-aed/wykaz-aed.component.ts`
  - `portal-wykaz/frontend/src/app/pages/wykaz-aed/wykaz-aed.component.html`
  - `portal-wykaz/frontend/src/app/pages/wykaz-aed/wykaz-aed.component.scss`
- **Możliwości komponentu:**
  - Dynamiczne wyszukiwanie pełnotekstowe po miejscowości, adresie, nazwie lokalizacji i dysponencie.
  - Filtry błyskawiczne: *Wszystkie (163)*, *Zweryfikowane (52)*, *dane.gov.pl (73)*, *DEMO (90)*, *Dostępne 24/7*.
  - Sortowanie po każdej z 34 kolumn wzorcowych (z indykatorami ▲/▼).
  - Paginacja (20, 50, 100 rekordów na stronę).
  - Bezpośredni eksport odfiltrowanego zbioru do **CSV** (z BOM UTF-8 dla polskiego Excela) i **JSON**.
  - Zintegrowany, rozwijany panel opisujący proces administracyjny i ingestion danych.

### C. Routing i Menu
- **Plik:** `portal-wykaz/frontend/src/app/app-routing.module.ts`
  - Dodano trasę `!wykaz-aed` ładującą `WykazAedComponent` w układzie `MainLayoutComponent`.
  - Dodano alias `!aed` przekierowujący do `!wykaz-aed`.
- **Plik:** `portal-wykaz/frontend/src/app/layout/header/header.component.html`
  - Dodano pozycję menu **Wykaz AED** w głównym pasku nawigacji portalu obok istniejących wykazów.

---

## 3. Panel administracyjny: Jak działa zasilanie zasobu

Wykaz w portalu `dane.gov.pl` obsługuje dwa komplementarne strumienie zasilania danymi:

### 1. Zasilenie manualne (Onboarding dysponenta i publikacja plików)
1. **Weryfikacja organizacji:** Dysponent AED (urząd gminy, MOSiR, szpital, szkoła, zarządca galerii handlowej) zakłada konto organizacji w portalu. Tożsamość potwierdzana jest numerem REGON (walidowanym z sumą kontrolną) oraz Profilem Zaufanym / e-Dowodem reprezentanta.
2. **Elektroniczne oświadczenie dysponenta:** Przed pierwszym wgraniem danych dysponent podpisuje oświadczenie o odpowiedzialności prawnej za rzetelność i aktualność publikowanych lokalizacji AED.
3. **Deklaracja zakresu referencyjnego:** Przypisanie obszaru odpowiedzialności (kod TERYT) oraz deklarowanej częstotliwości przeglądów (np. co kwartał).
4. **Walidacja w locie (R01–R20):** Przy wysyłaniu pliku CSV/XLSX formularz portalu uruchamia silnik walidacji:
   - Sprawdza kompletność nagłówków według Table Schema.
   - Weryfikuje współrzędne geograficzne (czy mieszczą się w granicach Polski i czy nie zamieniono LAT/LON).
   - Waliduje format godzin dostępności (np. `08:00-16:00` lub `24/7`).
   - W przypadku błędów generuje raport z numerem wiersza i podpowiedzią naprawy.
5. **Publikacja:** Poprawny plik zasila zbiór danych instytucji i natychmiast trafia do kolejki agregacji Wykazu AED.

### 2. Zasilenie automatyczne (Harwester / API / Konektor CKAN)
1. **Okresowy harwester (Celery Task):** Zadanie w backendzie `create_main_dga_resource_task` regularnie odpytuje zarejestrowane adresy URL dostawców (endpointy REST, pliki GeoJSON/CSV z miejskich portali open data, np. Warszawa, Wrocław, Gdańsk).
2. **Konektor API `dane.gov.pl`:** Endpoint `GET /1.4/resources/{id}/data` umożliwia zautomatyzowane przesyłanie nowych i zaktualizowanych rekordów bezpośrednio ze szpitalnych lub ratowniczych systemów dyspozytorskich.
3. **Harmonizacja i deduplikacja przestrzenna:**
   - Rekordy z różnych źródeł są normalizowane (usuwanie spacji, unifikacja wielkości liter, ujednolicenie słowników).
   - Algorytm przestrzenny wykrywa duplikaty urządzeń w promieniu 10 metrów i przypisuje priorytet rekordowi o wyższym statusie weryfikacji.

---

## 4. Instrukcja uruchomienia lokalnego

```bash
# 1. Wejdź do katalogu frontendu
cd portal-wykaz/frontend

# 2. Uruchom serwer developerski w konfiguracji local
npm run start:local
```

Aplikacja uruchomi się pod adresem:  
👉 **`http://localhost:4200/pl/wykaz-aed`** (lub `http://localhost:4200/`)

Proxy w `proxy.local.conf.json` automatycznie przekazuje zapytania `/api/**` do produkcyjnego API `https://api.dane.gov.pl/1.4/`.

---

## 5. Zrzuty ekranu

Zrzuty zostały wykonane automatycznie w rozdzielczości 1920×1080 i znajdują się w katalogu `prezentacja/zrzuty/` (oraz `zrzuty/` w repozytorium portalu):

1. **`prezentacja/zrzuty/wykaz-aed-portal.png`**  
   *Widok główny tabeli Wykazu AED osadzonej w portalu dane.gov.pl (nagłówek portalu, statystyki zasobu zbiorczego, pasek pobierania CSV/JSON, pasek filtrów, tabela 34 kolumn).*
2. **`prezentacja/zrzuty/panel-administracyjny.png`**  
   *Rozwinięty panel administracyjny wyjaśniający ścieżkę zasilania manualnego (onboarding, oświadczenie, walidacja R01-R20) oraz automatycznego (harwester Celery, harmonizacja, API).*
3. **`prezentacja/zrzuty/wykaz-aed-zweryfikowane.png`**  
   *Prezentacja interaktywnego filtrowania – widok rekordów ze statusem zweryfikowanym (zielone znaczniki ✓, podział na źródła).*
4. **`prezentacja/zrzuty/wykaz-aed-pelna-strona.png`**  
   *Zrzut całej długości strony z zachowaniem układu graficznego portalu i paginacji.*

---

## 6. Gwarancja nienaruszalności repozytorium

Wszystkie operacje, pliki źródłowe portalu, pakiety `node_modules` i skrypty zostały umieszczone wyłącznie w katalogu `portal-wykaz/`. Katalog ten oraz niniejszy raport zostały zabezpieczone w lokalnych wykluczeniach `.git/info/exclude`. Główne repozytorium projektu `misja-aed` pozostało w 100% czyste (`working tree clean`), a działający prototyp nie został w żaden sposób zmodyfikowany.
