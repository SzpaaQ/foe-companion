# Historia zbiorów — zmiany lokalne, bez nowego wydania

Przycisk **Historia zbiorów** w Najazdach otwiera modal. Historia jest zapisywana
w IndexedDB na domenie gry, osobno dla świata i identyfikatora gracza. Wyczyszczenie
danych witryny usuwa tę historię. Eksport JSON pobiera lokalny plik; nie wykonuje
żądania sieciowego. Plik zawiera wersję formatu, świat, ID gracza i zapisane zdarzenia.

Każdy wpis przechowuje czas obserwacji, stan osady i podsumowanie z chwili zdarzenia.
Działania mają także stan przed zmianą. Samo wczytanie strony nie tworzy wpisu; nie rekonstruujemy działań wykonanych podczas nieobecności rozszerzenia.
Wartości produkcji to prognozy obliczone przez panel, nie potwierdzone kwoty wypłat.

Odbiór rozpoznajemy z odpowiedzi CityProductionService.pickupProduction/pickupAll
i zmiany stanu znanego budynku kwantowego. Sam upływ czasu nie jest odbiorem.
Ekonomiczne odbiory partiami mają wspólny numer, jeżeli terminy ich produkcji mieszczą
się w godzinie od początku grupy i nie minął kolejny 10-godzinny cykl. Powtórny odbiór
tego samego budynku rozpoczyna kolejny cykl. W modalu dostępna jest ręczna korekta
grupowania. Numery odnoszą się do zaobserwowanych zbiorów, nie całego sezonu sprzed
uruchomienia historii.

Porównanie identyfikatorów budynków wykrywa dodanie, usunięcie, zmianę typu/poziomu,
zmianę połączenia. Ukończenie budowy nie tworzy osobnej akcji. Współrzędne są zachowywane, ale samo przesunięcie
nie tworzy wpisu. Częściowe aktualizacje nie usuwają budynków pominiętych w odpowiedzi.
Usunięcia rozpoznajemy z pełnej mapy lub deleteEntity, gdy aktywna jest mapa kwantowa.
Rozszerzenia wykrywamy po zmianie unlocked_areas w pełnej mapie. Czas takiego wpisu
jest czasem wykrycia, nie gwarantowanym czasem zakupu; kosztu nie zgadujemy z salda.

HAR najazdy-kwantowe.har zawiera wejście do osady. Obsługa transakcji bazuje również
na protokole w zapisanym skrypcie ForgeHX i testach syntetycznych. HAR obejmujący
rzeczywisty zbiór, budowę, usunięcie oraz zakup rozszerzenia jest potrzebny do
weryfikacji wszystkich wariantów odpowiedzi działającej gry.

Nowy plik quantum-history.js jest ładowany przez manifest i obserwowany przez serwer
deweloperski. Po aktualizacji przeładuj rozszerzenie i stronę gry; jeśli używasz
START-DEV.cmd, uruchom ponownie serwer, aby wczytał nową listę plików.

Testy: node --test quantum-history.test.cjs quantum-history-ui.test.cjs
quantum-construction.test.cjs module-loading.test.cjs panel-render.test.cjs


## Zmiany najazdów — 21 października, lokalne

- Bez nowych wpisów początku obserwacji, zapisu stanu i ukończenia budowy. Stare techniczne wpisy pozostają w archiwalnych danych, ale są ukryte w widoku.
- Odbiory z rozpoznanych budynków mają nazwę. Osobne rodzaje budynków otrzymują osobne wiersze.
- Sąsiednie identyczne akcje w obrębie grupy i odstępie do dwóch minut łączą się w kafelki, np. +3× Posiadłość; odmienna uwaga rozdziela grupy.
- Pole uwagi zapisuje się po zakończeniu edycji (opuszczeniu pola), pozostaje po ponownym uruchomieniu i trafia do eksportu JSON. Edycja grupy dotyczy jej obecnych składników.
- Usuwanie kafelka nie usuwa innych rodzajów budynków z tej samej odpowiedzi gry. Zachowane migawki Przed/Po są oryginalnymi danymi obserwacji.
- Porównanie Przed/Po ma dwie wycentrowane kolumny; na ekranach do 600 px układa się pionowo. Eksport po prawej, zamknięcie × bez obramowania. Dodano odstęp od suwaka panelu najazdów.
