import { toRows } from "./csv.js";
import { buildWines, buildRegions, SCORES } from "./data.js";
import { buildGlossary, useGlossary, linkTerms } from "./glossary.js";
import { esc, glyph, wineRow, badges, money } from "./ui.js";
import { renderCard } from "./views/card.js";
import { renderList, toggleType } from "./views/list.js";
import { renderCheck } from "./views/check.js";
import { renderMapShell, mountMap } from "./views/map.js";
import { renderPath, onPathClick, onPathSubmit } from "./views/path.js";
import { renderLesson, onLessonClick, onLessonKey, onLessonInput, onLessonSubmit } from "./views/lesson.js";
import { renderRegionsShell, mountRegions } from "./views/regions.js";
import { loadProgress, saveProgress, isKnown, isDue, grade, emptyProgress, KNOWN } from "./quiz/progress.js";
import { buildStages } from "./quiz/stages.js";
import { SCALE_WORDS, SCORE_NAMES, gridScores } from "./quiz/tasting.js";
import { store } from "./store.js";
globalThis.Study = { toRows, buildWines, buildRegions, SCORES, buildGlossary, useGlossary, linkTerms, esc, glyph, wineRow, badges, money,
  renderCard, renderList, toggleType, renderCheck, renderMapShell, mountMap, renderPath, onPathClick, onPathSubmit,
  renderLesson, onLessonClick, onLessonKey, onLessonInput, onLessonSubmit, renderRegionsShell, mountRegions,
  loadProgress, saveProgress, isKnown, isDue, grade, emptyProgress, KNOWN, buildStages, SCALE_WORDS, SCORE_NAMES, gridScores, store };
