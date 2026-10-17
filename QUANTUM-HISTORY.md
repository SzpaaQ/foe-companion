# Historia zbiorów — zmiany lokalne, bez nowego wydania

Przycisk **Historia zbiorów** w Najazdach otwiera modal. Historia jest zapisywana
w IndexedDB na domenie gry, osobno dla świata i identyfikatora gracza. Wyczyszczenie
danych witryny usuwa tę historię. Eksport JSON pobiera lokalny plik; nie wykonuje
żądania sieciowego. Plik zawiera wersję formatu, świat, ID gracza i zapisane zdarzenia.

Każdy wpis przechowuje czas obserwacji, stan osady i podsumowanie z chwili zdarzenia.
Działania mają także stan przed zmianą. Pierwszy zapis po wczytaniu strony to granica
obserwacji — nie rekonstruujemy działań wykonanych podczas nieobecności rozszerzenia.
Wartości produkcji to prognozy obliczone przez panel, nie potwierdzone kwoty wypłat.

Odbiór rozpoznajemy z odpowiedzi CityProductionService.pickupProduction/pickupAll
i zmiany stanu znanego budynku kwantowego. Sam upływ czasu nie jest odbiorem.
Ekonomiczne odbiory partiami mają wspólny numer, jeżeli terminy ich produkcji mieszczą
się w godzinie od początku grupy i nie minął kolejny 10-godzinny cykl. Powtórny odbiór
tego samego budynku rozpoczyna kolejny cykl. W modalu dostępna jest ręczna korekta
grupowania. Numery odnoszą się do zaobserwowanych zbiorów, nie całego sezonu sprzed
uruchomienia historii.

Porównanie identyfikatorów budynków wykrywa dodanie, usunięcie, zmianę typu/poziomu,
ukończenie budowy i zmianę połączenia. Współrzędne są zachowywane, ale samo przesunięcie
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
