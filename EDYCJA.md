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
# Po dodaniu Najazdów i notatek

Nowe pliki: `quantum.js`, `quantum-definitions.json`, `notes.js`. Zmieniony manifest ładuje je automatycznie. Po tej aktualizacji uruchom ponownie `START-DEV.cmd`, jeśli serwer działał już wcześniej — zmieniła się lista obserwowanych plików. Jeśli panel nie zaktualizuje się sam, kliknij przeładowanie rozszerzenia w `brave://extensions` i odśwież grę. Otwórz następnie osadę kwantową, aby pobrać aktualny układ.
