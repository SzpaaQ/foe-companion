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

Emoji **📨** przy nagłówku rozpiski włącza lub wyłącza wysyłanie bieżącej listy na skonfigurowany kanał Discord. Kliknij **🔓**, aby dołączać otwarte sektory. Ta opcja jest domyślnie wyłączona i steruje również ich kopiowaniem przyciskiem **📋 Discord**. Obie ikony mają tooltip ze stanem; przygaszona ikona jest wyłączona. Funkcja sprawdza zmiany co sekundę, ale aktualizuje wiadomość tylko wtedy, gdy zmieni się treść. Jeśli ostatnia wiadomość na kanale nie jest zapamiętaną rozpiską, bot publikuje nową, aby bieżąca lista ponownie znalazła się na końcu kanału.

Konfigurację wykonuje się w **Ustawienia → Discord**. Checkbox **Wysyłaj otwarte** jest zsynchronizowany z **🔓**. Filtr sąsiedztwa z pola **tylko sąsiedzi** obejmuje także wysyłaną i kopiowaną listę. Limity liczby sektorów i czasu dotyczą wyłącznie zamkniętych sektorów. Gdy otwarte sektory są włączone, ich wiersze i nadchodzące sektory są rozdzielone pustym wierszem. Wiadomość nie dodaje nagłówków „Otwarte” ani „Zamknięte”. Discord ogranicza długość wiadomości, więc w razie zbyt długiej listy ustaw jeden z limitów.

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

Konsola w sekcji **Szczegóły** jest dostępna w widoku zaawansowanym po włączeniu przycisków ataku lub negocjacji. Gdy oba rodzaje przycisków są wyłączone, cały wiersz **Szczegóły** jest ukryty.

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
- Checkbox **Zamykaj sektory** (widoczny tylko w trybie zaawansowanym) obok **Ignoruj łapkę** ustawia globalny autoatak i autonegocjacje tak, by pomijały limity progresu, rezerwę walk i limit sukcesów negocjacji oraz kontynuowały wybrany sektor do jego zamknięcia. Nadal obowiązują typ walki, szansa wzrostu oporu, limit oporu negocjacji, towary, lokalne **Ignoruj** i **STOP**. Negocjacje bez wystarczających towarów przechodzą na walki. Trzy kolejne przegrane walki zatrzymują automat i wyświetlają komunikat o niepowodzeniu. Zmiana checkboxa zatrzymuje automat; uruchom go ponownie.
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


### Okna sektorów

Przycisk 🏠 obok tytułu „Otwarte sektory” otwiera i zamyka okno „Nasze sektory”. Oba okna można rozciągać w pionie i poziomie za prawy dolny róg. Tooltip nazwy sektora ma nagłówek „Nasze sektory” i pokazuje każdego naszego sąsiada w osobnym wierszu. Checkboxy sterowania znajdują się razem przy prawej krawędzi górnego paska.

Aktywne zagrożenie odcięciem pojawia się również w małym oknie „Pola chwały” jako wpis ⚠️ z nazwą sektora. Takie wpisy mają pierwszeństwo na liście i znikają po wygaśnięciu zagrożenia (chyba że sektor nadal spełnia warunki zwykłego powiadomienia). Małe okno pokazuje zagrożenie wyłącznie dla otwartych sektorów do zdobycia, niezależnie od opcji oznaczania zamkniętych w tabeli.

Zagrożenie odcięciem wymaga dokładnie jednego naszego sąsiada. Ten sąsiad musi być otwarty, a postęp wroga na nim musi wzrosnąć w ostatnich 60 sekundach. Przy co najmniej dwóch naszych sąsiadach nie ma oznaczenia odcięcia, również jeśli część z nich jest zamknięta. Zastany postęp, zamknięcie albo utrata sąsiada nie są uznawane za świeży atak. Warunek jest wspólny dla oznaczenia w tabeli i opcji „Zamykaj zagrożone”.


## Okna sektorów i wybór celu — 0.7.09

- 🌐 otwiera Wszystkie sektory, posortowane po czasie otwarcia, z sąsiadami i zajętymi slotami budynków. Własne sektory nie mają dostępnych akcji ataku. Widok współdzieli sterowanie, filtry, kopiowanie i konsolę z oknem Otwartych sektorów; przełączenie widoku zachowuje działający automat.
- ⚙️ obok 🏠 otwiera ustawienia ataku, negocjacji i automatyzacji bez zwijania sekcji. Zmiana trafia do tych samych ustawień co w panelu.
- ▶ przy sektorze wybiera go do automatycznej obsługi. Globalna kolejka kończy rozpoczętą akcję, następnie obsługuje wskazany sektor i wraca do wcześniej włączonych trybów. STOP anuluje również oczekujące przełączenie i powrót.
- Otwarte sektory z postępem 0 mogą rozpocząć pierwszą walkę lub negocjację mimo braku maksymalnego postępu w danych gry. Nadal obowiązują pozostałe ustawienia, towary, opór i bufor otwarcia 2 s lub jawne potwierdzenie otwarcia przez grę.
- ⚠️ przy zamkniętym sektorze i w rozpisce ostrzega, jeśli wszyscy nasi sąsiedzi otwierają się wcześniej niż cel. To prognoza możliwego odcięcia; tooltip podaje naszych sąsiadów. Nie uruchamia sama opcji Zamykaj zagrożone, która nadal wymaga aktywnego ataku na jedynego dostępnego sąsiada.
- Nasze sektory pokazują sąsiadów w osobnych liniach: odliczanie, kolor gildii, sektor, właściciel i opór. Nasza gildia ma biały kolor.
- W oknach sektorów przewija się tabela; nagłówek i stopka pozostają widoczne. Rozwijana Konsola Pól Chwały ma kopiowanie i czyszczenie po lewej.
- 🟥 / 🟦 przy automatach przełączają typy sektorów Atak/Obrona; tooltip podaje wł./wył. Opcja Przełącz na atak, gdy skończą się towary jest domyślnie wyłączona i wymaga dostępnej funkcji ataku oraz zakończenia poprzedniej negocjacji.

## Sterowanie w oknie sektorów

Okno dostępnych ustawień używa tych samych kolorów i kontrolek co panel: etykiety są po lewej, pola po prawej. Dostępność ustawień jest taka sama jak w panelu.

**⏹ STOP** w nagłówku jest widoczny również podczas automatu pojedynczego sektora i oczekiwania na jego uruchomienie. Rozpoczęta walka zostaje dokończona.

W globalnym autoataku dostępne sektory oznaczone **🎯** mają pierwszeństwo. Zmiany oznaczeń otrzymane z gry są uwzględniane przed kolejną akcją; priorytet nie omija blokady sektora, lokalnego ignorowania ani pozostałych limitów.

Po wyłączeniu **Ignoruj łapkę** nowa automatyczna walka lub negocjacja nie rozpoczyna się na sektorze oznaczonym **✋**, także przy automacie pojedynczego sektora. Jawne wymuszone zamykanie według reguł pilnowania zachowuje wcześniejsze wyjątki.

Pod rozpiską znajduje się jeden wiersz: **📋** kopiuje rozpiskę, **📋 Discord** kopiuje format Discorda, a emoji po prawej sterują zawartością. Pola Prefix i Suffix w ustawieniach Discorda mają jednakową szerokość.

## Ustawienia i przełączanie widoku

**⚙️** otwiera całą sekcję Pól Chwały (w tym Rozpiskę i Alert) oraz Discord. Widoczne są te same opcje co w panelu. **🌐** w nagłówku przełącza na wszystkie sektory, a **⚔️** w tym miejscu wraca do otwartych.

Przełącznik **⚠️** pod rozpiską i tabelą włącza lub wyłącza ostrzeżenia w treści rozpiski oraz jej kopiowaniu. Nie wyłącza wykrywania zagrożenia. Skróty rozpiski są bez tooltipów. Kopiowanie **📋 Discord** otacza rozpiskę trzema backtickami, bez oznaczenia języka.

Przy włączonym wysyłaniu rozszerzenie co minutę odczytuje ostatnią wiadomość kanału. Jeśli rozpiska została usunięta lub ktoś napisał po niej, publikuje nową, nawet gdy jej treść się nie zmieniła. Bot musi mieć uprawnienie odczytu historii wiadomości. Błąd sprawdzenia wstrzymuje wysyłanie; szczegóły są w statusie Discorda.

Najedź na **⚠️ przy konkretnym sektorze w rozpisce**, aby zobaczyć jego własnych sąsiadów, po jednym wierszu. Godzina oznacza otwarcie sąsiada; **⚠️mm:ss** to czas od jego otwarcia do otwarcia celu (dla już otwartego sąsiada: czas pozostały od teraz). **👾** pokazuje postęp wroga, jeśli jest większy od zera. Cała rozpiska nie ma wspólnego tooltipu.

**Kopiowanie 📋 Discord:** kopiuje dokładnie zawartość widocznego pola rozpiski (zamknięte sektory, z aktualnym filtrem „tylko sąsiedzi”), otoczoną potrójnymi backtickami oraz ustawionym prefiksem i sufiksem. Nie dopisuje otwartych sektorów ani nie stosuje dodatkowych limitów automatycznej wysyłki.

### Zamykanie sektora zagrożonego odcięciem

Kolumna ⚡ uwzględnia również jedynego własnego sąsiada zapewniającego dostęp do celu. Sąsiad musi być otwarty, postęp wroga musi świeżo rosnąć (w ostatnich 60 sekundach) i przekroczyć próg z ustawień zamykania. Przy dwóch lub większej liczbie własnych sąsiadów ten warunek nie działa. Zamknięty sąsiad albo nieruchomy postęp nie uruchamia zamykania.

Opcja **Zamykaj zagrożone** również stosuje ten próg. Samo wizualne ostrzeżenie ⚠️ nadal może pojawić się wcześniej. Zamykanie korzysta z wybranej metody walk/negocjacji i respektuje STOP.
