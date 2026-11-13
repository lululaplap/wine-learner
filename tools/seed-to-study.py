#!/usr/bin/env python3
"""Builds sheets/study.csv from docs/wine-study/wine-study-seed.json.

Run once to make the first study sheet: python3 tools/seed-to-study.py
Each seed wine is matched to the wine sheet (sheets/wine.csv) by the wine key.
Where the seed's corrected names differ from the sheet's spelling, the sheet's
spelling goes in "Also matches", so the notes stay attached to the right wine.
"""
import csv, json, re, sys, unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "docs/wine-study/wine-study-seed.json"
WINE = ROOT / "sheets/wine.csv"
OUT = ROOT / "sheets/study.csv"

COLUMNS = ["Key", "Also matches", "Display name", "Short name", "Pronunciation", "Lead grape", "Grape family",
           "Region group", "Country", "Sweetness", "Acidity", "Tannin", "Body", "Oak", "Wildness", "Flavours",
           "Making", "Style note", "Guest line", "If you like", "Compare", "Anchor", "Serve", "Story",
           "Pairs with", "Source", "Check"]

ANCHORS = {"galerne", "loiseau", "pranzegg", "fronsac", "boutdzan"}

# Seed wines whose name differs so much from the sheet's that the key alone cannot find them.
# Seed id -> (sheet producer, sheet cuvée) for each sheet spelling, checked by hand against sheets/wine.csv.
MANUAL = {
    "selosse": [("Guillame Selosse", "Largillier")],
    "altesse": [("Correntin Houillon", "Force of Nature")],
    "arcane": [("Correntin Houillon", "Arcane")],
    "paloblanco": [("Enviante", "Palo Blanco")],
    "wachter": [("Wachter Wiesler", "Bela-Joska")],
    "roch": [("Preurie Roch", "VDF Rouge")],
}


def key(producer, cuvee):
    """Must match wineKey() in src/js/key.js."""
    s = unicodedata.normalize("NFKD", f"{producer} {cuvee}".lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[^a-z0-9\s]", "", s)
    return re.sub(r"\s+", " ", s).strip()


def check_question(note):
    for sentence in re.split(r"(?<=[.!?])\s+", note):
        if re.match(r"(Check|Confirm|Ask)\b", sentence) or "ask your supplier" in sentence.lower() or "ask how" in sentence.lower():
            return sentence.strip()
    return "Confirm this note with the supplier."


def main():
    seed = json.loads(SEED.read_text())
    rows = list(csv.DictReader(WINE.open(encoding="utf-8-sig")))
    sheet = {}
    for r in rows:
        sheet.setdefault(key(r["Producer"], r["Cuvée"]), []).append(r)

    wines = seed["wines"]
    by_id = {w["id"]: w for w in wines}
    seed_keys = {w["id"]: key(w["producer"], w["cuvee"]) for w in wines}
    used = set()
    matches = {}

    def by_producer_and_price(w):
        """Rows from the same producer whose bottle price equals the seed's, or its glass price on a By the Glass row."""
        prod = key(w["producer"], "")
        hits = []
        for k, rs in sheet.items():
            for r in rs:
                if key(r["Producer"], "") != prod and not k.startswith(prod.split(" ")[0]):
                    continue
                price = re.sub(r"[^0-9.]", "", r["Bottle Price (£)"])
                if r["Section"] == "Bottles" and w["price"] is not None and price and float(price) == w["price"]:
                    hits.append(k)
                if r["Section"] == "By the Glass" and w["glass"] is not None and price and float(price) == w["glass"]:
                    hits.append(k)
        return hits

    for w in wines:
        sk = seed_keys[w["id"]]
        found = [sk] if sk in sheet else []
        if w["id"] in MANUAL:
            found = [key(p, c) for p, c in MANUAL[w["id"]]]
        if not found:
            found = by_producer_and_price(w)
        # The glass row can be spelt differently from the bottle row: pick it up by producer and glass price.
        if w["glass"] is not None:
            for k in by_producer_and_price(w):
                if k not in found:
                    found.append(k)
        found = [k for k in dict.fromkeys(found) if k in sheet]
        matches[w["id"]] = found
        used.update(found)

    problems = [w["id"] for w in wines if not matches[w["id"]]]
    leftover = sorted(set(sheet) - used)
    if problems or leftover:
        print("Seed wines with no sheet row:", problems, file=sys.stderr)
        print("Sheet wines with no seed row:", leftover, file=sys.stderr)

    with OUT.open("w", newline="", encoding="utf-8") as f:
        out = csv.writer(f)
        out.writerow(COLUMNS)
        for w in wines:
            sk = seed_keys[w["id"]]
            found = matches[w["id"]]
            primary = sk
            also = [k for k in found if k != primary]
            compare = [seed_keys[c] for c in w["cmp"] if c in by_id]
            out.writerow({
                "Key": primary,
                "Also matches": "; ".join(also),
                "Display name": f'{w["producer"]}, {w["cuvee"]}',
                "Short name": w["short"],
                "Lead grape": w["grape"],
                "Grape family": w["grape"],
                "Region group": w["region"],
                "Country": w["country"],
                "Style note": w["note"],
                "Compare": "; ".join(compare),
                "Anchor": "yes" if w["id"] in ANCHORS else "",
                "Source": "estimate",
                "Check": check_question(w["note"]) if w["check"] else "",
            }.get(c, "") for c in COLUMNS)
    print(f"Wrote {OUT.relative_to(ROOT)}: {len(wines)} wines, {sum(len(v) > 1 for v in matches.values())} with more than one sheet spelling.")
    return 1 if problems or leftover else 0


if __name__ == "__main__":
    sys.exit(main())
