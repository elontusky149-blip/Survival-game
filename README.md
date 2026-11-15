# Saltborne — Ocean Raft Survival

A third-person, open-world 3D ocean survival game that runs in the browser.
You start on four planks. Gather drifting debris, build a floating base,
sail between nine islands, dive wrecks, fight sharks and pirates, and
uncover why the sea will not rest.

No build step and no external assets: three.js is vendored in `lib/`, and
every texture, model and sound is generated in code.

## Run

ES modules need to be served over HTTP:

```
python3 -m http.server 8000
# open http://localhost:8000
```

Any static host works (GitHub Pages included).

## Controls

| | Desktop | Touch |
|---|---|---|
| Move / look | WASD / mouse | left side drag / right side drag |
| Use held item | left click | large action button |
| Interact | E | hand button (appears in reach) |
| Jump, swim up / dive | Space / C | arrows |
| Sprint | Shift | runner toggle |
| Hotbar | 1–8, wheel | tap slot |
| Inventory, craft, build, map, journal | Tab, F, B, M, J | top buttons |
| Rotate piece / remove mode | R / X | rotate button / Build menu |

## Layout

- `js/env.js` sky, day/night, weather, ocean shader
- `js/world.js` terrain, islands, resource nodes, points of interest
- `js/raft.js` grid building, devices, sailing physics
- `js/player.js` controller, survival stats, tools, building, interaction
- `js/creatures.js`, `js/entities.js` wildlife, sharks, pirates, ships, events
- `js/quests.js` six-stage progression, quests, journals, radio, ending
- `js/ui.js`, `js/input.js`, `js/audio.js` interface, controls, synthesised sound
- `js/items.js` items, recipes and build pieces

Progress saves automatically to the browser's local storage.
