# The study tool's code runs in the mock as it is, with these small changes, made to a temporary copy of src/js:
# the maps' D3 and country outlines are bundled into the page; "open to taste" and the card's stock line come from
# stock (through globalThis.studyHooks); tastings go to the sommelier's inbox; the wording speaks of accounts, not devices.
# mock/build.py runs this from inside that copy.
def patch(path, old, new, count=1):
    s=open(path).read()
    assert s.count(old)==count, (path, old[:70], s.count(old))
    s=s.replace(old,new); open(path,"w").write(s)
H="(globalThis.studyHooks || {})"
patch("js/views/map.js",'const loadD3 = () => (d3p = d3p || import(new URL("../../vendor/d3-map.js", import.meta.url).href));',
 'import * as D3 from "../../vendor/d3-map.js";\nconst loadD3 = () => Promise.resolve(D3);')
patch("js/views/regions.js",'const loadD3 = () => (d3p = d3p || import(new URL("../../vendor/d3-map.js", import.meta.url).href));',
 'import * as D3 from "../../vendor/d3-map.js";\nconst loadD3 = () => Promise.resolve(D3);')
patch("js/views/regions.js",'const loadWorld = () => (worldp = worldp || fetch(new URL("../../vendor/world-50m.json", import.meta.url)).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }));',
 'const loadWorld = () => Promise.resolve(globalThis.WORLD);')
patch("js/quiz/tasting.js","export function isOpen(w, now = Date.now()) {\n",
 "export function isOpen(w, now = Date.now()) {\n  if (" + H + ".isOpen) return " + H + ".isOpen(w);\n")
patch("js/quiz/tasting.js","export const openExtras = (wines, now = Date.now()) => { const m = marks(now);",
 "export const openExtras = (wines, now = Date.now()) => { if (" + H + ".openExtras) return " + H + ".openExtras(wines); const m = marks(now);")
patch("js/views/card.js","function openBlock(w) {\n", "function openBlock(w) {\n  if (" + H + ".cardExtra) return " + H + ".cardExtra(w);\n")
patch("js/views/card.js",'    ${!service ? yourTasting(w) : ""}', '    ${!service ? yourTasting(w) : ""}\n    ${' + H + '.cardFoot ? ' + H + '.cardFoot(w) : ""}')
patch("js/views/lesson.js","const glass = shuffle(all.filter(w => w.glass != null), Math.random)",
 "const glass = shuffle(all.filter(w => w.glass != null && !(" + H + ".isOff && " + H + ".isOff(w))), Math.random)")
patch("js/views/lesson.js",'<button type="button" class="btn ghost big" data-copy>Copy my notes</button>',
 '<button type="button" class="btn ghost big" data-copy>Send to the sommelier</button>')
patch("js/views/lesson.js","""    const text = tastingText(tt.draft, w, active.name), done = msg => { const el = document.querySelector(".copied"); if (el) el.textContent = msg; };
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => done("Copied. Paste it into a message to the wine lead."), () => done(text));""",
 """    const done = msg => { const el = document.querySelector(".copied"); if (el) el.textContent = msg; };
    if (""" + H + """.sendTasting) { """ + H + """.sendTasting(w, tt.draft, active.name); done("Sent. It is in the sommelier's Tasting notes, beside the current notes."); copy.disabled = true; }""")
patch("js/views/lesson.js","If you are confident they are wrong, send your notes to the wine lead.","If you think they are wrong, send your notes to the sommelier.")
patch("js/views/path.js",'<p class="intro">Your progress is kept on this device under your first name.</p>','<p class="intro">This is the shared tablet. Pick your name and your own path opens. It hands back to the tablet after a few idle minutes.</p>')
patch("js/views/path.js","""    <form class="nameform" id="nameForm"><label for="nameInput">First name</label>
      <div class="namerow"><input id="nameInput" name="name" autocomplete="given-name" maxlength="30" required><button type="submit" class="btn">Start</button></div></form>""","")
patch("js/views/path.js",'<p class="intro">Not listed?</p>','')
patch("js/views/path.js",'<button type="button" class="linkbtn" data-switch>Not you?</button>','<button type="button" class="linkbtn tabletonly" data-switch>Not you? Hand back the tablet</button>')
patch("js/views/path.js","the glass list, and any bottle marked <em>Open to taste today</em> on its card.","the glass list, and any bottle taken off stock for a staff tasting.")
patch("js/views/path.js","<p>Lessons on this device: ${sessToday} today, ${sessWeek} in the last 7 days.</p>","<p>Your lessons: ${sessToday} today, ${sessWeek} in the last 7 days. Saved to your account.</p>")
patch("js/views/path.js","Reset all of ${learner()}'s progress on this device?","Reset all of ${learner()}'s progress?")
patch("js/views/path.js","<h2>Open to taste today</h2>","<h2>Opened for a tasting today</h2>")
patch("js/views/path.js",'href="#/lesson/service">Before service: 5 on the glass list</a>','href="#/lesson/service">Before service: 5 on tonight&#39;s glass list</a>')
