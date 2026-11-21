# Ograniczenia prototypu – uczciwa lista

## Co jest symulacją lub demo

1. **Publikacja w dane.gov.pl jest symulowana.** Krok 7 kreatora nie wysyła niczego do portalu – celowo. Zgodnie z zasadami dane.gov.pl dane publikuje dostawca w panelu swojej instytucji (lub przez harwester) i to on odpowiada za ich jakość. Adres zasobu i identyfikatory w kroku 7 są przykładowe.
2. **Rejestracja instytucji jest symulowana.** W portalu konto instytucji zakłada administrator na wniosek; formularz w kroku 1 przygotowuje dane do takiego wniosku.
3. **Rekordy DEMO są syntetyczne.** 102 rekordy od 4 fikcyjnych dostawców („… (DEMO)”) wygenerowano losowo wokół centrów miast, z fikcyjnymi adresami („ul. Kwiatowa 12” itp.). Służą wyłącznie do pokazania pełnego wzorca (statusy, godziny, weryfikacja, licencja niekompatybilna). Nie opisują prawdziwych urządzeń.
4. **„Zgłoś uwagę dostawcy”** to symulacja mechanizmu uwag portalu (komunikat, bez wysyłki).
5. **Odpowiedź API** w kroku 7 i w „Wzorcowym zbiorze” jest generowana lokalnie w formacie odwzorowanym z prawdziwej odpowiedzi `api.dane.gov.pl/1.4/resources/{id}/data`.

## Czego nie zrobiono

6. **Agregator nie działa cyklicznie.** Prawdziwe zasoby z dane.gov.pl zostały pobrane i zharmonizowane skryptem `narzedzia/zbuduj_dane.py` (migawka z 21.11.2026). W wdrożeniu agregator powinien regularnie odpytywać API portalu (np. po słowie kluczowym `SerceNaMapie`).
7. **Adaptery źródeł są ręczne.** Każdy z trzech prawdziwych zasobów ma osobny adapter (inne kolumny i formaty). Docelowo nowe zasoby powinny być od razu zgodne ze wzorcem – po to jest kreator.
8. **Warszawa niezintegrowana.** Zasób Urzędu m.st. Warszawy wymaga indywidualnego tokenu API – nie rejestrowaliśmy konta, więc źródło jest tylko wykazane jako „niedostępne”.
9. **Warstwa OpenStreetMap bez danych – świadomie.** Licencja ODbL (share-alike dla baz danych) jest niezgodna z CC BY 4.0 zbioru zbiorczego, dlatego nie dystrybuujemy punktów OSM. Konektor i logika (warstwa pomocnicza poza zbiorem) są gotowe do użycia po decyzji prawnej operatora. Podkład mapy (kafelki OSM) jest używany zgodnie z atrybucją.
10. **Brak geokodowania i słowników TERYT online.** Gmina/powiat/województwo dla prawdziwych rekordów uzupełniono z wiedzy o miejscowości; kod TERYT jest polem opcjonalnym i pozostał pusty. Walidator nie sprawdza zgodności punktu z granicą gminy (sprawdza punkty odstające względem miejscowości).
11. **Deduplikacja jest prosta** (odległość < 10 m między różnymi źródłami + pierwszeństwo źródła referencyjnego). Nie porównuje nazw ani numerów seryjnych.
12. **Godziny dostępności** obsługują podzbiór składni OSM `opening_hours` (dni, zakresy godzin, `PH` bez kalendarza świąt).
13. **Brak backendu i trwałego zapisu.** Zasoby „opublikowane” w kreatorze są zapisywane tylko w pamięci przeglądarki (localStorage); w trybie prywatnym znikają po zamknięciu karty.
14. **Dostępność sprawdzona ręcznie** (klawiatura, kontrast obliczeniowy, etykiety, `aria-live`, widok listy zamiast mapy, emulacja telefonu 375–390 px). Nie wykonano audytu z czytnikiem ekranu ani automatycznego audytu axe.
15. **Mapa podkładowa wymaga internetu** (kafelki OpenStreetMap). Bez sieci wszystkie funkcje działają, a punkty widać bez podkładu.
16. **Wartości CMYK i Pantone w księdze znaku są orientacyjne** (konwersja z RGB) – do potwierdzenia proofem drukarni.
17. **Kod źródłowy dane.gov.pl** – pobranie archiwum backendu (88 MB) nie zakończyło się w czasie hackathonu; zgodność z mechanizmami portalu zweryfikowaliśmy na **żywym API** (nazwy pól: `license_name`, `update_frequency`, `institution_type`, `openness_score`, `verified`, `data_date`, format `/resources/{id}/data`) oraz na materiałach bazy wiedzy portalu („Przydatne materiały”: standardy otwartości, przewodnik dla dostawców, wzorzec dla deweloperów).

## Co dopracować w pierwszej kolejności

- Cykliczny agregator na API dane.gov.pl + raport jakości wysyłany dostawcom.
- Szablon harwestera (XML / DCAT-AP) dla dużych dysponentów (sieci handlowe, szpitale, PKP).
- Pilotaż kreatora z 2–3 gminami i test z użytkownikami czytników ekranu.
- Słownik TERYT i walidacja punktu względem granic gminy (PRG).
