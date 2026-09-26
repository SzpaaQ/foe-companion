# 🛡️ FOE Helper / Companion – Podręcznik Użytkownika (v0.3)

Rozszerzenie przeznaczone do automatycznej analizy danych w grze Forge of Empires. Aplikacja działa w tle, interpretując pakiety przesyłane między serwerem gry a przeglądarką. Nie wymaga ręcznego wklejania plików JSON ani wprowadzania danych.

---

## 🛠️ Instalacja rozszerzenia z pliku ZIP

Instalacja w przeglądarce Brave z przygotowanej paczki archiwum:

1. **Przygotowanie folderu:** Wypakować zawartość pliku `.zip` do stałej lokalizacji na dysku (np. do katalogu `Dokumenty`). *Ważne: plik manifest.json musi znajdować się bezpośrednio w wypakowanym folderze głównego projektu.*
2. **Karta rozszerzeń:** Wpisać w pasek adresu przeglądarki `brave://extensions` i zatwierdzić klawiszem Enter.
3. **Tryb programisty:** Włączyć przełącznik **Tryb deweloperki** (Developer mode) znajdujący się w prawym górnym rogu ekranu.
4. **Wczytanie wtyczki:** Kliknąć przycisk **Załaduj rozpakowane** (Load unpacked) w lewym górnym rogu i wskazać folder powstały po wypakowaniu pliku ZIP.

*Uwaga:* Po pierwszej instalacji lub aktualizacji wtyczki należy **odświeżyć kartę z grą** (F5 lub Ctrl+R). Do poprawnego działania wymagane jest prowadzenie rozgrywki na tylko jednej otwartej karcie.

---

## 🧭 Opis funkcji i sposób użycia

Aplikacja jest podzielona na cztery główne obszary robocze:

### 1. ⚔️ Pola Chwały
Moduł służy do mapowania i vizualizacji sytuacji w prowincjach.
* **Działanie:** Należy wejść na mapę Pól Chwały w grze. Rozszerzenie automatycznie odczyta strukturę sektorów.
* **Zawartość:** Ekran prezentuje status 61 sektorów, relacje sąsiedztwa oraz prowincje własne (oznaczone jako ⚪).
* **Aktualizacja danych:** Wtyczka nie generuje własnych zapytań sieciowych. Aktualizacja stanu mapy następuje po jej ponownym zamknięciu i otwarciu w interfejsie gry.

### 2. 🏛️ Kalkulator Pereł 1.9
Narzędzie do wyliczania bezpiecznych poziomów wpłat dla miejsc 1-5 w Perłach Architektury.
* **Działanie:** Należy otworzyć okno wybranej Perły Architektury (własnej lub innego gracza).
* **Obliczenia:** System automatycznie pobiera koszt poziomu i wylicza wartości dla pozycji P1–P5 z uwzględnieniem mnożnika 1.9 (zaokrąglanie w górę). Przyciski obok kwot kopiują gotowy tekst zabezpieczenia bezpośrednio do schowka.
* **Wkład właściciela:** Wyświetlana jest łączna kwota wymagana do zablokowania miejsc. Opcjonalny checkbox pozwala pomniejszyć wyliczenie o 1 PR.
* **Wysyłanie wpłat:** Przycisk "Wpłać" automatycznie realizuje transakcję w grze na bazie bieżących nagłówków sesji. W przypadku wykrycia zabezpieczeń kryptograficznych (podpisy cyfrowe/checksumy), funkcja ta jest automatycznie blokowana w celu ochrony konta.

### 3. ⚛️ Najazdy Kwantowe
Moduł prognozowania ekonomicznego dla osady kwantowej.
* **Działanie:** Należy otworzyć Osadę Kwantową w grze, aby wtyczka zainicjowała odczyt struktur.
* **Prognoza:** Ekran kalkuluje spodziewany zbiór monet, zaopatrzenia oraz chronostopów z uwzględnieniem bonusów oraz aktualnego wskaźnika Euforii.
* **Grupowanie czasu:** Budynki z czasem zakończenia produkcji różniącym się o mniej niż godzinę są łączone w grupy. Prezentowany termin jest czasem zakończenia ostatniej produkcji w grupie. Place budowy wyświetlane są w osobnej sekcji.

### 4. ⚙️ Diagnostyka
Karta techniczna monitorująca status aplikacji.
* **Zawartość:** Wyświetla aktualną wersję rozszerzenia (0.3) oraz statystyki odebranych pakietów danych. Służy do weryfikacji poprawności nasłuchiwania interfejsu API.

---

## 📝 Moduł Notatek (Notes)

Dolna sekcja panelu (zablokowana do maksymalnie 300 pikseli wysokości) służy do prowadzenia zapisków.
* **Zapis:** Treść jest zapisywana automatycznie podczas wprowadzania znaków do pamięci podręcznej przeglądarki (`localStorage`).
* **Kontekstowość:** Wpisany tekst jest unikalny dla każdej zakładki. W module kalkulatora notatki są przypisywane globalnie do konkretnego typu Perły Architektury, niezależnie od jej właściciela.
* *Ważne:* Czyszczenie danych przeglądarki lub pamięci podręcznej witryny bezpowrotnie usuwa zapisane notatki.

---

## ⚠️ Środki ostrożności i bezpieczeństwo

1. **Ochrona danych:** W katalogu roboczym mogą powstawać pliki z logami danych (np. `response.json`). **Zabrania się udostępniania paczki rozszerzenia zawierającej takie pliki osobom trzecim.** Mogą one zawierać klucze sesji oraz pełne dane konta gry.
2. **Aktualizacja kodu:** Przy ręcznych modyfikacjach kodu w plikach `.json` lub `.js`, należy użyć mechanizmu `START-DEV.cmd`, który automatycznie odświeży rozszerzenie oraz kartę gry po zapisie.
