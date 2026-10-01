# FoE Companion 0.3

Panel odczytuje automatycznie odpowiedzi fetch/XHR gry pod /game/json. Nie wklejasz JSON. Po pierwszym załadowaniu lub aktualizacji rozszerzenia odśwież grę i otwórz mapę Pól Chwały. Obserwator rozpoznaje obiekt zawierający map.provinces i battlegroundParticipants także wewnątrz tablic i obiektów odpowiedzi. GuildBattlegroundStateService.getState w dostarczonym przykładzie zawiera tylko uczestnictwo i mistrzostwa, nie mapę. Panel czeka na kolejną odpowiedź z sektorami, bez wysyłania własnych żądań do gry.

Zakładki: ⚔️ Pola Chwały, 🏛️ kalkulator 1.9 (do zbudowania), 🏘️ zbiory (do zbudowania), ⚙️ diagnostyka. Import JSON usunięto. Statystyki komunikacji i metody są tylko w diagnostyce.

## Pierwsza instalacja / przejście na 0.3

1. brave://extensions → Tryb programisty.
2. Wyłącz poprzednią kopię z innego folderu.
3. Załaduj rozpakowane → C:\Users\Romantyk\Documents\Codex\2026-09-06\c\foe-helper.
4. Jeśli już korzystasz z tego folderu, kliknij raz Reload na kafelku (nowa wersja dodaje service worker i lokalne uprawnienie developerskie).
5. Odśwież grę. Otwórz Pola Chwały. Diagnostyka powinna wskazywać wersję 0.3 i odebrane odpowiedzi.

## Automatyczne zmiany kodu

1. Dwuklik START-DEV.cmd w folderze projektu. Zostaw okno uruchomione.
2. Po zapisaniu zmiany JS, sectors.json lub manifestu lokalny watcher wykryje ją w około 2–5 sekund.
3. Rozszerzenie przeładuje się, a po nim odświeży się karta gry. To automatyczne pełne przeładowanie, nie podmiana kodu w działającej grze.
4. Po odświeżeniu ponownie otwórz mapę, aby gra przesłała aktualny stan. Dane nie są trwale zapisywane.
5. Zatrzymaj watcher Ctrl+C lub zamknij jego okno. Nie uruchamiaj go podczas walk, jeśli nie chcesz odświeżenia karty przy zapisie kodu.

START-DEV używa Node dostarczonego z Codex na tym komputerze; na innym komputerze wymaga Node w PATH. Serwer nasłuchuje tylko 127.0.0.1:18743 i zwraca hash wersji, bez plików i bez danych gry. Panel nie wysyła do niego danych gry. Uprawnienie localhost służy wyłącznie temu mechanizmowi. Bez uruchomionego watchera obowiązuje ręczne Reload + Ctrl+R. Wiele otwartych kart gry może wymagać ręcznego odświeżenia pozostałych kart po przeładowaniu rozszerzenia; tryb pracy zakłada jedną kartę.

## Edycja

- panel.js: wygląd, zakładki, prezentacja.
- model.js: rozpoznawanie obiektu, aktualizacje i formatowanie.
- capture.js: obserwacja fetch/XHR; brak obsługi WebSocket/workerów i innych domen.
- sectors.json: 61 sektorów; granice zawsze obustronne; własne pola rozpoznawane po currentParticipantId, wyświetlane jako ⚪.
- dev-server.cjs, dev-client.js, background.js: automatyczne przeładowanie.

Zapisz plik w zwykłym edytorze. Nie pakuj i nie przenoś ponownie folderu. Graf został zrekonstruowany ze zrzutu. Przy korekcie sąsiedztwa zmień oba sektory. Nie uruchamiaj create-map.cjs po ręcznych korektach, bo nadpisze JSON.

Testy: node tests.cjs oraz node test-dev.cjs (test watchera przy wyłączonym START-DEV). Testy nie zastępują próby w zalogowanej sesji Brave.

https://developer.chrome.com/docs/extensions/reference/api/runtime
https://developer.chrome.com/docs/extensions/develop/concepts/network-requests

## Kalkulator pereł
Przelicznik domyślny 1.9 (akceptuje też przecinek), pięć nagród z zaokrągleniem w górę i przyciskami kopiowania. Wpłata właściciela to koszt całego poziomu minus suma pięciu obliczonych kwot; checkbox odejmuje dodatkowo 1 PR, minimum zero. To łączny planowany wkład, nie pozostała dopłata po uwzględnieniu bieżących wpłat i nie gwarancja zabezpieczenia miejsc.

Dane miasta są odczytywane przy starcie (limit odpowiedzi zwiększony do 24 MB) i zachowane w pamięci pod kluczem właściciel:ID budynku. Request getConstruction jest łączony z response po requestId. Po zmianie poziomu stare nagrody są odrzucane. Brak pewnego dopasowania pokazuje brak kosztu zamiast zgadywania. Dla cudzej perły potrzebne są dane jej miasta otrzymane w bieżącej sesji.

Przycisk Wpłać wysyła dodatkowo wyświetlaną kwotę po rzeczywistym kliknięciu. Endpoint i nagłówki pochodzą z bieżącego żądania GreatBuildingsService, nie z zapisanej sesji. Przy nagłówku signature/checksum wysyłanie jest blokowane, ponieważ nie zaimplementowano podpisywania zmienionej treści. Wymagane są ID właściciela, ID budynku i poziom z danych miasta. Jedna wpłata naraz; brak automatycznych powtórzeń. Po wpłacie lub niejednoznacznym wyniku należy otworzyć perłę ponownie. Testy transportu używają wyłącznie mocka, nie wykonano prawdziwej wpłaty. Parametr 49 w przykładzie odpowiada poziomowi budynku 775 w dostarczonym startup response. Pole klasy protokołu to __class__, nie **class**.

Nie dodawaj prywatnego response.json do paczki dystrybucyjnej. Plik miasta może zawierać dane konta i sesji.

Miejsca bez nagrody lub z nagrodą zero mają kwotę 1 PR, także w sumie odejmowanej od kosztu poziomu.

# Najazdy kwantowe i notatki

Zakładka ⚛️ odczytuje osadę i stan najazdu z odpowiedzi gry. Otwórz osadę po przeładowaniu rozszerzenia. Panel pokazuje prognozę monet, młotków i chronostopów, terminy zbiorów oraz budynki w każdej grupie. Przerwa większa niż godzinę rozpoczyna nową grupę; termin grupy jest terminem ostatniego budynku.

Prognoza obejmuje jeden zbiór z aktualnie produkujących budynków, bonusy osady i euforię. Nie zakłada przebudowy ani ponownego uruchamiania produkcji. Budynki w budowie są wymienione oddzielnie. Definicje z gry zastępują lokalny katalog `quantum-definitions.json`. Brakujące definicje i nieuwzględniona kara niezadowolenia są sygnalizowane. Saldo jest pokazywane tylko po odebraniu danych zasobowych, nie jest wyciągane z kosztów lub nagród.

Notatki są przyklejone do dołu panelu (maksymalnie 300 px); treść zakładki przewija się nad nimi. Zapis następuje podczas pisania w localStorage gry, pod kluczem `foe-companion.notes`. Każda zakładka ma własne notatki, a kalkulator pereł osobne dla każdego typu perły, wspólne dla różnych właścicieli. Czyszczenie danych witryny usuwa notatki. Cyfry wpisywane w notatkach nie uruchamiają kopiowania wpłat.

Testy: `node tests-quantum-notes.cjs`, `node tests.cjs`, `node tests-pearls.cjs`.


### Autoatak na Polach Chwały

- `⚔️` wykonuje jedną falę ręcznie; `▶` uruchamia autoatak na wybranym sektorze, `⏹` zatrzymuje dalsze żądania. Żądanie już wysłane jest kończone.
- W Ustawieniach: zapas walk (domyślnie 3) oraz minimalna i maksymalna przerwa po zakończeniu walki (domyślnie 0,3–0,4 s). Ustawienia zapisują się lokalnie; autoatak nie wznawia się po odświeżeniu.
- Przed nową walką automatyczną odczytywana jest aktualna mapa przez `GuildBattlegroundService.getBattleground`. Przy 197/200 i zapasie 3 następna walka nie jest wysyłana. Zmiany progresu dokonane równocześnie przez innych graczy mogą nastąpić już po tym odczycie.
- Każda nowa walka: pobranie armii → wymiana → potwierdzenie → szybka walka. Między falami nie ma wymiany jednostek. Progres jest pobierany ponownie po zakończeniu walki.
- Autoatak zatrzymuje się po 3 kolejnych przegranych, braku potwierdzonego wyniku/progresu lub błędzie. `🏆 wygrane/wszystkie` liczy zakończone walki z przycisków rozszerzenia w bieżącej sesji, nie pojedyncze fale.
- Górna rozpiska i schowek zawierają tylko sektory z przyszłą godziną odblokowania. Otwarte sektory znajdują się poniżej.
- Testy offline: `node --test battle-flow.test.cjs`.
