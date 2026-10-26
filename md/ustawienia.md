# ⚙️ Ustawienia

Każdy nagłówek ze strzałką jest zwijaną sekcją. Kliknij go, aby rozwinąć lub schować zawartość. Stan sekcji jest zapamiętywany.

## Ustawienia → Perły

- **Przelicznik** określa mnożnik proponowanych wpłat. Dozwolone wartości to liczby większe od zera i nie większe niż 10, z maksymalnie czterema miejscami po przecinku.
- **Bonus Arki (%)** podaje procent bonusu Arki używany do wyliczenia szacowanej nagrody i zysku. Zakres: 0–1000%.
- **Kopiuj kwotę (klawisze 1–5)** pozwala kopiować kwotę dla miejsc P1–P5 po naciśnięciu cyfr 1–5. Wyłącz tę opcję, jeśli skrót przeszkadza w grze.

## Ustawienia → Wysuwaj panel

Każdy checkbox włącza automatyczne wysunięcie panelu po otwarciu wskazanego ekranu gry:

- **Otwarcie perły** — po otwarciu perły architektury.
- **Pola Chwały** — po otwarciu mapy Pól Chwały.
- **Osada kwantowa** — po otwarciu osady kwantowej.
- **Negocjacje** — po otwarciu ekranu negocjacji poza Polami Chwały.

## Ustawienia → Pola Chwały

- **Wyświetlaj przyciski ataku** pokazuje przyciski ręcznej i automatycznej walki przy sektorach.
- **Wyświetlaj przyciski negocjacji** pokazuje przyciski ręcznej i automatycznej negocjacji przy sektorach.
- **Alert** włącza dźwiękowy sygnał o sektorze wkrótce otwieranym lub atakowanym przez przeciwnika. Możesz go też użyć razem z pilnowaniem w tabeli sektorów.
- Lista dźwięków **Sygnał alertu** pozwala wybrać **Trzy piknięcia**, **Ding-dong**, **Pojedynczy**, **Melodyjka** albo **Alarm**.
- Pole **Wyprzedzenie w minutach** określa, ile minut przed otwarciem mają pojawiać się zwykłe alerty. Wartość od 1 do 60 minut.
- **▶ Odsłuch sygnału** odtwarza wybrany dźwięk. Przeglądarka może wymagać wcześniejszego kliknięcia na stronie, zanim pozwoli odtwarzać dźwięk.
- **Autoatak: Pozostaw walk** określa, ile walk należy zachować jako rezerwę. Wartość zero nie pozostawia rezerwy.
- **Przerwa (s)** określa minimalne i maksymalne opóźnienie między automatycznymi walkami. Wartości muszą być nieujemne, a maksymalna nie mniejsza niż minimalna. Automat zatrzymuje się po trzech porażkach z rzędu.
- **Negocjacje: Między turami (s)** określa minimalną i maksymalną przerwę pomiędzy turami negocjacji. Zakres to 0–60 sekund; maksymalna wartość musi być nie mniejsza niż minimalna.
- **Zamykaj sektory negocjacjami** pozwala opcji 🕐 i ⚡ zamykać sektor negocjacjami zamiast walkami. Warunki negocjacji, m.in. dostępny opór i rezerwa, nadal muszą być spełnione.
- **Autozamykanie ⚡: próg postępu wroga (%)** określa próg 1–100%, domyślnie 50%. Sektor kwalifikuje się, gdy postęp wroga jest wyższy od tego progu.
- **Autoatak: limit progresu (%)** ogranicza autoatak do sektorów, których postęp naszej gildii jest poniżej ustawionej granicy. Sektor, który osiągnął granicę, jest pomijany.
- **Autoatak: maks. szansa wzrostu oporu (%)** ogranicza autoatak do sektorów o nie większej szansie wzrostu oporu. Domyślnie to 20%. Wartość zero dopuszcza tylko sektory bez ryzyka; nieznana szansa nie przechodzi limitu.
- **Negocjacje: limit progresu (%)** ogranicza automatyczne negocjacje do sektorów, których postęp naszej gildii jest poniżej ustawionej granicy.
- **Negocjacje: sukcesy na otwarcie** ustala limit udanych negocjacji na dane otwarcie sektora. Domyślnie są to 3 sukcesy; zakres wynosi 1–10000. Nie jest to limit porażek.
- **Negocjacje: maksymalny opór** określa najwyższy opór gracza, przy którym automat może negocjować. Domyślnie wynosi 0; gdy opór jest wyższy albo nie został odczytany, negocjacje są blokowane.
- **Autoatak: bonus atakujący** i **bonus obronny** określają, które typy walk może podejmować automat.

Po zmianie ustawień automaty zatrzymują się, aby nie kontynuować ze starą konfiguracją. Uruchom je ponownie, jeśli chcesz pracować z nowymi wartościami.

## Ustawienia → Budynki

- **Wyświetlaj przyciski zbiorów** pokazuje przycisk **🤲** przy budynkach oraz **🤲 Zbierz wszystkie** w zakładce Zbiory. Wyłączenie opcji ukrywa przyciski zbioru.

⚠️ Walki, negocjacje i zbiory wysyłają żądania do serwerów gry i zmieniają stan konta. Ich używanie może skutkować banem. Używasz na własną odpowiedzialność.

## Ustawienia → Najazdy kwantowe

- **Dziennik zbiorów** pokazuje przycisk **Historia zbiorów** w zakładce osady.
- **Panel na zrzucie** dołącza zestawienie osady do zrzutu ekranu.
- **Działania na zrzucie** dołącza listę działań do obrazu.
- **Wyczyść dziennik zbiorów** pyta o potwierdzenie, a następnie usuwa zapis historii bieżącego gracza i świata. Eksportuj historię wcześniej, jeśli chcesz ją zachować.
- Komunikat obok przycisku potwierdza usunięcie albo informuje o błędzie.

## Ustawienia → Discord

Ustawienia dotyczą wysyłania rozpiski Pól Chwały. Wysyłanie włączysz także checkboxem **Wysyłaj rozpiskę** przy rozpisce.

- **Token bota** to poufny token aplikacji Discord. Jest ukryty podczas wpisywania. Bot musi należeć do serwera i mieć dostęp do wskazanego kanału.
- **ID kanału** to numeryczny identyfikator kanału Discord. Włącz tryb deweloperski w Discordzie, aby skopiować ID kanału.
- **Limit liczby sektorów** ogranicza liczbę zamkniętych sektorów w rozpisce. Wartość **0** oznacza brak limitu; maksymalnie można wpisać 500. Otwarte sektory pozostają na liście.
- **Limit czasu otwarcia (min)** ogranicza zamknięte sektory do tych, które otworzą się w podanym czasie. **0** oznacza brak limitu; maksymalnie 10080 minut. Można ustawić oba limity naraz.
- **Sprawdź połączenie** weryfikuje, czy token działa i bot może odczytać wskazany kanał. Wynik jest pokazany pod przyciskiem. Udane sprawdzenie dostępu nie oznacza jeszcze, że bot ma prawo pisać na kanale.
- Status wyjaśnia, czy wysyłanie jest wyłączone, aktywne, oczekuje na dane gry albo napotkało błąd.

Treść rozpiski jest aktualizowana przez edycję zapamiętanej wiadomości, jeśli nadal jest właściwa. Wiadomość powstaje ponownie, gdy na końcu kanału znajduje się inna wiadomość. Zmiana tokenu lub kanału czyści zapamiętanie poprzedniej wiadomości. Discord narzuca limity długości; ustaw limity sektorów, jeśli rozpiska nie mieści się w wiadomości.

Nie wklejaj tokenu do zgłoszeń, zrzutów ekranu ani publicznego repozytorium. Jeśli token wycieknie, unieważnij go w panelu aplikacji Discord i wpisz nowy.

## Changelog

Kliknij **Changelog · numer wersji**, aby rozwinąć listę zmian w kolejnych wydaniach. Przewiń jej zawartość, aby sprawdzić starsze wersje.

## Diagnostyka

Sekcja **Diagnostyka** pokazuje wersję rozszerzenia i informacje techniczne odczytane z gry. Jej zawartość służy do diagnozowania problemów. **Tryb developerski** wymaga uruchomienia `START-DEV.cmd` w folderze projektu; zapis zmian może przeładować rozszerzenie i kartę gry.

## Notatka

Notatka na dole panelu jest wspólna dla zakładki Ustawienia. Patrz [Notatki](wspolne.md#notatki).
