#!/bin/sh
# Builds the tool from src/ into the repo root, the way apricity-mocks builds its menu:
#   src/index.html -> index.html
#   src/js/        -> js/   (with each sheet pointed at its published link)
# Run it after changing anything in src/, then commit both.
cd "$(dirname "$0")"

# The live tool reads the sheets straight from published Google Sheets (File → Share → Publish to web, then the tab's .csv link).
# A link left empty here keeps reading its copy in sheets/.
# The wine list is the restaurant's own published "apricity_wines" sheet, the same link the menu site uses. Read only.
WINE_CSV='https://docs.google.com/spreadsheets/d/e/2PACX-1vSH5PMPgMOSJTzJ3FnKJmZxY3lI0loTNugZsmD6_U7PeT4LHiYJY75BtW-mFIgpeVbuDoZ8x724M6i1/pub?gid=652214147&single=true&output=csv'
# The study sheet: the "Wine study", "Wine lists", "Wine glossary" and "Wine regions" tabs, once they are made and published. See UPDATING-THE-WINE-NOTES.md.
STUDY_CSV=''
LISTS_CSV=''
GLOSSARY_CSV=''
REGIONS_CSV=''

rm -rf js && mkdir -p js && cp -R src/js/. js/
cp src/index.html index.html

point() { # point <name> <file> <url>
  [ -n "$3" ] || return 0
  esc=$(printf %s "$3" | sed 's/[&#\\]/\\&/g')
  sed -i.bak "s#$1: \"sheets/$2\"#$1: \"$esc\"#" js/config.js && rm -f js/config.js.bak
}
point wine wine.csv "$WINE_CSV"
point study study.csv "$STUDY_CSV"
point lists lists.csv "$LISTS_CSV"
point glossary glossary.csv "$GLOSSARY_CSV"
point regions regions.csv "$REGIONS_CSV"
echo "Built index.html and js/. Sheets:"; grep -E '^\s+(wine|study|lists|glossary|regions):' js/config.js
