# ⚙️ Ustawienia

Wszystkie sekcje ustawień są domyślnie zwinięte. Kliknij nagłówek, aby rozwinąć wybraną sekcję. Po każdym odświeżeniu strony wszystkie sekcje znów są zwinięte. W trakcie pracy możesz je dowolnie rozwijać.

## Ustawienia → Perły

- **Przelicznik** określa mnożnik proponowanych wpłat. Dozwolone wartości to liczby większe od zera i nie większe niż 10, z maksymalnie czterema miejscami po przecinku.
- **Bonus Arki (%)** podaje procent bonusu Arki używany do wyliczenia szacowanej nagrody i zysku. Zakres: 0–1000%.
- **Kopiuj kwotę (klawisze 1–5)** pozwala kopiować kwotę dla miejsc P1–P5 po naciśnięciu cyfr 1–5. Wyłącz tę opcję, jeśli skrót przeszkadza w grze.

## Ustawienia → Wysuwaj panel

Każdy checkbox włącza automatyczne wysunięcie panelu po otwarciu wskazanego ekranu gry:

- **Otwarcie perły** — po otwarciu perły architektury.
- **Pola Chwały** — po otwarciu mapy Pól Chwały.
- **Tylko okno sektorów** — opcja podrzędna dla Pól Chwały. Zamiast wysuwać panel i przełączać kartę, otwiera modal **Otwarte sektory**. Wybór zapamiętuje się po odświeżeniu.
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
- **Zamykaj sektory negocjacjami** pozwala opcji 🕐 i ⚡ zamykać sektor negocjacjami zamiast walkami. Zamykanie pomija limity zwykłych automatów. Negocjacje wymagają wystarczających towarów; po ich wyczerpaniu zamykanie przechodzi na walki. Trzy kolejne przegrane walki zatrzymują zamykanie z komunikatem o niepowodzeniu.
- **Autozamykanie ⚡: próg postępu wroga (%)** określa próg 1–100%, domyślnie 50%. Zamykanie uruchamia się, gdy postęp wroga osiągnie lub przekroczy ten próg.
- **Autoatak: limit progresu (%)** ogranicza autoatak do sektorów, których postęp naszej gildii jest poniżej ustawionej granicy. Sektor, który osiągnął granicę, jest pomijany.
- **Autoatak: maks. szansa wzrostu oporu (%)** ogranicza autoatak do sektorów o nie większej szansie wzrostu oporu. Domyślnie to 20%. Wartość zero dopuszcza tylko sektory bez ryzyka; nieznana szansa nie przechodzi limitu.
- **Negocjacje: limit progresu (%)** ogranicza automatyczne negocjacje do sektorów, których postęp naszej gildii jest poniżej ustawionej granicy.
- **Negocjacje: sukcesy na otwarcie** ustala limit udanych negocjacji na dane otwarcie sektora. Domyślnie jest to 100 sukcesów; zakres wynosi 1–10000. Nie jest to limit porażek.
- **Negocjacje: maksymalny opór** określa najwyższy opór gracza, przy którym automat może negocjować. Domyślnie wynosi 100; gdy opór jest wyższy albo nie został odczytany, negocjacje są blokowane.
- **Autoatak: 🟥 Atak** i **Autoatak: 🟦 Obrona** określają, które typy walk może podejmować automat. Domyślnie obie opcje są włączone. Checkbox **Zamykaj sektory** w pasku automatyzacji otwartego okna ignoruje limity progresu i rezerwę do czasu zamknięcia sektora.
- Domyślny **Autoatak: limit progresu (%)** wynosi 100%. Przerwa między automatycznymi walkami wynosi od 0,7 do 1,5 sekundy, a przerwa między turami negocjacji od 3,7 do 6 sekund.

Po zmianie ustawień automaty zatrzymują się, aby nie kontynuować ze starą konfiguracją. Uruchom je ponownie, jeśli chcesz pracować z nowymi wartościami.

### Pola Chwały → Rozpiska

- **Kolor gildii w sektorze** (**⚪**) — dodaje do rozpiski kółko w kolorze gildii.
- **Pokazuj progres w sektorze** (**⚔️**) — dodaje postęp naszej gildii, jeśli jest większy od zera.
- **Pokazuj progres wroga w sektorze** (**👾**) — dodaje postęp przeciwnika, jeśli jest większy od zera.
- **Oznaczaj wyścig** (**🔥**) — włącza oznaczenie wyścigu o sektor.
- **Opór zamkniętych sektorów** (**🔻**) — dodaje szansę wzrostu oporu do opisu zamkniętych sektorów. Nie zmienia opisu otwartych sektorów.
- **Liczba zamkniętych sektorów w modalu** — określa liczbę nadchodzących sektorów w oknie **Otwarte sektory**; zakres 0–500, domyślnie 10.

Pięć przełączników jest domyślnie włączonych. Zmienisz je także małymi emoji pod rozpiską w panelu i pod tabelą w oknie sektorów. Pełna widoczność i ciemny cień oznaczają włączenie, przygaszenie do połowy bez cienia — wyłączenie. Wybór zapisuje się i jest wspólny dla obu miejsc oraz ustawień. Dotyczy treści rozpiski i kopiowania, a także formatu wysyłanego na Discord. Kolumny postępu i szansy oporu w tabeli okna pozostają widoczne.

## Ustawienia → Budynki

- **Wyświetlaj przyciski zbiorów** pokazuje przycisk **🤲** przy budynkach oraz **🤲 Zbierz wszystkie** w zakładce Zbiory. Wyłączenie opcji ukrywa przyciski zbioru.

## Ustawienia → Najazdy kwantowe

- **Dziennik zbiorów** pokazuje przycisk **Historia zbiorów** w zakładce osady.
- **Panel na zrzucie** dołącza zestawienie osady do zrzutu ekranu.
- **Działania na zrzucie** dołącza listę działań do obrazu.
- **Wyczyść dziennik zbiorów** pyta o potwierdzenie, a następnie usuwa zapis historii bieżącego gracza i świata. Eksportuj historię wcześniej, jeśli chcesz ją zachować.
- Komunikat obok przycisku potwierdza usunięcie albo informuje o błędzie.

## Ustawienia → Discord

Ustawienia Discorda są osobne dla każdej karty gry. W każdej karcie możesz wpisać inny token i kanał; rozpiska z tej karty trafia na skonfigurowany dla niej kanał. Wysyłanie włączysz także checkboxem **Wysyłaj rozpiskę** przy rozpisce.

- **Token bota** to poufny token aplikacji Discord. Jest ukryty podczas wpisywania. Bot musi należeć do serwera i mieć dostęp do wskazanego kanału.
- **ID kanału** to numeryczny identyfikator kanału Discord. Włącz tryb deweloperski w Discordzie, aby skopiować ID kanału.
- **Limit liczby sektorów** ogranicza liczbę zamkniętych sektorów w rozpisce. Wartość **0** oznacza brak limitu; maksymalnie można wpisać 500. Otwarte sektory pozostają na liście.
- **Limit czasu otwarcia (min)** ogranicza zamknięte sektory do tych, które otworzą się w podanym czasie. **0** oznacza brak limitu; maksymalnie 10080 minut. Można ustawić oba limity naraz.
- **Sprawdź połączenie** weryfikuje, czy token działa i bot może odczytać wskazany kanał. Dopiero po udanym sprawdzeniu pojawia się checkbox **Wysyłaj rozpiskę**. Zmiana tokenu lub ID kanału chowa checkbox do czasu ponownego udanego testu. Udane sprawdzenie dostępu nie potwierdza, że bot może wysyłać wiadomości.
- Status wyjaśnia, czy wysyłanie jest wyłączone, aktywne, oczekuje na dane gry albo napotkało błąd.

Treść rozpiski jest aktualizowana przez edycję zapamiętanej wiadomości, jeśli nadal jest właściwa. Wiadomość powstaje ponownie, gdy na końcu kanału znajduje się inna wiadomość. Zmiana tokenu lub kanału czyści zapamiętanie poprzedniej wiadomości. Discord narzuca limity długości; ustaw limity sektorów, jeśli rozpiska nie mieści się w wiadomości.

Nie wklejaj tokenu do zgłoszeń, zrzutów ekranu ani publicznego repozytorium. Jeśli token wycieknie, unieważnij go w panelu aplikacji Discord i wpisz nowy.

Udany test Discorda jest zapamiętany dla konfiguracji karty i pozostaje ważny po odświeżeniu strony. Edycja tokenu lub kanału unieważnia test; zmiana limitów nie wymaga ponownego sprawdzania. Ręcznie zapisane wartości automatyzacji i opóźnień są zachowywane — wartości domyślne dotyczą brakujących ustawień.

## Changelog

Kliknij **Changelog · numer wersji**, aby rozwinąć listę zmian w kolejnych wydaniach. Przewiń jej zawartość, aby sprawdzić starsze wersje.


## Ostrzeżenie

⚠️ Walki, negocjacje i zbiory wysyłają żądania do serwerów gry i zmieniają stan konta. Ich używanie może skutkować banem. Używasz na własną odpowiedzialność.

## Notatka

Notatka na dole panelu jest wspólna dla zakładki Ustawienia. Patrz [Notatki](wspolne.md#notatki).
