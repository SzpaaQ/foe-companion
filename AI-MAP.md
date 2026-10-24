# FoE Companion — mapa dla AI

Stan rozpoznany: 2026-10-24, baza poprzedniego etapu `d99c9da`, automatyzacja wdrożona lokalnie, manifest 0.6.03.
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
| UI / ustawienia | `panel.js`: `mount`, `paintOpenSectors`, `paintQuantum`, `openSectorGuardModal` | Zakładki, renderowanie, przyciski, stan automatów i ustawienia |
| Ruch gry / akcje | `capture.js`: `emit`, `observeTransport`, `battleCall`, `prepareGameRequest`, `restoreGameResponse` | Przechwytywanie, podpisy, requestId, wykonanie akcji |
| Podpis żądania | `request-signature.js`; `analyze-signatures.cjs` | Podpisywanie i pomocnicza weryfikacja offline; nie wypisuj danych sesji |
| Model Pól Chwały | `model.js`: `rows`, topologie | Nazwy, sąsiedztwo, własna gildia, progres, blokada, ignorowanie |
| Stan socketu | `battleground-live.js`: `createTracker`, `check`, `waitForProgress`, `observeSockets` | Aktualność prowincji, epoch po reconnect, potwierdzanie progresu |
| Kolejka otwartych sektorów | `sector-automation.js`: `create`, `eligible`, `tick`, `result`; panel: `tickBulk`, `paintBulkControls` | Limity, trwałe sukcesy na otwarcie, seria porażek |
| Dobór armii do walki | `battle-army.js`: `plan`, `confirmed` | Wybór jednostek i weryfikacja ustawionego składu |
| Negocjacje | `capture.js`: `negBestGuess`, `negFilter`, `ensureFreeNegotiationTurn`; `panel.js`: `startNeg`, `stopAutoNeg` | Solver, darmowe tury, przebieg i pętla per sektor |
| Osada kwantowa | `quantum.js`: `createTracker`, `consume`, `summary`, `summarizeArmy` | Mapa osady, zasoby, budowy, prognoza produkcji, wojsko |
| Historia osady | `quantum-history.js`: `create`, `observe`, `groupEvents`, `actionRows`, `actionRuns`, `mount` | Trwałe zdarzenia, grupowanie, notatki, undo/split i UI historii |
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
