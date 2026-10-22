# FoE Companion 0.6.03

Panel pomocniczy do Forge of Empires. Automatycznie odczytuje odpowiedzi fetch/XHR gry pod `/game/json`; przyciski akcji korzystają z bieżącej sesji. Po instalacji lub aktualizacji odśwież grę i otwórz odpowiednią mapę, perłę albo osadę.

Zakładki: ⚔️ Pola Chwały, 🏛️ kalkulator pereł, 🏘️ zbiory, ⚛️ Najazdy kwantowe i ⚙️ ustawienia.

---

## Instalacja z pliku ZIP (użytkownicy)

1. Wypakuj zawartość pliku `.zip` do stałej lokalizacji na dysku (np. `Dokumenty`). Plik `manifest.json` musi znajdować się bezpośrednio w wypakowanym folderze.
2. Otwórz `brave://extensions` i włącz **Tryb deweloperki** (prawy górny róg).
3. Kliknij **Załaduj rozpakowane** i wskaż wypakowany folder.
4. Po instalacji lub aktualizacji odśwież kartę z grą (F5).

Do poprawnego działania wymagana jest jedna otwarta karta z grą.

## Instalacja z folderu (deweloperzy)

1. Otwórz `brave://extensions` i włącz tryb programisty.
2. Wyłącz poprzednią kopię rozszerzenia z innego folderu.
3. Wybierz **Załaduj rozpakowane** i wskaż folder `foe-helper` zawierający `manifest.json`.
4. Po aktualizacji przeładuj rozszerzenie i odśwież kartę gry.

---

## Pola Chwały

Obsługiwane mapy: `waterfall_archipelago` i `volcano_archipelago`. Własna gildia jest rozpoznawana przez `currentParticipantId`.

- Otwarte sektory są sortowane rosnąco według progresu. Ignorowane mają czerwone tło i trafiają na dół.
- Wiersz pokazuje sektor, progres, szansę na opór oraz przyciski walk i negocjacji.
- Liczniki przy tytule pokazują wygrane / zakończone akcje wykonane rozszerzeniem w bieżącej sesji.
- Rozpiska pod sektorami ma maksymalnie 100 px wysokości. Wyświetla i kopiuje tylko przyszłe otwarcia. Opcja „tylko sąsiedzi" ogranicza ją do sąsiadów własnych pól.
- Status i komunikaty mają stałą wysokość. Dłuższy komunikat jest dostępny po najechaniu myszką.
- W ustawieniach można skonfigurować alert dźwiękowy przed otwarciem sektora.

> ⚠️ **Uwaga:** Przyciski automatycznych walk i negocjacji są dostępne w ustawieniach, ale ich używanie **może skutkować banem konta** w Forge of Empires. Używasz ich na własną odpowiedzialność.

---

## Kalkulator pereł

Po otwarciu perły panel pokazuje pięć nagród i kwoty inwestorów. Domyślny przelicznik to 1,9; kwoty są zaokrąglane w górę, a miejsca bez nagrody otrzymują 1 PR. Przy kwotach znajdują się przyciski kopiowania.

**Total PR** określa koszt poziomu. Przy każdym miejscu widoczna jest dopłata właściciela na danym etapie oraz łączna wpłata potrzebna do zabezpieczenia. Etapy uwzględniają wcześniejsze planowane wpłaty. Odczytana wpłata właściciela zmniejsza pozostałą dopłatę i kopiowaną kwotę. Gdy nie jest znana, panel sygnalizuje obliczenia od zera.

Obliczenia zakładają planowane wpłaty wcześniejszych inwestorów; nie są pełną analizą dowolnego istniejącego rankingu.

---

## Zbiory

Budynki są sortowane według produkcji PR, a Perły Architektury znajdują się na dole. Nazwy można edytować na liście; własne nazwy zapisują się lokalnie.

- `🤲` zbiera gotową produkcję. Przed terminem jest nieaktywne i ma opacity 0,2.
- Żółta gwiazda oznacza motywację lub odrestaurowanie; wyblakła — brak efektu.
- Tooltip pokazuje godzinę i produkcję, np. `22:06:22 | PR: 500 | Towary: 650 | Monety: 21233`.

Po zbiorze przez żądanie grafika miasta może nadal pokazywać gotowy budynek do czasu odświeżenia widoku gry. Przed ponowieniem sprawdź stan produkcji.

---

## Najazdy kwantowe

Otwórz osadę po przeładowaniu rozszerzenia. Panel pokazuje zasoby, liny, euforię, wydajność godzinową, bonusy i prognozę zbiorów. Tooltip liny podaje możliwą produkcję z obecnych zapasów.

Budynki są grupowane według terminów. Przerwa większa niż godzinę rozpoczyna nową grupę; jej termin odpowiada ostatniemu budynkowi. Budynki w budowie są wymieniane oddzielnie.

Prognoza obejmuje jeden zbiór z aktualnych produkcji. Nie planuje sprzedaży, przebudowy ani ponownego uruchamiania produkcji. Definicje odebrane z gry mają pierwszeństwo przed lokalnym katalogiem `quantum-definitions.json`.

### Historia zbiorów

Przycisk **Historia zbiorów** otwiera pływające okno z listą zarejestrowanych zbiorów, zmian i żonglowan w osadzie. Okno jest przeciągane za pasek tytułu i zmienialne w szerokości.

- Każdy wpis można rozwinąć, by zobaczyć szczegóły działań i porównanie **Przed / Po** z miniaturkami zrzutów ekranu.
- Przy każdym zbiorze widoczna jest odznaka **⚔️ N** — skumulowana liczba walk wykonanych od początku najazdu do tego momentu, liczona jako suma `actionsPerHour × Δt / 3500` dla każdego interwału między zbiorami.
- Cofanie operacji (do 3 kroków), rozdzielanie i łączenie grup zbiorów, notatki do działań, eksport JSON.

### Zrzuty ekranu

W ustawieniach (**⚙️ → Najazdy kwantowe**) można włączyć:
- **Dziennik zbiorów** — pokazuje przycisk Historia zbiorów w panelu osady.
- **Panel na zrzucie** — dołącza zestawienie osady do zrzutu ekranu.
- **Działania na zrzucie** — dołącza listę działań (żonglowania) do zrzutu.

Przycisk 📷 przy zbiorze otwiera panel kadrowania z widokiem zestawienia i przyciskiem wykonania zrzutu. Tytuł panelu pokazuje nazwę i datę bieżącego zbioru.

---

## Notatki

Notatki są przyklejone do dołu panelu i domyślnie zwinięte do jednej linii. Po rozwinięciu zajmują maksymalnie 300 px. Zapis następuje podczas pisania w localStorage gry, pod kluczem `foe-companion.notes`.

Każda zakładka ma własne notatki. Kalkulator przechowuje je osobno dla każdego typu perły, wspólnie dla różnych właścicieli. Czyszczenie danych witryny usuwa notatki.

---

## Ustawienia

- **Perły** — przelicznik i bonus Arki, kopiowanie kwoty klawiszami 1–5.
- **Wysuwaj panel** — automatyczne otwieranie panelu przy perłach, Polach Chwały, osadzie kwantowej i negocjacjach.
- **Pola chwały** — alert dźwiękowy przed otwarciem sektora (przyciski walk/negocjacji dostępne w ustawieniach — patrz ostrzeżenie powyżej).
- **Budynki** — przyciski zbiorów (patrz ostrzeżenie powyżej).
- **Najazdy kwantowe** — dziennik zbiorów, panel na zrzucie, działania na zrzucie.

> Korzystanie z przycisków ataku, negocjacji i zbiorów może wiązać się z ryzykiem bana konta w grze.

---

## Automatyczne zmiany kodu (deweloperzy)

1. Uruchom `START-DEV.cmd` i pozostaw okno otwarte.
2. Zmiana kodu powoduje przeładowanie rozszerzenia i karty gry.
3. Po odświeżeniu ponownie otwórz ekran potrzebny do odczytu danych.
4. Zatrzymaj watcher przez Ctrl+C lub zamknięcie okna.

Nie zapisuj zmian podczas ważnej operacji w grze: watcher wykonuje pełne przeładowanie. Bez niego obowiązuje ręczne przeładowanie rozszerzenia i strony.

Watcher wymaga Node.js w PATH lub lokalnego runtime Codex. Serwer nasłuchuje na `127.0.0.1:18743` i zwraca hash wersji, bez plików i danych gry. Tryb pracy zakłada jedną kartę gry.

---

## Edycja i Git

- `panel.js` — interfejs, ustawienia i przyciski.
- `capture.js` — obserwacja komunikacji, akcje i solver negocjacji.
- `request-signature.js` — podpisy i identyfikatory żądań.
- `battle-army.js` — skład armii.
- `model.js` — stan i prezentacja sektorów.
- `quantum.js`, `quantum-history.js` — najazdy kwantowe i historia zbiorów.
- `pearls.js`, `notes.js` — pozostałe zakładki.
- `sectors*.json` — nazwy i sąsiedztwo map.
- `dev-server.cjs`, `dev-client.js`, `background.js` — przeładowanie deweloperskie.

Sąsiedztwo poprawiaj obustronnie. Nie uruchamiaj generatora map po ręcznych korektach bez sprawdzenia, co nadpisuje.

Repozytorium: [SzpaaQ/foe-companion](https://github.com/SzpaaQ/foe-companion). Przed commitem sprawdź `git status` i diff. Commit zapisuje wersję lokalnie; wysłanie na GitHub wymaga osobnego push. Plików HAR i odpowiedzi z danymi sesji nie dodawaj do repozytorium ani paczki rozszerzenia.

---

## Testy

Testy regresji: `node --test *.test.cjs`. Obejmują transport, walki, solver, negocjacje, historię zbiorów i liczniki walk.

Testy offline używają atrap komunikacji i nie wykonują operacji na koncie. Nie zastępują sprawdzenia w zalogowanej sesji Brave. Obserwator fetch/XHR nie obejmuje wszystkich kanałów komunikacji gry.

---

## Bezpieczeństwo

W katalogu roboczym mogą powstawać pliki z logami danych (np. `.har`, `response.json`). **Zabrania się udostępniania paczki rozszerzenia zawierającej takie pliki osobom trzecim.** Mogą one zawierać klucze sesji oraz pełne dane konta gry.

Katalog `dist/` zawiera wyłącznie pliki potrzebne do działania rozszerzenia i jest bezpieczny do udostępnienia.
