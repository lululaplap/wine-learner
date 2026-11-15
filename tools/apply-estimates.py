#!/usr/bin/env python3
"""Fills the estimated tasting data in tools/estimates.txt into sheets/study.csv.

Only empty cells are filled, so anything the team has already written stays. Tags must come from the fixed
lists in sheets/lists.csv. Run: python3 tools/apply-estimates.py
"""
import csv, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from importlib import import_module
key = import_module("seed-to-study").key

SCORES = ["Sweetness", "Acidity", "Tannin", "Body", "Oak", "Wildness"]


def main():
    lists = {}
    for r in csv.DictReader((ROOT / "sheets/lists.csv").open(encoding="utf-8")):
        lists.setdefault(r["List"], set()).add(r["Value"])
    seed = {w["id"]: w for w in json.loads((ROOT / "docs/wine-study/wine-study-seed.json").read_text())["wines"]}
    est, problems = {}, []
    for n, line in enumerate((ROOT / "tools/estimates.txt").read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip() or line.startswith("#"):
            continue
        parts = [p.strip() for p in line.split("|")]
        if len(parts) != 6:
            problems.append(f"line {n}: expected 6 fields"); continue
        wid, scores, flav, making, like, guest = parts
        if wid not in seed:
            problems.append(f"line {n}: unknown wine {wid}"); continue
        nums = scores.split()
        if len(nums) != 6 or any(x != "-" and x not in "12345" for x in nums):
            problems.append(f"line {n}: scores must be six values from 1 to 5 or -"); continue
        tags = lambda cell: [] if cell == "-" else [t.strip() for t in cell.split(";") if t.strip()]
        row = {s: ("" if v == "-" else v) for s, v in zip(SCORES, nums)}
        for col, cell, lst, most in (("Flavours", flav, "Flavours", 4), ("Making", making, "Making", 7), ("If you like", like, "If you like", 3)):
            vals = tags(cell)
            bad = [v for v in vals if v not in lists.get(lst, set())]
            if bad: problems.append(f"line {n}: {col} not on the {lst} list: {bad}")
            if len(vals) > most: problems.append(f"line {n}: more than {most} {col}")
            row[col] = ", ".join(vals)
        row["Guest line"] = "" if guest == "-" else guest
        est[key(seed[wid]["producer"], seed[wid]["cuvee"])] = row
    missing = [w for w in seed if key(seed[w]["producer"], seed[w]["cuvee"]) not in est]
    if missing: problems.append(f"no estimates for: {missing}")
    if problems:
        print("\n".join(problems), file=sys.stderr); return 1

    path = ROOT / "sheets/study.csv"
    rows = list(csv.DictReader(path.open(encoding="utf-8")))
    cols = list(rows[0].keys())
    filled = 0
    for r in rows:
        for c, v in est.get(r["Key"], {}).items():
            if v and not r[c].strip():
                r[c] = v; filled += 1
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(rows)
    print(f"Filled {filled} empty cells across {len(est)} wines.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
