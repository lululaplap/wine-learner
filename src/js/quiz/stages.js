// The learning path: six stages, each split into short lessons. Membership is worked out from the live list,
// so a new wine by the glass joins stage 2 by itself. A wine belongs to the first stage it qualifies for.

const FAMILIES = ["Pinot Noir", "Chardonnay", "Sauvignon Blanc", "Riesling", "Sangiovese", "Syrah", "Blaufränkisch"];
const fold = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const inFamily = w => FAMILIES.some(f => fold(w.family).includes(fold(f)) || fold(w.leadGrape).includes(fold(f)));
const isGrowerChampagne = w => /champagne/i.test(w.section);
const price = w => (w.bottle != null ? w.bottle : w.glass != null ? w.glass * 5 : 999);
const TYPE_ORDER = ["sparkling", "white", "rose", "orange", "red", "sweet"];
const byTypeThenPrice = (a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || price(a) - price(b);

export const STAGE_DEFS = [
  { id: "anchors", title: "The anchors", blurb: "Five reference wines. Learn these first and describe everything else against them.",
    test: w => w.anchor, sort: (a, b) => byTypeThenPrice(a, b) },
  { id: "glass", title: "By the glass", blurb: "Everything we pour by the glass, then the sweet wines by the glass.",
    test: w => w.glass != null, sort: (a, b) => (a.type === "sweet") - (b.type === "sweet") || byTypeThenPrice(a, b) },
  { id: "under100", title: "Bottles under £100", blurb: "The bottles guests order most.",
    test: w => w.bottle != null && w.bottle < 100, sort: byTypeThenPrice },
  { id: "families", title: "Families and ladders", blurb: "Pinot Noir, Chardonnay, Sauvignon, Riesling, Sangiovese, Syrah, Blaufränkisch and the grower Champagnes, each by price.",
    test: w => inFamily(w) || isGrowerChampagne(w),
    sort: (a, b) => fold(a.family || a.leadGrape).localeCompare(fold(b.family || b.leadGrape)) || price(a) - price(b) },
  { id: "mid", title: "Bottles £100 to £179", blurb: "The middle of the list.",
    test: w => w.bottle != null && w.bottle < 180, sort: byTypeThenPrice },
  { id: "top", title: "The top of the list", blurb: "The rarest, the priciest and the unusual.",
    test: () => true, sort: byTypeThenPrice }
];

export const LESSON_SIZE = 4;

export function buildStages(wines) {
  const taken = new Set();
  return STAGE_DEFS.map((def, i) => {
    const list = wines.filter(w => !taken.has(w.id) && def.test(w)).sort(def.sort);
    list.forEach(w => taken.add(w.id));
    const lessons = [];
    for (let k = 0; k < list.length; k += LESSON_SIZE) {
      lessons.push({ id: `${def.id}-${lessons.length + 1}`, stageId: def.id, n: lessons.length + 1, wines: list.slice(k, k + LESSON_SIZE) });
    }
    return { ...def, n: i + 1, wines: list, lessons };
  });
}
