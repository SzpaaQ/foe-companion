# FoE Companion 0.3

Panel pomocniczy do Forge of Empires. Automatycznie odczytuje odpowiedzi fetch/XHR gry pod `/game/json`; przyciski akcji korzystają z bieżącej sesji. Po instalacji lub aktualizacji odśwież grę i otwórz odpowiednią mapę, perłę albo osadę.

Zakładki: ⚔️ Pola Chwały, 🏛️ kalkulator pereł, 🏘️ zbiory, ⚛️ Najazdy kwantowe i ⚙️ ustawienia z diagnostyką.

## Instalacja w Brave

1. Otwórz `brave://extensions` i włącz tryb programisty.
2. Wyłącz poprzednią kopię rozszerzenia z innego folderu.
3. Wybierz **Załaduj rozpakowane** i wskaż folder `foe-helper` zawierający `manifest.json`.
4. Po aktualizacji przeładuj rozszerzenie i odśwież kartę gry.
5. Otwórz odpowiedni ekran gry. Diagnostyka pokazuje odebrane odpowiedzi.

## Pola Chwały

Obsługiwane mapy: `waterfall_archipelago` i `volcano_archipelago`. Własna gildia jest rozpoznawana przez `currentParticipantId`.

- Otwarte sektory są sortowane rosnąco według progresu. Ignorowane mają czerwone tło i trafiają na dół.
- Wiersz pokazuje sektor, progres, szansę na opór oraz przyciski walk i negocjacji.
- Liczniki przy tytule pokazują wygrane / zakończone akcje wykonane rozszerzeniem w bieżącej sesji.
- Rozpiska pod sektorami ma maksymalnie 100 px wysokości. Wyświetla i kopiuje tylko przyszłe otwarcia. Opcja „tylko sąsiedzi” ogranicza ją do sąsiadów własnych pól.
- Status i komunikaty mają stałą wysokość. Dłuższy komunikat jest dostępny po najechaniu myszką.
- W ustawieniach można skonfigurować alert dźwiękowy przed otwarciem sektora.

### Walki

`⚔️` uruchamia ręczną szybką walkę, `▶` autoatak, a `⏹` zatrzymuje kolejne akcje. Wysłane żądanie jest kończone. Ręczna walka pomija ustawienie „Pozostaw walk”.

Każda nowa walka: pobranie armii → wymiana jednostek → potwierdzenie składu → szybka walka. Między falami tej samej walki nie ma wymiany jednostek. Po zakończeniu pobierany jest aktualny stan mapy.

Autoatak korzysta z zapasu walk (domyślnie 3) i zakresu przerwy (domyślnie 0,3–0,4 s). Zatrzymuje się po trzech kolejnych porażkach lub błędzie. Gdy mapa nie zawiera jeszcze rekordu podboju, obecna implementacja dopuszcza pierwszą walkę bez sprawdzenia zapasu. Inni gracze mogą zmienić progres już po odczycie.

Błąd `invalid wave` zatrzymuje autoatak, ale pozwala ponowić ręczną próbę. Inny niepotwierdzony wynik może wymagać sprawdzenia stanu i odświeżenia gry. Automatyzacja nie wznawia się po przeładowaniu strony.

### Negocjacje

`🤝` rozpoczyna pojedynczą negocjację; przycisk automatyzacji powtarza negocjacje w wybranym sektorze. Status nad sektorami pokazuje start, turę i wynik. Historia tur znajduje się pod rozpiską. Pusta konsola jest przezroczysta i nie ma tekstu zastępczego. Przerwany start nie pozostawia komunikatu „Uruchamiam negocjację”.

Po wykorzystaniu tur przegrana negocjacja jest poddawana. Automatyzacja może rozpocząć następną po ponownym sprawdzeniu progresu i zapasu. Uwzględnia dwa punkty progresu za negocjację; brak potwierdzonego limitu zatrzymuje dalsze akcje.

Przy błędzie żądania rozszerzenie sprawdza trwającą negocjację Pól Chwały, poddaje ją i zatrzymuje automatyzację. Dotyczy to również braku towarów, choć ogólne `Error` nie zawsze pozwala ustalić przyczynę. Solver ma ograniczony koszt obliczeń i nie gwarantuje wygranej. Brak zgodnego rozwiązania kończy się poddaniem i zatrzymaniem.

## Negocjacje poza Polami Chwały

Po otwarciu standardowej negocjacji w grze pojawia się zakładka **🤝 Nego**. Obsługuje negocjacje misji (`quest`) oraz inne konteksty korzystające z tego samego protokołu pięciu rozmówców i maksymalnie dziesięciu towarów. Pola Chwały mają osobną obsługę.

Przycisk **Negocjuj** odczytuje bieżący stan i historię, a następnie rozgrywa pozostałe tury. Zakładka pokazuje towary, propozycje, odpowiedzi i wynik. Po wyczerpaniu tur negocjacja jest poddawana; dodatkowe tury nie są kupowane. Podczas pracy solvera nie wykonuj równocześnie tur w oknie gry.

W ustawieniach można wyłączyć automatyczne wysuwanie panelu po wykryciu negocjacji. Samo wykrycie nie uruchamia solvera. Obsługa pozostałych kontekstów wymaga zgodnego formatu odpowiedzi; testy offline nie zastępują weryfikacji w grze.

Alerty Pól Chwały mają wybór pięciu zapamiętywanych sygnałów: trzy piknięcia, ding-dong, pojedynczy sygnał, melodyjka i alarm. Przycisk **Test dźwięku** odtwarza wybrany wariant.

## Kalkulator pereł

Po otwarciu perły panel pokazuje pięć nagród i kwoty inwestorów. Domyślny przelicznik to 1,9; kwoty są zaokrąglane w górę, a miejsca bez nagrody otrzymują 1 PR. Przy kwotach znajdują się przyciski kopiowania.

**Total PR** określa koszt poziomu. Przy każdym miejscu widoczna jest dopłata właściciela na danym etapie oraz łączna wpłata potrzebna do zabezpieczenia. Etapy uwzględniają wcześniejsze planowane wpłaty. Odczytana wpłata właściciela zmniejsza pozostałą dopłatę i kopiowaną kwotę. Gdy nie jest znana, panel sygnalizuje obliczenia od zera.

Obliczenia zakładają planowane wpłaty wcześniejszych inwestorów; nie są pełną analizą dowolnego istniejącego rankingu.

## Zbiory

Budynki są sortowane według produkcji PR, a Perły Architektury znajdują się na dole. Nazwy można edytować na liście; własne nazwy zapisują się lokalnie.

- `🤲` zbiera gotową produkcję. Przed terminem jest nieaktywne i ma opacity 0,2.
- Żółta gwiazda oznacza motywację lub odrestaurowanie; wyblakła — brak efektu.
- Tooltip pokazuje godzinę i produkcję, np. `22:06:22 | PR: 500 | Towary: 650 | Monety: 21233`.

Po zbiorze przez żądanie grafika miasta może nadal pokazywać gotowy budynek do czasu odświeżenia widoku gry. Przed ponowieniem sprawdź stan produkcji.

## Najazdy kwantowe

Otwórz osadę po przeładowaniu rozszerzenia. Panel pokazuje zasoby, liny, euforię, wydajność godzinową, bonusy i prognozę zbiorów. Tooltip liny podaje możliwą produkcję z obecnych zapasów.

Budynki są grupowane według terminów. Przerwa większa niż godzinę rozpoczyna nową grupę; jej termin odpowiada ostatniemu budynkowi. Budynki w budowie są wymieniane oddzielnie.

Prognoza obejmuje jeden zbiór z aktualnych produkcji. Nie planuje sprzedaży, przebudowy ani ponownego uruchamiania produkcji. Definicje odebrane z gry mają pierwszeństwo przed lokalnym katalogiem `quantum-definitions.json`.

## Notatki

Notatki są przyklejone do dołu panelu i domyślnie zwinięte do jednej linii. Po rozwinięciu zajmują maksymalnie 300 px. Zapis następuje podczas pisania w localStorage gry, pod kluczem `foe-companion.notes`.

Każda zakładka ma własne notatki. Kalkulator przechowuje je osobno dla każdego typu perły, wspólnie dla różnych właścicieli. Czyszczenie danych witryny usuwa notatki.

## Automatyczne zmiany kodu

1. Uruchom `START-DEV.cmd` i pozostaw okno otwarte.
2. Zmiana kodu powoduje przeładowanie rozszerzenia i karty gry.
3. Po odświeżeniu ponownie otwórz ekran potrzebny do odczytu danych.
4. Zatrzymaj watcher przez Ctrl+C lub zamknięcie okna.

Nie zapisuj zmian podczas ważnej operacji w grze: watcher wykonuje pełne przeładowanie. Bez niego obowiązuje ręczne przeładowanie rozszerzenia i strony.

Watcher wymaga Node.js w PATH lub lokalnego runtime Codex. Serwer nasłuchuje na `127.0.0.1:18743` i zwraca hash wersji, bez plików i danych gry. Tryb pracy zakłada jedną kartę gry.

## Edycja i Git

- `panel.js`: interfejs, ustawienia i przyciski.
- `capture.js`: obserwacja komunikacji, akcje i solver negocjacji.
- `request-signature.js`: podpisy i identyfikatory żądań.
- `battle-army.js`: skład armii.
- `model.js`: stan i prezentacja sektorów.
- `pearls.js`, `quantum.js`, `notes.js`: pozostałe zakładki.
- `sectors*.json`: nazwy i sąsiedztwo map.
- `dev-server.cjs`, `dev-client.js`, `background.js`: przeładowanie developerskie.

Sąsiedztwo poprawiaj obustronnie. Nie uruchamiaj generatora map po ręcznych korektach bez sprawdzenia, co nadpisuje.

Repozytorium: [SzpaaQ/foe-companion](https://github.com/SzpaaQ/foe-companion). Przed commitem sprawdź `git status` i diff. Commit zapisuje wersję lokalnie; wysłanie na GitHub wymaga osobnego push. Plików HAR i odpowiedzi z danymi sesji nie dodawaj do repozytorium ani paczki rozszerzenia.

## Testy

Testy regresji: `node --test *.test.cjs`. Obejmują transport, walki, solver i negocjacje poza Polami Chwały.

Testy offline używają atrap komunikacji i nie wykonują operacji na koncie. Nie zastępują sprawdzenia w zalogowanej sesji Brave. Obserwator fetch/XHR nie obejmuje wszystkich kanałów komunikacji gry.
