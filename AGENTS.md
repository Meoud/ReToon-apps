# Instructions for AI assistants: writing a ReToon app

You are helping someone write an app for ReToon, an open system for the
Eneco/Quby Toon thermostat display. An app draws a card on a page of the
Toon's touch screen (1024 × 600 on a Toon 2, 800 × 480 on a Toon 1), and
optionally a full screen that opens when the card is tapped. This file is
the complete interface. Do not use anything that is not in it: it will not
exist on the Toon.

The longer guide for people is [docs/writing-apps.md](docs/writing-apps.md).
A complete working app to start from is [docs/example-app](docs/example-app).
Two real apps: [spotenergy](spotenergy) (fetches prices, draws a bar graph)
and [powerflow](powerflow) (Home Assistant entities, moving dots).

## Hard rules

1. An app is one folder, `<id>/`, with `manifest.json` and one JavaScript
   file (`main.js`). The folder name equals `"id"`: `[a-z0-9-]`, starting
   with a letter or digit, at most 47 characters.
2. The JavaScript is a plain script run by QuickJS (ES2023). **No `import`,
   `export` or `require`; no second file; no npm packages.** Put everything
   in the one file.
3. **No browser or Node APIs.** There is no DOM, `document`, `window`,
   `fetch`, `XMLHttpRequest`, `WebSocket`, `localStorage`, `Buffer`,
   `process`, `fs`, `Intl`, `TextEncoder`, `atob`/`btoa`, `requestAnimationFrame`
   or canvas. Use only `retoon.*`, the `el` drawing functions below, the
   timers, and standard JavaScript (`JSON`, `Math`, `Date`, `Array`,
   `String`, `RegExp`, `Map`, `Set`, `Promise`, `async`/`await`).
4. Every call into the app (start, a draw function, a callback) must finish
   within **2 seconds**; memory is limited to **24 MB**. Never loop waiting
   for something; use `await` or a timer.
5. **Never fetch inside a draw function.** Fetch on a timer, keep the result
   in a variable, call `retoon.update()`, and draw from the variable.
6. Draw functions must work with no data yet (show "Loading…" or "-") and
   with missing settings (tell the user what to set under Apps in the web
   interface). `retoon.state()` returns `null` for an unknown entity.
7. No state survives a restart of the screen. There is no storage; settings
   are only written by the web interface. (A retained MQTT message, level 5,
   lasts until the Toon restarts.)
8. Text has no emoji: the font has letters and common symbols only. Icons
   come from `el.icon("mdi:...")`.
9. Raise `"version"` with every change. Set `"api"` to the lowest level that
   has every function the app uses (see the API levels table).

## manifest.json

```json
{
	"id": "bus-times",
	"name": "Bus times",
	"version": "1.0.0",
	"api": 2,
	"main": "main.js",
	"description": "The next departures from your stop.",
	"author": "Your name",
	"tile": { "height": 150 },
	"settings": [
		{ "key": "stop", "label": "Stop code", "type": "text", "default": "" },
		{ "key": "apiKey", "label": "API key", "type": "secret", "default": "" },
		{ "key": "count", "label": "Departures to show", "type": "number", "default": 3 },
		{ "key": "showLine", "label": "Show the line number", "type": "bool", "default": true },
		{ "key": "sensor", "label": "Outside temperature", "type": "entity", "units": ["°C"] }
	]
}
```

Required: `id`, `name`, `version` (`"x.y.z"`), `api` (whole number),
`main`, `description`, `author`. Optional: `tile.height` (card height in
pixels, 60–520, default 150), `settings`.

Setting types: `text`, `secret` (password field), `number`, `bool`,
`entity` (picks one Home Assistant entity id; `units` filters the list),
`entities` (a list of rows `{ entity, ...fields }`; takes `fields` with types
`text`/`number`/`bool`, `max`, `addLabel`, `units`). Every setting has
`key` and `label`; give a `default`.

## The interface

### retoon

```
retoon.tile(fn)            fn(el, card): draw the card. card = the card's JSON from the page
retoon.screen(fn)          fn(el): draw the full screen (optional; without it a tap does nothing)
retoon.update()            redraw the card(s) and the open full screen, soon (async)
retoon.settings            object: saved settings over the manifest's defaults, by key
retoon.onSettings(fn)      fn(): the user saved new settings (retoon.settings has them)
retoon.watch(ids, fn)      follow these entity ids; fn(id) on each state change; replaces the old list
retoon.state(id)           { state, value, unit, name, attributes } | null
                           state: string; value: number or NaN; unit: string | null;
                           name: friendly name; attributes: object (as in Home Assistant)
retoon.fetch(url, opts)    Promise<{ status, text, headers }>; opts: { method, headers,
                           body, timeout, user, password, auth }
                           http/https; body is a string; timeout in s (1-120, default 30);
                           user/password do HTTP authentication, auth is "basic", "digest" or
                           "any" (the default when a user is given); the answer's headers are in
                           headers with names in lower case (both level 4);
                           resolves for every HTTP status, rejects only without an answer;
                           text only (no binary), at most 4 MB
retoon.notify(msg, fn)     banner at the top or popup in the middle; msg: { title, message,
                           level: "info"|"warning"|"alert", icon: "mdi:x", style: "banner"|"popup",
                           timeout: s (0 = until tapped), buttons: [up to 3 labels], sound:
                           "none"|"beep"|"chime"|"alarm"|wav name, volume: 0-100, tag, dismiss,
                           wake }; fn(label) after a button, fn(null) when closed without one.
                           Same tag = replaces the old message. Returns false if msg is no object
retoon.sound(name, volume) "beep" | "chime" | wav name; volume 0-100 optional
retoon.publish(topic, payload, opts)
                           MQTT message on the Toon's own broker (level 5); payload a
                           string, or anything else as JSON; opts: { retain }; null
                           payload with retain removes a kept message; no + or # in
                           the topic; returns false if the broker cannot be reached
retoon.subscribe(pattern, fn)
                           fn(topic, payload) for every message on a matching topic
                           (+ and # wildcards; payload is a string, JSON.parse it
                           yourself); kept (retained) messages arrive right away;
                           again with the same pattern replaces fn; at most 32 (level 5)
retoon.unsubscribe(pattern)
retoon.app                 { id, name, version }
retoon.log(...args)        log line "app <id>: ..." (console.log is the same)
setTimeout, setInterval, clearTimeout, clearInterval
```

Entity ids: any Home Assistant entity (`sensor.x`, `light.y`, ...), MQTT
values as `mqtt.<name>`, and the Toon's own entities, which work without
Home Assistant: `toon.temperature`, `toon.humidity`, `toon.illuminance`,
`toon.air_quality`, `toon.thermostat`, `toon.boiler_connection`,
`toon.boiler_water`, `toon.return_water`, `toon.flow_setpoint`,
`toon.hot_water_setpoint`, `toon.max_heating_setpoint`, `toon.modulation`,
`toon.water_pressure`, `toon.fault_code`, `toon.boiler_fault`,
`toon.boiler_message`, `toon.flame`, `toon.heat_request`, `toon.display`,
`toon.wifi`. Apps can read
states but cannot call Home Assistant services. `retoon.state` of an entity
that is not in a `watch` list may be missing or stale: watch what you show.

The Toon's own MQTT broker (level 5) carries the Toon's state as retained
JSON: `retoon/climate`, `retoon/voc`, `retoon/boiler` (fields such as
`hvac`, `target`, `room`, `preset`, `heat`), `retoon/display`; and takes
commands: `retoon/boiler/set` with `"target 20.5"`, `"hvac heat"`,
`"hvac off"`, `"preset comfort"` (`home`, `sleep`, `away`) or
`"program resume"`; `retoon/display/set` with `"ON"`, `"OFF"` or 0-100;
`retoon/notify/set` with the JSON of `retoon.notify`; `retoon/ui/set` with
`"view 2"` or `"wake"`. For data of its own, an app uses topics under
`app/<its id>/`. Devices on the network can use the same broker when the
user opened it to the network. Only command the thermostat when that is what
the user set the app up to do.

### Drawing

A draw function gets `el`, an empty area. Every function below returns a new
`el` for what it drew, so you can draw inside a box. Coordinates are pixels
of a 1024-wide screen; the Toon scales them. `(0, 0)` is the area's top
left. Everything drawn before is removed when the app is drawn again.

```
el.width, el.height                  size of the area (card: card minus 12 px padding;
                                     full screen: about 990 x 520)
el.box(opts)                         rectangle
el.text(string, opts)                text; opts.font, opts.textAlign ("left"|"center"|"right", needs w)
el.button(label, opts, fn)           button, 48 high; fn() on tap
el.icon("mdi:name", opts)            Material Design icon; opts.size "small"(26) | "mid"(32) | "big"(48)
el.circle(opts)                      opts.x, opts.y = centre, opts.r = radius
el.line([x1, y1, x2, y2, ...], opts) polyline, at least 2 points (4 numbers); opts.width (2)
el.flow(opts)                        dots moving x1,y1 -> x2,y2 by themselves; opts.speed px/s
                                     (negative: the other way, 0: still), gap (30), size (8)
el.time(opts, fn)                    time picker (hour + minute wheels); opts.value "HH:MM",
                                     step (minutes, a divisor of 60; default 1), rows (1-7,
                                     default 3), font; fn("HH:MM") after a wheel is turned
el.onClick(fn)                       fn() when tapped
el.set(opts)                         change in place: any option, a text's { text },
                                     a flow's { speed, color }, a time picker's { value }
                                     (no fn call); cheap, no redraw of the rest
```

Options: `x`, `y`, `w`, `h`; `align` (`top-left`, `top-mid`, `top-right`,
`left-mid`, `center`, `right-mid`, `bottom-left`, `bottom-mid`,
`bottom-right`; then `x`, `y` are an offset); `color` (text, icon, line);
`bg` (fill); `opacity` (0–1); `radius`; `border` (width); `borderColor`;
`font`: `small` (16 px), `body` (19, default), `head` (22, semibold), `mid`
(34), `big` (78, light).

Colours: `"#rrggbb"`, or better a theme name: `text`, `muted`, `accent`,
`ok`, `warn`, `bad`, `card`, `background`. The screen background is black;
cards are dark grey (`card`).

### API levels (the manifest's "api")

- 1: `retoon.tile`, `screen`, `update`, `settings`, `onSettings`, `fetch`,
  `app`, `log`, timers; `el.box`, `text`, `button`, `onClick`, `width`,
  `height`.
- 2: adds `retoon.watch`, `retoon.state`, `el.icon`, `el.circle`, `el.line`,
  `el.flow`, `el.set`.
- 3 (ReToon 1.15): adds `retoon.notify`, `retoon.sound`. Use a `tag` for
  messages that can repeat, and sounds only for what needs attention.
- 4 (ReToon 1.19): `retoon.fetch` gains `user`, `password` and `auth` for HTTP
  authentication (basic/digest), and returns the answer's `headers`; `el.time`
  adds a time picker.
- 5 (ReToon 1.20): `retoon.publish`, `retoon.subscribe`, `retoon.unsubscribe`
  (MQTT on the Toon's own broker).

## The shape of an app

```js
// <What the app does, in a sentence or two.>

const S = () => retoon.settings;

let data = null;	// the last good result
let error = "";		// why the last fetch failed

async function load() {
	if (!S().stop) { error = "Set the stop code under Apps in the web interface"; retoon.update(); return; }
	try {
		const r = await retoon.fetch("https://example.org/api?stop=" + encodeURIComponent(S().stop), { timeout: 30 });
		if (r.status !== 200) throw new Error("HTTP " + r.status);
		data = JSON.parse(r.text);
		error = "";
	} catch (e) {
		error = "Could not load: " + e.message;
		retoon.log(error);
	}
	retoon.update();
}

function drawTile(el) {
	if (!data) {
		el.text(error || "Loading…", { align: "center", color: error ? "bad" : "muted" });
		return;
	}
	el.text("...", { x: 0, y: 0, font: "head" });
}

retoon.tile(drawTile);
retoon.onSettings(() => load());
load();
setInterval(load, 5 * 60 * 1000);
```

For an app that shows entities instead: call `retoon.watch([...ids],
() => retoon.update())` at start and again in `onSettings`, and read
`retoon.state(id)` in the draw function.

## Layout hints

- The default card is about 490 × 150 in a two-column page (area about
  466 × 126). Design for `el.width`/`el.height`, not fixed sizes, because
  cards can be full width or taller.
- One clear value on the card, details on the full screen. Big numbers use
  `font: "mid"` or `"big"`; labels `muted`.
- Leave about 8–12 px between elements. Touch targets at least 48 px.
- For bars or graphs, compute positions from `el.width`/`el.height`.
- Avoid hundreds of elements; one `el.line` with many points is cheaper than
  many lines. Things that change often: `el.set`, not `retoon.update()`.

## Check before you hand it over

- [ ] Folder name = `id`; `version` raised; `api` matches the functions used.
- [ ] No `import`/`require`/`fetch(`/`document`/`window`/`localStorage` in the code.
- [ ] `python3 tools/build-index.py --check <folder>` prints `ok`.
- [ ] `node --check <folder>/main.js` passes (if node is available).
- [ ] Works without settings filled in and before data arrives.
- [ ] Fetches are on a timer, not in draw functions; errors are shown on the card.
- [ ] `onSettings` reloads or redraws.

## Trying it on a Toon

If you can run commands and the user gives you the Toon's address and SSH
access (user `root`), install it with:

```sh
tools/push-app.sh <toon address> <app folder>
```

Otherwise give the user that command, or the manual steps in
[docs/trying-an-app.md](docs/trying-an-app.md). Then the user adds an App
card to a page in the web interface. If the card shows an error, ask the
user for its text and fix the code. To see `retoon.log` output, the screen
program has to run by hand, see that same file.

## Publishing

When it works, the app goes into the catalogue by a pull request that adds
its folder at the top level of this repository (see [README.md](README.md)).
