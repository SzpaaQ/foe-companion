# Stan współpracy — 2026-10-01

Projekt rozszerzenia Brave/Chromium, bez procesu budowania. Manifest ładuje pliki JS bezpośrednio. START-DEV.cmd uruchamia mechanizm przeładowania. Nie wykonuj prawdziwych walk ani negocjacji jako testów.

## Git

- Repozytorium lokalne w tym folderze. Pierwszy commit `85f3715` zachowuje stan po pracy użytkownika i Kiro, przed naprawą rozpiski.
- Przed zmianami sprawdź `git status` i `git diff`. Nie cofaj cudzych zmian.
- HAR-y, transkrypt, zrzuty i klucze nie są wersjonowane. Nie publikuj ich: mogą zawierać dane sesji. Nie skonfigurowano zdalnego repozytorium.
- Przy zmianie narzędzia pracuj w tym samym folderze; zapisz pliki i zakończ pracę poprzedniego narzędzia. Commit tworzy punkt powrotu.

## Naprawa rozpiski

`negPendingSector` było używane, ale niezadeklarowane. ReferenceError z `paintOpenSectors()` przerywał również aktualizację górnej rozpiski. Dodano deklarację stanu i test renderowania. Oba lokalne HAR-y `pola-brak-rozpiski.har` oraz `pola-rozpiska-dziala.har` zawierają mapę volcano_archipelago z 60 prowincjami.

`isAttackBattleType` oznacza atak/obronę, nie walkę/negocjację. Przywrócono dostęp do obu rodzajów akcji niezależnie od tej flagi.

## Walidacja i dalsze prace

Testy: `node --test *.test.cjs` (22 testy). Testy offline, bez sprawdzenia na aktywnym koncie.

Transkrypt Kiro kończył się również zgłoszeniem `invalid wave`. Ta poprawka dotyczy renderowania rozpiski; przyczyna `invalid wave` nie została potwierdzona ani naprawiona. Nie usuwaj kontroli zgodności sektora bez analizy konkretnej odpowiedzi walki.

Kiro dodało solver i automatyzację negocjacji oraz zmieniło odczyt progresu i obsługę podpisów. Te zmiany zachowano. Testy solvera nie potwierdzają pełnej poprawności negocjacji w grze. Zwróć uwagę na zachowanie zapasu walk przy brakującym limicie — istniejący test dopuszcza rozpoczęcie walki na nowym sektorze bez potwierdzonego limitu. Wymaga to osobnej decyzji/naprawy względem pierwotnego wymagania zatrzymania z zapasem.
