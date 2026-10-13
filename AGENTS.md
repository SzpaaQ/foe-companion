# Zasady wersjonowania ustalone z użytkownikiem

- Po zakończeniu wprowadzanych zmian oraz przy każdym poleceniu `v+` wykonuj lokalny commit z opisem zmian. Sprawdź zakres diffu i odpowiednie testy; nie dodawaj przypadkowych plików ani HAR-ów. Push wymaga osobnego polecenia.

- Od linii 0.5 stosuj widoczne numery 0.5.01–0.5.99 (dwie cyfry trzeciego członu). Wydanie otwierające linię: 0.5.0, analogicznie 0.6.0.
- Po .99 przechodź do kolejnego drugiego członu, np. 0.4.99 → 0.5.0 lub 0.5.99 → 0.6.0. Cykl obejmuje 100 wydań (.0–.99).
- Wydanie otwierające kolejną linię podsumowuje cykl zmian i obejmuje poprawki estetyczne.
- Od podwersji 90 przy każdym kolejnym wydaniu informuj użytkownika, ile kroków zostało do przeskoku: 100 minus trzeci człon (90 → 10, 99 → 1).
- Chrome/Brave nie dopuszcza zer wiodących w `manifest.version`. Używaj technicznie np. `version: "0.5.1"` oraz `version_name: "0.5.01"`. W interfejsie i changelogu wyświetlaj `version_name || version`.
- Changelog musi zawierać każde wydanie i być przewijalny. Nie przypisuj niewydanych zmian do historycznych wersji; oznaczaj je jako lokalne do czasu wydania.
- Samo ustalenie tej konwencji nie oznacza wydania 0.5.0 ani zmiany obecnego numeru.
