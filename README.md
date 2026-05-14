# Alchemy — The Circle of Binding

A discovery-based crafting game themed as a dark alchemist's working circle.
Drag elements into sigil slots, watch burning ley-lines race around the
crucible, and forge new elements whose true names burn across the board.

A Pizza Hero Gaming project.

## Play

No build step. Serve the folder over HTTP:

```powershell
python -m http.server 8000
```

Then visit <http://localhost:8000>. To play on a phone, find your laptop's
LAN IP and visit `http://<that-ip>:8000` from the phone on the same Wi-Fi
(the game locks to landscape on mobile).

You can also install the page as a PWA — Chrome's "Install app" or Safari's
"Add to Home Screen". It launches fullscreen in landscape with the alembic
icon.

## How it works

You begin as an **Initiate** with the four primal elements — Water, Fire,
Earth, Air — and a **Vesica Piscis** circle holding two slots. Drag elements
from the library into the slots. When every slot is filled, the brew fires:

- Burning ley-lines race from each slot to the crucible at the centre, then
  clockwise around its perimeter to meet on the far side.
- The crucible erupts in gold sparks.
- The result rises from the crucible, hovers, and settles.
- Its **true name** burns across the top of the board, Ring-of-Power style.
- Four pillars of light fire back out from the crucible along each filled
  slot's axis — energy returning to its source.

If the combination isn't a valid recipe, the brew fizzles instead: smoke
billows, dark embers spit outward, the slots shake red, and the board jolts.

## Rank progression — eight tiers, four sigils

| Rank | Slots | Sigil | %  |
|---|---|---|---|
| Initiate    | 2 | **Vesica Piscis** — twin overlapping circles    | 0%   |
| Apprentice  | 2 | Vesica Piscis                                   | 5%   |
| Adept       | 3 | **Triquetra** — trinity arms + inscribed triangle | 15% |
| Scholar     | 3 | Triquetra                                       | 30%  |
| Mystic      | 4 | **Squaring of the Circle** — diamond + triangle + ring | 50% |
| Sage        | 4 | Squaring of the Circle                          | 70%  |
| Archmage    | 5 | **Pentacle** — pentagram in a circle            | 90%  |
| Demiurge    | 5 | Pentacle                                        | 100% |

Each time you cross a tier that widens the circle, a cutscene plays — gold
rays sweep in, the new slot reveals itself, and a brief tutorial explains
the new mechanics.

Each rank tier also re-themes the workspace background — chiseled stone for
Initiate, parchment for Apprentice, aged grimoire for Adept, burgundy library
for Scholar, celestial chart for Mystic, summoning circle for Sage, cosmic
nebula for Archmage, and forge-of-creation gold for Demiurge.

## Brewing pairs at higher ranks

When your circle holds three or more slots but you only want a 2-element
combination, fill any two slots and **tap the crucible** to fire the brew.
The crucible pulses gold when it's ready. Only the filled slots' channels
ignite.

## Miracle recipes

In addition to the **159 pair recipes**, there are **28 hand-authored
"miracle" recipes** that take 3, 4, or 5 specific ingredients at once:

- **Triplets** (Adept+): water + earth + fire = primordial, moon + sun + star
  = cosmos, knowledge + idea + time = wisdom, human + sword + magic = knight,
  human + wolf + moon = werewolf, dragon + fire + soul = phoenix, and many more.
- **Quartets** (Mystic+): water + fire + earth + air = aether, love + dream
  + idea + magic = inspiration, gold + diamond + magic + crystal =
  philosopher's stone, …
- **Quintet** (Archmage): water + earth + fire + air + life = **eden**.

Multi-input miracles are checked *before* sequential pair fallback, so the
miracle path always wins when its ingredients are all in the slots.

## The Tree of Forging

Press the **Tree** button in the topbar to open a tiered map of every
element you've discovered, organised by BFS-depth from the four primal
seeds. Click any node to drill into its **lineage** — what made it, and
what it makes — with clickable chips to traverse the recipe graph.

You can also click any tile in your library to open its lineage directly.

## Other features

- **Save / load** — 5 named slots plus an auto-save. Export to clipboard /
  import from text for backups or sharing runs.
- **Settings** — library position (left or right), library width, tile size.
- **Seasonal sigils** — workspace gains decorative accents during All
  Hallows, Long Night (winter solstice), Verdant Hour (spring), and Solar
  Apex (summer solstice). Gameplay is unchanged; only atmosphere shifts.
- **First-run + Adept tutorials** — a light walkthrough on first launch,
  and a short lesson when the circle widens to three slots.
- **Migration** — saves from the pre-Circle (free-form workspace) era are
  no longer compatible. A one-time apology modal explains the change and
  wipes the old data.

## Project layout

```
alchemy/
├── index.html
├── manifest.json                — PWA manifest, landscape orientation
├── assets/icons/icon.svg        — installable app icon (gold alembic)
├── css/
│   ├── main.css                 — theme, typography, layout, modals
│   ├── workspace.css            — library + workspace shell
│   ├── icons.css                — procedural CSS-shape icons per category
│   ├── circle.css               — slots, channels, crucible, success/fail FX
│   ├── themes.css               — rank-tier board themes, rank-up banner
│   ├── seasons.css              — seasonal decoration overlays
│   ├── lineage.css              — lineage panel + tree-of-forging
│   └── splash.css               — Pizza Hero Gaming bumper
├── js/
│   ├── main.js                  — bootstrap, migration, board-offset, modals
│   ├── state.js                 — discovered set + persistence
│   ├── storage.js               — localStorage wrapper, versioned
│   ├── recipes.js               — pair-recipe index + lookup
│   ├── multi_recipes.js         — multi-input miracle lookup
│   ├── ranks.js                 — 8 rank tiers + theme metadata
│   ├── icons.js                 — buildIcon(element)
│   ├── progress.js              — rank/percent topbar + theme application
│   ├── circle.js                — Circle of Binding: slots, channels,
│   │                              brew, success/failure animations, sigils,
│   │                              slot-unlock cutscene
│   ├── workspace.js             — library drag-to-slot, reset modal
│   ├── sidebar.js               — library list, search, filter, tap-to-lineage
│   ├── saves.js                 — manual save slots + export/import
│   ├── settings.js              — UI preference persistence
│   ├── lineage.js               — element-lineage panel
│   ├── graph.js                 — Tree of Forging tier view
│   ├── seasons.js               — seasonal-theme detection
│   ├── tutorial.js              — first-run + Adept tutorials
│   ├── splash.js                — Pizza Hero Gaming bumper module
│   └── ...
└── data/
    ├── elements.json            — every element (id, name, category, tint, base?)
    ├── recipes.json             — pair recipes (a + b → result)
    └── multi_recipes.json       — 3/4/5-input miracle recipes
```

The `data/*.json` files are the source of truth. The matching `data/*.js`
files are regenerated wrappers (`window.ELEMENTS_DATA = …`) that the page
loads via `<script>` tags so the game works from `file://` too. To rebuild
them after editing JSON:

```powershell
node -e "const fs=require('fs');
for (const n of ['elements','recipes','multi_recipes']) {
  const k = n === 'elements' ? 'ELEMENTS_DATA' :
            n === 'recipes'  ? 'RECIPES_DATA'  : 'MULTI_RECIPES_DATA';
  fs.writeFileSync('data/'+n+'.js', 'window.'+k+' = '+fs.readFileSync('data/'+n+'.json','utf8')+';\n');
}"
```

## Authoring rules

- **Slugs are forever.** Once an element ships, never rename its `id` —
  doing so orphans every existing save.
- **One producer per element.** The dataset is audited to keep exactly one
  recipe creating each non-base element (no orphans, no multi-producers,
  no canonical-pair conflicts, no self-replication).
- **Reachability** from the four bases is verified by BFS — every element
  must be makeable from `water / fire / earth / air` through the recipe
  graph.

Categories drive the icon shape: `liquid, fire, earth, air, plant, animal,
tool, structure, mineral, mythic, time, abstract`.

## Stats at a glance

- **190 elements** (4 base + 186 discoverable)
- **159 pair recipes** + **28 miracle recipes** = **187 paths**
- **4 alchemical sigils** tied to rank progression
- **8 rank tiers** with themed boards
- 100% reachable from a fresh save

## License

Code: TBD. Recipe data is hand-curated for this project.

🎮 A **Pizza Hero Gaming** project · ◆ PHG · MMXXVI
