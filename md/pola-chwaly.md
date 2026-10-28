# ⚔️ Pola Chwały

## Dane mapy i rozpiska

Otwórz mapę Pól Chwały w grze. Panel pokazuje otwarte sektory oraz godziny nadchodzących otwarć. Bez danych mapy pojawia się komunikat, aby ją otworzyć.

- **Otwarte sektory** to cele, na których można wykonać dostępne akcje. Wiersz pokazuje kolor sektora, jego nazwę, postęp przejęcia oraz szansę wzrostu oporu.
- **🟥 / 🟦** oznacza typ bitwy: atak albo obronę. Okrągły symbol przy nazwie sektora oznacza barwę gildii, która aktualnie go zajmuje: **🔴** czerwony, **🟢** zielony, **🟡** żółty, **🔵** niebieski lub turkusowy, **🟣** fioletowy, **🟠** pomarańczowy, **⚫** nieznana barwa. **⚪** to sektor naszej gildii.
- **⚔️ N/M** to postęp naszej gildii, gdy jest większy niż zero. **👾 N** pokazuje postęp przeciwnika. **🔥** oznacza wyścig lub zmaganie o sektor. **🔻 N%** przy liczniku oporu oznacza aktualny opór gracza; procent w wierszu sektora oznacza szansę wzrostu oporu. **✋** oznacza, że gildia oznaczyła sektor jako ignorowany, a **🎯** — że wskazała go do ataku.
- **🏆 N/M** pokazuje wygrane i zakończone walki wykonane przyciskami rozszerzenia w bieżącej sesji. To licznik sesji, nie ranking gry.
- **⏹ Stop walk** pojawia się podczas automatycznej walki. Kończy dalsze automatyczne kroki; rozpoczęta walka lub kolejna fala może zostać dokończona.
- **📋** przy nazwie sektora kopiuje opis tego sektora. **Kopiuj otwarte sektory** pod nagłówkiem kopiuje tekst wszystkich aktualnie wyświetlanych otwartych celów.
- Kliknięcie nazwy lub wiersza sektora zaznacza go. Zaznaczenie może podświetlić sektor w grze; wybór jest wyłączony podczas trwającej walki lub negocjacji.

## Rozpiska nadchodzących sektorów

Rozpiska pokazuje przyszłe otwarcia i aktualizuje się wraz z danymi gry. **tylko sąsiedzi** ogranicza listę do sektorów sąsiadujących z polami naszej gildii. Wyłącz tę opcję, aby zobaczyć pełną listę dostępnych przyszłych otwarć. **Kopiuj rozpiskę** kopiuje widoczny tekst do schowka.

### Przełączniki wyglądu rozpiski

Pod rozpiską w panelu oraz pod tabelą w oknie **Otwarte sektory**, przy prawej krawędzi, znajdują się małe przełączniki:

- **👾** — pokazuje postęp przeciwnika.
- **⚔️** — pokazuje postęp naszej gildii.
- **⚪** — pokazuje kolor gildii przy sektorze. Białe kółko jest ikoną przełącznika; w rozpisce pojawia się właściwy kolor gildii.
- **🔥** — **Oznaczaj wyścig**, pokazuje oznaczenie wyścigu o sektor.
- **🔻** — pokazuje szansę wzrostu oporu również przy zamkniętych sektorach.

Kliknij emoji, aby włączyć lub wyłączyć opcję. Włączona ikona jest w pełni widoczna (opacity 1) i ma ciemny cień, wyłączona jest przygaszona (opacity 0,5) i bez cienia. Oba zestawy i pola w **Ustawienia → Pola Chwały → Rozpiska** są zsynchronizowane, a wybór pozostaje po odświeżeniu strony. Opcje zmieniają treść rozpiski, kopiowanie pojedynczych sektorów i całej listy oraz format rozpiski na Discordzie. Nie ukrywają kolumn z postępem i szansą oporu w tabeli okna **Otwarte sektory**.

### Wysyłanie rozpiski na Discord

Pole **Wysyłaj rozpiskę** przy nagłówku rozpiski włącza lub wyłącza wysyłanie bieżącej listy na skonfigurowany kanał Discord. Funkcja sprawdza zmiany co sekundę, ale aktualizuje wiadomość tylko wtedy, gdy zmieni się treść. Jeśli ostatnia wiadomość na kanale nie jest zapamiętaną rozpiską, bot publikuje nową, aby bieżąca lista ponownie znalazła się na końcu kanału.

Konfigurację wykonuje się w **Ustawienia → Discord**. Filtr sąsiedztwa z pola **tylko sąsiedzi** obejmuje także wysyłaną listę. Limity liczby sektorów i czasu dotyczą wyłącznie zamkniętych sektorów; otwarte pozostają na liście. Wiersze otwartych i nadchodzących sektorów są rozdzielone pustym wierszem. Wiadomość nie dodaje nagłówków „Otwarte” ani „Zamknięte”. Discord ogranicza długość wiadomości, więc w razie zbyt długiej listy ustaw jeden z limitów.

Bot musi mieć dostęp do kanału oraz prawo do wyświetlania kanału i wysyłania wiadomości. Przycisk **Sprawdź połączenie** w ustawieniach sprawdza dostęp. Token bota traktuj jak hasło i nie udostępniaj go.

## Przyciski akcji

Przyciski akcji są widoczne po włączeniu ich w **Ustawienia → Pola Chwały**. Każdy może być niedostępny, gdy gra nie dostarczyła danych, trwa inna akcja, sektor wymaga innego rodzaju działania albo brakuje odpowiednich jednostek.

- **⚔️** rozpoczyna jedną szybką walkę na sektorze. Rozszerzenie może automatycznie wymienić armię na wybraną przez grę.
- **▶ / ⏹** przy ⚔️ rozpoczyna lub zatrzymuje automatyczne walki na jednym sektorze.
- **🤝** rozpoczyna pojedynczą negocjację.
- **▶ / ⏹** przy 🤝 uruchamia lub zatrzymuje automatyczne negocjacje na jednym sektorze.
- **⏳** oznacza, że żądanie jest przetwarzane. **✅** sygnalizuje powodzenie, a **⚠️** wynik wymagający sprawdzenia. Wynik gry może pojawić się z opóźnieniem.
- **🤝 / ⚔️ przy tytule lub uchwycie panelu** wskazuje działający automat danego rodzaju. Kliknięcie ikony otwiera modal sektorów; automat zatrzymasz przyciskiem **STOP** w modalu.
- **🗺️** po lewej stronie nagłówka modalu przełącza stały skrót do okna sektorów. Włączona ikona ma pełną widoczność; wyłączona jest przygaszona. Gdy skrót jest wyłączony, pływające ikony automatów pojawiają się tylko podczas ich działania. Ustawienie zapamiętuje się po odświeżeniu.
- Pozycja modalu sektorów jest zapamiętywana przy zamknięciu i przywracana przy następnym otwarciu. Pływające ikony ⚔️/🤝 nadal wskazują działający autoatak lub autonegocjacje po zamknięciu okna.
- **⏹ Stop nego** zatrzymuje dalsze automatyczne negocjacje. Rozpoczęta tura może się zakończyć.

⚠️ Walki, negocjacje oraz automaty wysyłają żądania do serwerów gry i zmieniają stan konta. Ich używanie może skutkować banem. Używasz na własną odpowiedzialność.

## Opcje pilnowania sektorów: **⋮**

Kliknij **⋮** przy nagłówku „Otwarte sektory”, aby otworzyć tabelę celów i opcji pilnowania. Tytuł okna brzmi **Otwarte sektory**. Można przeciągnąć okno za nagłówek. **×** lub klawisz Esc je zamyka. Okno odświeża dane, a po zmianie mapy zamyka się samo.

Na dole okna znajduje się zwijana **Konsola Pól Chwały**. Zapisuje akcje użytkownika związane z automatami, żądania walki i negocjacji faktycznie wysłane przez rozszerzenie oraz ich wyniki. Każdy wpis ma lokalną godzinę do sekundy (`HH:mm:ss`). Błędy są czerwone, wygrane zielone, a przegrane pomarańczowe. Konsola przewija się do najnowszego wpisu i przechowuje do 250 komunikatów z bieżącej karty i sesji strony; sam status połączenia nie tworzy wpisu. **📋** kopiuje wszystkie zapisane wpisy, a **🧹** czyści konsolę. Po wykonaniu którejś z tych czynności ikona na chwilę zmienia się na **✓**.

Tabela może zawierać otwarte sektory i określoną w ustawieniach liczbę nadchodzących sektorów (domyślnie 10). Nadchodzące wiersze są przygaszone i ich akcje są nieaktywne. Po czasie blokady automat odczekuje jeszcze 2 sekundy przed wysłaniem akcji; ruszy wcześniej, jeśli socket gry jawnie potwierdzi otwarcie sektora. Sektory należące do naszej gildii (⚪) są pomijane.

- **📋 Kopiuj wszystkie** kopiuje widoczne otwarte i nadchodzące sektory. **📋 Kopiuj zamknięte** obok kopiuje wyłącznie nadchodzące sektory z tabeli. Godzina otwarcia ma format `HH:mm`; tekst nie dodaje słowa „Otwarte”. Po udanym kopiowaniu przycisk przez około 1,5 sekundy pokazuje **✓**. Dotyczy to także małego **📋** przy sektorze. Przy błędzie pojawia się **Błąd kopiowania**.
- **👁️ Pokaż otwarte sektory** pod tabelą, przy prawej krawędzi, przełącza widoczność otwartych wierszy. Wyłączone oko jest przygaszone; włączone ma pełną widoczność i ciemny cień, jak pozostałe przełączniki emoji. Wybór zostaje po odświeżeniu. Ukryte otwarte wiersze nie trafiają do „Kopiuj wszystkie”; filtr nie zatrzymuje działań ani pilnowania sektorów.
- Zaznaczone lokalne **Ignoruj** wyłącza wiersz z kopiowania pojedynczego i zbiorczego oraz z przycisku **Kopiuj rozpiskę** w panelu. Sama łapka gildii nie jest tym lokalnym zaznaczeniem. Jeśli brak wierszy do skopiowania, odpowiedni przycisk w oknie jest nieaktywny.
- **Otwarcie** pokazuje odliczanie, a potem **Otwarte**.
- **Sektor** pokazuje kolor, nazwę, typ bitwy oraz symbole wyścigu i postępów. Małe **📋** kopiuje opis jednego sektora.
- **Postęp** pokazuje postęp naszej gildii. Osobna kolumna **👾** pokazuje postęp przeciwnika i limit sektora; kreska oznacza brak danych lub zerowy postęp.
- **%** pokazuje szansę na wzrost oporu.
- **⚔️** wykonuje jedną walkę, a **🤝** jedną negocjację. Kolumny mogą być ukryte przełącznikami w ustawieniach.
- **▶** w kolumnach autoataku i autonegocjacji uruchamia dany automat. Po uruchomieniu zmienia się w **⏹**, którym można go zatrzymać.
- Checkbox **Zamykaj sektory** obok **Ignoruj łapkę** ustawia globalny autoatak i autonegocjacje tak, by pomijały limity progresu, rezerwę walk i limit sukcesów negocjacji oraz kontynuowały wybrany sektor do jego zamknięcia. Nadal obowiązują typ walki, szansa wzrostu oporu, limit oporu negocjacji, towary, lokalne **Ignoruj** i **STOP**. Negocjacje bez wystarczających towarów przechodzą na walki. Trzy kolejne przegrane walki zatrzymują automat i wyświetlają komunikat o niepowodzeniu. Zmiana checkboxa zatrzymuje automat; uruchom go ponownie.
- **🔔** przy wierszu włącza powiadomienie, gdy wróg atakuje sektor. Kliknięcie nagłówka 🔔 przełącza tę opcję dla wszystkich dostępnych wierszy.
- **🕐** rozpoczyna zamykanie sektora 30 sekund przed pełną godziną. Zaznaczenie w ostatnich 30 sekundach godziny uruchamia je od razu. Jeśli trwa inna akcja, wyzwalacz czeka i ponawia próbę uruchomienia. Zaznaczenie znika dopiero po starcie. Kliknięcie nagłówka przełącza opcję w całej kolumnie.
- **⚡** rozpoczyna zamykanie, gdy postęp wroga osiągnie lub przekroczy ustawiony próg procentowy. Kliknięcie nagłówka przełącza opcję w całej kolumnie.
- **Ignoruj** to lokalny checkbox pomijania sektora przez automatyczne walki i negocjacje otwartych sektorów. Nie zmienia oznaczeń gildii i nie blokuje ręcznie uruchomionej akcji.
- Czerwone tło wiersza oznacza gildyjne **Ignoruj łapkę**; zielone tło oznacza gildyjny **cel ataku** (🎯). Oznaczenia są zapisane w `GuildBattlegroundParticipant.signals` jako `ignore` lub `focus` z `provinceId`. Przechwycony HAR pokazuje je w `getBattleground`; jeśli aktualizacja `getPlayerParticipant` przyjdzie przez socket, panel też ją przetwarza. Przy jednoczesnych oznaczeniach czerwone tło ma pierwszeństwo.
- **⚔️ N/M**, **🤝 N/M** oraz licznik oporu na dole okna podsumowują działania rozszerzenia w bieżącej sesji.
- Pasek **Automatyzacja otwartych sektorów** pokazuje dostępne działania. Przycisk **▶ ⚔️** uruchamia globalny autoatak, gdy w ustawieniach jest włączony przynajmniej jeden typ: **Autoatak: 🟥 Atak** lub **Autoatak: 🟦 Obrona**. Jeśli oba są wyłączone, przycisk autoataku jest ukryty. **▶ 🤝** uruchamia globalne autonegocjacje, jeśli włączono wyświetlanie przycisków negocjacji. **⏹** zatrzymuje dalsze działania.
- Checkbox **Ignoruj łapkę** pozwala globalnemu autoatakowi pominąć gildyjne oznaczenie ignorowania. Lokalne **Ignoruj** w tabeli nadal obowiązuje. Negocjacje nadal respektują oznaczenie gildii.
- Tekst pod przyciskami wyjaśnia przyczynę, gdy negocjacje są zablokowane, np. zbyt wysoki opór gracza. Domyślny limit wynosi 100; przy oporze 68 negocjacje nie powinny być zablokowane tym limitem.

## Nasze sektory: **🏠**

Kliknij **🏠** obok nagłówka, aby zobaczyć sektory należące do naszej gildii. Okno można przesuwać za nagłówek; **×** lub Esc je zamyka.

- **📋 Kopiuj** kopiuje widoczne wiersze tabeli do schowka. W kopii czas otwarcia ma format `HH:mm`, a otwarty sektor jest opisany jako **Otwarte**. Postępy, kolor gildii i oznaczenie wyścigu respektują emoji przełączniki pod tabelą. Po skopiowaniu przycisk na chwilę pokaże **✓**.
- Ikona **📋** przy sektorze kopiuje tylko ten jeden wpis w tym samym formacie. Po skopiowaniu ikona na chwilę zmieni się na **✓**.
- Wiersze są sortowane po czasie otwarcia: otwarte sektory na górze, nadchodzące według najbliższego czasu otwarcia.
- Emoji przełączniki pod tabelą są wspólne z ustawieniami rozpiski. Włączone opcje są wyraźniejsze; wyłączone mają opacity 0.5.
- **🕐** w nowej kolumnie pokazuje odliczanie do otwarcia sektora naszej gildii; po otwarciu wyświetla **Otwarte**.
- **🏰** oznacza sektor naszej gildii. Wartość pokazuje jego typ, kolor i nazwę.
- **👾** pokazuje postęp ataku przeciwnika jako bieżący postęp / maksymalny postęp. **—** oznacza brak postępu.
- **🏗️** to trzy kwadraty miejsc na budynki: pełny oznacza zajęte, półprzezroczysty wolne, niewidoczny nieistniejące miejsce. Podpowiedź podaje liczbę zajętych miejsc.
- **🛡️** opisuje sąsiednie sektory i ich szansę wzrostu oporu.
- **✋** oznacza sektor oznaczony przez gildię jako ignorowany; **🎯** oznacza sektor wskazany przez gildię do ataku.
- Gdy nie ma własnych sektorów, tabela pokazuje komunikat **Brak sektorów należących do naszej gildii**.

W pasku nad tabelą modalu **Otwarte sektory** checkboxy **Ignoruj łapkę** i **Zamykaj sektory** są dosunięte do prawej krawędzi, za przyciskami automatów i STOP.

Alert **🔔** małego okna pojawia się dla sektora z włączonym checkboxem alarmu, gdy sektor jest otwarty, należy do innej gildii i ma postęp wroga. Wyłączenie dźwięku nie wyłącza okna. Przycisk **×** ukrywa bieżący alarm; gdy postęp wroga spadnie do zera, kolejne wznowienie ataku ponownie wyświetli alert.

## Notatka

Notatka na dole panelu jest wspólna dla tej zakładki. Patrz [Notatki](wspolne.md#notatki).

Opcja **Ignoruj łapkę** jest widoczna, gdy włączono przyciski ataku i co najmniej jeden typ autoataku (🟥 lub 🟦). Typy te nie ograniczają negocjacji. Liczniki walk i negocjacji są widoczne przy włączonych przyciskach danego rodzaju. Opisy zamykania są widoczne, gdy wybrana metoda zamykania jest dostępna. Komunikat o wyłączonych przyciskach nie pozostaje w statusie okna. Jeśli lista Discorda stanie się pusta, poprzednią rozpiskę zastępuje informacja „Brak sektorów w rozpisce.”. Grupy sektorów rozdziela pusty wiersz, bez słowa „Otwarte”.

### Jak działają zamykania 🕐 i ⚡

Zaznaczenie zamykania jest poleceniem przejęcia wybranego sektora. Pomija łapkę gildii, lokalne **Ignoruj**, wybór typu ataku/obrony, rezerwę walk, limity postępu, sukcesów negocjacji, oporu i szansy jego wzrostu. Ukryte przyciski akcji nie blokują wcześniej zaznaczonego zamykania. Zamykanie czeka na zakończenie bieżącej akcji; może następnie zatrzymać zwykły automat i przejąć wykonywanie działań.

Domyślnie powtarza walki. Przy włączonym **Zamykaj sektory negocjacjami** ponawia negocjacje także po porażce, dopóki sektor jest otwarty i wystarcza towarów. Przed każdą turą sprawdza ilość potrzebnych towarów; nie kupuje ich za diamenty. Jeśli towarów zabraknie, kończy aktywną negocjację i dopiero po potwierdzeniu jej zakończenia przechodzi na walki na tym sektorze.

Po **trzech kolejnych przegranych walkach** zatrzymuje zamykanie i pokazuje **Nie udało się zamknąć sektora — 3 przegrane walki z rzędu.** Wygrana walka zeruje serię porażek. Porażki negocjacji nie są doliczane do tej serii. Aby ponowić zamykanie po zatrzymaniu, ponownie zaznacz właściwą opcję 🕐 lub ⚡.

**STOP** wstrzymuje zamykanie; trwająca akcja może zostać dokończona. Brak jednostek, niepotwierdzony wynik, utrata połączenia lub błąd gry także zatrzymują działania. Zamykanie kończy się, gdy sektor zostaje przejęty lub zablokowany; rozszerzenie nie może zagwarantować przejęcia przed inną gildią. Negocjacja na Polach Chwały wysyła najwyżej trzy tury.
