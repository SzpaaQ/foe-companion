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
- **🤝 / ⚔️ przy tytule lub uchwycie panelu** wskazuje działający automat danego rodzaju. Kliknięcie ikony zatrzymuje ten automat.
- **⏹ Stop nego** zatrzymuje dalsze automatyczne negocjacje. Rozpoczęta tura może się zakończyć.

⚠️ Walki, negocjacje oraz automaty wysyłają żądania do serwerów gry i zmieniają stan konta. Ich używanie może skutkować banem. Używasz na własną odpowiedzialność.

## Opcje pilnowania sektorów: **⋮**

Kliknij **⋮** przy nagłówku „Otwarte sektory”, aby otworzyć tabelę celów i opcji pilnowania. Tytuł okna brzmi **Otwarte sektory**. Można przeciągnąć okno za nagłówek. **×** lub klawisz Esc je zamyka. Okno odświeża dane, a po zmianie mapy zamyka się samo.

Tabela może zawierać wszystkie otwarte sektory oraz do pięciu najbliższych sektorów, które dopiero się otworzą. Nadchodzące wiersze są przygaszone i ich akcje są nieaktywne. Godzina odlicza się do stanu **Otwarte**. Sektory należące do naszej gildii (⚪) są pomijane.

- **📋 Kopiuj wszystkie** kopiuje widoczne otwarte i nadchodzące sektory. Dla zamkniętego sektora używa lokalnej godziny otwarcia `HH:mm`; otwarty jest oznaczony jako „Otwarte”.
- **Otwarcie** pokazuje odliczanie, a potem **Otwarte**.
- **Sektor** pokazuje kolor, nazwę, typ bitwy oraz symbole wyścigu i postępów. Małe **📋** kopiuje opis jednego sektora.
- **Postęp** pokazuje postęp naszej gildii.
- **%** pokazuje szansę na wzrost oporu.
- **⚔️** wykonuje jedną walkę, a **🤝** jedną negocjację. Kolumny mogą być ukryte przełącznikami w ustawieniach.
- **▶** w kolumnach autoataku i autonegocjacji uruchamia dany automat. Po uruchomieniu zmienia się w **⏹**, którym można go zatrzymać.
- **🔔** przy wierszu włącza powiadomienie, gdy wróg atakuje sektor. Kliknięcie nagłówka 🔔 przełącza tę opcję dla wszystkich dostępnych wierszy.
- **🕐** włącza próbę zamknięcia sektora 30 sekund przed pełną godziną. Kliknięcie nagłówka przełącza opcję w całej kolumnie.
- **⚡** włącza próbę zamknięcia sektora, gdy postęp wroga przekroczy ustawiony próg. Kliknięcie nagłówka przełącza opcję w całej kolumnie.
- **Ignoruj** to lokalny checkbox pomijania sektora przez automatyczne walki i negocjacje otwartych sektorów. Nie zmienia oznaczeń gildii i nie blokuje ręcznie uruchomionej akcji.
- **⚔️ N/M**, **🤝 N/M** oraz licznik oporu na dole okna podsumowują działania rozszerzenia w bieżącej sesji.
- Pasek **Automatyzacja otwartych sektorów** pokazuje dostępne działania. Przycisk **▶ ⚔️** uruchamia globalny autoatak, gdy w ustawieniach jest włączony przynajmniej jeden typ: **Autoatak: 🟥 Atak** lub **Autoatak: 🟦 Obrona**. Jeśli oba są wyłączone, przycisk autoataku jest ukryty. **▶ 🤝** uruchamia globalne autonegocjacje, jeśli włączono wyświetlanie przycisków negocjacji. **⏹** zatrzymuje dalsze działania.
- Checkbox **Ignoruj łapkę** pozwala globalnemu autoatakowi pominąć gildyjne oznaczenie ignorowania. Lokalne **Ignoruj** w tabeli nadal obowiązuje. Negocjacje nadal respektują oznaczenie gildii.
- Tekst pod przyciskami wyjaśnia przyczynę, gdy negocjacje są zablokowane, np. zbyt wysoki opór gracza. Domyślny limit wynosi 100; przy oporze 68 negocjacje nie powinny być zablokowane tym limitem.

## Nasze sektory: **🏠**

Kliknij **🏠** obok nagłówka, aby zobaczyć sektory należące do naszej gildii. Okno można przesuwać za nagłówek; **×** lub Esc je zamyka.

- **🏰** oznacza sektor naszej gildii. Wartość pokazuje jego typ, kolor i nazwę.
- **👾** pokazuje postęp ataku przeciwnika jako bieżący postęp / maksymalny postęp. **—** oznacza brak postępu.
- **🏗️** to trzy kwadraty miejsc na budynki: pełny oznacza zajęte, półprzezroczysty wolne, niewidoczny nieistniejące miejsce. Podpowiedź podaje liczbę zajętych miejsc.
- **🛡️** opisuje sąsiednie sektory i ich szansę wzrostu oporu.
- **✋** oznacza sektor oznaczony przez gildię jako ignorowany; **🎯** oznacza sektor wskazany przez gildię do ataku.
- **Brak sektorów należących do naszej gildii** oznacza, że panel nie znalazł własnych pól na aktualnej mapie.

## Notatka

Notatka na dole panelu jest wspólna dla tej zakładki. Patrz [Notatki](wspolne.md#notatki).

Opcja **Ignoruj łapkę** jest widoczna, gdy włączono przyciski ataku i co najmniej jeden typ autoataku (🟥 lub 🟦). Typy te nie ograniczają negocjacji. Liczniki walk i negocjacji są widoczne przy włączonych przyciskach danego rodzaju. Opisy zamykania są widoczne, gdy wybrana metoda zamykania jest dostępna. Komunikat o wyłączonych przyciskach nie pozostaje w statusie okna. Jeśli lista Discorda stanie się pusta, poprzednią rozpiskę zastępuje informacja „Brak sektorów w rozpisce.”. Grupy sektorów rozdziela pusty wiersz, bez słowa „Otwarte”.
