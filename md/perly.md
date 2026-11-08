# 🏛️ Kalkulator pereł

## Co pokazuje zakładka

Otwórz w grze perłę architektury, aby panel odczytał jej koszt poziomu i ranking. Kalkulator oblicza proponowane wpłaty na miejsca nagród zwrócone przez grę (P1–P5 lub P1–P7). Wartości są podpowiedziami obliczonymi z danych widocznych w grze; przed wpłatą sprawdź aktualny stan perły.

## Pola i ustawienia

- **Przelicznik miedziany / złoty** określają, ile razy większa ma być wpłata od nagrody z danego miejsca. Wpisz dodatnią liczbę nie większą niż 10, do czterech miejsc po przecinku. Zmiana od razu przelicza kwoty i zostaje zapamiętana.
- **Bonus Arki miedziany / złoty (%)** określają bonus, z jakim kalkulator ocenia nagrodę z Arki. Dozwolony zakres to 0–1000%, do czterech miejsc po przecinku. Podpowiedź nad kwotą pokazuje szacowaną nagrodę, zysk lub stratę i proponowaną wpłatę.
- **🎯 / 👤** przy nazwie perły pokazują koszt poziomu i wpłatę właściciela. Koszt jest odczytywany automatycznie.
- **Kopiuj kwotę (klawisze 1–7)** włącza kopiowanie kwot miejsc P1–P7 po naciśnięciu cyfr 1–7, gdy kursor nie znajduje się w polu tekstowym. Wyłącz opcję, jeśli te klawisze mają służyć wyłącznie grze.

## Wyniki i symbole

- **P1–P7** to miejsca w rankingu nagród. Obok miejsca widać podstawową nagrodę PR oraz wyliczoną proponowaną wpłatę.
- **📋** przy kwocie kopiuje propozycję wpłaty dla danego miejsca. Przy dopłacie obliczonej dla właściciela kopiuje tę dopłatę.
- **Dopłata właściciela przed P…** pokazuje, ile trzeba dołożyć, aby utrzymać wskazane miejsce, biorąc pod uwagę bieżące wpłaty innych graczy i planowaną kwotę inwestora. **Łącznie** pokazuje sumę do osiągnięcia. Podpowiedź wyjaśnia zasady rozstrzygania remisu.
- **Wpłacono przez właściciela** pokazuje odczytaną dotychczasową wpłatę właściciela. Gdy gra nie przekazała tej informacji, wynik może być liczony od zera.
- **Łączny koszt właściciela** to koszt poziomu minus suma wymaganych wpłat inwestorów, wraz z dotychczasową wpłatą właściciela. Nadpłaty inwestorów mogą obniżyć rzeczywisty koszt.
- **Do zamknięcia teraz** to koszt poziomu minus wszystkie rzeczywiste wpłaty, również właściciela.
- **—** oznacza brak wystarczających danych do wyliczenia kwoty.

## Przed wpłatą

Kalkulator oblicza i kopiuje kwoty; nie wykonuje wpłat. Wklej skopiowaną propozycję w grze i przed potwierdzeniem sprawdź aktualne miejsce oraz kwotę. Dane perły mogą się zmienić, gdy inni gracze wpłacają PR. Informacja o odświeżeniu stanu perły pojawia się tylko wtedy, gdy w panelu są dostępne i włączone przyciski wpłaty.

## Statusy

- **Otwórz perłę w grze** oznacza, że kalkulator nie ma aktualnych danych perły.
- Komunikat o przeliczniku oznacza, że wpisana wartość jest pusta, zerowa lub poza zakresem.
- Komunikat przy kopiowaniu potwierdza skopiowanie kwoty albo informuje, że przeglądarka odmówiła dostępu do schowka.

## Notatka

Notatka na dole panelu jest osobna dla aktualnie otwartej perły. Patrz [Notatki](wspolne.md#notatki).

## Miedź, złoto i maraton

Rodzaj poziomu pochodzi z danych gry. Gdy brak bezpośredniego oznaczenia, kalkulator używa definicji konkretnej perły. Nie każda perła powyżej poziomu 100 jest złota. Nieznany rodzaj poziomu wstrzymuje wyliczenie zamiast wybierać przelicznik na chybił trafił.

Dotychczasowy przelicznik i bonus Arki pozostają ustawieniami miedzianymi. Złote wartości należy uzupełnić osobno. Małe pola **Miedź** i **Złoto** pod nagłówkiem kalkulatora zmieniają te same przeliczniki co ustawienia.

Przy własnej perle dostępna jest zwijana sekcja **Maraton**. Każdy wiersz pokazuje wymaganą wpłatę, a przy prawej krawędzi różnicę rzeczywistej wpłaty względem wymaganej: dodatnią na zielono, ujemną na czerwono. Różnica zerowa pozostaje pusta.

✅ oznacza, że inwestor wpłacił PR, a łączny bilans od P1 do tego miejsca jest nieujemny. Nadpłaty wyższych miejsc mogą więc pokryć niewielką niedopłatę niższego miejsca. To potwierdzenie bilansu wpłat, nie blokady miejsca. Wpłata właściciela nie pokrywa bilansu inwestorów.

Maraton korzysta z ostatniego pełnego rankingu otrzymanego z gry. Jeśli nadejdzie zmiana łącznego postępu bez rankingu, potwierdzenia są usuwane do otrzymania pełnego rankingu. Zmiana poziomu usuwa poprzedni ranking. Rozszerzenie nie wpłaca PR w celu odświeżenia.

### Aktualizacja maratonu na żywo

Przy rozwiniętym maratonie we własnej perle rozszerzenie wykrywa przez socket zmianę łącznej wpłaty. Wtedy odczytuje pełny ranking inwestorów, bez wpłacania PR. Odczyty odbywają się najwyżej raz na 5 sekund, tylko gdy zakładka przeglądarki i panel pereł są widoczne. Zwijając maraton, wyłączasz te odczyty. Zmiana poziomu usuwa stare potwierdzenia i powoduje ponowny odczyt. Sam brak nowych danych nie jest uznawany za wpłatę.

## Okno maratonu i wpłaty

Przycisk 🏃 otwiera okno maratonu, które zapamiętuje położenie i rozmiar. Te same dane pokazuje domyślnie rozwinięta sekcja **Wpłaty** na dole panelu. Zero jest widoczne; poprawne wpłaty mają zielony kolor i ✅. Nieaktualny ranking nie daje potwierdzenia.

Przycisk ⚙️ otwiera wszystkie ustawienia pereł. **Otwieraj maraton przy własnej perle** automatycznie pokazuje okno. **Tolerancja wpłat (PR)** dopuszcza narastający niedobór: przy 2 PR jest to do −2 po pierwszym opłaconym miejscu, do −4 po drugim itd. Rzeczywiste różnice nadal są wyświetlane.

**Kopiuj przy zamkniętym panelu** pozwala korzystać z cyfr 1–7 bez wysuwania panelu, gdy włączone jest kopiowanie kwot. Potwierdzenie, np. **P4: 123 PR ✅**, pojawia się na 3 sekundy w prawym dolnym rogu. 📋 przy **Łączny koszt właściciela** kopiuje tę wartość.
