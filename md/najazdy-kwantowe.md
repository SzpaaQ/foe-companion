# ⚛️ Najazdy kwantowe

## Otwieranie zakładki

Ikona **⚛️** pojawia się, gdy rozszerzenie rozpozna osadę kwantową. Po otwarciu osady panel pokazuje dane przekazane przez grę. Jeśli nic się nie pojawia, odśwież kartę gry i ponownie otwórz osadę.

## Podsumowanie osady

Górna część zakładki zestawia zasoby osady, stan najazdu, euforię, wydajność i dostępne bonusy. Wartości są odczytem bieżącego stanu z gry. Podpowiedzi nad ikonami lub nazwami wyjaśniają skróty i dodatkowe szczegóły.

- **🪢 Liny** pokazują zapas lin; podpowiedź może podać, ile da się wyprodukować z obecnych zapasów. To szacunek kosztu z dostępnych zasobów, bez kosztu budowy wytwórni.
- **Wydajność na godzinę** opisuje tempo z aktualnego stanu osady.
- **Bonusy i zasoby** są odczytem gry; nie są poleceniem do budowy ani gwarancją przyszłej produkcji.
- **🚧** przy budynku oznacza, że trwa jego budowa. Suma może uwzględniać bieżące aktywne efekty budowy, ale nie prognozuje pełnego wpływu ukończonego budynku na pozostałe produkcje.

### Znaczenie ikon zasobów

- **🪙** — monety kwantowe.
- **🔨** — zaopatrzenie kwantowe, przedstawione jako młotki.
- **🔩** — chronostopy.
- **👑** — poziom trudności najazdu.
- **⌛** — termin zakończenia najazdu.
- **✨** — mnożnik produkcji wynikający z zadowolenia.
- **⚡** — produkcja działań kwantowych na godzinę.
- **⚔️** w podsumowaniu osady — szacowane walki na godzinę przy koszcie 3500 działań na walkę. W historii **⚔️ N** ma osobne znaczenie opisane niżej.

## Terminy zbiorów i prognoza

Budynki są grupowane według przewidywanego terminu zbioru. Kilka budynków o zbliżonym terminie tworzy jedną grupę. Zestawienie wylicza jeden przyszły zbiór na podstawie aktualnych produkcji; nie zakłada późniejszej sprzedaży, przebudowy ani ponownego uruchomienia produkcji.

- **xN** przy nazwie budynku oznacza liczbę budynków tego rodzaju.
- **—** oznacza brak danych dla danej wartości.
- Suma z budową pokazuje wartości dla bieżących pozycji oraz budynków w budowie zgodnie z opisem podpowiedzi.
- Dane otrzymane bezpośrednio z gry mają pierwszeństwo przed lokalnym katalogiem definicji.
- Kliknij wiersz godziny z symbolem **▸**, aby rozwinąć grupę i zobaczyć budynki oraz ich prognozowaną produkcję. **▾** oznacza grupę rozwiniętą; kliknij ponownie, aby ją schować. Grupy domyślnie są zwinięte.
- **Zestawienie** oraz **Pozostałe budynki** to zwijane nagłówki. Kliknij nagłówek, aby ukryć lub pokazać tabelę.
- W tabelach **😊** oznacza zadowolenie, **👥** populację, **⚡** produkcję działań na godzinę, **🔋** pojemność działań, **🗡️** bonus ataku, a **🛡️** bonus obrony. Kolumny pojawiają się tylko wtedy, gdy są dostępne dane.

## Wojsko

Sekcja **Wojsko** pokazuje dostępne jednostki, zdrowie, skład armii i czas ostatniego odczytu, jeśli takie informacje zostały przekazane. Gdy ich brakuje, otwórz ekran armii w grze. Panel nie odczytuje składu, którego gra mu nie udostępniła.

## Historia zbiorów

Przycisk **Historia zbiorów** otwiera pływające okno z zapisaną historią. Historia jest lokalna dla świata i gracza; nie odtwarza zdarzeń sprzed uruchomienia jej zapisu.

### Pasek historii

- **↶ Cofnij** cofa jedną z maksymalnie trzech ostatnich ręcznych zmian w historii. Nie usuwa późniejszych obserwacji z gry.
- **Eksport JSON** pobiera plik z historią. Jest to kopia danych do zachowania lub analizy.
- **×** zamyka okno historii. Strona gry pozostaje klikalna.
- Przycisk sortowania **Najnowsze ↑ / Najstarsze ↑** przełącza kolejność wpisów na liście.
- **Brak zapisanej historii zbiorów dla tego świata** oznacza, że rozszerzenie nie zarejestrowało jeszcze zdarzeń dla bieżącego profilu.
- **Pokaż starsze** doładowuje wcześniejsze wpisy listy.

### Wpisy historii i ich przyciski

- Kliknij nagłówek wpisu, aby rozwinąć szczegóły. Nagłówek podaje rodzaj zdarzenia i lokalną datę oraz godzinę.
- **× Usuń cały wpis** usuwa wybrany wpis historii.
- **Połącz z poprzednim zbiorem** łączy zbiór z wcześniejszym zbiorem tego samego najazdu, jeśli taki istnieje.
- **⚔️ N** podaje szacunkową, skumulowaną liczbę walk od początku najazdu do danego zbioru. To obliczenie z odstępów między zarejestrowanymi zbiorami i wydajności, a nie licznik walk odczytany z serwera.
- Sekcja **Działania (N)** rozwija listę budów, sprzedaży, zmian i zbiorów.
- **⠿** przy działaniu służy do przeciągania wiersza i zmiany kolejności. Zmieniona kolejność jest zapisywana. **↺ Resetuj kolejność** przywraca porządek chronologiczny.
- Pole **Dodaj notatkę…** zapisuje notatkę do działania. Zmiana i notatka są przypisane do działania, więc pozostają z nim przy przegrupowaniu.
- **✂️ Rozdziel od tego działania** rozpoczyna osobną grupę od wskazanego działania i kolejnych. Pierwszego działania grupy nie można rozdzielić od samej siebie.
- **× Usuń działanie** usuwa wybrane działanie z historii.

### Porównanie Przed i Po oraz zrzuty

- Rozwiń **Przed i Po**, aby porównać zapisany stan osady przed i po zbiorze. Brak danych jest opisany wprost.
- **📷** rozpoczyna zapis zrzutu ekranu dla etapu Przed lub Po. Dostępny przycisk dotyczy najnowszego zbioru w danym najazdzie; zapisanie nowego obrazu zastępuje poprzedni dla tego etapu.
- W panelu zrzutu ustaw w grze widok, który chcesz zachować. Sam panel i okno historii są na czas zdjęcia ukrywane. **📷 Wykonaj zrzut** zapisuje widoczny ekran gry, a **✕ Anuluj** wraca bez zapisu.
- Kliknięcie miniatury otwiera większy podgląd. **⬇** pobiera obraz na urządzenie. **×** zamyka podgląd.
- Jeżeli wcześniejszy zbiór ma zrzut „Po”, a bieżący nie ma obrazu „Przed”, historia może użyć poprzedniego zrzutu jako porównania.

## Ustawienia historii

W **Ustawienia → Najazdy kwantowe** znajdują się:

- **Dziennik zbiorów** pokazuje lub ukrywa przycisk **Historia zbiorów**.
- **Panel na zrzucie** dołącza podsumowanie osady do zrzutu.
- **Działania na zrzucie** dołącza listę działań do zrzutu.
- **Wyczyść dziennik zbiorów** po potwierdzeniu usuwa historię bieżącego gracza i świata. Operacji tej nie można cofnąć.

⚠️ Funkcja czyszczenia usuwa lokalne dane historii. Przed potwierdzeniem wyeksportuj JSON, jeśli chcesz zachować kopię.

## Notatka

Notatka na dole panelu jest wspólna dla zakładki Najazdy kwantowe. Osobne pola notatek przy działaniach w historii zapisują się w tych działaniach.
