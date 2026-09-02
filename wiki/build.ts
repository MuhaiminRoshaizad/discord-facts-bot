/**
 * Generate the public compendium.
 *
 * Built from the same modules the game runs on, so the wiki cannot drift out
 * of date: change an affinity in src/game/content and it changes here on the
 * next build. Output goes to public/, which wrangler serves as static assets.
 *
 *   npm run wiki
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { ALL_ECHO_SPECIES } from '../src/game/content/echoes.ts';
import { ALL_HUSK_SPECIES } from '../src/game/content/husks.ts';
import { ALL_SKILLS } from '../src/game/content/skills.ts';
import { SUIT_BLURB, SUIT_LABEL, weaveSuit } from '../src/game/content/suits.ts';
import { ALL_ALLIES } from '../src/game/content/allies.ts';
import { AFFINITY_LABEL, ELEMENT_LABEL } from '../src/game/affinity.ts';
import { ELEMENTS, SUITS, type AffinityTable } from '../src/game/types.ts';
import { echoCapacity, xpToNext } from '../src/game/progression.ts';

function escape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stars(rarity: number): string {
  return '★'.repeat(rarity) + '☆'.repeat(Math.max(0, 5 - rarity));
}

function affinityCells(table: AffinityTable): string {
  return ELEMENTS.map((element) => {
    const state = table[element] ?? 'neutral';
    return `<td class="a a-${state}" title="${ELEMENT_LABEL[element]}">${
      state === 'neutral' ? '·' : escape(AFFINITY_LABEL[state])
    }</td>`;
  }).join('');
}

const elementHead = ELEMENTS.map(
  (element) => `<th class="el">${escape(ELEMENT_LABEL[element].slice(0, 3))}</th>`,
).join('');

const STYLE = `
:root{
  color-scheme: light dark;
  --bg:#f6f7fb; --panel:#ffffff; --ink:#141a2e; --muted:#5b647d;
  --line:#dfe3ee; --accent:#2a9d8f; --amber:#b9761b; --danger:#b23a40;
  --violet:#6b4f96;
}
@media (prefers-color-scheme: dark){
  :root{
    --bg:#11141f; --panel:#181d2c; --ink:#e8ecf7; --muted:#98a2bd;
    --line:#28304a; --accent:#4fc4b4; --amber:#e9a03c; --danger:#e0666c;
    --violet:#a98fd4;
  }
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font:15px/1.6 ui-sans-serif,system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.wrap{max-width:1040px;margin:0 auto;padding:32px 20px 80px}
header{border-bottom:1px solid var(--line);padding-bottom:20px;margin-bottom:28px}
h1{margin:0 0 4px;font-size:28px;letter-spacing:-.01em}
h2{margin:40px 0 12px;font-size:20px;border-bottom:1px solid var(--line);padding-bottom:6px}
p.lede{margin:0;color:var(--muted);max-width:62ch}
nav{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
nav a{color:var(--ink);text-decoration:none;border:1px solid var(--line);
  background:var(--panel);border-radius:999px;padding:5px 13px;font-size:13px}
nav a:hover{border-color:var(--accent);color:var(--accent)}
.search{width:100%;margin:12px 0 4px;padding:10px 13px;border-radius:9px;
  border:1px solid var(--line);background:var(--panel);color:var(--ink);font-size:14px}
.scroll{overflow-x:auto;border:1px solid var(--line);border-radius:11px;background:var(--panel)}
table{border-collapse:collapse;width:100%;font-size:13.5px}
th,td{text-align:left;padding:8px 11px;border-bottom:1px solid var(--line);white-space:nowrap}
thead th{position:sticky;top:0;background:var(--panel);font-weight:600;color:var(--muted);
  font-size:12px;text-transform:uppercase;letter-spacing:.05em}
tbody tr:last-child td{border-bottom:0}
td.name{font-weight:600;white-space:normal;min-width:9rem}
td.lore{color:var(--muted);white-space:normal;min-width:20rem;font-size:13px}
th.el{text-align:center;font-size:11px}
td.a{text-align:center;font-size:11.5px;font-weight:600;color:var(--muted)}
.a-weak{color:var(--danger)}
.a-resist,.a-null{color:var(--accent)}
.a-drain,.a-repel{color:var(--violet)}
.rarity{color:var(--amber);letter-spacing:1px}
.pill{display:inline-block;border:1px solid var(--line);border-radius:999px;
  padding:1px 8px;font-size:11.5px;color:var(--muted)}
.suits{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(210px,1fr))}
.suit{border:1px solid var(--line);border-radius:11px;padding:13px 15px;background:var(--panel)}
.suit h3{margin:0 0 4px;font-size:15px}
.suit p{margin:0;color:var(--muted);font-size:13px}
footer{margin-top:56px;padding-top:18px;border-top:1px solid var(--line);
  color:var(--muted);font-size:12.5px}
.hidden{display:none}

/* Husk affinities are meant to be discovered in play, so they are blurred out
   until the reader deliberately asks to see them. */
.spoiler-table td.a{filter:blur(5px);user-select:none;transition:filter .15s}
.spoilers-shown .spoiler-table td.a{filter:none;user-select:auto}
.toggle{display:inline-flex;align-items:center;gap:8px;margin:10px 0 4px;
  border:1px solid var(--line);background:var(--panel);color:var(--ink);
  border-radius:9px;padding:8px 13px;font:inherit;font-size:13.5px;cursor:pointer}
.toggle:hover{border-color:var(--amber);color:var(--amber)}
.note{color:var(--muted);font-size:13px;margin:6px 0 0}
`;

const SCRIPT = `
document.querySelectorAll('input[data-filters]').forEach(function (input) {
  input.addEventListener('input', function () {
    var q = input.value.trim().toLowerCase();
    var rows = document.querySelectorAll(input.getAttribute('data-filters') + ' tbody tr');
    rows.forEach(function (row) {
      row.classList.toggle('hidden', q !== '' && row.textContent.toLowerCase().indexOf(q) === -1);
    });
  });
});

var spoilerButton = document.getElementById('spoilers');
if (spoilerButton) {
  spoilerButton.addEventListener('click', function () {
    var shown = document.body.classList.toggle('spoilers-shown');
    spoilerButton.textContent = shown
      ? 'Hide Husk weaknesses'
      : 'Reveal Husk weaknesses (spoilers)';
    spoilerButton.setAttribute('aria-pressed', String(shown));
  });
}
`;

function echoTable(): string {
  const rows = ALL_ECHO_SPECIES.map(
    (species) => `<tr>
      <td class="name">${escape(species.name)}</td>
      <td><span class="pill">${escape(SUIT_LABEL[species.suit])}</span></td>
      <td class="rarity">${stars(species.rarity)}</td>
      ${affinityCells(species.affinities)}
      <td class="lore">${escape(species.lore)}</td>
    </tr>`,
  ).join('');

  return `<div class="scroll"><table><thead><tr>
    <th>Echo</th><th>Suit</th><th>Rarity</th>${elementHead}<th>Notes</th>
  </tr></thead><tbody>${rows}</tbody></table></div>`;
}

/**
 * Husk affinities are the one thing the game asks you to *find*, by hitting
 * something and seeing what happens. Printing them here in plain sight would
 * make that mechanic pointless, so they are hidden behind a toggle the reader
 * has to reach for deliberately.
 */
function huskTable(): string {
  const rows = ALL_HUSK_SPECIES.map(
    (species) => `<tr>
      <td class="name">${escape(species.name)}</td>
      <td><span class="pill">${escape(species.rank)}</span></td>
      <td><span class="pill">${escape(SUIT_LABEL[species.suit])}</span></td>
      <td>${species.hp}</td>
      ${affinityCells(species.affinities)}
      <td class="lore">${escape(species.lore)}</td>
    </tr>`,
  ).join('');

  return `<div class="scroll"><table class="spoiler-table"><thead><tr>
    <th>Husk</th><th>Rank</th><th>Suit</th><th>HP</th>${elementHead}<th>Notes</th>
  </tr></thead><tbody>${rows}</tbody></table></div>`;
}

function skillTable(): string {
  const rows = ALL_SKILLS.map((skill) => {
    const effect =
      skill.kind === 'damage'
        ? `${skill.power} power${skill.aoe ? ', all enemies' : ''}`
        : skill.kind === 'heal'
          ? `${skill.power} healing${skill.party ? ', whole party' : ''}`
          : `${skill.stages > 0 ? '+' : ''}${skill.stages} ${skill.stat.toUpperCase()}`;

    return `<tr>
      <td class="name">${escape(skill.name)}</td>
      <td><span class="pill">${escape(ELEMENT_LABEL[skill.element])}</span></td>
      <td>${skill.cost === 0 ? 'free' : `${skill.cost} Focus`}</td>
      <td>${escape(effect)}</td>
      <td class="lore">${escape(skill.description)}</td>
    </tr>`;
  }).join('');

  return `<div class="scroll"><table><thead><tr>
    <th>Skill</th><th>Element</th><th>Cost</th><th>Effect</th><th>Notes</th>
  </tr></thead><tbody>${rows}</tbody></table></div>`;
}

function weaveTable(): string {
  const head = SUITS.map((suit) => `<th class="el">${escape(SUIT_LABEL[suit].slice(0, 4))}</th>`).join('');
  const rows = SUITS.map(
    (a) =>
      `<tr><td class="name">${escape(SUIT_LABEL[a])}</td>${SUITS.map(
        (b) => `<td class="a">${escape(SUIT_LABEL[weaveSuit(a, b)].slice(0, 4))}</td>`,
      ).join('')}</tr>`,
  ).join('');

  return `<div class="scroll"><table><thead><tr><th>Weave</th>${head}</tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

function progressionTable(): string {
  const rows = [1, 2, 3, 4, 5, 8, 10, 15, 20, 30]
    .map(
      (level) =>
        `<tr><td class="name">${level}</td><td>${xpToNext(level).toLocaleString('en')}</td><td>${echoCapacity(level)}</td></tr>`,
    )
    .join('');

  return `<div class="scroll"><table><thead><tr>
    <th>Level</th><th>XP to next</th><th>Echo slots</th>
  </tr></thead><tbody>${rows}</tbody></table></div>`;
}

function allyList(): string {
  return `<div class="suits">${ALL_ALLIES.map(
    (a) => `<div class="suit">
      <h3>${escape(a.name)} <span class="pill">${escape(a.role)}</span></h3>
      <p>Bound to ${escape(a.echoSpeciesId)} · found at level ${a.unlockLevel}</p>
      <p style="margin-top:6px">${escape(a.lore)}</p>
    </div>`,
  ).join('')}</div>`;
}

function suitGrid(): string {
  return `<div class="suits">${SUITS.map(
    (suit) => `<div class="suit"><h3>${escape(SUIT_LABEL[suit])}</h3><p>${escape(SUIT_BLURB[suit])}</p></div>`,
  ).join('')}</div>`;
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mooji · Compendium</title>
<meta name="description" content="Echoes, Husks, skills and weaving for Mooji, a turn-based RPG Discord bot.">
<style>${STYLE}</style>
</head>
<body>
<div class="wrap">
<header>
  <h1>Mooji · Compendium</h1>
  <p class="lede">Everything in the Rifts, generated from the same files the bot runs on.
  Strike a weakness to knock a Husk down and act again; down them all for an Onslaught.
  Your summoned Echo lends you its skills and its weaknesses both.</p>
  <nav>
    <a href="#echoes">Echoes</a>
    <a href="#husks">Husks</a>
    <a href="#skills">Skills</a>
    <a href="#weaving">Weaving</a>
    <a href="#suits">Suits</a>
    <a href="#allies">Allies</a>
    <a href="#progression">Progression</a>
  </nav>
</header>

<h2 id="echoes">Echoes</h2>
<input class="search" data-filters="#echo-table" placeholder="Filter Echoes by name, suit or affinity">
<div id="echo-table">${echoTable()}</div>

<h2 id="husks">Husks</h2>
<p class="note">Affinities are blurred on purpose. In play you learn them by attacking
something and watching what happens — an element you have never tried against a Husk shows
as <code>?</code> in your <code>/codex</code> until you do.</p>
<button class="toggle" id="spoilers" type="button" aria-pressed="false">Reveal Husk weaknesses (spoilers)</button>
<input class="search" data-filters="#husk-table" placeholder="Filter Husks by name, rank or suit">
<div id="husk-table">${huskTable()}</div>

<h2 id="skills">Skills</h2>
<input class="search" data-filters="#skill-table" placeholder="Filter skills by name or element">
<div id="skill-table">${skillTable()}</div>

<h2 id="weaving">Weaving</h2>
<p class="lede">Two Echoes are consumed and one comes back, one level above their average
and never above your own. The suit of the result is read off this table; it is symmetric,
so the order you pick them in makes no difference.</p>
${weaveTable()}

<h2 id="suits">Suits</h2>
${suitGrid()}

<h2 id="allies">Allies</h2>
<p class="lede">Each is bound to exactly one Echo, permanently. Only the Wanderer is Unbound.</p>
${allyList()}

<h2 id="progression">Progression</h2>
${progressionTable()}

<footer>
  Generated from <code>src/game/content</code>. Mooji is an original work; its mechanics are
  unprotected by copyright and its names, art and text are its own.
</footer>
</div>
<script>${SCRIPT}</script>
</body>
</html>
`;

await mkdir('public', { recursive: true });
await writeFile('public/index.html', html, 'utf8');
console.log(
  `Wrote public/index.html - ${ALL_ECHO_SPECIES.length} Echoes, ${ALL_HUSK_SPECIES.length} Husks, ${ALL_SKILLS.length} skills.`,
);
