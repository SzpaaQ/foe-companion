## Aktualny stan — 0.6.12, 2026-10-26

- Wydanie 0.6.12: modal Nasze sektory obok opcji pilnowania pokazuje własne sektory, atak przeciwnika i progres, zajęte sloty, opór sąsiadów oraz wskaźniki gildyjnego ignore/focus. Emoji nagłówków mają tooltipy, a sloty to trzy równe kwadraty o opacity 1/0.5/0.
- Przycisk w zakładce Najazdy kwantowe otwiera historię zbiorów bez osady kwantowej. `quantum-history.create().loadLatest(playerId)` ładuje profil z IndexedDB; fallback wybiera ostatnio aktualizowany profil bieżącego świata.
- Ustawienia → Najazdy kwantowe: „Wyczyść dziennik zbiorów” pyta o potwierdzenie i usuwa profil historii bieżącego gracza z IndexedDB.
- `openSectorGuardModal` — „Kopiuj wszystkie” kopiuje lokalny czas otwarcia w `HH:mm`, a już otwarte sektory jako „Otwarte”.
- Lokalna zmiana po 0.6.12: w modalu sektorów (⋮) zamknięte cele kopiowane pojedynczo lub przez „Kopiuj wszystkie” używają czasu otwarcia `HH:mm`; postęp gildii ma format `⚔️N/M` i poprzedza postęp wroga `👾N`, jeśli oba występują. Przy postępie wroga marker ma postać `🔥 👾N`. Kopiowanie otwartych sektorów pokazuje wyścig `🔥`, istniejący postęp własny/wroga i szansę oporu; pusty postęp jest pomijany.
- Nagłówek „Otwarte sektory”: przyciski kopiowania, opcji pilnowania, własnych sektorów oraz automatyzacji są wyrównane do prawej; przycisk własnych sektorów używa `🏠`.
- `panel.localIgnoreKey/localSectorIgnored/setLocalSectorIgnored`: localStorage `foe-companion.localSectorIgnore.v1:<host>:<endsAt>:<mapId>`, tablica ID. Modal ma ostatnią kolumnę Ignoruj. `tickBulk` dodaje `localIgnored` do wierszy i przekazuje klucz do polityki MAIN. Dotyczy obu globalnych automatów, nie ręcznych akcji ani osobnego pilnowania 🕐/⚡. Nie zmienia gildyjnych signals. Uszkodzony zapis blokuje kwalifikację.
- `capture.checkLocalIgnore` sprawdza stan przed akcją oraz po ustawieniu armii; nie przerywa wysłanej akcji ani dalszych fal. Negocjacyjne pominięcie przed startem daje `sectorSkipped + notStarted`; kolejka zwalnia rezerwację bez naliczania wyniku.
- `settings.closeWithNegotiations` (domyślnie false), `panel.startGuardClosing`, `guardNegClosing`: oba wyzwalacze pilnowania mogą uruchamiać serię negocjacji przez istniejący autoNegSector. Każda akcja kontroluje 20% szansy, opór gracza, gildyjne ignorowanie i rezerwę (również MAIN). Polityka progresu 100%, bez globalnego limitu sukcesów ani limitu porażek; zamykanie kończy się przy rezerwie/zamknięciu/błędzie/STOP. `stopAutoNeg` wstrzymuje pilnowanie przez `pauseGuards`, aby ⚡ nie uruchamiała go od razu ponownie. Ponowne zaznaczenie checkboxa uzbraja pilnowanie.
- Testy nowych ścieżek: `guard-closing.test.cjs`, `battle-flow.test.cjs`, `sector-automation.test.cjs`; pełny zestaw 182/182 offline. Gra/wygląd wymagają ręcznej weryfikacji; Arka odłożona.

## Zmiany lokalne po 0.6.09 — autozamykanie i pomijanie celu

- `sector-automation.settings.closeEnemyProgress`: próg ⚡ 1–100%, domyślnie 50; `checkSectorAlerts` porównuje postęp wroga ściśle powyżej progu. Zapis i formularz współdzielone z ustawieniami automatyzacji.
- Modal ukrywa komórki i nagłówki kolumn na podstawie `actionVisible`, a przy obu rodzajach akcji wyłączonych także kolumny checkboxów. Kolumny automatów mają puste nagłówki.
- `battleground-live.unavailable` oznacza znane ograniczenia sektora kodem `SECTOR_INELIGIBLE`; `canSkipAttack` wymaga tego kodu, połączenia, aktualnej epoch i zgodnej mapy/edycji. `capture` zwraca `sectorSkipped + notStarted` tylko przed wysłaniem walki i bez kontynuowanej fali. `sector-automation.result` zwalnia kolejkę bez zmiany serii porażek. Nie klasyfikuj błędów po treści komunikatu i nie pomijaj niepewnych wyników.
- Testy: 176/176 offline, w tym zmiana sektora podczas ustawiania armii, utrata połączenia, STOP, próg i widoczność kolumn. Negocjacyjne zamykanie i lokalny checkbox Ignoruj nadal odłożone.

## Nadchodzące sektory — etapy 2 i 3, 0.6.09

`openSectorGuardModal.modal.refresh` łączy wszystkie otwarte cele z maksymalnie 5 najbliższymi zamkniętymi sąsiadami. Własne ⚪ wykluczone. Wiersze zamknięte mają `dataset.locked`, opacity .55 oraz disabled na wszystkich przyciskach i checkboxach; operacje kolumn pomijają disabled. `timeCells` aktualizuje kolumnę Otwarcie co sekundę przed porównaniem snapshotu; `open.length` zapewnia przebudowę przy otwarciu także bez nowych danych gry. Kolejka automatów nadal korzysta z własnej kwalifikacji, nie z listy podglądu. Etap 4 nie jest wdrożony.

## Gildyjne ignorowanie — etap 1, 0.6.08

Pełny `GuildBattlegroundParticipant` bez pola `signals` oznacza pustą listę oznaczeń (potwierdzone formatem zapisów HAR). `model.updateBattle` oraz `battleground-live.consume` zastępują wtedy stare sygnały pustą listą. Częściowy obiekt bez klasy ani aktualizacja prowincji nie kasują oznaczeń. `observeSockets` przepuszcza pełnego uczestnika również bez signals. Dotyczy obu automatów; lokalny checkbox Ignoruj to dopiero etap 4. Testy regresji: `sector-ignore.test.cjs`.

## Aktualizacja otwartych sektorów — wydanie 0.6.07 (2026-10-25)

- `model.updateBattle` zeruje pominięte pola domyślne odpowiedzi `GuildBattlegroundProvince`, tak jak tracker MAIN: właściciel, blokada, spawn, progres, typ i szansa oporu. Dotyczy zmian wszystkich gildii; stara blokada/progres nie mogą przetrwać pełnej odpowiedzi sektora.
- `openSectorGuardModal`: `modal.refresh()` odświeża tylko tabelę po zmianie snapshotu danych, stanu akcji lub checkboxów. Wywołuje je `paintOpenSectors` także przed jego wczesnym powrotem; odświeżanie sekundowe obsługuje upływ blokady. Okno i nagłówek pozostają na miejscu. Zmiana mapy zamyka modal przez `modal.close()` ze sprzątaniem listenerów.
- Powiadomienia alarmowe i zwykłe oraz obie listy otwartych sektorów wykluczają ⚪. Automat nadal respektuje odrębne warunki kwalifikacji; powiadomienie nie gwarantuje startu negocjacji.
- Testy: `sector-refresh.test.cjs`, `sector-controls.test.cjs`, `sector-popup.test.cjs`. 163/163 offline; bez rzeczywistych akcji gry.

## Autoatak: limit szansy wzrostu oporu (2026-10-25)

`sector-automation.settings.attackChance`: 0–100, domyślnie 20. `eligible` odrzuca wyższą lub nieznaną szansę; kolejka przekazuje limit w `bulkPolicy`. `battleground-live.checkPolicy` ponawia kontrolę przed walką. Panel zapisuje limit wraz z pozostałymi ustawieniami, zmiana zatrzymuje automaty. Nie mylić z progresowym `attackProgress` ani oporem gracza `maxAttrition` dla negocjacji.

# FoE Companion — mapa dla AI

## Pola Chwały — wydane w 0.6.06 (2026-10-25)

- Wersja 0.6.06. Zakres ograniczony do Pól Chwały; odczyt bonusu Arki odłożony.
- `battleground-live.closedSince(id,before)` potwierdza zmianę właściciela lub blokadę w tej samej mapie, sezonie i epoce połączenia. `capture.js` rozpoznaje wyłącznie skorelowane `getRunning: null` jako brak negocjacji; brak odpowiedzi nadal jest błędem.
- Po błędzie negocjacji potwierdzone zamknięcie sektora i zakończenie negocjacji daje `sectorClosed` oraz `negotiationEnded`. Kolejka zwalnia rezerwację bez sukcesu/porażki, kontynuuje inne cele i respektuje STOP. Test: `negotiation-closure.test.cjs`.
- `model.js`: `sectorMarker`, `progressText`, `openSectorText` współdzielą format tabel i kopiowania. Zerowy progres to `0`; wróg to `👾34` zamiast symbolu wyścigu `🔥`. Opór oznacza `🔻`.
- `panel.js`: `mountSectorWindow` obsługuje przeciąganie nagłówka (do 80% poza prawy bok), Esc/× i sprzątanie listenerów. Nakładka przepuszcza kliknięcia; zamknięcie nie zatrzymuje automatów. Status nad licznikami jest jednoliniowy, przycinany, bez title/tooltipa. Przyciski akcji i nagłówki kolumn nadal mają tooltipy.
- Powiadomienie pozostaje do 99% włącznie; przejęcie/zamknięcie usuwa je niezależnie od procentu. Kopiowanie pojedyncze i zbiorcze używa tekstu modelu, bez ikon przycisków.
- 157 testów offline przechodzi. Wygląd w grze pozostaje do weryfikacji przez użytkownika; bez rzeczywistych walk/negocjacji w testach.

Stan rozpoznany: 2026-10-26, manifest 0.6.11, etapy 1–4 wdrożone.
To indeks do selektywnego czytania, nie zamiennik aktualnego kodu. Po zmianach
architektury aktualizuj ten plik. Wyszukuj symbole, nie polegaj na numerach linii.

## Start w 2 minuty

1. Przeczytaj `AGENTS.md`, ten plik oraz najnowszą sekcję `TODO.md`.
2. Wykonaj `git status --short`, `git log -8 --oneline`, `git diff --stat`.
3. Ustal zakres z użytkownikiem; wpis w TODO nie oznacza polecenia wdrożenia.
4. Wybierz poniżej moduł i przeczytaj tylko jego symbole oraz odpowiednie testy.
5. Zachowaj cudze zmiany i pliki nieśledzone. Nie dodawaj wszystkiego przez `git add .`.

Repozytorium robocze: `C:\Users\Romantyk\Documents\Codex\2026-09-06\c\foe-helper`.
Rozszerzenie Chrome/Brave Manifest V3, zwykły JavaScript, bez bundlera/builda i npm.
Manifest ładuje pliki bezpośrednio. Moduły przeważnie IIFE, API na `globalThis.Foe…`,
część ma eksport CommonJS do testów. UI jest po polsku.

## Trzy konteksty wykonania i przepływ danych

```text
Gra: HTTP fetch/XHR + WebSocket
  -> MAIN: capture.js / battleground-live.js
  -> window.postMessage (kanał foe-companion-v1)
  -> ISOLATED: panel.js -> model.js / quantum.js / pearls.js
                              -> quantum-history.js (snapshoty + IndexedDB)

Kliknięcie w panelu -> postMessage (token operacji)
  -> MAIN capture.js -> podpisane żądanie gry -> odpowiedź i potwierdzenie
  -> postMessage z tym samym tokenem -> panel.js

Zrzut / reload -> chrome.runtime.sendMessage
  -> background.js (service worker) -> odpowiedź do strony
```

- MAIN w kolejności manifestu: `request-signature.js`, `battle-army.js`,
  `battleground-live.js`, `pearls-main.js`, `capture.js`.
- ISOLATED: `pearls.js`, `model.js`, `quantum.js`, `quantum-history.js`,
  `notes.js`, `sector-automation.js`, `panel.js`, `dev-client.js`.
- Nie zakładaj wspólnej pamięci pomiędzy MAIN, ISOLATED i workerem.
- Panel jest w **zamkniętym Shadow DOM** (`mount` w panel.js). Zewnętrzne
  `document.querySelector` nie odczyta jego wnętrza.
- Kanały wiadomości i tokeny są kontraktem. Sprawdzaj odbiorcę i nadawcę
  przy zmianie payloadu, a także walidację `event.source`/`event.origin`.

## Mapa modułów: gdzie wejść z zadaniem

| Obszar | Pliki i symbole startowe | Odpowiedzialność |
|---|---|---|
| UI / ustawienia | `panel.js`: `mount`, `paintOpenSectors`, `paintQuantum`, `openSectorGuardModal`, `openOwnSectorsModal` | Zakładki, renderowanie, przyciski, stan automatów i ustawienia |
| Ruch gry / akcje | `capture.js`: `emit`, `observeTransport`, `battleCall`, `prepareGameRequest`, `restoreGameResponse` | Przechwytywanie, podpisy, requestId, wykonanie akcji |
| Podpis żądania | `request-signature.js`; `analyze-signatures.cjs` | Podpisywanie i pomocnicza weryfikacja offline; nie wypisuj danych sesji |
| Model Pól Chwały | `model.js`: `rows`, `neighbors`, topologie | Nazwy, sąsiedztwo, własna gildia, progres, blokada, sygnały i sloty budynków |
| Stan socketu | `battleground-live.js`: `createTracker`, `check`, `waitForProgress`, `observeSockets` | Aktualność prowincji, epoch po reconnect, potwierdzanie progresu |
| Kolejka otwartych sektorów | `sector-automation.js`: `create`, `eligible`, `tick`, `result`; panel: `tickBulk`, `paintBulkControls` | Limity, trwałe sukcesy na otwarcie, seria porażek |
| Dobór armii do walki | `battle-army.js`: `plan`, `confirmed` | Wybór jednostek i weryfikacja ustawionego składu |
| Negocjacje | `capture.js`: `negBestGuess`, `negFilter`, `ensureFreeNegotiationTurn`; `panel.js`: `startNeg`, `stopAutoNeg` | Solver, darmowe tury, przebieg i pętla per sektor |
| Osada kwantowa | `quantum.js`: `createTracker`, `consume`, `summary`, `summarizeArmy` | Mapa osady, zasoby, budowy, prognoza produkcji, wojsko |
| Historia osady | `quantum-history.js`: `create`, `observe`, `loadLatest`, `groupEvents`, `actionRows`, `actionRuns`, `mount` | Trwałe zdarzenia, odczyt profilu IndexedDB bez mapy, grupowanie, notatki, undo/split i UI historii |
| Zrzuty osady | `quantum-history.js`: `captureScreenshot`, `startFraming`; `background.js`: `captureTab` | Kadrowanie, zapis zdjęcia, miniatura, powiększenie i eksport |
| Perły | `pearls.js`, `pearls-main.js`: `createTracker`, `lockStages`, `liveLocks`, `arcProfit` | Obliczenia i śledzenie; sprawdź oba konteksty przy zmianie |
| Zbiory miasta | `model.js`: `parseCity`, `updateCity`, `cityRows`; `panel.js`: `startCollection`; `capture.js`: `foe-collect` | Klasyfikacja budynków, gotowość produkcji, potwierdzenie zbioru |
| Notatki zakładek | `notes.js`: `createStore`, `KEY` | Osobne od notatek działań historii |
| Reload dev | `dev-server.cjs`, `dev-client.js`, `background.js`, `START-DEV.cmd` | Hash plików, lokalny serwer, reload rozszerzenia i karty |

`panel.js` i `quantum-history.js` zawierają duże sekcje DOM/CSS. Najpierw `rg -n`
po symbolu lub napisie przycisku, potem czytaj ograniczony fragment.

## Pola Chwały: pojęcia i aktualny stan

- `currentParticipantId` identyfikuje własną gildię; nie myl z ID gracza.
- `isAttackBattleType` to **bonus atakujący/obronny**, nie wybór walka/negocjacja.
- `lockedUntil` / `row.until`: Unix **sekundy**. `Date.now()` to milisekundy.
- `conquestProgress` ma postępy poszczególnych gildii; kwalifikacja używa własnej.
- `row.ignored` pochodzi z sygnału `ignore` własnej gildii.
- `FoeModel.rows(battle,true)` ogranicza cele do sąsiadów; `false` nie oznacza,
  że wszystkie wyświetlone sektory można atakować.
- Mapy: `sectors.json` i `sectors-volcano.json`. `create-map.cjs` może nadpisać
  ręczne korekty topologii — nie uruchamiaj go jako rutynowego kroku.

Dotychczasowe automaty **per sektor** nadal istnieją. Panel trzyma `autoSector`, `autoTimer`,
`lossStreak`, `autoNegSector`, `autoNegTimer`, `negPending`, `battlePending`,
`battleWaveSector`. MAIN ma m.in. `battleBusy`, `negBusy`, `paymentBusy`,
`collectBusy`, `battleUncertain`. Nie dokładaj niezależnej pętli omijającej blokady.

Ważne kanały: `foe-battle-ready`, `foe-quick-battle` / `foe-quick-battle-result`,
`foe-negotiate` / `foe-negotiate-started` / `foe-negotiate-turn` /
`foe-negotiate-feedback` / `foe-negotiate-result`.
Wygrana negocjacja sprawdza `waitForProgress(...,2)`; potwierdzenie wyniku i
potwierdzenie aktualizacji sektora to dwa różne warunki.

Pilnowanie: `GUARD_KEY = foe-companion.sectorGuard`, `getGuard`, `setGuard`,
`checkSectorAlerts`, `scheduleCloseAtHour`, `openSectorGuardModal`.
Modal zastąpił wcześniejsze dropdowny. Opcje obejmują powiadomienie,
zamykanie 30 s przed pełną godziną i przy postępie wroga >80%.

### Automatyzacja otwartych sektorów — WDROŻONA

Szczegóły: najnowszy plan w TODO. Dwa tryby zbiorcze w istniejącym modalu:
autonegocjacje i autoatak wszystkich otwartych, kwalifikujących się sektorów.
Negocjacje: limit oporu, sukcesów na otwarcie, progresu, dokładnie 20% szansy
wzrostu oporu. Atak: checkboxy atak/obrona, ignorowanie i limity.

**Ostateczna korekta użytkownika: 3 porażki Z RZĘDU kończą autoatak. Wygrana
zeruje licznik.** Wcześniejszy pomysł trzech łącznych porażek jest nieaktualny.
Obecny `lossStreak` już liczy serię porażek; nowy tryb musi zachować tę semantykę.

Uwaga do planu: bieżące `autoSettings` ma `reserve`, `min`, `max`
(`foe-companion-gbg-auto`). `reserve` to zapas punktów/walk, **nie procent**.
Nowe limity procentowe są dodatkowymi warunkami; rezerwa nadal obowiązuje.
Istniejący tracker dopuszcza start przy zerowym progresie bez znanego maxProgress;
nowy filtr także dopuszcza pierwszy autoatak przy progresie 0 i nieznanym limicie.

Negocjacje nie mają limitu porażek i mają pierwszeństwo w kolejce.
`bulkPolicy` jest ponownie sprawdzana przez MAIN `checkPolicy` przed akcją.
Model i MAIN biorą maxProgress z wpisu własnej gildii, a przy jego braku z innych
gildii w tym samym sektorze (najmniejsza dodatnia wartość, jeśli są różne).
Nasz progres pozostaje 0; nie kopiujemy postępu wroga. Gdy limit nadal nieznany,
tylko atak z progresu 0 jest dopuszczony. Dodatni progres bez limitu blokuje kolejny
atak; negocjacja wymaga znanego limitu. Rezerwy/procentu nie da się sprawdzić przed
pierwszym atakiem bez limitu — to świadomy wyjątek na polecenie użytkownika.
Przycisk autonegocjacji pozostaje widoczny przy za dużym/nieznanym oporze,
lecz nieaktywny z widocznym wyjaśnieniem. STOP znika w bezczynności.
Opór pochodzi z mapy/getPlayerParticipant; wygrana bez aktualizacji unieważnia opór.
Sygnały ignorowania aktualizuje także `model.updateBattle`.
Ustawienia: `foe-companion.openSectorSettings.v1`. Liczniki sukcesów i rezerwacje:
`foe-companion.openSectorLedger.v1` (świat, konto, edycja/mapa, cykl właściciela/blokady).
Niepewny wynik blokuje ponowienie negocjacji na tym otwarciu także po reloadzie.
Tryby po reloadzie są wyłączone. STOP dokańcza rozpoczętą akcję, także fale.
`guardsPaused` blokuje automatyczne zamykanie z pilnowania również po STOP/3 porażkach;
ponowne zaznaczenie checkboxa zamykania, przy bezczynnej kolejce, przywraca pilnowanie.
Testy nowej kolejki: `sector-automation.test.cjs`, `battle-flow.test.cjs`.

W 0.6.05: `model.rows` dodaje ownerId, enemyProgress i enemyMaxProgress (największy
postęp pojedynczego przeciwnika, bez sumowania). `updateSectorPopup` łączy alarm
pilnowania z otwarciem; zamknięcie, przejęcie lub zniknięcie z listy usuwa wpis.
`popupCycles` (sessionStorage `.cycles`) resetuje wyciszenie przy nowym właścicielu,
blokadzie lub edycji; alarmy mają pierwszeństwo i nie wymagają włączonego dźwięku.
`paintAutomationIndicators` aktualizuje emoji w nagłówku i nad uchwytem oraz
komórki `[data-modal-counter]` z istniejących liczników. Odczyt bez osobnego liczenia.
Nagłówki kolumn w modalu używają `paintGuardColumns`, `applyGuard`, `toggleGuardColumn`;
obsługa pojedyncza i zbiorcza współdzielą zapis i zarządzanie timerem.
Testy: `sector-popup.test.cjs`, `sector-controls.test.cjs` (także montaż całego modala).

## Najazdy i historia: niezmienniki

- Osada: `gridId === guild_raids`, jednostki: prefiks `guild_raids_`.
- Miasto główne nie może zostać nadpisane osadą ani cudzym miastem.
- `quantum-definitions.json` jest fallbackiem definicji; świeże dane gry mają
  pierwszeństwo. Produkcja w panelu to prognoza, nie potwierdzona wypłata.
- Historia zapisuje obserwacje i snapshoty Przed/Po. Nie rekonstruuje przeszłości
  sprzed uruchomienia rozszerzenia. Klonowanie danych przed asynchronicznym zapisem
  jest istotne, bo obiekty mapy mogą się zmieniać.
- `groupEvents` = grupy zbiorów; `actionRows` = stabilne odniesienia do działań;
  `actionRuns` = prezentacyjne łączenie kolejnych operacji.
- Nie usuwaj snapshotów przy kosmetycznym przegrupowaniu. Notatki są związane
  z referencjami zdarzeń, nie tylko pozycją wiersza w DOM.
- `rememberEdit`, `undo`, `split`, `merge`, `removeRows`: trwałe cofanie do 3
  operacji. Undo nie może usuwać późniejszych obserwacji gry.
- Obecny widok działań jest od najstarszego do najnowszego; sprawdź również
  ręczną kolejność w widoku kadrowania. Nie przywracaj starego `.reverse()`.
- Zrzuty są już wdrożone (starsze rozmowy odkładały je). Worker odpowiada na
  `captureTab`; robi JPEG quality 70 przez `captureVisibleTab`.
  Zdjęcie jest bieżącym widokiem, nie rekonstrukcją historycznej osady.
- Wojsko ma celowo tylko `liczba × nazwa`; brak danych: „Otwórz armię w grze”.

## UI: pułapki, które były już naprawiane

- Historia używa `dialog.show()`, NIE `showModal()`: strona ma pozostać klikalna.
- Warstwa tooltipa `#rich-tooltip` musi być nad historią. Tytuły są przenoszone
  przez MutationObserver do `data-tooltip`; do ustawiania nowego opisu można
  używać `title`, który konwerter przejmie.
- Historia jest przeciągana za nagłówek, zmienia szerokość i może wystawać w prawo
  do 80% szerokości. Nagłówek poza scrollowaną treścią, bez szczeliny nad nim.
- Notatki bez border/outline/shadow przy hover/focus. `data-history-note`
  identyfikuje pole; `foeEditing` na hoście sygnalizuje fokus do MAIN.
- Guard klawiatury w `capture.js` na window capture zatrzymuje skróty gry,
  ale nie robi preventDefault, żeby działało natywne wpisywanie tekstu.
- W zamkniętym Shadow DOM używaj `composedPath` do wykrywania kliknięć;
  proste sprawdzanie `event.target` poza shadow może mylić wnętrze z otoczeniem.

## Dane i pliki pomocnicze

- IndexedDB `foe-companion-quantum-history`, store `profiles`, klucz świat:gracz.
  To baza domeny gry z content scriptu, NIE baza workera rozszerzenia.
- localStorage: ustawienia, `foe-companion.notes`, `foe-companion.sectorGuard`,
  `foe-companion-gbg-auto`; konkretne dodatkowe klucze wyszukuj w panel.js.
- `building-names.json`, `building-fp-types.json`: nazwy i klasyfikacja miasta.
- HAR-y są lokalnymi materiałami diagnostycznymi w `har/`, ignorowanymi przez Git.
  Jedyny zachowany zapis ładowania miasta: `har/loading-game.har` (około 2,8 MB).
  `game-loaded.har` usunięto na polecenie użytkownika; zapisy innych akcji zachowano.
  Nie czytaj całego HAR do kontekstu. Parsuj JSON i wybieraj klasy/metody/pola.
  Nie wypisuj cookies, podpisów, URL z sesją ani całych żądań.
- `python/foe_nego.py`, `python/START-NEGO.bat`: osobne narzędzie, nie część
  manifestu rozszerzenia. Starsze trainery nie są automatycznie punktem wejścia.
- `dist/` jest ignorowanym katalogiem wydania / osobnego repo; nie edytuj go
  zamiast źródeł, nie publikuj ani nie kopiuj tam automatycznie.

## Weryfikacja i praca z Git

PowerShell, z katalogu projektu:

```powershell
node --check panel.js
node --check capture.js
$testFiles = @(rg --files -g '*.test.cjs' -g '!dist/**')
node --test @testFiles
# Celowany przykład:
node --test quantum-history.test.cjs quantum-history-ui.test.cjs
```

Nie polegaj na `node --test *.test.cjs` w PowerShell — zależnie od Node wildcard
nie jest rozwijany. Testy używają node:test, assert, vm i atrap DOM; przejście
testów nie dowodzi działania CSS, skrótów ani protokołu w żywej grze.

| Zmiana | Testy startowe |
|---|---|
| Walki / stop | `battle-flow`, `auto-stop`, `battleground-live`, `attrition` |
| Negocjacje | `negotiate`, `negotiation-delay`, `standalone-negotiation` |
| Sektory / UI | `panel-render`, `sector-popup`, `sector-race`, `popup-mount`, `action-settings` |
| Transport | `request-ids`, `capture-socket`, `module-loading` |
| Historia / armia | `quantum-history`, `quantum-history-ui`, `quantum-army`, `quantum-construction` |
| Notatki | `note-keyboard` |
| Miasto | `collection-flow`, `collection-bonuses`, `city-categories`, `city-visibility`, `metadata-names` |
| Perły | `contribution`, `pearl-locks`, `arc-profit` |

Nazwy powyżej mają sufiks `.test.cjs`. Część testów wycina fragmenty źródła po
markerach tekstowych; po refaktorze rozróżnij awarię markera od regresji funkcji.
Nie wykonuj prawdziwych walk/negocjacji jako testów bez osobnego polecenia.

`START-DEV.cmd` uruchamia watcher na 127.0.0.1:18743. Zapis JS może przeładować
grę, jeśli watcher i klient są aktywne. Nowy moduł wymaga wpisu w manifest.json
i liście `files` dev-server.cjs. Restart watchera wczytuje nową listę.

Po zmianach: odpowiednie testy, diff, lokalny commit tylko właściwych plików.
Push wymaga osobnego polecenia. `v+` oznacza wydanie: technicznie np. 0.6.4,
widocznie 0.6.04 oraz wpis changelogu w panel.js. Bez wydania: „Zmiany lokalne”.
Zachowaj styl końców linii istniejących plików; mieszane CRLF/LF nie powinny
powodować diffu całego pliku. AGENTS.md zawiera pełne zasady numeracji.

## Jak nie zgubić stanu projektu

`TODO.md` miesza aktualny plan i historyczne transkrypty. Czytaj najnowszy blok;
stary tekst „jeszcze nie rób” przy zrzutach nie oznacza, że zrzutów nie wdrożono.
`HANDOFF.md` pochodzi z 2026-10-01 i jest historyczny (np. liczba testów i stan Git).
`QUANTUM-HISTORY.md` wyjaśnia model historii, ale część opisów UI jest starsza.
Nie traktuj żadnego z nich jako kompletnego aktualnego wykazu funkcji.

Podczas przygotowania mapy zastano nieśledzone: README-z-githuba.md,
python/foe_negotiation_trainer_v57.py, python/foe_result_color_debug.txt.
Nie usuwaj ich ani nie commituj przy okazji; zawsze ponownie sprawdź status.

Po kolejnej większej zmianie uaktualnij: datę/bazę, tabelę modułów, kontrakty,
stan wdrożenia vs TODO, testy i nowe pułapki. Zachowaj ten dokument jako mapę,
nie dopisuj pełnych transkryptów ani treści HAR.
