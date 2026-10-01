import itertools
import os
import time
import math
import random
import re
import threading
import tkinter as tk
from collections import Counter, defaultdict
from tkinter import ttk, messagebox


APP_TITLE = "FoE Negotiation Trainer"
MAX_EXACT_CANDIDATES = 1_000_000
MAX_HINT_GUESSES = 220

# Kolory stanów zgodnie z założeniami.
COLOR_YES = "#b7e1cd"       # zielony
COLOR_NO = "#f4c7c3"        # czerwony
COLOR_OTHER = "#fce8b2"     # żółty
COLOR_SELECTED = "#0089ac"  # aktualny wybór
COLOR_NORMAL = "#ffffff"
COLOR_LOCKED = "#d9ead3"
COLOR_DISABLED = "#eeeeee"
COLOR_HEADER = "#f3f3f3"

CALIBRATION_FILE = "foe_negotiation_clicker_calibration.json"
CLICK_DELAY = 0.20

# AUTO: FoE potrzebuje ok. 5-6 s na pokazanie NOWEGO wyniku.
# Nie wolno czytać starych napisów z poprzedniej tury tuż po kliknięciu.
FULL_AUTO_RESULT_MIN_WAIT = 1.8
FULL_AUTO_RESULT_TIMEOUT = 12.0
FULL_AUTO_RESULT_STABLE_READS = 2


def feedback_for(secret, guess):
    """
    Poprawna logika negocjacji FoE z uwzględnieniem już trafionych osób:

    1. Najpierw wszystkie dokładne trafienia -> TAK.
       Ich towary są już "zużyte" przez trafione osoby.

    2. Dla pozostałych osób:
       - jeśli istnieje jeszcze wolne wystąpienie tego towaru
         u którejś z POZOSTAŁYCH osób -> INNA,
       - jeśli nie -> NIE.

    Dzięki temu:
        A=1 TAK
        C->1
    nie daje automatycznie INNA tylko dlatego, że A miało 1.
    A jest już rozwiązane i nie należy do "pozostałych osób".
    """
    n = len(secret)
    result = [None] * n
    remaining = Counter()

    # 001. Najpierw blokujemy dokładne trafienia.
    for i in range(n):
        if guess[i] == secret[i]:
            result[i] = "TAK"
        else:
            remaining[secret[i]] += 1

    # 002. Dopiero potem INNA / NIE dla nierozwiązanych pozycji.
    for i in range(n):
        if result[i] == "TAK":
            continue

        good = guess[i]

        if remaining[good] > 0:
            result[i] = "INNA"
            remaining[good] -= 1
        else:
            result[i] = "NIE"

    return tuple(result)


class NegotiationApp(tk.Tk):
    def __init__(self):
        super().__init__()

        self.title(APP_TITLE)
        self.geometry("620x700")
        self.minsize(360, 420)

        self.mode_var = tk.StringVar(value="Analiza")
        self.people_var = tk.IntVar(value=5)
        self.goods_var = tk.IntVar(value=5)
        self.rounds_var = tk.IntVar(value=3)
        self.hints_var = tk.BooleanVar(value=True)
        self.topmost_var = tk.BooleanVar(value=False)
        self.autofill_var = tk.BooleanVar(value=True)
        self.compact_var = tk.BooleanVar(value=True)
        self.hide_clicker_window_var = tk.BooleanVar(value=False)
        self.more_settings_visible = False

        self.current_round = 1
        self.secret = []
        self.locked = {}
        self.selected = {}
        self.tried = defaultdict(dict)   # person -> good -> status
        # Jeśli choć jedna osoba zwróci NIE, towar odpada globalnie
        # i nie może być użyty u żadnej osoby w kolejnych turach.
        self.global_rejected_goods = set()
        self.known_present_goods = set()
        self.analysis_status = {}
        self.history = []

        self.candidates = []
        self.exact_solver = True
        self.hint_busy = False
        self.current_hint_text = ""
        self.hint_generation = 0

        self.person_widgets = {}
        self.good_buttons = {}

        # Klikacz przeglądarki - automatyczne wykrywanie elementów.
        self.clicker_busy = False
        self.last_detected_people = []
        self.last_detected_goods = []
        self.result_rois = []
        self.clicker_detected = False
        self.console_lines = []
        self.last_result_read_ok = False
        self.detected_popup_person = None

        # 001. Pełna automatyzacja całej negocjacji.
        self.full_auto_running = False
        self.full_auto_pay_started = 0.0
        self.full_auto_result_started = 0.0
        self.full_auto_result_stable_count = 0
        self.full_auto_last_result_signature = None

        # Stan automatyzacji negocjacji.
        # NOWA -> WYKRYCIE -> SUGESTIA -> WYNIK -> SUGESTIA -> ...
        self.negotiation_stage = "NOWA"

        self._build_ui()
        self._console_log("Gotowy. ENTER = następna akcja.")
        self.bind("<Configure>", self._on_window_configure)

        # ENTER wykonuje dokładnie następny krok zapisany w stanie negocjacji:
        # NOWA/WYKRYCIE/SUGESTIA -> WYKONAJ
        # WYNIK -> SPRAWDŹ
        self.bind("<Return>", self._on_enter_shortcut)
        self.bind("<KP_Enter>", self._on_enter_shortcut)

        self.new_game()

    # ============================================================
    # UI
    # ============================================================

    def _build_ui(self):
        compact = self.compact_var.get()

        outer_padding = 3 if compact else 8
        section_padding = 3 if compact else 8
        section_gap = 3 if compact else 7

        self.outer = ttk.Frame(self, padding=outer_padding)
        self.outer.pack(fill="both", expand=True)

        # ========================================================
        # USTAWIENIA PODSTAWOWE
        # ========================================================
        self.controls = ttk.LabelFrame(
            self.outer,
            text="Ustawienia",
            padding=section_padding,
        )
        self.controls.pack(fill="x")

        # Pierwsza linia zawsze widoczna:
        # OSOBY | TOWARY | TURY
        basic = ttk.Frame(self.controls)
        basic.pack(fill="x")

        ttk.Label(basic, text="OSOBY").pack(side="left")
        ttk.Spinbox(
            basic,
            from_=1,
            to=26,
            textvariable=self.people_var,
            width=3 if compact else 5,
        ).pack(side="left", padx=(3, 8 if compact else 14))

        ttk.Label(basic, text="TOWARY").pack(side="left")
        ttk.Spinbox(
            basic,
            from_=1,
            to=99,
            textvariable=self.goods_var,
            width=3 if compact else 5,
        ).pack(side="left", padx=(3, 8 if compact else 14))

        ttk.Label(basic, text="TURY").pack(side="left")
        ttk.Spinbox(
            basic,
            from_=1,
            to=10,
            textvariable=self.rounds_var,
            width=3 if compact else 5,
        ).pack(side="left", padx=(3, 0))

        # Druga linia - nowa negocjacja + więcej ustawień.
        basic_actions = ttk.Frame(self.controls)
        basic_actions.pack(fill="x", pady=(3, 0))

        ttk.Button(
            basic_actions,
            text="NOWA NEGOCJACJA",
            command=self.new_game,
        ).pack(side="left")

        self.more_button = ttk.Button(
            basic_actions,
            text="WIĘCEJ USTAWIEŃ",
            command=self.toggle_more_settings,
        )
        self.more_button.pack(side="left", padx=(4, 0))

        # Zaawansowane ustawienia domyślnie ukryte.
        self.more_frame = ttk.Frame(self.controls)

        row1 = ttk.Frame(self.more_frame)
        row1.pack(fill="x", pady=(4, 0))

        ttk.Label(row1, text="Tryb:").pack(side="left")
        mode = ttk.Combobox(
            row1,
            textvariable=self.mode_var,
            values=("Trening", "Analiza"),
            state="readonly",
            width=10,
        )
        mode.pack(side="left", padx=(3, 8))
        mode.bind("<<ComboboxSelected>>", lambda _e: self.new_game())

        ttk.Checkbutton(
            row1,
            text="Wskazówki",
            variable=self.hints_var,
            command=self.toggle_hint_visibility,
        ).pack(side="left", padx=(0, 8))

        self.autofill_check = ttk.Checkbutton(
            row1,
            text="Autouzupełnianie",
            variable=self.autofill_var,
        )
        self.autofill_check.pack(side="left")

        row2 = ttk.Frame(self.more_frame)
        row2.pack(fill="x", pady=(3, 0))

        ttk.Checkbutton(
            row2,
            text="Tryb kompaktowy",
            variable=self.compact_var,
            command=self.toggle_compact_mode,
        ).pack(side="left")

        ttk.Checkbutton(
            row2,
            text="Ukrywaj okno podczas automatyzacji",
            variable=self.hide_clicker_window_var,
        ).pack(side="left", padx=(8, 0))

        if self.more_settings_visible:
            self.more_frame.pack(fill="x")

        # ========================================================
        # INFORMACJA O TURZE
        # ========================================================
        self.round_label = ttk.Label(
            self.outer,
            text="",
            font=("Segoe UI", 9 if compact else 11, "bold"),
        )
        self.round_label.pack(fill="x", pady=(section_gap, 2))

        # ========================================================
        # NEGOCJACJA
        # ========================================================
        self.board_box = ttk.LabelFrame(
            self.outer,
            text="Negocjacja",
            padding=2 if compact else 5,
        )
        self.board_box.pack(fill="both", expand=True)

        self.canvas = tk.Canvas(
            self.board_box,
            highlightthickness=0,
            bg="#fafafa",
            bd=0,
        )
        self.canvas.grid(row=0, column=0, sticky="nsew")

        self.vscroll = ttk.Scrollbar(
            self.board_box,
            orient="vertical",
            command=self.canvas.yview,
        )
        self.vscroll.grid(row=0, column=1, sticky="ns")

        self.hscroll = ttk.Scrollbar(
            self.board_box,
            orient="horizontal",
            command=self.canvas.xview,
        )
        self.hscroll.grid(row=1, column=0, sticky="ew")

        self.board_box.rowconfigure(0, weight=1)
        self.board_box.columnconfigure(0, weight=1)

        self.canvas.configure(
            yscrollcommand=self.vscroll.set,
            xscrollcommand=self.hscroll.set,
        )

        self.board = tk.Frame(self.canvas, bg="#fafafa")
        self.board_window = self.canvas.create_window(
            (0, 0),
            window=self.board,
            anchor="nw",
        )
        self.board.bind(
            "<Configure>",
            lambda _e: self.canvas.configure(
                scrollregion=self.canvas.bbox("all")
            ),
        )
        self.canvas.bind(
            "<Configure>",
            self._resize_board_to_canvas,
        )

        # ========================================================
        # DOLNY PASEK
        # ========================================================
        bottom = ttk.Frame(self.outer)
        bottom.pack(fill="x", pady=(section_gap, 0))

        self.action_button = ttk.Button(
            bottom,
            text="SPRAWDŹ TURĘ",
            command=self.submit_round,
        )
        self.action_button.pack(side="left")

        ttk.Button(
            bottom,
            text="WYCZYŚĆ",
            command=self.clear_current_selection,
        ).pack(side="left", padx=(3, 0))

        # Kopia przycisku zgodnie z założeniem - zawsze dostępna na dole.
        ttk.Button(
            bottom,
            text="NOWA NEGOCJACJA",
            command=self.new_game,
        ).pack(side="left", padx=(3, 0))

        self.show_solution_button = ttk.Button(
            bottom,
            text="POKAŻ ROZWIĄZANIE",
            command=self.show_training_solution,
        )
        self.show_solution_button.pack(side="left", padx=(3, 0))

        self.history_button = ttk.Button(
            bottom,
            text="HISTORIA",
            command=self.show_move_history,
        )
        self.history_button.pack(side="left", padx=(3, 0))

        # ========================================================
        # WSKAZÓWKA
        # ========================================================
        self.hint_box = ttk.LabelFrame(
            self.outer,
            text="Wskazówka / analiza",
            padding=3 if compact else 7,
        )
        self.hint_box.pack(fill="x", pady=(section_gap, 0))

        hint_row = ttk.Frame(self.hint_box)
        hint_row.pack(fill="x")

        self.hint_label = ttk.Label(
            hint_row,
            text="",
            justify="left",
            wraplength=460 if compact else 1020,
            font=("Segoe UI", 8 if compact else 9),
        )
        self.hint_label.pack(side="left", fill="x", expand=True)

        self.hint_check_button = ttk.Button(
            hint_row,
            text="SPRAWDŹ",
            width=8,
            command=self.apply_hint_and_check,
        )
        if self.mode_var.get() == "Trening":
            self.hint_check_button.pack(side="right", padx=(4, 0))

        # ========================================================
        # KLIKACZ / ODCZYT - ZAWSZE WIDOCZNY NA SAMYM DOLE
        # ========================================================
        self.clicker_frame = ttk.Frame(self.outer)
        self.clicker_frame.pack(
            side="bottom",
            fill="x",
            pady=(section_gap, 0),
        )

        clicker_row = ttk.Frame(self.clicker_frame)
        clicker_row.pack(fill="x")

        # Nie ma już osobnego WYKRYJ.
        # WYKONAJ sam wykrywa negocjację, jeśli nie ma jeszcze kalibracji.
        self.execute_button = tk.Button(
            clicker_row,
            text="WYKONAJ",
            command=self.execute_browser_suggestion,
            bg="#2e7d32",
            fg="#ffffff",
            activebackground="#256628",
            activeforeground="#ffffff",
            disabledforeground="#d7d7d7",
            relief="raised",
            bd=1,
            padx=10,
            pady=2,
            font=("Segoe UI", 8 if compact else 9, "bold"),
        )
        self.execute_button.pack(side="left")

        self.read_result_button = tk.Button(
            clicker_row,
            text="SPRAWDŹ",
            command=self.read_browser_result,
            bg="#1565c0",
            fg="#ffffff",
            activebackground="#0d47a1",
            activeforeground="#ffffff",
            disabledforeground="#d7d7d7",
            relief="raised",
            bd=1,
            padx=10,
            pady=2,
            font=("Segoe UI", 8 if compact else 9, "bold"),
        )
        self.read_result_button.pack(side="left", padx=(4, 0))

        # Skrót: SPRAWDŹ wynik i po policzeniu od razu WYKONAJ kolejną sugestię.
        self.read_and_execute_button = tk.Button(
            clicker_row,
            text="↻▶",
            width=4,
            command=self.read_result_and_execute,
            bg="#6a1b9a",
            fg="#ffffff",
            activebackground="#4a148c",
            activeforeground="#ffffff",
            disabledforeground="#d7d7d7",
            relief="raised",
            bd=1,
            padx=4,
            pady=2,
            font=("Segoe UI", 8 if compact else 9, "bold"),
        )
        self.read_and_execute_button.pack(side="left", padx=(4, 0))

        # 002. Jednym kliknięciem rozgrywa wszystkie ustawione tury.
        self.full_auto_button = tk.Button(
            clicker_row,
            text="AUTO",
            command=self.toggle_full_auto,
            bg="#ef6c00",
            fg="#ffffff",
            activebackground="#e65100",
            activeforeground="#ffffff",
            disabledforeground="#d7d7d7",
            relief="raised",
            bd=1,
            padx=10,
            pady=2,
            font=("Segoe UI", 8 if compact else 9, "bold"),
        )
        self.full_auto_button.pack(side="left", padx=(4, 0))

        # Status automatyzacji + liczba możliwych układów.
        clicker_info_row = ttk.Frame(self.clicker_frame)
        clicker_info_row.pack(fill="x", pady=(3, 0))

        self.negotiation_status_label = ttk.Label(
            clicker_info_row,
            text="",
            font=("Segoe UI", 8 if compact else 9, "bold"),
        )
        self.negotiation_status_label.pack(side="left", fill="x", expand=True)

        self.candidate_label = ttk.Label(
            clicker_info_row,
            text="",
            font=("Segoe UI", 8 if compact else 9),
        )
        self.candidate_label.pack(side="right")

        console_height = 1 if compact else 4
        self.console_box = tk.Text(
            self.clicker_frame,
            height=console_height,
            wrap="word",
            font=("Consolas", 8 if compact else 9),
            relief="solid",
            bd=1,
            padx=4,
            pady=2,
            state="disabled",
        )
        self.console_box.pack(fill="x", pady=(3, 0))
        self._render_console()

        # ========================================================
        # ZAWSZE NA WIERZCHU - ABSOLUTNIE W PRAWYM GÓRNYM ROGU
        # ========================================================
        self.topmost_button = ttk.Button(
            self,
            text=("TOP: TAK" if self.topmost_var.get() else "TOP: NIE"),
            command=self.toggle_topmost,
            width=8,
        )
        self.topmost_button.place(
            relx=1.0,
            x=-7,
            y=7,
            anchor="ne",
        )
        self.topmost_button.lift()

        self._sync_mode_specific_ui()
        self._sync_clicker_buttons()
        self._update_negotiation_status_label()

    def _stretch_board_now(self):
        if hasattr(self, "canvas") and hasattr(self, "board_window"):
            self.update_idletasks()
            self.canvas.itemconfigure(
                self.board_window,
                width=max(1, self.canvas.winfo_width()),
            )

    def _resize_board_to_canvas(self, event):
        # Negocjacja zajmuje zawsze całą szerokość obszaru.
        if hasattr(self, "board_window"):
            self.canvas.itemconfigure(
                self.board_window,
                width=max(1, event.width),
            )

    def _on_window_configure(self, _event=None):
        if hasattr(self, "hint_label") and self.hint_label.winfo_exists():
            width = max(260, self.winfo_width() - 40)
            self.hint_label.configure(wraplength=width)

        if hasattr(self, "topmost_button") and self.topmost_button.winfo_exists():
            self.topmost_button.lift()


    # ============================================================
    # KLIKACZ PRZEGLĄDARKI - AUTOMATYCZNE WYKRYWANIE
    # ============================================================

    def _get_clicker_modules(self):
        try:
            import pyautogui
            import cv2
            import numpy as np

            pyautogui.FAILSAFE = True
            return pyautogui, cv2, np

        except ImportError as exc:
            self._console_log(
                "BŁĄD: brak bibliotek klikacza. "
                "pip install pyautogui opencv-python pillow | "
                f"{exc}"
            )
            return None

    @staticmethod
    def _rect_center(rect):
        x, y, w, h = rect
        return x + w / 2.0, y + h / 2.0

    @staticmethod
    def _rect_iou(a, b):
        ax, ay, aw, ah = a
        bx, by, bw, bh = b

        x1 = max(ax, bx)
        y1 = max(ay, by)
        x2 = min(ax + aw, bx + bw)
        y2 = min(ay + ah, by + bh)

        iw = max(0, x2 - x1)
        ih = max(0, y2 - y1)
        intersection = iw * ih

        if intersection <= 0:
            return 0.0

        union = aw * ah + bw * bh - intersection
        return intersection / union if union else 0.0

    def _find_rectangles(self, image_bgr):
        """
        Wykrywa prostokątne elementy interfejsu.
        Zachowujemy większy prostokąt, gdy OpenCV znajdzie jednocześnie
        zewnętrzną i wewnętrzną krawędź tego samego przycisku.
        """
        modules = self._get_clicker_modules()
        if modules is None:
            return []

        _pyautogui, cv2, np = modules

        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (3, 3), 0)

        edges = cv2.Canny(gray, 45, 145)
        edges = cv2.dilate(
            edges,
            np.ones((3, 3), dtype=np.uint8),
            iterations=1,
        )

        contours, _hierarchy = cv2.findContours(
            edges,
            cv2.RETR_LIST,
            cv2.CHAIN_APPROX_SIMPLE,
        )

        found = []

        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)

            if w < 35 or h < 22:
                continue
            if w > 220 or h > 120:
                continue

            ratio = w / float(h)
            if ratio < 0.85 or ratio > 4.0:
                continue

            found.append((int(x), int(y), int(w), int(h)))

        # Najpierw większe. Dzięki temu ramka zewnętrzna wygrywa
        # z prawie identyczną ramką wewnętrzną.
        found.sort(key=lambda r: r[2] * r[3], reverse=True)

        result = []

        for rect in found:
            cx, cy = self._rect_center(rect)
            duplicate = False

            for kept in result:
                kx, ky = self._rect_center(kept)

                if (
                    abs(cx - kx) <= 6
                    and abs(cy - ky) <= 6
                    and self._rect_iou(rect, kept) >= 0.60
                ):
                    duplicate = True
                    break

            if not duplicate:
                result.append(rect)

        return result

    @staticmethod
    def _row_groups(rectangles, tolerance=10):
        """
        Grupuje prostokąty znajdujące się na podobnej wysokości.
        """
        rows = []

        for rect in sorted(
            rectangles,
            key=lambda r: (r[1] + r[3] / 2.0, r[0]),
        ):
            cy = rect[1] + rect[3] / 2.0

            matched = None
            for row in rows:
                mean_y = sum(
                    r[1] + r[3] / 2.0 for r in row
                ) / len(row)

                if abs(cy - mean_y) <= tolerance:
                    matched = row
                    break

            if matched is None:
                rows.append([rect])
            else:
                matched.append(rect)

        for row in rows:
            row.sort(key=lambda r: r[0])

        return rows

    @staticmethod
    def _regularity_score(rectangles):
        """
        Niższy wynik = bardziej regularny rząd przycisków.
        """
        if len(rectangles) < 2:
            return 999999.0

        widths = [r[2] for r in rectangles]
        heights = [r[3] for r in rectangles]
        centers_x = [r[0] + r[2] / 2.0 for r in rectangles]
        centers_y = [r[1] + r[3] / 2.0 for r in rectangles]

        gaps = [
            centers_x[i + 1] - centers_x[i]
            for i in range(len(centers_x) - 1)
        ]

        mean_w = sum(widths) / len(widths)
        mean_h = sum(heights) / len(heights)
        mean_gap = sum(gaps) / len(gaps)

        width_dev = sum(abs(w - mean_w) for w in widths) / len(widths)
        height_dev = sum(abs(h - mean_h) for h in heights) / len(heights)
        y_dev = sum(
            abs(y - sum(centers_y) / len(centers_y))
            for y in centers_y
        ) / len(centers_y)
        gap_dev = sum(abs(g - mean_gap) for g in gaps) / len(gaps)

        return width_dev + height_dev + y_dev * 2.0 + gap_dev

    def _find_person_buttons(self, image_bgr, expected_people):
        """
        Szuka rzędu przycisków „Wybór surowca”.
        Nie czytamy tekstu - wykorzystujemy ich identyczny rozmiar,
        wspólny poziom i regularne rozmieszczenie.
        """
        rects = self._find_rectangles(image_bgr)

        candidates = [
            r for r in rects
            if 80 <= r[2] <= 155
            and 45 <= r[3] <= 90
            and 1.25 <= (r[2] / float(r[3])) <= 2.4
        ]

        rows = self._row_groups(candidates, tolerance=10)
        best = None
        best_score = None

        for row in rows:
            if len(row) < expected_people:
                continue

            # Sprawdzamy każde kolejne okno N elementów w danym rzędzie.
            for start in range(0, len(row) - expected_people + 1):
                group = row[start:start + expected_people]

                centers = [
                    r[0] + r[2] / 2.0
                    for r in group
                ]
                gaps = [
                    centers[i + 1] - centers[i]
                    for i in range(len(centers) - 1)
                ]

                if gaps and min(gaps) < 70:
                    continue
                if gaps and max(gaps) > 260:
                    continue

                score = self._regularity_score(group)

                # Preferujemy układ szeroki - 5 osób w FoE zajmuje
                # dużą część okna negocjacji.
                span = centers[-1] - centers[0]
                score -= span * 0.015

                if best_score is None or score < best_score:
                    best_score = score
                    best = group

        if best:
            return sorted(best, key=lambda r: r[0])

        return []

    def _find_goods_buttons(self, image_bgr):
        """
        Wykrywa kafelki towarów zgodnie z układem FoE:

            1-5 towarów  -> 1 linia
            6-10 towarów -> 2 linie

        Przy 6+ nie zakładamy 5 elementów w pierwszej linii.
        Przykład:
            6 towarów:
                1 2 3
                4 5 6

        Kolejność zwracana:
            najpierw lewo->prawo w górnym rzędzie,
            potem lewo->prawo w dolnym rzędzie.
        """
        rects = self._find_rectangles(image_bgr)

        candidates = [
            r for r in rects
            if 72 <= r[2] <= 125
            and 48 <= r[3] <= 82
            and 1.15 <= (r[2] / float(r[3])) <= 1.95
        ]

        rows = self._row_groups(candidates, tolerance=10)
        clean_rows = []

        for row in rows:
            if not row:
                continue

            row = sorted(row, key=lambda r: r[0])

            # Podobny rozmiar kafelków w jednym rzędzie.
            widths = sorted(r[2] for r in row)
            heights = sorted(r[3] for r in row)
            median_w = widths[len(widths) // 2]
            median_h = heights[len(heights) // 2]

            row = [
                r for r in row
                if abs(r[2] - median_w) <= 12
                and abs(r[3] - median_h) <= 12
            ]

            if len(row) < 2:
                continue

            # Zostaw regularne ciągi kafelków.
            segments = []
            current = [row[0]]

            for rect in row[1:]:
                prev = current[-1]
                prev_cx = prev[0] + prev[2] / 2.0
                cx = rect[0] + rect[2] / 2.0
                gap = cx - prev_cx

                if 65 <= gap <= 145:
                    current.append(rect)
                else:
                    if 2 <= len(current) <= 5:
                        segments.append(current)
                    current = [rect]

            if 2 <= len(current) <= 5:
                segments.append(current)

            clean_rows.extend(segments)

        if not clean_rows:
            return []

        # --------------------------------------------------------
        # 001. Najpierw szukamy układu DWÓCH rzędów.
        # Jeśli go znajdziemy, to zgodnie z FoE oznacza 6-10 towarów.
        # --------------------------------------------------------
        best_pair = None
        best_score = None

        for top in clean_rows:
            top = sorted(top, key=lambda r: r[0])

            top_cy = sum(r[1] + r[3] / 2.0 for r in top) / len(top)
            top_h = sum(r[3] for r in top) / len(top)

            top_centers = [r[0] + r[2] / 2.0 for r in top]

            top_step = None
            if len(top_centers) > 1:
                top_step = sum(
                    top_centers[i + 1] - top_centers[i]
                    for i in range(len(top_centers) - 1)
                ) / (len(top_centers) - 1)

            for bottom in clean_rows:
                if bottom is top:
                    continue

                bottom = sorted(bottom, key=lambda r: r[0])

                bottom_cy = sum(
                    r[1] + r[3] / 2.0 for r in bottom
                ) / len(bottom)

                vertical_gap = bottom_cy - top_cy

                if not top_h * 0.75 <= vertical_gap <= top_h * 1.70:
                    continue

                total = len(top) + len(bottom)

                # Dwa rzędy w FoE oznaczają co najmniej 6 towarów.
                if not 6 <= total <= 10:
                    continue

                bottom_centers = [
                    r[0] + r[2] / 2.0 for r in bottom
                ]

                bottom_step = None
                if len(bottom_centers) > 1:
                    bottom_step = sum(
                        bottom_centers[i + 1] - bottom_centers[i]
                        for i in range(len(bottom_centers) - 1)
                    ) / (len(bottom_centers) - 1)

                step_diff = 0.0

                if top_step is not None and bottom_step is not None:
                    step_diff = abs(top_step - bottom_step)

                    if step_diff > 18:
                        continue

                # Środki obu rzędów powinny być blisko siebie.
                top_mid = (
                    min(top_centers) + max(top_centers)
                ) / 2.0
                bottom_mid = (
                    min(bottom_centers) + max(bottom_centers)
                ) / 2.0

                if abs(top_mid - bottom_mid) > 42:
                    continue

                score = (
                    self._regularity_score(top)
                    + self._regularity_score(bottom)
                    + step_diff * 2.0
                    + abs(vertical_gap - top_h * 1.15)
                    - total * 40
                )

                # Równa liczba wierszy, np. 3+3 lub 4+4, jest bardzo typowa.
                if len(top) == len(bottom):
                    score -= 30

                if best_score is None or score < best_score:
                    best_score = score
                    best_pair = (top, bottom)

        if best_pair:
            top, bottom = best_pair
            return (
                sorted(top, key=lambda r: r[0])
                + sorted(bottom, key=lambda r: r[0])
            )

        # --------------------------------------------------------
        # 002. Jeśli nie ma poprawnych dwóch rzędów, traktujemy układ
        # jako 1-5 towarów w jednej linii.
        # --------------------------------------------------------
        one_row_candidates = [
            row for row in clean_rows
            if 1 <= len(row) <= 5
        ]

        if not one_row_candidates:
            return []

        best_row = min(
            one_row_candidates,
            key=lambda row: (
                self._regularity_score(row) - len(row) * 35
            ),
        )

        return sorted(best_row, key=lambda r: r[0])

    def _goods_popup_is_open(self, image_bgr):
        """
        Sprawdza wyłącznie, czy popup wyboru surowca jest otwarty.

        Nie przelicza i nie zmienia zapamiętanych pozycji towarów.
        Weryfikujemy obecność prostokątnych elementów w pobliżu
        wcześniej zapamiętanych środków kafelków.
        """
        if not self.last_detected_goods:
            return False

        rects = self._find_rectangles(image_bgr)
        if not rects:
            return False

        matched = 0

        # Wystarczy potwierdzenie kilku pierwszych zapamiętanych pozycji.
        checks = self.last_detected_goods[:min(3, len(self.last_detected_goods))]

        for saved in checks:
            sx, sy = self._rect_center(saved)

            for rect in rects:
                rx, ry = self._rect_center(rect)

                if abs(rx - sx) <= 18 and abs(ry - sy) <= 18:
                    matched += 1
                    break

        required = 1 if len(checks) == 1 else 2
        return matched >= required

    def _screen_to_bgr(self, screenshot):
        modules = self._get_clicker_modules()
        if modules is None:
            return None

        _pyautogui, cv2, np = modules

        rgb = np.array(screenshot)
        return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)

    def _take_screen_bgr(self):
        modules = self._get_clicker_modules()
        if modules is None:
            return None

        pyautogui, _cv2, _np = modules
        screenshot = pyautogui.screenshot()
        return self._screen_to_bgr(screenshot)

    def _save_detection_debug(self, image_bgr, people=None, goods=None):
        """
        Zapisuje pomocniczy screenshot z wykrytymi prostokątami.
        Przy problemach użytkownik może podesłać ten plik.
        """
        modules = self._get_clicker_modules()
        if modules is None:
            return None

        _pyautogui, cv2, _np = modules
        debug = image_bgr.copy()

        if people:
            for index, (x, y, w, h) in enumerate(people):
                cv2.rectangle(
                    debug,
                    (x, y),
                    (x + w, y + h),
                    (0, 255, 0),
                    2,
                )
                cv2.putText(
                    debug,
                    chr(ord("A") + index),
                    (x + 4, max(15, y - 5)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (0, 255, 0),
                    2,
                )

        if goods:
            for index, (x, y, w, h) in enumerate(goods, start=1):
                cv2.rectangle(
                    debug,
                    (x, y),
                    (x + w, y + h),
                    (255, 0, 255),
                    2,
                )
                cv2.putText(
                    debug,
                    str(index),
                    (x + 4, y + 20),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.65,
                    (255, 0, 255),
                    2,
                )

        path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "foe_clicker_debug.png",
        )
        cv2.imwrite(path, debug)
        return path

    def _hide_window_for_automation(self):
        """
        Domyślnie NIC nie robi.
        Jeśli użytkownik włączy opcję, chowamy okno przez withdraw(),
        bez animacji minimalizowania Windows.
        """
        if not self.hide_clicker_window_var.get():
            return False

        self.withdraw()
        self.update_idletasks()
        time.sleep(0.05)
        return True

    def _restore_window_after_automation(self, was_hidden):
        if not was_hidden:
            return

        self.deiconify()

        if self.topmost_var.get():
            self.attributes("-topmost", True)

        self.lift()

    def _find_negotiate_action_button(self, image_bgr):
        """
        Szuka dolnego, szerokiego przycisku FoE:
            "Płać i negocjuj" / "Wybierz surowce".

        Nie używamy OCR. Wykorzystujemy:
        - geometrię: szeroki przycisk pod rzędem osób,
        - położenie względem zapamiętanych przycisków osób,
        - kolor: aktywny "Płać i negocjuj" jest mocno nasycony
          pomarańczowo/brązowy, nieaktywny jest praktycznie szary.

        Zwraca:
            (rect, active, stats)
        """
        modules = self._get_clicker_modules()
        if modules is None:
            return None, False, {}

        _pyautogui, cv2, np = modules

        if image_bgr is None:
            return None, False, {}

        img_h, img_w = image_bgr.shape[:2]

        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (3, 3), 0)

        edges = cv2.Canny(gray, 40, 135)
        edges = cv2.dilate(
            edges,
            np.ones((3, 3), dtype=np.uint8),
            iterations=1,
        )

        contours, _hierarchy = cv2.findContours(
            edges,
            cv2.RETR_LIST,
            cv2.CHAIN_APPROX_SIMPLE,
        )

        # 001. Oczekiwane położenie liczymy względem rzędu osób.
        expected_x = img_w / 2.0
        min_y = int(img_h * 0.58)
        max_y = img_h - 5
        expected_y = img_h * 0.90

        if self.last_detected_people:
            centers_x = [
                x + w / 2.0
                for x, y, w, h in self.last_detected_people
            ]
            people_bottom = max(
                y + h
                for x, y, w, h in self.last_detected_people
            )

            expected_x = (
                min(centers_x) + max(centers_x)
            ) / 2.0

            min_y = max(
                0,
                int(people_bottom + 45),
            )
            max_y = min(
                img_h,
                int(people_bottom + 190),
            )
            expected_y = people_bottom + 110

        candidates = []

        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)

            # Na przesłanych ekranach zewnętrzna ramka ma ok. 262x26 px.
            # Zakres jest celowo dużo szerszy na DPI / skalowanie.
            if not 205 <= w <= 370:
                continue
            if not 17 <= h <= 52:
                continue
            if not min_y <= y <= max_y:
                continue

            cx = x + w / 2.0
            cy = y + h / 2.0

            if abs(cx - expected_x) > 190:
                continue

            # Preferujemy zewnętrzną ramkę ~260x26 oraz środek pod osobami.
            score = (
                abs(cx - expected_x) * 1.5
                + abs(cy - expected_y) * 0.65
                + abs(w - 262) * 0.35
                + abs(h - 26) * 0.55
            )

            candidates.append(
                (score, (int(x), int(y), int(w), int(h)))
            )

        if not candidates:
            return None, False, {}

        candidates.sort(key=lambda item: item[0])
        rect = candidates[0][1]
        x, y, w, h = rect

        # 002. Pomijamy samą krawędź przycisku.
        pad_x = max(2, int(w * 0.03))
        pad_y = max(2, int(h * 0.10))

        roi = image_bgr[
            y + pad_y:y + h - pad_y,
            x + pad_x:x + w - pad_x,
        ]

        if roi.size == 0:
            return rect, False, {}

        hsv = cv2.cvtColor(
            roi,
            cv2.COLOR_BGR2HSV,
        )

        saturation = hsv[:, :, 1]
        hue = hsv[:, :, 0]

        mean_saturation = float(np.mean(saturation))

        # Pomarańczowo/brązowy przycisk FoE:
        # H mniej więcej 0..35 i wyraźne nasycenie.
        warm_mask = (
            (hue <= 35)
            & (saturation >= 70)
        )

        warm_ratio = float(
            np.count_nonzero(warm_mask)
            / warm_mask.size
        )

        # Na dostarczonych screenach:
        # - nieaktywny: średnie S ~1.4
        # - aktywny:    średnie S ~187
        # Zostawiamy duży margines bezpieczeństwa.
        active = (
            mean_saturation >= 45.0
            and warm_ratio >= 0.20
        )

        return rect, active, {
            "mean_saturation": round(mean_saturation, 2),
            "warm_ratio": round(warm_ratio, 3),
        }

    def _click_negotiate_action_button(self):
        """
        Jeśli "Płać i negocjuj" jest aktywny, klika jego środek.
        """
        modules = self._get_clicker_modules()
        if modules is None:
            return False

        pyautogui, _cv2, _np = modules

        image = self._take_screen_bgr()
        if image is None:
            return False

        rect, active, stats = self._find_negotiate_action_button(
            image
        )

        if rect is None or not active:
            return False

        x, y, w, h = rect
        pyautogui.click(
            int(x + w / 2.0),
            int(y + h / 2.0),
        )

        self._console_log(
            "AUTO: klik PŁAĆ I NEGOCJUJ "
            f"(S={stats.get('mean_saturation', '-')}, "
            f"warm={stats.get('warm_ratio', '-')})."
        )
        return True

    def _read_complete_result_snapshot(self):
        """
        Czyta komplet wyników dla wszystkich aktualnie aktywnych osób.

        Zwraca:
            tuple((person, status), ...)
        albo None, jeśli choć jednej osoby jeszcze nie da się odczytać.

        To jest snapshot ekranu - niczego nie zapisuje do solvera.
        """
        if not self.clicker_detected:
            return None

        people_count = int(self.people_var.get())

        if len(self.last_detected_people) != people_count:
            return None

        active_people = [
            p for p in range(people_count)
            if p not in self.locked
        ]

        if not active_people:
            return tuple()

        image = self._take_screen_bgr()
        if image is None:
            return None

        result = []

        for person in active_people:
            status, _rect, _stats = self._read_result_by_font_color(
                image,
                person,
            )

            if not status:
                return None

            result.append((person, status))

        return tuple(result)

    def _screen_has_complete_negotiation_result(self):
        """
        Zgodność ze starszym kodem: True dopiero, gdy mamy komplet wyników.
        """
        return self._read_complete_result_snapshot() is not None

    def toggle_full_auto(self):
        """
        AUTO:
        - pierwsze kliknięcie uruchamia pełną negocjację,
        - podczas pracy przycisk zmienia się na STOP AUTO,
        - kolejne kliknięcie zatrzymuje automat przed następną akcją.
        """
        if self.full_auto_running:
            self._stop_full_auto("AUTO zatrzymane przez użytkownika.")
            return

        if self.clicker_busy:
            self._console_log("AUTO: trwa inna operacja.")
            return

        if self.negotiation_stage == "ZAKONCZONA":
            self._console_log(
                "AUTO: negocjacja jest zakończona. "
                "Kliknij NOWA NEGOCJACJA."
            )
            return

        self.full_auto_running = True
        self.full_auto_result_stable_count = 0
        self.full_auto_last_result_signature = None
        self._sync_clicker_buttons()

        self._console_log(
            f"AUTO START: maksymalnie {int(self.rounds_var.get())} tur."
        )

        self.after(20, self._full_auto_step)

    def _stop_full_auto(self, message=None):
        self.full_auto_running = False
        self.full_auto_pay_started = 0.0
        self.full_auto_result_started = 0.0
        self.full_auto_result_stable_count = 0
        self.full_auto_last_result_signature = None
        self._sync_clicker_buttons()

        if message:
            self._console_log(message)

    def _full_auto_step(self):
        """
        Główna maszyna stanów pełnej automatyzacji.
        """
        if not self.full_auto_running:
            return

        if self.clicker_busy:
            self.after(50, self._full_auto_step)
            return

        stage = getattr(self, "negotiation_stage", "NOWA")

        if stage == "ZAKONCZONA":
            self._stop_full_auto("AUTO: negocjacja zakończona.")
            return

        if stage == "BLAD":
            self._stop_full_auto(
                "AUTO STOP: automat zatrzymany po błędzie."
            )
            return

        # 001. Wybierz towary według sugestii solvera.
        if stage in ("NOWA", "WYKRYCIE", "SUGESTIA"):
            self.execute_browser_suggestion()

            if not self.full_auto_running:
                return

            if self.negotiation_stage == "BLAD":
                self._stop_full_auto(
                    "AUTO STOP: błąd podczas wykonywania sugestii."
                )
                return

            if self.negotiation_stage != "WYNIK":
                self.after(100, self._full_auto_step)
                return

            self._set_negotiation_stage("PLATNOSC")
            self.full_auto_pay_started = time.monotonic()
            self.after(80, self._full_auto_wait_for_pay_button)
            return

        # 002. AUTO może zostać włączone już po ręcznym WYKONAJ.
        if stage in ("WYNIK", "PLATNOSC"):
            self._set_negotiation_stage("PLATNOSC")
            self.full_auto_pay_started = time.monotonic()
            self.after(40, self._full_auto_wait_for_pay_button)
            return

        if stage == "OCZEKIWANIE":
            self.after(200, self._full_auto_wait_for_result)
            return

        if stage in ("WYKRYWANIE", "SPRAWDZENIE"):
            self.after(80, self._full_auto_step)
            return

    def _full_auto_wait_for_pay_button(self):
        """
        Po wybraniu wszystkich towarów czeka aż dolny przycisk zmieni
        się z szarego na aktywny "Płać i negocjuj", a następnie go klika.
        """
        if not self.full_auto_running:
            return

        if self.negotiation_stage == "BLAD":
            self._stop_full_auto(
                "AUTO STOP: błąd przed kliknięciem negocjacji."
            )
            return

        if self._click_negotiate_action_button():
            self._set_negotiation_stage("OCZEKIWANIE")
            self.full_auto_result_started = time.monotonic()
            self.full_auto_result_stable_count = 0
            self.full_auto_last_result_signature = None

            # WAŻNE:
            # po 2. i kolejnej turze stare napisy TAK/NIE/INNA mogą jeszcze
            # przez kilka sekund wisieć na ekranie. Nie próbujemy ich czytać.
            self._console_log(
                f"AUTO: czekam min. {FULL_AUTO_RESULT_MIN_WAIT:.1f} s "
                "na NOWY wynik."
            )
            self.after(250, self._full_auto_wait_for_result)
            return

        elapsed = (
            time.monotonic()
            - self.full_auto_pay_started
        )

        if elapsed >= 4.0:
            self._set_negotiation_stage("BLAD")
            self._stop_full_auto(
                "AUTO STOP: nie znaleziono aktywnego "
                "przycisku PŁAĆ I NEGOCJUJ."
            )
            return

        self.after(120, self._full_auto_wait_for_pay_button)

    def _full_auto_wait_for_result(self):
        """
        Czeka na NOWY wynik po kliknięciu "Płać i negocjuj".

        Problem z poprzedniej wersji:
        po 2. turze napisy z wynikiem 1. tury potrafią jeszcze przez kilka
        sekund pozostać na ekranie. Automat odczytywał je jako wynik nowej
        tury, co dawało "wyniki są sprzeczne".

        Zabezpieczenia:
        1. przez pierwsze FULL_AUTO_RESULT_MIN_WAIT sekund w ogóle nie
           analizujemy kolorów wyniku,
        2. kompletny wynik musi być identyczny w dwóch kolejnych odczytach,
        3. read_browser_result dodatkowo sprawdza zgodność nowego wyniku
           z aktualnymi kandydatami PRZED zapisaniem go do historii.
        """
        if not self.full_auto_running:
            return

        elapsed = (
            time.monotonic()
            - self.full_auto_result_started
        )

        # 001. Twarde okno ochronne przed starym wynikiem poprzedniej tury.
        if elapsed < FULL_AUTO_RESULT_MIN_WAIT:
            self.after(250, self._full_auto_wait_for_result)
            return

        # 002. Czytamy kompletny snapshot, ale jeszcze go nie zapisujemy.
        signature = self._read_complete_result_snapshot()

        if signature is None:
            self.full_auto_result_stable_count = 0
            self.full_auto_last_result_signature = None
        else:
            if signature == self.full_auto_last_result_signature:
                self.full_auto_result_stable_count += 1
            else:
                self.full_auto_last_result_signature = signature
                self.full_auto_result_stable_count = 1

            if (
                self.full_auto_result_stable_count
                >= FULL_AUTO_RESULT_STABLE_READS
            ):
                self._set_negotiation_stage("WYNIK")
                self.last_result_read_ok = False
                self.read_browser_result()

                if self.last_result_read_ok:
                    self.full_auto_result_stable_count = 0
                    self.full_auto_last_result_signature = None

                    if self.negotiation_stage == "ZAKONCZONA":
                        self._stop_full_auto(
                            "AUTO: negocjacja zakończona."
                        )
                        return

                    self.after(30, self._full_auto_wait_for_hint)
                    return

                # Odczyt mógł zostać odrzucony jako sprzeczny.
                # Nie zatrzymujemy AUTO - FoE może jeszcze kończyć animację.
                self.full_auto_result_stable_count = 0
                self.full_auto_last_result_signature = None
                self._set_negotiation_stage("OCZEKIWANIE")

        if elapsed >= FULL_AUTO_RESULT_TIMEOUT:
            self._set_negotiation_stage("BLAD")
            self._stop_full_auto(
                "AUTO STOP: nie uzyskano poprawnego NOWEGO wyniku "
                f"w ciągu {FULL_AUTO_RESULT_TIMEOUT:.0f} s."
            )
            return

        self.after(300, self._full_auto_wait_for_result)

    def _full_auto_wait_for_hint(self):
        """
        Czeka aż solver policzy sugestię następnej tury.
        """
        if not self.full_auto_running:
            return

        if self.negotiation_stage == "ZAKONCZONA":
            self._stop_full_auto(
                "AUTO: negocjacja zakończona."
            )
            return

        if self.negotiation_stage == "BLAD":
            self._stop_full_auto(
                "AUTO STOP: błąd po odczycie wyniku."
            )
            return

        if self.hint_busy:
            self.after(40, self._full_auto_wait_for_hint)
            return

        self.after(20, self._full_auto_step)

    def _screen_has_negotiation_result(self):
        """
        Szybko sprawdza, czy przy aktywnych osobach pojawił się wynik.

        Nie zapisuje nic do solvera. Robi tylko jeden screenshot i korzysta
        z istniejącego, lekkiego wykrywania koloru tekstu.

        Zwraca True, gdy przynajmniej jedna aktywna osoba ma rozpoznany
        wynik TAK / NIE / INNA. Pełną poprawność wszystkich osób sprawdzi
        potem read_browser_result().
        """
        if not self.clicker_detected:
            return False

        people_count = int(self.people_var.get())

        if len(self.last_detected_people) != people_count:
            return False

        image = self._take_screen_bgr()

        if image is None:
            return False

        active_people = [
            p for p in range(people_count)
            if p not in self.locked
        ]

        for person in active_people:
            status, _rect, _stats = self._read_result_by_font_color(
                image,
                person,
            )

            if status:
                return True

        return False

    def _on_enter_shortcut(self, _event=None):
        """
        ENTER wykonuje dokładnie następną akcję wynikającą ze stanu negocjacji.

        NOWA / WYKRYCIE / SUGESTIA:
            WYKONAJ
            (jeśli trzeba: najpierw automatyczne wykrycie)

        WYNIK:
            SPRAWDŹ

        Dzięki temu nie zgadujemy już etapu na podstawie obrazu ekranu.
        """
        if self.full_auto_running:
            self._console_log("ENTER: trwa AUTO. Użyj STOP AUTO, aby przerwać.")
            return "break"

        if self.clicker_busy:
            self._console_log("ENTER: trwa poprzednia operacja.")
            return "break"

        stage = getattr(self, "negotiation_stage", "NOWA")

        if stage in ("NOWA", "WYKRYCIE", "SUGESTIA"):
            self.execute_browser_suggestion()
            return "break"

        if stage == "WYNIK":
            self.read_browser_result()
            return "break"

        if stage in ("WYKRYWANIE", "SPRAWDZENIE"):
            self._console_log("ENTER: trwa aktualny etap negocjacji.")
            return "break"

        if stage == "ZAKONCZONA":
            self._console_log("ENTER: negocjacja jest zakończona. Kliknij NOWA NEGOCJACJA.")
            return "break"

        if stage == "BLAD":
            self._console_log(
                "ENTER: poprzednia automatyzacja zakończyła się błędem. "
                "Sprawdź grę i użyj odpowiedniego przycisku."
            )
            return "break"

        self._console_log(f"ENTER: nieznany etap {stage}.")
        return "break"

    def read_result_and_execute(self):
        """
        Jednym kliknięciem:
        1. wczytaj wynik poprzedniej tury,
        2. poczekaj aż solver policzy nową wskazówkę,
        3. wykonaj nową sugestię.
        """
        if self.clicker_busy:
            return

        self.last_result_read_ok = False
        self.read_browser_result()

        if not self.last_result_read_ok:
            return

        if self.negotiation_stage == "ZAKONCZONA":
            return

        self._console_log("AUTO: wynik wczytany, czekam na sugestię...")
        self.after(20, self._wait_for_hint_and_execute)

    def _wait_for_hint_and_execute(self):
        if self.negotiation_stage == "ZAKONCZONA":
            return

        if self.hint_busy:
            self.after(30, self._wait_for_hint_and_execute)
            return

        self.after(20, self.execute_browser_suggestion)

    def detect_browser_negotiation(self, keep_popup_open=False):
        """
        Wewnętrzne wykrycie negocjacji:
        1. wykrywa pozycje przycisków pod osobami,
        2. zapamiętuje je,
        3. klika pierwszą osobę,
        4. wykrywa wszystkie towary,
        5. zapamiętuje ich dokładne pozycje,
        6. jeśli keep_popup_open=True, NIE zamyka popupu.

        Dzięki temu WYKONAJ może po wykryciu od razu kliknąć właściwy
        towar dla osoby A bez ESC i bez ponownego otwierania okna.
        """
        modules = self._get_clicker_modules()
        if modules is None:
            return

        if self.clicker_busy:
            return False

        self._set_negotiation_stage("WYKRYWANIE")
        self.update_idletasks()

        pyautogui, _cv2, _np = modules
        expected_people = int(self.people_var.get())

        self.clicker_busy = True
        detected_goods = []
        self.detected_popup_person = None

        was_hidden = False

        try:
            was_hidden = self._hide_window_for_automation()

            image = self._take_screen_bgr()
            if image is None:
                raise RuntimeError("Nie udało się pobrać obrazu ekranu.")

            people = self._find_person_buttons(
                image,
                expected_people,
            )

            self.last_detected_people = people

            if len(people) == expected_people:
                self.result_rois = self._build_result_rois(
                    image,
                    people,
                )
            else:
                self.result_rois = []

            if len(people) != expected_people:
                self.last_detected_goods = []
                self.result_rois = []
                self._save_detection_debug(
                    image,
                    people=people,
                )
                raise RuntimeError(
                    f"Znaleziono {len(people)}/{expected_people} osób.\n"
                    "Zapisano foe_clicker_debug.png."
                )

            # Klikamy pierwszą osobę i otwieramy popup.
            px, py = self._rect_center(people[0])
            pyautogui.click(int(px), int(py))
            time.sleep(0.38)

            goods_image = self._take_screen_bgr()
            if goods_image is None:
                raise RuntimeError(
                    "Nie udało się pobrać obrazu popupu towarów."
                )

            detected_goods = self._find_goods_buttons(goods_image)
            self.last_detected_goods = list(detected_goods)

            self._save_detection_debug(
                goods_image,
                people=people,
                goods=detected_goods,
            )

            if keep_popup_open and detected_goods:
                # Popup należy do pierwszej osoby (A) i pozostaje otwarty.
                # WYKONAJ wykorzysta go bez ponownego klikania osoby.
                self.detected_popup_person = 0
            else:
                # Samodzielne wykrycie / tryb awaryjny: zamykamy bez wyboru.
                pyautogui.press("esc")
                time.sleep(0.12)

        except Exception as exc:
            # Jeśli błąd wystąpił po otwarciu wyboru surowca,
            # spróbuj zostawić grę w czystym stanie.
            try:
                pyautogui.press("esc")
            except Exception:
                pass

            self.detected_popup_person = None
            self.last_detected_goods = []
            error_text = str(exc)

        else:
            error_text = None

        finally:
            self._restore_window_after_automation(was_hidden)
            self.clicker_busy = False

        if error_text:
            self._set_clicker_detected(False)
            self._set_negotiation_stage("WYKRYCIE")
            self._console_log(f"WYKRYWANIE NIEUDANE: {error_text}")
            return False

        goods_count = len(self.last_detected_goods)

        if goods_count < 1:
            self._set_clicker_detected(False)
            self._set_negotiation_stage("WYKRYCIE")
            self._console_log(
                f"WYKRYWANIE: osoby {expected_people}, towary nierozpoznane. "
                "Debug: foe_clicker_debug.png"
            )
            return False

        old_goods = int(self.goods_var.get())

        # Przed rozpoczęciem negocjacji synchronizujemy solver z realną liczbą towarów.
        changed = False
        if goods_count != old_goods and not self.history:
            self.goods_var.set(goods_count)

            self.selected.clear()
            self.analysis_status.clear()
            self.locked.clear()
            self.tried = defaultdict(dict)

            self._init_candidates(
                int(self.people_var.get()),
                goods_count,
            )
            self._build_board()
            self._update_round_label()
            self.refresh_hint()
            changed = True

        self._set_clicker_detected(True)
        self._set_negotiation_stage("SUGESTIA")

        # Pozycje z wykrycia są źródłem prawdy dla klikacza.
        # Logujemy je jawnie, żeby od razu było widać stan pamięci.
        self._console_log(
            f"ZAPAMIĘTANO: osoby={len(self.last_detected_people)}, "
            f"towary={len(self.last_detected_goods)}."
        )

        # Przygotuj bieżącą sugestię również w trybie Trening,
        # żeby WYKONAJ SUGESTIĘ było od razu gotowe po wykryciu.
        if not self.selected:
            self._apply_current_hint_to_selection()

        text = (
            f"WYKRYWANIE OK: {expected_people} osób / {goods_count} towarów."
        )

        if changed:
            text += (
                f" Liczba towarów zmieniona {old_goods} → {goods_count}."
            )

        if self.detected_popup_person is not None:
            text += " Popup pozostawiony otwarty — wybieram pierwszy towar bez ponownego otwierania."

        self._console_log(text)
        return True

    def _build_result_rois(self, image_bgr, people):
        """
        Buduje stały obszar historii wyników dla każdej osoby.

        ROI jest celowo szerszy niż wcześniej i obejmuje całą pionową
        strefę pomiędzy portretem a przyciskiem "Wybór surowca".
        Dzięki temu debug jasno pokaże, czy szukamy we właściwym miejscu.
        """
        img_h, img_w = image_bgr.shape[:2]
        rois = []

        for x, y, w, h in people:
            # Przycisk "Wybór surowca" jest dużo szerszy od małych kafelków
            # historii. Historia znajduje się nad nim, bliżej lewej części
            # kolumny osoby. Bierzemy jednak szeroki ROI, żeby niczego nie zgubić.
            left = max(0, int(x - 30))
            right = min(img_w, int(x + w + 20))

            # Góra: wysoko ponad historię.
            top = max(0, int(y - 260))

            # Dół: tuż nad przyciskiem "Wybór surowca".
            bottom = max(top + 1, int(y - 5))

            rois.append((left, top, right - left, bottom - top))

        return rois

    def _get_result_text_roi(self, image_bgr, person_index):
        """
        Mały ROI zawierający wyłącznie napis wyniku.

        Liczymy względem zapamiętanego przycisku "Wybór surowca":

        poziomo:
            x2 = x + 1/4 * w
            w2 = 1/2 * w

        pionowo:
            h2 = 2/3 * h
            dolna krawędź ROI = 5 px nad przyciskiem

        Czyli ROI jest wycentrowany poziomo i "przyklejony"
        5 px nad przyciskiem.
        """
        if person_index >= len(self.last_detected_people):
            return None

        x, y, w, h = self.last_detected_people[person_index]
        img_h, img_w = image_bgr.shape[:2]

        roi_w = int(round(w * 0.50))
        roi_h = int(round(h * 2.0 / 3.0))

        roi_x = int(round(x + (w - roi_w) / 2.0))

        # 5 px przerwy nad górną krawędzią przycisku.
        roi_bottom = int(round(y - 5))
        roi_y = int(round(roi_bottom - roi_h))

        left = max(0, roi_x)
        top = max(0, roi_y)
        right = min(img_w, roi_x + roi_w)
        bottom = min(img_h, roi_bottom)

        if right <= left or bottom <= top:
            return None

        return (
            left,
            top,
            right - left,
            bottom - top,
        )

    @staticmethod
    def _rgb_box_mask(rgb, target, tolerance, np):
        """
        Bardzo szybkie dopasowanie koloru:
        każdy kanał RGB musi mieścić się w zakresie target +/- tolerance.
        """
        target_arr = np.array(target, dtype=np.int16)
        low = target_arr - tolerance
        high = target_arr + tolerance

        arr = rgb.astype(np.int16)

        return np.logical_and.reduce((
            arr[:, :, 0] >= low[0],
            arr[:, :, 0] <= high[0],
            arr[:, :, 1] >= low[1],
            arr[:, :, 1] <= high[1],
            arr[:, :, 2] >= low[2],
            arr[:, :, 2] <= high[2],
        ))

    def _read_result_by_font_color(self, image_bgr, person_index):
        """
        Rozpoznaje wynik wyłącznie po obecności charakterystycznego
        koloru czcionki w małym ROI nad przyciskiem osoby.

        Referencje:
        - NIE:
            #A82914 -> RGB(168, 41, 20)
        - TAK:
            #759036 -> RGB(117, 144, 54)
        - INNA OSOBA:
            RGB(178, 101, 0)

        Nie ma OCR, HSV, rankingu ani analizy kształtu tekstu.
        """
        modules = self._get_clicker_modules()
        if modules is None:
            return None, None, {}

        _pyautogui, cv2, np = modules

        roi_rect = self._get_result_text_roi(
            image_bgr,
            person_index,
        )

        if roi_rect is None:
            return None, None, {}

        x, y, w, h = roi_rect
        roi_bgr = image_bgr[y:y + h, x:x + w]

        if roi_bgr.size == 0:
            return None, roi_rect, {}

        rgb = cv2.cvtColor(
            roi_bgr,
            cv2.COLOR_BGR2RGB,
        )

        # Mała tolerancja - tylko antyaliasing / drobne odchylenia renderowania.
        targets = {
            "TAK":  ((117, 144, 54), 10),
            "NIE":  ((168, 41, 20), 10),
            "INNA": ((178, 101, 0), 12),
        }

        stats = {}
        masks = {}

        for status, (target, tolerance) in targets.items():
            mask = self._rgb_box_mask(
                rgb,
                target,
                tolerance,
                np,
            )
            masks[status] = mask

            row_counts = np.count_nonzero(
                mask,
                axis=1,
            )

            stats[status] = {
                "pixels": int(np.count_nonzero(mask)),
                "rows": int(np.count_nonzero(row_counts > 0)),
                "max_row": int(
                    np.max(row_counts)
                    if row_counts.size
                    else 0
                ),
            }

        # Minimalna liczba trafień. Nie "wygrywa" największy kolor:
        # po prostu sprawdzamy czy dany charakterystyczny kolor występuje.
        min_pixels = 6
        min_rows = 2

        # Kolejność celowo jednoznaczna.
        for status in ("TAK", "NIE", "INNA"):
            data = stats[status]

            if (
                data["pixels"] >= min_pixels
                and data["rows"] >= min_rows
            ):
                return status, roi_rect, stats

        return None, roi_rect, stats

    def _save_result_debug(self, image_bgr, results):
        modules = self._get_clicker_modules()
        if modules is None:
            return None

        _pyautogui, cv2, np = modules
        debug = image_bgr.copy()
        overlay = debug.copy()

        base_dir = os.path.dirname(os.path.abspath(__file__))

        # Turkusowy = dokładny obszar analizy koloru tekstu.
        for person in range(len(self.last_detected_people)):
            roi = self._get_result_text_roi(
                image_bgr,
                person,
            )

            if roi is None:
                continue

            x, y, w, h = roi

            cv2.rectangle(
                overlay,
                (x, y),
                (x + w, y + h),
                (255, 180, 0),
                -1,
            )

        debug = cv2.addWeighted(
            overlay,
            0.14,
            debug,
            0.86,
            0,
        )

        # Ramki ROI + osobne pliki każdego wycinka.
        for person in range(len(self.last_detected_people)):
            roi = self._get_result_text_roi(
                image_bgr,
                person,
            )

            if roi is None:
                continue

            x, y, w, h = roi

            cv2.rectangle(
                debug,
                (x, y),
                (x + w, y + h),
                (255, 180, 0),
                2,
            )

            cv2.putText(
                debug,
                f"TEXT {chr(ord('A') + person)}",
                (x + 3, max(14, y - 4)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.45,
                (255, 180, 0),
                1,
            )

            crop = image_bgr[y:y + h, x:x + w]
            if crop.size:
                cv2.imwrite(
                    os.path.join(
                        base_dir,
                        f"foe_result_text_{chr(ord('A') + person)}.png",
                    ),
                    crop,
                )

        colors = {
            "TAK": (0, 210, 0),
            "NIE": (0, 0, 255),
            "INNA": (0, 190, 255),
        }

        # Wynik + statystyki kolorów.
        for person, status, rect, stats in results:
            if rect is None:
                continue

            x, y, w, h = rect
            color = colors.get(
                status,
                (255, 255, 255),
            )

            cv2.rectangle(
                debug,
                (x, y),
                (x + w, y + h),
                color,
                3,
            )

            r = stats.get("NIE", {}).get("pixels", 0)
            o = stats.get("INNA", {}).get("pixels", 0)
            g = stats.get("TAK", {}).get("pixels", 0)

            label = (
                f"{chr(ord('A') + person)}:"
                f"{status or '?'} R{r} O{o} G{g}"
            )

            cv2.putText(
                debug,
                label,
                (x + 2, min(debug.shape[0] - 5, y + h + 16)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.42,
                color,
                1,
            )

        path = os.path.join(
            base_dir,
            "foe_result_debug.png",
        )

        cv2.imwrite(path, debug)
        return path

    def read_browser_result(self):
        """
        SPRAWDŹ - szybki odczyt wyniku bez OCR.

        Dla każdej aktywnej osoby:
        1. bierze mały, stały obszar nad zapamiętanym przyciskiem,
        2. liczy piksele kolorów czcionki,
        3. rozpoznaje NIE / INNA OSOBA / TAK,
        4. dopiero gdy komplet osób ma pewny wynik, zapisuje turę do solvera.
        """
        modules = self._get_clicker_modules()
        if modules is None:
            return

        if self.clicker_busy:
            return

        if self.negotiation_stage not in ("WYNIK", "SPRAWDZENIE"):
            self._console_log(
                "SPRAWDŹ: najpierw wykonaj sugestię przyciskiem WYKONAJ."
            )
            return

        people_count = int(self.people_var.get())

        if len(self.last_detected_people) != people_count:
            self._set_negotiation_stage("BLAD")
            self._console_log(
                "SPRAWDŹ: brak zapamiętanych pozycji osób. "
                "Rozpocznij NOWĄ NEGOCJACJĘ."
            )
            return

        active_people = [
            p for p in range(people_count)
            if p not in self.locked
        ]

        missing_selections = [
            p for p in active_people
            if p not in self.selected
        ]

        if missing_selections:
            letters = ", ".join(
                chr(ord("A") + p)
                for p in missing_selections
            )
            self._console_log(
                f"SPRAWDŹ: brak zapamiętanego towaru dla {letters}."
            )
            return

        self._set_negotiation_stage("SPRAWDZENIE")
        self.update_idletasks()
        self.clicker_busy = True
        self.last_result_read_ok = False
        was_hidden = False

        try:
            was_hidden = self._hide_window_for_automation()

            image = self._take_screen_bgr()

            if image is None:
                raise RuntimeError(
                    "Nie udało się pobrać obrazu ekranu."
                )

            read_results = []
            result_by_person = {}
            color_debug = []

            for person in active_people:
                status, rect, stats = self._read_result_by_font_color(
                    image,
                    person,
                )

                read_results.append(
                    (person, status, rect, stats)
                )

                color_debug.append(
                    (person, status, stats)
                )

                if status:
                    result_by_person[person] = status

            debug_path = self._save_result_debug(
                image,
                read_results,
            )

            debug_txt_path = os.path.join(
                os.path.dirname(os.path.abspath(__file__)),
                "foe_result_color_debug.txt",
            )

            with open(
                debug_txt_path,
                "w",
                encoding="utf-8",
            ) as f:
                for person, status, stats in color_debug:
                    f.write(
                        f"{chr(ord('A') + person)} | "
                        f"{status or 'BRAK'} | "
                        f"NIE={stats.get('NIE', {})} | "
                        f"INNA={stats.get('INNA', {})} | "
                        f"TAK={stats.get('TAK', {})}\n"
                    )

        except Exception as exc:
            error = str(exc)
            result_by_person = {}
            read_results = []
            debug_path = None
            debug_txt_path = None

        else:
            error = None

        finally:
            self._restore_window_after_automation(was_hidden)
            self.clicker_busy = False

        if error:
            self._set_negotiation_stage("WYNIK")
            self._console_log(
                f"BŁĄD ODCZYTU: {error}"
            )
            return

        missing = [
            p for p in active_people
            if p not in result_by_person
        ]

        if missing:
            letters = ", ".join(
                chr(ord("A") + p)
                for p in missing
            )

            self._set_negotiation_stage("WYNIK")
            self._console_log(
                f"NIEPEŁNY WYNIK: brak odczytu dla {letters}. "
                f"Debug: {debug_path or '-'} | "
                f"Kolory: {debug_txt_path or '-'}"
            )
            return

        guess = [None] * people_count
        result = [None] * people_count

        for person in range(people_count):
            if person in self.locked:
                guess[person] = self.locked[person]
                result[person] = "TAK"
            else:
                guess[person] = self.selected[person]
                result[person] = result_by_person[person]

        # Kolory rozstrzygamy dopiero po odczytaniu kompletu osób.
        result = self._normalize_result_statuses(
            guess,
            result,
            active_people,
        )

        # 003. Krytyczna walidacja PRZED zapisaniem wyniku.
        #
        # Jeśli na ekranie nadal wiszą napisy z poprzedniej tury,
        # mogą zostać poprawnie rozpoznane kolorystycznie, ale będą
        # sprzeczne z aktualną ofertą. W v55 taki wynik był najpierw
        # dopisywany do historii i dopiero potem solver odkrywał 0 układów.
        #
        # Teraz odrzucamy go bez modyfikowania historii, locked ani tried.
        if self.exact_solver:
            observed = tuple(result)
            matching_candidates = [
                secret
                for secret in self.candidates
                if feedback_for(secret, guess) == observed
            ]

            if not matching_candidates:
                self._set_negotiation_stage("WYNIK")
                self._console_log(
                    "ODRZUCONO ODCZYT: wynik jest sprzeczny z aktualną "
                    "turą — prawdopodobnie animacja jeszcze trwa. Czekam..."
                )
                return

        # Uaktualnij słownik odczytu, żeby komunikat używał
        # już ostatecznych kolorów.
        for person in active_people:
            result_by_person[person] = result[person]

        self.history.append(
            (tuple(guess), tuple(result))
        )

        self._apply_round_constraints(
            guess,
            result,
            active_people,
        )

        self._rebuild_exact_candidates_from_history()
        self._recompute_global_rejected_goods()
        self._update_round_label()

        lines = []

        for person in active_people:
            good = guess[person]
            status = result_by_person[person]

            label = {
                "TAK": "TAK",
                "NIE": "NIE",
                "INNA": "Inna osoba",
            }[status]

            lines.append(
                f"{chr(ord('A') + person)} → {good}: {label}"
            )

        self.selected.clear()
        self.analysis_status.clear()
        self.current_round += 1

        self._refresh_board()

        if (
            len(self.locked) == people_count
            or self.current_round > int(self.rounds_var.get())
        ):
            self._set_negotiation_stage("ZAKONCZONA")
        else:
            self._set_negotiation_stage("SUGESTIA")

        self._update_round_label()
        self.refresh_hint()

        self.last_result_read_ok = True

        self._console_log(
            "WYNIK: " + " | ".join(lines)
        )

    def apply_hint_and_check(self):
        """
        SPRAWDŹ:
        - używa tylko aktualnej, ważnej wskazówki,
        - jeśli wskazówka jest nieaktualna, zleca ponowne liczenie.
        """
        if self.hint_busy:
            self._console_log("SPRAWDŹ: solver jeszcze liczy wskazówkę.")
            return

        if not self._apply_current_hint_to_selection():
            self._console_log("SPRAWDŹ: wskazówka była nieaktualna — przeliczam.")
            self.refresh_hint()
            return

        if self.mode_var.get() == "Trening":
            self.submit_round()
        else:
            self._console_log(
                "SPRAWDŹ: sugestia wypełniona. W trybie Analiza wczytaj wynik z gry."
            )

    def _apply_current_hint_to_selection(self):
        """
        Wstawia bieżącą sugestię solvera do self.selected.

        Działa w każdym trybie. Nie zmienia ustawienia "Autouzupełnianie" -
        to ustawienie nadal dotyczy tylko automatycznego wypełniania UI
        w trybie Analiza.
        """
        people = int(self.people_var.get())

        hint = getattr(self, "current_hint_text", "") or ""

        # Jeśli hint jeszcze nie zdążył się policzyć, dla pierwszej tury
        # generujemy go bezpośrednio.
        if not hint or "Liczenie najlepszej wskazówki" in hint:
            if not self.history:
                parts = []
                goods = int(self.goods_var.get())

                for p in range(people):
                    if p in self.locked:
                        continue

                    good = (p % goods) + 1

                    if (
                        good in self.tried[p]
                        or good in self.global_rejected_goods
                    ):
                        available = [
                            g for g in range(1, goods + 1)
                            if g not in self.tried[p]
                            and g not in self.global_rejected_goods
                        ]
                        if not available:
                            continue
                        good = available[0]

                    parts.append(
                        f"{chr(ord('A') + p)} → {good}"
                    )

                hint = (
                    "Pierwsza tura — sprawdzamy towary kolejno: "
                    + ", ".join(parts)
                )
            else:
                return False

        suggestions = {}

        for letter, good in re.findall(
            r"([A-Z])\s*→\s*(\d+)",
            hint,
        ):
            person = ord(letter) - ord("A")

            if not (0 <= person < people):
                continue
            if person in self.locked:
                continue

            good = int(good)

            if good in self.global_rejected_goods:
                continue

            if good in self.tried[person]:
                continue

            suggestions[person] = good

        if not suggestions:
            return False

        for person, good in suggestions.items():
            self.selected[person] = good
            self.analysis_status.pop(person, None)

        self._refresh_board()
        return True

    def execute_browser_suggestion(self):
        """
        WYKONAJ:
        - jeśli negocjacja nie była jeszcze wykryta, sam wykonuje WYKRYCIE,
        - następnie pobiera aktualną SUGESTIĘ solvera,
        - korzysta z zapamiętanych pozycji osób i towarów,
        - po wykonaniu przechodzi do etapu SPRAWDZENIE WYNIKU.
        """
        modules = self._get_clicker_modules()
        if modules is None:
            return

        if self.clicker_busy:
            return

        pyautogui, _cv2, _np = modules

        people_count = int(self.people_var.get())
        goods_count = int(self.goods_var.get())

        if self.negotiation_stage == "ZAKONCZONA":
            self._console_log("WYKONAJ: negocjacja jest już zakończona.")
            return

        if self.negotiation_stage == "WYNIK":
            self._console_log("WYKONAJ: najpierw SPRAWDŹ wynik poprzedniej tury.")
            return

        needs_detection = (
            not self.clicker_detected
            or len(self.last_detected_people) != people_count
            or len(self.last_detected_goods) < 1
        )

        if needs_detection:
            self._console_log("WYKONAJ: brak wykrycia — uruchamiam wykrywanie.")
            if not self.detect_browser_negotiation(keep_popup_open=True):
                return

            # Wykrycie może zmienić liczbę towarów.
            people_count = int(self.people_var.get())
            goods_count = int(self.goods_var.get())

        self._set_negotiation_stage("SUGESTIA")
        detected_goods_count = len(self.last_detected_goods)

        # Po udanym wykryciu zapamiętane pozycje są źródłem prawdy.
        # Jeżeli GUI/solver ma jeszcze starą liczbę towarów, synchronizujemy ją
        # zamiast odrzucać poprawne wykrycie.
        if goods_count != detected_goods_count:
            old_goods_count = goods_count
            goods_count = detected_goods_count
            self.goods_var.set(goods_count)

            # Jeśli negocjacja jeszcze nie ma historii, bezpiecznie
            # synchronizujemy również solver i planszę.
            if not self.history:
                self.selected.clear()
                self.analysis_status.clear()
                self.locked.clear()
                self.tried = defaultdict(dict)
                self.global_rejected_goods = set()
                self.known_present_goods = set()

                self._init_candidates(
                    people_count,
                    goods_count,
                )
                self._build_board()
                self._update_round_label()
                self.refresh_hint()

            self._console_log(
                f"WYKONAJ: synchronizacja towarów "
                f"{old_goods_count} → {goods_count} wg wykrycia."
            )

        active = []

        for person in range(people_count):
            if person in self.locked:
                continue

            good = self.selected.get(person)
            if good is None:
                continue

            good = int(good)

            if 1 <= good <= goods_count:
                active.append((person, good))

        # "WYKONAJ" ma używać wskazówki solvera.
        # W trybie Trening sugestia nie jest autouzupełniana w UI,
        # więc jeśli nic nie zaznaczono, wstawiamy ją dopiero teraz.
        if not active:
            if self._apply_current_hint_to_selection():
                active = []

                for person in range(people_count):
                    if person in self.locked:
                        continue

                    good = self.selected.get(person)
                    if good is None:
                        continue

                    good = int(good)

                    if 1 <= good <= goods_count:
                        active.append((person, good))

        if not active:
            if self.detected_popup_person is not None:
                try:
                    pyautogui.press("esc")
                except Exception:
                    pass
                self.detected_popup_person = None

            self._console_log(
                "WYKONAJ: solver nie ma gotowej sugestii do kliknięcia."
            )
            return

        self._console_log(
            "WYKONAJ: " + " | ".join(
                f"{chr(ord('A') + p)}→{g}"
                for p, g in active
            )
        )

        self.clicker_busy = True
        was_hidden = False

        try:
            was_hidden = self._hide_window_for_automation()

            for person, good in active:
                popup_already_open = (
                    self.detected_popup_person == person
                )

                if popup_already_open:
                    # Pierwsze WYKONAJ po wykryciu:
                    # okno wyboru towaru dla A jest już otwarte.
                    # Nie robimy ESC -> klik A -> otwarcie ponownie.
                    popup_image = self._take_screen_bgr()

                    if (
                        popup_image is None
                        or not self._goods_popup_is_open(popup_image)
                    ):
                        # Awaryjnie: jeśli popup jednak zniknął, otwieramy go normalnie.
                        popup_already_open = False

                if not popup_already_open:
                    # 001. Kliknij zapamiętaną pozycję przycisku osoby.
                    person_rect = self.last_detected_people[person]
                    px, py = self._rect_center(person_rect)

                    pyautogui.click(int(px), int(py))
                    time.sleep(0.28)

                    # 002. Sprawdź tylko czy popup się pojawił.
                    popup_image = self._take_screen_bgr()
                    if popup_image is None:
                        raise RuntimeError(
                            "Nie udało się pobrać obrazu po otwarciu popupu."
                        )

                    if not self._goods_popup_is_open(popup_image):
                        raise RuntimeError(
                            f"Nie potwierdzono otwarcia wyboru surowca "
                            f"dla osoby {chr(ord('A') + person)}.\n\n"
                            "Klikanie zostało zatrzymane."
                        )

                # 003. Kliknij ZAPAMIĘTANĄ pozycję konkretnego towaru.
                good_rect = self.last_detected_goods[good - 1]
                gx, gy = self._rect_center(good_rect)

                pyautogui.click(int(gx), int(gy))
                time.sleep(0.20)

                # Po wyborze popup tej osoby jest już zamknięty.
                if self.detected_popup_person == person:
                    self.detected_popup_person = None

            self._set_negotiation_stage("WYNIK")
            self._console_log("WYKONANIE OK. Następny krok: SPRAWDŹ.")

        except pyautogui.FailSafeException:
            self.detected_popup_person = None
            self._set_negotiation_stage("BLAD")
            self._console_log("PRZERWANO: klikacz zatrzymany przez FAILSAFE.")

        except Exception as exc:
            self.detected_popup_person = None
            self._set_negotiation_stage("BLAD")
            self._console_log(f"BŁĄD KLIKACZA: {exc}")

        finally:
            self._restore_window_after_automation(was_hidden)
            self.clicker_busy = False

    def _render_console(self):
        if not hasattr(self, "console_box"):
            return

        lines = self.console_lines[-1:] if self.compact_var.get() else self.console_lines[-4:]
        text = "\n".join(lines) if lines else "Gotowy."

        self.console_box.configure(state="normal")
        self.console_box.delete("1.0", "end")
        self.console_box.insert("1.0", text)
        self.console_box.configure(state="disabled")
        self.console_box.see("end")

    def _console_log(self, text):
        text = str(text).replace("\r", " ").replace("\n", " | ").strip()
        if not text:
            return

        self.console_lines.append(text)
        self.console_lines = self.console_lines[-50:]
        self._render_console()

    def _set_clicker_detected(self, value):
        """
        Zapisuje wyłącznie stan wykrycia.

        Przyciski WYKONAJ / SPRAWDŹ są zawsze widoczne.
        Ich aktywność zależy od etapu negocjacji, nie od samego wykrycia.
        """
        self.clicker_detected = bool(value)
        self._sync_clicker_buttons()

    def _set_negotiation_stage(self, stage):
        self.negotiation_stage = str(stage)
        self._update_negotiation_status_label()
        self._sync_clicker_buttons()

    def _update_negotiation_status_label(self):
        if not hasattr(self, "negotiation_status_label"):
            return

        labels = {
            "NOWA": "Status: NOWA NEGOCJACJA • etap 1/3: WYKRYCIE",
            "WYKRYCIE": "Status: etap 1/3 • WYKRYCIE",
            "WYKRYWANIE": "Status: etap 1/3 • WYKRYWANIE...",
            "SUGESTIA": "Status: etap 2/3 • SUGESTIA",
            "PLATNOSC": "Status: AUTO • PŁAĆ I NEGOCJUJ",
            "OCZEKIWANIE": "Status: AUTO • OCZEKIWANIE NA WYNIK",
            "WYNIK": "Status: etap 3/3 • SPRAWDZENIE WYNIKU",
            "SPRAWDZENIE": "Status: etap 3/3 • SPRAWDZANIE...",
            "ZAKONCZONA": "Status: NEGOCJACJA ZAKOŃCZONA",
            "BLAD": "Status: BŁĄD AUTOMATYZACJI",
        }

        self.negotiation_status_label.configure(
            text=labels.get(
                self.negotiation_stage,
                f"Status: {self.negotiation_stage}",
            )
        )

    def _sync_clicker_buttons(self):
        if not (
            hasattr(self, "execute_button")
            and hasattr(self, "read_result_button")
        ):
            return

        stage = getattr(self, "negotiation_stage", "NOWA")

        execute_state = "disabled"
        read_state = "disabled"
        combo_state = "disabled"

        if not self.full_auto_running:
            if stage in ("NOWA", "WYKRYCIE", "SUGESTIA"):
                execute_state = "normal"
            elif stage == "WYNIK":
                read_state = "normal"
                combo_state = "normal"
            elif stage == "BLAD":
                # Przy błędzie pozostawiamy obie drogi ręcznej naprawy.
                execute_state = "normal"
                read_state = "normal"
                combo_state = "normal"

        self.execute_button.configure(state=execute_state)
        self.read_result_button.configure(state=read_state)

        if hasattr(self, "read_and_execute_button"):
            self.read_and_execute_button.configure(state=combo_state)

        if hasattr(self, "full_auto_button"):
            if self.full_auto_running:
                self.full_auto_button.configure(
                    text="STOP AUTO",
                    state="normal",
                    bg="#c62828",
                    activebackground="#b71c1c",
                )
            else:
                auto_state = (
                    "disabled"
                    if stage == "ZAKONCZONA"
                    else "normal"
                )
                self.full_auto_button.configure(
                    text="AUTO",
                    state=auto_state,
                    bg="#ef6c00",
                    activebackground="#e65100",
                )

    def _sync_mode_specific_ui(self):
        if not hasattr(self, "hint_check_button"):
            return

        if self.mode_var.get() == "Trening":
            if not self.hint_check_button.winfo_manager():
                self.hint_check_button.pack(side="right", padx=(4, 0))
        else:
            if self.hint_check_button.winfo_manager():
                self.hint_check_button.pack_forget()

    def toggle_more_settings(self):
        self.more_settings_visible = not self.more_settings_visible

        if self.more_settings_visible:
            self.more_frame.pack(fill="x")
            self.more_button.configure(text="MNIEJ USTAWIEŃ")
        else:
            self.more_frame.pack_forget()
            self.more_button.configure(text="WIĘCEJ USTAWIEŃ")

    def toggle_compact_mode(self):
        # Przebudowujemy zawartość, ale NIE zmieniamy rozmiaru
        # ani położenia głównego okna.
        for widget in self.winfo_children():
            widget.destroy()

        self._build_ui()
        self._build_board()
        self._update_round_label()
        self.toggle_hint_visibility()

    def _fit_window_to_content(self):
        """
        Celowo nic nie robi.

        Rozmiar i pozycja głównego okna są własnością użytkownika.
        Po ręcznym przesunięciu, resize albo snapie Windows program
        nie może już sam zmieniać geometrii.
        """
        return

    def toggle_hint_visibility(self):
        if self.hints_var.get():
            self.hint_label.configure(
                text=self.current_hint_text or "Wskazówka zostanie policzona przed turą."
            )
        else:
            self.hint_label.configure(text="Wskazówki wyłączone.")

    def toggle_topmost(self):
        new_value = not self.topmost_var.get()
        self.topmost_var.set(new_value)

        self.attributes("-topmost", new_value)

        self.topmost_button.configure(
            text=("TOP: TAK" if new_value else "TOP: NIE")
        )

        # Odświeżamy fokus po zmianie flagi okna.
        self.lift()
        self.focus_force()

    # ============================================================
    # NOWA GRA
    # ============================================================

    def new_game(self):
        try:
            people = int(self.people_var.get())
            goods = int(self.goods_var.get())
            rounds = int(self.rounds_var.get())
        except Exception:
            messagebox.showerror("Błąd", "Podaj poprawne wartości.")
            return

        if not 1 <= people <= 26:
            messagebox.showerror("Błąd", "Liczba osób: 1-26.")
            return

        if not 1 <= goods <= 99:
            messagebox.showerror("Błąd", "Liczba towarów: 1-99.")
            return

        if rounds < 1:
            messagebox.showerror("Błąd", "Liczba tur musi być większa od 0.")
            return

        self.full_auto_running = False
        self.full_auto_pay_started = 0.0
        self.full_auto_result_started = 0.0
        self.full_auto_result_stable_count = 0
        self.full_auto_last_result_signature = None

        self.current_round = 1
        self.last_result_read_ok = False
        self._set_negotiation_stage("NOWA")

        # Nowa negocjacja = stare pozycje klikacza nie są już gwarantowane.
        self.last_detected_people = []
        self.last_detected_goods = []
        self.result_rois = []
        self.detected_popup_person = None
        self._set_clicker_detected(False)

        self.locked = {}
        self.selected = {}
        self.tried = defaultdict(dict)
        self.global_rejected_goods = set()
        self.known_present_goods = set()
        self.analysis_status = {}
        self.history = []
        self.current_hint_text = ""
        self.hint_generation += 1
        self.hint_busy = False

        # W treningu rozwiązanie jest losowane. Towary mogą się powtarzać.
        if self.mode_var.get() == "Trening":
            self.secret = [random.randint(1, goods) for _ in range(people)]
            self.action_button.configure(text="SPRAWDŹ TURĘ")
            self.autofill_check.configure(state="disabled")

            if hasattr(self, "show_solution_button"):
                self.show_solution_button.pack(side="left", padx=(3, 0))
        else:
            self.secret = []
            self.action_button.configure(text="ZATWIERDŹ WYNIKI")
            self.autofill_check.configure(state="normal")

            if (
                hasattr(self, "show_solution_button")
                and self.show_solution_button.winfo_manager()
            ):
                self.show_solution_button.pack_forget()

        self._sync_mode_specific_ui()
        self._init_candidates(people, goods)
        self._build_board()
        self._update_round_label()
        self.refresh_hint()
        self._console_log(
            "NOWA NEGOCJACJA: etap 1/3 — WYKRYCIE. "
            "Kliknij WYKONAJ lub naciśnij ENTER."
        )

    def show_move_history(self):
        """
        Pokazuje historię kolejnych tur:
        - ruchy A->towar, B->towar...
        - wynik TAK / NIE / INNA
        """
        win = tk.Toplevel(self)
        win.title("Historia negocjacji")
        win.geometry("620x360")
        win.minsize(420, 220)

        if self.topmost_var.get():
            win.attributes("-topmost", True)

        frame = ttk.Frame(win, padding=6)
        frame.pack(fill="both", expand=True)

        text = tk.Text(
            frame,
            wrap="none",
            font=("Consolas", 9),
            relief="solid",
            bd=1,
        )
        text.grid(row=0, column=0, sticky="nsew")

        vscroll = ttk.Scrollbar(
            frame,
            orient="vertical",
            command=text.yview,
        )
        vscroll.grid(row=0, column=1, sticky="ns")

        hscroll = ttk.Scrollbar(
            frame,
            orient="horizontal",
            command=text.xview,
        )
        hscroll.grid(row=1, column=0, sticky="ew")

        text.configure(
            yscrollcommand=vscroll.set,
            xscrollcommand=hscroll.set,
        )

        frame.rowconfigure(0, weight=1)
        frame.columnconfigure(0, weight=1)

        if not self.history:
            text.insert("end", "Brak zapisanych tur.\n")
        else:
            for turn_no, (guess, result) in enumerate(self.history, start=1):
                moves = []
                results = []

                for person, good in enumerate(guess):
                    letter = chr(ord("A") + person)
                    moves.append(f"{letter}->{good}")

                    status = result[person]
                    label = {
                        "TAK": "TAK",
                        "NIE": "NIE",
                        "INNA": "INNA",
                    }.get(status, str(status))

                    results.append(f"{letter}:{label}")

                text.insert(
                    "end",
                    f"TURA {turn_no}\n"
                    f"  RUCH:   {' | '.join(moves)}\n"
                    f"  WYNIK:  {' | '.join(results)}\n\n"
                )

        # Dodaj bieżącą, jeszcze niezatwierdzoną selekcję.
        if self.selected:
            pending = []
            for person in range(int(self.people_var.get())):
                if person in self.locked:
                    pending.append(
                        f"{chr(ord('A') + person)}->{self.locked[person]} [TAK]"
                    )
                elif person in self.selected:
                    pending.append(
                        f"{chr(ord('A') + person)}->{self.selected[person]}"
                    )

            if pending:
                text.insert(
                    "end",
                    "BIEŻĄCA TURA (niezatwierdzona)\n"
                    f"  RUCH:   {' | '.join(pending)}\n"
                )

        text.configure(state="disabled")

        buttons = ttk.Frame(frame)
        buttons.grid(
            row=2,
            column=0,
            columnspan=2,
            sticky="e",
            pady=(5, 0),
        )

        ttk.Button(
            buttons,
            text="ZAMKNIJ",
            command=win.destroy,
        ).pack(side="right")

    def show_training_solution(self):
        """
        W trybie Trening pokazuje faktyczne rozwiązanie negocjacji.
        """
        if self.mode_var.get() != "Trening":
            self._console_log("POKAŻ ROZWIĄZANIE jest dostępne tylko w trybie Trening.")
            return

        if not self.secret:
            self._console_log("Brak rozwiązania do pokazania.")
            return

        solution = ", ".join(
            f"{chr(ord('A') + i)}={good}"
            for i, good in enumerate(self.secret)
        )

        messagebox.showinfo(
            "Rozwiązanie",
            solution,
        )

    def _init_candidates(self, people, goods):
        count = goods ** people

        if count <= MAX_EXACT_CANDIDATES:
            self.exact_solver = True
            self.candidates = list(
                itertools.product(range(1, goods + 1), repeat=people)
            )
        else:
            self.exact_solver = False
            self.candidates = []

    # ============================================================
    # PLANSZA
    # ============================================================

    def _build_board(self):
        for widget in self.board.winfo_children():
            widget.destroy()

        self.person_widgets = {}
        self.good_buttons = {}

        people = int(self.people_var.get())
        goods = int(self.goods_var.get())

        compact = self.compact_var.get()

        for person in range(people):
            self.board.grid_columnconfigure(person, weight=1, uniform="people")
            letter = chr(ord("A") + person)

            col = tk.Frame(
                self.board,
                bg="#fafafa",
                padx=2 if compact else 5,
                pady=1 if compact else 3,
                bd=1,
                relief="groove",
            )
            col.grid(
                row=0,
                column=person,
                sticky="nsew",
                padx=1 if compact else 2,
                pady=1 if compact else 2,
            )

            header = tk.Label(
                col,
                text=letter,
                font=("Segoe UI", 10 if compact else 15, "bold"),
                width=4 if compact else 6,
                bg=COLOR_HEADER,
                relief="solid",
                bd=1,
            )
            header.pack(fill="x", pady=(0, 4))

            selected_label = tk.Label(
                col,
                text="—",
                font=("Segoe UI", 7 if compact else 10, "bold"),
                width=6 if compact else 9,
                bg=COLOR_NORMAL,
                relief="solid",
                bd=1,
            )
            selected_label.pack(fill="x", pady=(0, 4))

            # 003. Trzy małe pola wyniku pod listą towarów:
            # zielony = TAK, czerwony = NIE, żółty = Inna osoba.
            result_frame = tk.Frame(col, bg="#fafafa")

            self.person_widgets[person] = {
                "column": col,
                "header": header,
                "selected": selected_label,
                "result_frame": result_frame,
            }

            self.good_buttons[person] = {}

            for good in range(1, goods + 1):
                # Osobna ramka 1 px daje pewny border #999 na Windows.
                good_border = tk.Frame(
                    col,
                    bg="#999999",
                    bd=0,
                    padx=1,
                    pady=1,
                )
                good_border.pack(
                    fill="x",
                    pady=(0, 1),
                )

                btn = tk.Button(
                    good_border,
                    text=str(good),
                    height=1,
                    font=("Segoe UI", 8 if compact else 9),
                    padx=0,
                    pady=0,
                    bg=COLOR_NORMAL,
                    activebackground=COLOR_SELECTED,
                    relief="flat",
                    bd=0,
                    highlightthickness=0,
                    command=lambda p=person, g=good: self.select_good(p, g),
                )
                btn.pack(fill="both", expand=True)
                self.good_buttons[person][good] = btn

            # Wyniki zajmują całą szerokość kolumny.
            result_frame.pack(
                fill="x",
                pady=(2 if compact else 5, 0 if compact else 1),
            )
            for result_col in range(3):
                result_frame.grid_columnconfigure(
                    result_col,
                    weight=1,
                    uniform="result",
                )

            yes_border = tk.Frame(result_frame, bg="#999999", padx=1, pady=1)
            yes_border.grid(row=0, column=0, sticky="ew", padx=(0, 1))

            yes_btn = tk.Button(
                yes_border,
                text="",
                height=1,
                bg=COLOR_YES,
                activebackground=COLOR_YES,
                font=("Segoe UI", 7 if compact else 8, "bold"),
                relief="flat",
                bd=0,
                highlightthickness=0,
                command=lambda p=person: self.set_analysis_status(p, "TAK"),
            )
            yes_btn.pack(fill="both", expand=True)

            no_border = tk.Frame(result_frame, bg="#999999", padx=1, pady=1)
            no_border.grid(row=0, column=1, sticky="ew", padx=(0, 1))

            no_btn = tk.Button(
                no_border,
                text="",
                height=1,
                bg=COLOR_NO,
                activebackground=COLOR_NO,
                font=("Segoe UI", 7 if compact else 8, "bold"),
                relief="flat",
                bd=0,
                highlightthickness=0,
                command=lambda p=person: self.set_analysis_status(p, "NIE"),
            )
            no_btn.pack(fill="both", expand=True)

            other_border = tk.Frame(result_frame, bg="#999999", padx=1, pady=1)
            other_border.grid(row=0, column=2, sticky="ew")

            other_btn = tk.Button(
                other_border,
                text="",
                height=1,
                bg=COLOR_OTHER,
                activebackground=COLOR_OTHER,
                font=("Segoe UI", 7 if compact else 8, "bold"),
                relief="flat",
                bd=0,
                highlightthickness=0,
                command=lambda p=person: self.set_analysis_status(p, "INNA"),
            )
            other_btn.pack(fill="both", expand=True)

            self.person_widgets[person]["result_buttons"] = {
                "TAK": yes_btn,
                "NIE": no_btn,
                "INNA": other_btn,
            }

        self._refresh_board()
        self.after(20, self._stretch_board_now)

    def select_good(self, person, good):
        if person in self.locked:
            return

        # Towar z wynikiem NIE odpada globalnie dla wszystkich osób.
        if good in self.global_rejected_goods:
            return

        # Towaru raz ocenionego dla danej osoby nie można użyć ponownie.
        if good in self.tried[person]:
            return

        # Kliknięcie ponownie usuwa wybór.
        if self.selected.get(person) == good:
            del self.selected[person]
        else:
            self.selected[person] = good

        if self.mode_var.get() == "Analiza":
            self.analysis_status.pop(person, None)

        self._refresh_board()

    def clear_current_selection(self):
        self.selected.clear()
        self.analysis_status.clear()
        self._refresh_board()

    def _refresh_board(self):
        people = int(self.people_var.get())
        goods = int(self.goods_var.get())

        for person in range(people):
            widgets = self.person_widgets[person]

            if person in self.locked:
                good = self.locked[person]
                widgets["selected"].configure(
                    text=f"TAK: {good}",
                    bg=COLOR_YES,
                )
                widgets["header"].configure(bg=COLOR_LOCKED)
            else:
                selected = self.selected.get(person)
                widgets["selected"].configure(
                    text=(f"Towar {selected}" if selected else "—"),
                    bg=(COLOR_SELECTED if selected else COLOR_NORMAL),
                )
                widgets["header"].configure(bg=COLOR_HEADER)

            for good in range(1, goods + 1):
                btn = self.good_buttons[person][good]

                if person in self.locked:
                    # Po sukcesie zachowujemy historię wcześniejszych prób.
                    # Czerwone i pomarańczowe pola nie znikają.
                    previous = self.tried[person].get(good)

                    if good == self.locked[person]:
                        btn.configure(
                            bg=COLOR_YES,
                            fg="black",
                            state="disabled",
                            relief="flat",
                        )
                    elif previous == "NIE":
                        btn.configure(
                            bg=COLOR_NO,
                            fg="black",
                            state="disabled",
                            relief="flat",
                        )
                    elif good in self.global_rejected_goods:
                        btn.configure(
                            bg=COLOR_DISABLED,
                            fg="black",
                            state="disabled",
                            relief="flat",
                        )
                    elif previous == "INNA":
                        btn.configure(
                            bg=COLOR_OTHER,
                            fg="black",
                            state="disabled",
                            relief="flat",
                        )
                    elif previous == "TAK":
                        btn.configure(
                            bg=COLOR_YES,
                            fg="black",
                            state="disabled",
                            relief="flat",
                        )
                    else:
                        btn.configure(
                            bg=COLOR_DISABLED,
                            fg="black",
                            state="disabled",
                            relief="flat",
                        )
                    continue

                previous = self.tried[person].get(good)

                if previous == "NIE":
                    btn.configure(
                        bg=COLOR_NO,
                        fg="black",
                        state="disabled",
                        relief="flat",
                    )
                elif good in self.global_rejected_goods:
                    btn.configure(
                        bg=COLOR_DISABLED,
                        fg="black",
                        state="disabled",
                        relief="flat",
                    )
                elif previous == "INNA":
                    btn.configure(
                        bg=COLOR_OTHER,
                        fg="black",
                        state="disabled",
                        relief="flat",
                    )
                elif previous == "TAK":
                    btn.configure(
                        bg=COLOR_YES,
                        fg="black",
                        state="disabled",
                        relief="flat",
                    )
                elif self.selected.get(person) == good:
                    btn.configure(
                        bg=COLOR_SELECTED,
                        fg="white",
                        activeforeground="white",
                        state="normal",
                        relief="flat",
                    )
                else:
                    btn.configure(
                        bg=COLOR_NORMAL,
                        fg="black",
                        activeforeground="black",
                        state="normal",
                        relief="flat",
                    )

            result_buttons = widgets.get("result_buttons", {})

            if result_buttons:
                status = self.analysis_status.get(person)

                for result_name, button in result_buttons.items():
                    # W trybie Trening pola są tylko wizualne.
                    if self.mode_var.get() != "Analiza":
                        button.configure(
                            state="disabled",
                            relief="flat",
                            text="",
                        )
                        continue

                    # Trafiona osoba jest już zablokowana.
                    if person in self.locked:
                        if result_name == "TAK":
                            button.configure(
                                state="disabled",
                                relief="flat",
                                text="✓",
                            )
                        else:
                            button.configure(
                                state="disabled",
                                relief="flat",
                                text="",
                            )
                        continue

                    # Najpierw trzeba wskazać towar dla osoby.
                    if person not in self.selected:
                        button.configure(
                            state="disabled",
                            relief="flat",
                            text="",
                        )
                        continue

                    button.configure(
                        state="normal",
                        relief="flat",
                        text=("✓" if status == result_name else ""),
                    )

    # ============================================================
    # TRYB ANALIZA
    # ============================================================

    def set_analysis_status(self, person, status):
        if self.mode_var.get() != "Analiza":
            return

        if person in self.locked:
            return

        # Wynik dotyczy aktualnie wybranego towaru.
        if person not in self.selected:
            return

        # Ponowne kliknięcie tego samego koloru usuwa wybór.
        if self.analysis_status.get(person) == status:
            self.analysis_status.pop(person, None)
        else:
            self.analysis_status[person] = status

        self._refresh_board()

    # ============================================================
    # TURA
    # ============================================================

    def submit_round(self):
        people = int(self.people_var.get())

        active_people = [p for p in range(people) if p not in self.locked]

        missing = [p for p in active_people if p not in self.selected]
        if missing:
            letters = ", ".join(chr(ord("A") + p) for p in missing)
            messagebox.showwarning(
                "Brak wyboru",
                f"Wybierz towar dla: {letters}",
            )
            return

        guess = [None] * people
        for p in range(people):
            if p in self.locked:
                guess[p] = self.locked[p]
            else:
                guess[p] = self.selected[p]

        if self.mode_var.get() == "Trening":
            result = feedback_for(self.secret, guess)
        else:
            missing_status = [
                p for p in active_people
                if p not in self.analysis_status
            ]
            if missing_status:
                letters = ", ".join(
                    chr(ord("A") + p) for p in missing_status
                )
                messagebox.showwarning(
                    "Brak wyniku",
                    "W trybie Analiza wybierz kolor wyniku pod osobą "
                    f"(zielony = TAK, czerwony = NIE, żółty = Inna osoba) dla: {letters}",
                )
                return

            result = []
            for p in range(people):
                if p in self.locked:
                    result.append("TAK")
                else:
                    result.append(self.analysis_status[p])
            result = tuple(result)

        # Najpierw analizujemy CAŁĄ turę i dopiero wtedy ustalamy
        # ostateczne kolory NIE / INNA.
        result = self._normalize_result_statuses(
            guess,
            result,
            active_people,
        )

        self.history.append((tuple(guess), tuple(result)))

        self._apply_round_constraints(
            guess,
            result,
            active_people,
        )

        self._rebuild_exact_candidates_from_history()
        self._recompute_global_rejected_goods()
        self._update_round_label()

        self.selected.clear()
        self.analysis_status.clear()
        self.current_round += 1

        if (
            len(self.locked) == people
            or self.current_round > int(self.rounds_var.get())
        ):
            self._set_negotiation_stage("ZAKONCZONA")
        else:
            self._set_negotiation_stage("SUGESTIA")

        self._refresh_board()
        self._update_round_label()

        if len(self.locked) == people:
            messagebox.showinfo(
                "Sukces",
                f"Negocjacja zakończona powodzeniem w {self.current_round - 1} turach.",
            )
            self.refresh_hint()
            return

        if self.current_round > int(self.rounds_var.get()):
            if self.mode_var.get() == "Trening":
                solution = ", ".join(
                    f"{chr(ord('A') + i)}={good}"
                    for i, good in enumerate(self.secret)
                )
                messagebox.showinfo(
                    "Koniec",
                    f"Nie udało się zakończyć negocjacji.\n\nRozwiązanie:\n{solution}",
                )
            else:
                messagebox.showinfo(
                    "Koniec",
                    "Wykorzystano wszystkie ustawione tury.",
                )

        self.refresh_hint()

    def _update_round_label(self):
        rounds = int(self.rounds_var.get())
        people = int(self.people_var.get())

        self.round_label.configure(
            text=(
                f"Tura: {min(self.current_round, rounds)} / {rounds}     "
                f"Trafione osoby: {len(self.locked)} / {people}"
            )
        )

        if self.exact_solver:
            self.candidate_label.configure(
                text=f"Możliwe układy: {len(self.candidates):,}".replace(",", " ")
            )
        else:
            self.candidate_label.configure(
                text="Solver: tryb uproszczony"
            )

        self._update_negotiation_status_label()

    # ============================================================
    # SOLVER
    # ============================================================

    def _normalize_result_statuses(self, guess, result, active_people):
        """
        Wynik z feedback_for / gry jest już ostateczny.
        Nie zmieniamy później NIE na INNA na podstawie trafionych osób,
        bo żółty dotyczy tylko pozostałych nierozwiązanych osób.
        """
        return list(result)

    def _rebuild_exact_candidates_from_history(self):
        """
        Odbudowuje dokładny solver na podstawie CAŁEJ historii.

        Ważne:
        filtrujemy listę natychmiast po każdej turze. Nie używamy
        zagnieżdżonych generatorów zależnych od old_guess/old_result,
        bo przez late binding mogły one później użyć warunków z ostatniej
        tury zamiast z właściwej tury.

        Liczba możliwych układów po kolejnych turach może więc tylko:
        - pozostać taka sama,
        - albo maleć.
        Nigdy nie powinna rosnąć.
        """
        if not self.exact_solver:
            return

        people = int(self.people_var.get())
        goods = int(self.goods_var.get())

        candidates = list(
            itertools.product(
                range(1, goods + 1),
                repeat=people,
            )
        )

        for old_guess, old_result in self.history:
            candidates = [
                secret
                for secret in candidates
                if feedback_for(secret, old_guess) == old_result
            ]

            if not candidates:
                break

        self.candidates = candidates

    def _apply_round_constraints(self, guess, result, active_people):
        """
        Zapisuje lokalne wyniki tury.

        Globalne blokowanie towarów NIE jest ustalane tutaj na podstawie
        kolejności A/B/C/D/E. Przy powtarzających się ofertach ten sam towar
        może w jednej turze dostać jednocześnie INNA i NIE.

        O tym, czy towar jest jeszcze potrzebny którejś nierozwiązanej osobie,
        decydujemy dopiero PO przefiltrowaniu wszystkich możliwych rozwiązań.
        """
        for person in active_people:
            good = guess[person]
            status = result[person]

            self.tried[person][good] = status

            if status == "TAK":
                self.locked[person] = good

    def _recompute_global_rejected_goods(self):
        """
        Wylicza towary, których NIE potrzebuje już żadna nierozwiązana osoba.

        W trybie dokładnym źródłem prawdy są wszystkie pozostałe kandydatury.
        Towar blokujemy globalnie tylko wtedy, gdy w ŻADNYM możliwym
        rozwiązaniu nie występuje już na żadnej aktywnej pozycji.

        Dzięki temu przypadek:
            C->1 = INNA
            D->1 = INNA
            E->1 = NIE
        nie zależy od kolejności przetwarzania osób.
        """
        people = int(self.people_var.get())
        goods = int(self.goods_var.get())

        active_people = [
            p for p in range(people)
            if p not in self.locked
        ]

        if not active_people:
            self.global_rejected_goods.clear()
            return

        if self.exact_solver and self.candidates:
            still_possible = set()

            for candidate in self.candidates:
                for p in active_people:
                    still_possible.add(candidate[p])

            self.global_rejected_goods = {
                good
                for good in range(1, goods + 1)
                if good not in still_possible
            }
            return

        # Tryb uproszczony: zachowawczo.
        # Globalnie blokujemy tylko towar, który dostał NIE i nie ma
        # żadnego INNA/TAK w zapisanej historii.
        seen_no = set()
        seen_present = set()

        for old_guess, old_result in self.history:
            for p, good in enumerate(old_guess):
                status = old_result[p]

                if status == "NIE":
                    seen_no.add(good)
                elif status in ("INNA", "TAK"):
                    seen_present.add(good)

        self.global_rejected_goods = seen_no - seen_present

    def _filter_candidates(self, guess, observed):
        if not self.exact_solver:
            return

        self.candidates = [
            secret
            for secret in self.candidates
            if feedback_for(secret, guess) == observed
        ]

        self._recompute_global_rejected_goods()
        self._update_round_label()

        if not self.candidates:
            self._console_log(
                "BRAK ROZWIĄZANIA: ostatni wynik jest sprzeczny "
                "z dotychczasowymi ograniczeniami."
            )

    def refresh_hint(self):
        # Każde odświeżenie unieważnia wynik poprzedniego wątku.
        self.hint_generation += 1
        generation = self.hint_generation

        if len(self.locked) == int(self.people_var.get()):
            parts = [
                f"{chr(ord('A') + p)} → {self.locked[p]}"
                for p in range(int(self.people_var.get()))
            ]
            self.current_hint_text = "Pewne rozwiązanie: " + ", ".join(parts)
            self.hint_busy = False
            self.toggle_hint_visibility()
            return

        if self.exact_solver:
            if not self.candidates:
                self.current_hint_text = "Brak możliwych układów — wyniki są sprzeczne."
                self.hint_busy = False
                self.toggle_hint_visibility()
                return

            self.current_hint_text = ""

            if self.hints_var.get():
                self.hint_label.configure(text="Liczenie najlepszej wskazówki...")
            else:
                self.hint_label.configure(text="Wskazówki wyłączone.")

            self.hint_busy = True

            threading.Thread(
                target=self._hint_worker,
                args=(generation,),
                daemon=True,
            ).start()
        else:
            self.hint_busy = False
            self._show_simple_hint()

    def _hint_worker(self, generation):
        try:
            hint = self._calculate_best_hint()
        except Exception as exc:
            hint = f"Błąd solvera: {exc}"

        self.after(
            0,
            lambda g=generation, h=hint: self._finish_hint(g, h),
        )

    def _finish_hint(self, generation, hint):
        # Wynik starego wątku nie może nadpisać wskazówki
        # policzonej dla nowszej tury/stanu.
        if generation != self.hint_generation:
            return

        self.hint_busy = False
        self.current_hint_text = hint

        if self.hints_var.get():
            self.hint_label.configure(text=hint)
        else:
            self.hint_label.configure(text="Wskazówki wyłączone.")

        # W trybie Analiza możemy od razu wstawić sugerowane towary
        # na początku każdej nowej tury.
        if (
            self.mode_var.get() == "Analiza"
            and self.autofill_var.get()
            and self.current_round <= int(self.rounds_var.get())
        ):
            self._autofill_from_hint(hint)

    def _autofill_from_hint(self, hint):
        # Czyścimy tylko bieżące wybory osób niezablokowanych.
        people = int(self.people_var.get())

        suggestions = {}
        for letter, good in re.findall(r"([A-Z])\s*→\s*(\d+)", hint):
            person = ord(letter) - ord("A")
            if 0 <= person < people:
                suggestions[person] = int(good)

        if not suggestions:
            return

        changed = False

        for person, good in suggestions.items():
            if person in self.locked:
                continue
            if good in self.global_rejected_goods:
                continue
            if good in self.tried[person]:
                continue
            if good not in self.good_buttons.get(person, {}):
                continue

            self.selected[person] = good
            self.analysis_status.pop(person, None)
            changed = True

        if changed:
            self._refresh_board()

    def _calculate_best_hint(self):
        people = int(self.people_var.get())
        goods = int(self.goods_var.get())

        # 001. Pierwsza tura ma być zawsze prosta i przewidywalna.
        # Zamiast losowego układu solver proponuje towary kolejno:
        # A->1, B->2, C->3, D->4, E->5 itd.
        # Jeżeli osób jest więcej niż towarów, numeracja zaczyna się od 1.
        if not self.history:
            parts = []
            for p in range(people):
                if p in self.locked:
                    continue

                good = (p % goods) + 1

                # Gdyby dany towar był już niedostępny dla osoby,
                # wybieramy pierwszy kolejny możliwy.
                if (
                    good in self.tried[p]
                    or good in self.global_rejected_goods
                ):
                    available = [
                        g for g in range(1, goods + 1)
                        if g not in self.tried[p]
                        and g not in self.global_rejected_goods
                    ]
                    if available:
                        good = available[0]
                    else:
                        continue

                parts.append(
                    f"{chr(ord('A') + p)} → {good}"
                )

            return (
                "Pierwsza tura — sprawdzamy towary kolejno: "
                + ", ".join(parts)
            )

        # Pewne rozwiązanie:
        # nie wymagamy już literalnie jednego rekordu w candidates.
        # Wystarczy, że dla każdej nierozwiązanej osoby wszystkie
        # pozostałe kandydatury wskazują dokładnie ten sam towar.
        certain_parts = []
        all_certain = True

        for p in range(people):
            if p in self.locked:
                continue

            possible_goods = {
                candidate[p]
                for candidate in self.candidates
                if candidate[p] not in self.global_rejected_goods
            }

            if len(possible_goods) != 1:
                all_certain = False
                break

            good = next(iter(possible_goods))
            certain_parts.append(
                f"{chr(ord('A') + p)} → {good}"
            )

        if all_certain and certain_parts:
            return "Pewne rozwiązanie: " + ", ".join(certain_parts)

        valid_guesses = []

        # Kandydat jako ruch musi respektować towary już odrzucone dla osoby.
        for candidate in self.candidates:
            good = True
            for p in range(people):
                if p in self.locked:
                    if candidate[p] != self.locked[p]:
                        good = False
                        break
                elif candidate[p] in self.global_rejected_goods:
                    good = False
                    break
                elif candidate[p] in self.tried[p]:
                    good = False
                    break
            if good:
                valid_guesses.append(candidate)

        if not valid_guesses:
            fallback_parts = []

            for p in range(people):
                if p in self.locked:
                    continue

                available = [
                    g for g in range(1, goods + 1)
                    if g not in self.global_rejected_goods
                    and g not in self.tried[p]
                ]

                if not available:
                    return (
                        "Brak ruchu dla "
                        + chr(ord("A") + p)
                        + " — sprawdź historię wyników."
                    )

                fallback_parts.append(
                    f"{chr(ord('A') + p)} → {available[0]}"
                )

            return "Sugerowany ruch: " + ", ".join(fallback_parts)

        # Dla dużej liczby kandydatów bierzemy próbkę ruchów.
        if len(valid_guesses) > MAX_HINT_GUESSES:
            guesses = random.sample(valid_guesses, MAX_HINT_GUESSES)
        else:
            guesses = valid_guesses

        # Dla bardzo dużej puli sekretów oceniamy na reprezentatywnej próbce.
        if len(self.candidates) > 5000:
            secrets = random.sample(self.candidates, 5000)
        else:
            secrets = self.candidates

        best_guess = None
        best_score = None
        best_worst = None

        for guess in guesses:
            buckets = defaultdict(int)

            for secret in secrets:
                buckets[feedback_for(secret, guess)] += 1

            total = len(secrets)

            # Oczekiwana liczba pozostających możliwości.
            expected = sum(size * size for size in buckets.values()) / total
            worst = max(buckets.values())

            score = expected

            if (
                best_score is None
                or score < best_score
                or (math.isclose(score, best_score) and worst < best_worst)
            ):
                best_score = score
                best_worst = worst
                best_guess = guess

        parts = []
        for p in range(people):
            if p not in self.locked:
                parts.append(
                    f"{chr(ord('A') + p)} → {best_guess[p]}"
                )

        confidence = []
        for p in range(people):
            if p in self.locked:
                continue

            counts = Counter(c[p] for c in self.candidates)
            top_good, top_count = counts.most_common(1)[0]
            pct = round(top_count * 100 / len(self.candidates))
            confidence.append(
                f"{chr(ord('A') + p)}: najczęściej {top_good} ({pct}%)"
            )

        return (
            "Sugerowany ruch: "
            + ", ".join(parts)
            + f"\nMożliwe układy: {len(self.candidates)}"
            + f" | oczekiwane po ruchu: {best_score:.1f}"
            + f" | najgorszy przypadek: {best_worst}"
            + "\n"
            + "   ".join(confidence)
        )

    def _show_simple_hint(self):
        people = int(self.people_var.get())
        goods = int(self.goods_var.get())

        parts = []

        for p in range(people):
            if p in self.locked:
                continue

            available = [
                g for g in range(1, goods + 1)
                if g not in self.tried[p]
                and g not in self.global_rejected_goods
            ]

            if available:
                parts.append(
                    f"{chr(ord('A') + p)} → {available[0]}"
                )

        self.current_hint_text = (
            "Duża przestrzeń rozwiązań — dokładny solver jest wyłączony. "
            "Proponowany ruch na podstawie lokalnych ograniczeń: "
            + ", ".join(parts)
        )
        self.toggle_hint_visibility()


if __name__ == "__main__":
    app = NegotiationApp()
    app.mainloop()
