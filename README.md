# Alchemy

A discovery-based crafting game in the style of Little Alchemy. Drag pairs of elements together on the workspace to discover new ones. Water + Water = Wave. Wave + Wave = Tsunami. Hundreds of combinations form a tree of discovery, themed as a dark alchemist's laboratory.

## Running locally

No build step. Serve the folder over HTTP (browsers block `fetch()` against `file://`):

```powershell
python -m http.server 8000
```

Then visit <http://localhost:8000>.

To test on a phone, find your laptop's LAN IP and visit `http://<that-ip>:8000` from the phone on the same Wi-Fi.

## Project layout

```
alchemy/
├── index.html
├── css/
│   ├── main.css         — theme, typography, layout
│   ├── workspace.css    — drag canvas, sidebar, tile styling
│   └── icons.css        — procedural CSS-shape icons per category
├── js/
│   ├── main.js          — bootstrap
│   ├── state.js         — discovered set + persistence
│   ├── storage.js       — localStorage wrapper
│   ├── recipes.js       — recipe index + lookup
│   ├── icons.js         — buildIcon(element)
│   ├── sidebar.js       — library UI (search, filter, list)
│   └── workspace.js     — drag/drop, combining, sparks
└── data/
    ├── elements.json    — all elements (id, name, category, tint, base?)
    └── recipes.json     — combination rules (a + b → result)
```

## Adding elements & recipes

Edit `data/elements.json` and `data/recipes.json`. Both are loaded fresh on every page load, so no rebuild. Slugs (`id` fields) are forever — once a save exists in someone's browser referencing a slug, you can't rename it without orphaning their unlocks.

Categories drive the icon shape: `liquid`, `fire`, `earth`, `air`, `plant`, `animal`, `tool`, `structure`, `mineral`, `mythic`, `time`, `abstract`.

## License

Code: TBD. Recipe data is hand-curated for this project.
