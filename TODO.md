# Oczekujące zmiany

Lista z 6 października 2026. Wdrożenie dopiero na wyraźne polecenie użytkownika.

## Interfejs

- [x] Przenieść ustawienia autoataku (pozostaw walk, przerwa, limit porażek) z diagnostyki do sekcji Pola Chwały.
- Tooltipy budowanych budynków kwantowych: dodać bazową produkcję obok populacji, zadowolenia i bonusów. Używać emoji i danych definicji budynku, bez wpisywania przykładowych liczb na sztywno.
- Zbiory kwantowe: wyrównać produkcję do prawej w kolumnach bez obramowania; pogrubić godziny i liczebności budynków.
- Pod zbiorami kwantowymi dodać pełne, domyślnie rozwinięte zestawienie budynków i produkcji, z wyrównaniem kolumn.
- Zbiory miejskie: tooltip w wierszach/kolumnach bez obramowania oraz ciaśniejsza lista budynków.
- Sprawdzić game-loaded.har pod kątem nazw budynków (np. Breezemill); rozróżnić nazwę zestawu ulepszenia od nazwy budynku i jego konkretnej wersji. Ocenić odczyt nazw w czasie gry.
- Komunikat potwierdzenia wpłaty do perły ma znikać po chwili.
- Przy wpłatach dodać krótką informację, że widok gry może być nieaktualny. Opisać odświeżenie strony / aktualizację po następnej wpłacie; nie obiecywać, że dowolna akcja zawsze odświeży perłę.

## Misje powtarzalne — bez analizy HAR do polecenia użytkownika

- Dopiero po poleceniu zbadać wykonalność na dostarczonym HAR.
- Zakładka „Inne” i przycisk wykonywania misji pobocznych.
- Rozpoznawać misje z dwoma warunkami: wpłać monety i wpłać zaopatrzenie. Na razie bez towarów.
- Pętla przerywania niespełniających kryteriów misji i wykonywania pasujących, o ile wystarcza zasobów.
- Ustawienia minimalnego zapasu monet i zaopatrzenia; automatyzacja nie może zejść poniżej tych wartości.

## Wcześniejsze niezakończone zadanie

- Przeanalizować nego-quest-manual.har i dodać odbiór nagrody/przejście do kolejnych negocjacji z panelu na podstawie faktycznych żądań. Dotychczas dodano śledzenie ukończonych warunków, lecz nie pełne przechodzenie dalej.
