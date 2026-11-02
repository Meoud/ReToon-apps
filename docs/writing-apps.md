# Writing an app

An app is a folder with a `manifest.json` and one JavaScript file. It draws
its own card on a page of the Toon's screen, and optionally a full screen
that opens when the card is tapped.

The quickest start is to copy [`example-app`](example-app) and change it.
Using an AI assistant? Point it at [`AGENTS.md`](../AGENTS.md), see
[Using AI](#using-ai) below.

## Where it runs

Apps run inside the Toon's screen program, in QuickJS (modern JavaScript,
ES2023). Each app has its own JavaScript runtime:

- 24 MB of memory, and at most 2 seconds for each call into the app.
- One file of code: there is no `import`, `require` or `export`, and no
  second file can be loaded.
- No browser: no DOM, no `window`, no `fetch`, no `localStorage`, no `Intl`.
  An app cannot reach files or start programs. It has only what is listed
  below.
- The Toon has one slow CPU core. Drawing costs real time, see
  [Drawing efficiently](#drawing-efficiently).

## The folder

```
my-app/
  manifest.json
  main.js
```

The folder name is the app's `id`: lower case letters, digits and `-`.

### manifest.json

```json
{
	"id": "my-app",
	"name": "My app",
	"version": "1.0.0",
	"api": 2,
	"main": "main.js",
	"description": "One or two sentences. Shown in the web interface, above the settings.",
	"author": "Your name",
	"tile": { "height": 150 },
	"settings": [
		{ "key": "entity", "label": "Temperature sensor", "type": "entity", "units": ["°C"] },
		{ "key": "title", "label": "Title", "type": "text", "default": "Outside" },
		{ "key": "warn", "label": "Warn above (°C)", "type": "number", "default": 25 },
		{ "key": "big", "label": "Big numbers", "type": "bool", "default": true }
	]
}
```

| Field | |
|---|---|
| `id` | The folder name |
| `name` | Shown in the web interface and above the full screen |
| `version` | `"1.2.3"`. Raise it with every change: the Toons offer an update when the catalogue's version is higher |
| `api` | The level of the interface the app needs, see [API levels](#api-levels) |
| `main` | The code file, in the folder |
| `description`, `author` | Shown in the web interface |
| `tile.height` | The card's height in screen pixels (60–520, default 150). A page can override it with `"height"` on the card |
| `settings` | What the user can set in the web interface, see below |

### Settings

The web interface makes a form from `settings`. The values are in
`retoon.settings`, by `key`: the saved value, or the `default`.

| `type` | Input | Value |
|---|---|---|
| `text` | A text field | string |
| `secret` | A password field, for tokens and keys | string |
| `number` | A number field | number |
| `bool` | A check box | `true` / `false` |
| `entity` | One entity, picked from Home Assistant | entity id, e.g. `"sensor.outside"` |
| `entities` | A list of entities, each with extra `fields` (`text`, `number` or `bool`); also `max` and `addLabel` | `[{ "entity": "...", <field keys> }]` |

`units` (with `entity` and `entities`) limits the picker to entities in those
units, e.g. `["W", "kW"]`. See `powerflow/manifest.json` for an `entities`
setting with fields.

## The code

A card showing one temperature:

```js
const S = () => retoon.settings;

function draw(el) {
	const st = retoon.state(S().entity);
	const v = st ? st.value : NaN;
	el.text(S().title, { x: 0, y: 0, color: "muted" });
	el.text(isFinite(v) ? v.toFixed(1) + " °C" : "-", {
		align: "center", font: S().big ? "big" : "mid",
		color: v > S().warn ? "bad" : "text" });
}

function follow() {
	retoon.watch([S().entity], () => retoon.update());
}

retoon.tile(draw);
retoon.onSettings(() => { follow(); retoon.update(); });
follow();
```

The file runs once when the screen starts. It registers draw functions and
starts timers; the screen calls the draw functions whenever the card has to
be drawn.

### retoon

| | |
|---|---|
| `retoon.tile(fn)` | `fn(el, card)` draws the card. `card` is the card's configuration from the page (`{ type, app, height, ... }`) |
| `retoon.screen(fn)` | `fn(el)` draws the full screen. Without it, tapping the card does nothing. The screen has the app's name and a Close button above the drawing area |
| `retoon.update()` | Draw the card(s) and the open full screen again, soon (not during this call) |
| `retoon.settings` | The settings: saved values over the manifest's defaults |
| `retoon.onSettings(fn)` | `fn()` is called after the user saved new settings; `retoon.settings` already has them |
| `retoon.watch(ids, fn)` | Keep these entities up to date: Home Assistant entities, `mqtt.*` and the Toon's own `toon.*`. `fn(id)` is called when the state of one changes. A new call replaces the list |
| `retoon.state(id)` | `{ state, value, unit, name, attributes }`, or `null` when unknown. `state` is the text, `value` the state as a number (`NaN` if it is not one), `unit` the unit or `null`, `name` the friendly name. Only entities in a `watch` list are kept up to date |
| `retoon.fetch(url, opts)` | http or https. `opts`: `method`, `headers` (object), `body` (string), `timeout` (seconds, 1–120, default 30), and for HTTP authentication `user`, `password` and `auth` (`"basic"`, `"digest"` or `"any"`, the default when a user is given). A Promise of `{ status, text, headers }` (`headers`: the answer's, names in lower case; level 4). It resolves for every HTTP status (check `status`) and rejects only when there was no answer. At most 4 MB |
| `retoon.notify(msg, fn)` | Show a message on the Toon: a banner at the top, or a popup in the middle (see [Notifications](#notifications)). `fn(button)` is called with the label of the tapped button, or with `null` when the message was closed without one. Returns `false` when `msg` is not an object |
| `retoon.sound(name, volume)` | Play `"beep"`, `"chime"` or a WAV file from the Toon's sound folder. `volume` 0–100 is optional (default: the Toon's sound setting) |
| `retoon.publish(topic, payload, opts)` | Send an MQTT message on the Toon's own broker (see [MQTT](#mqtt-on-the-toon)). `payload`: a string, or anything else as JSON; `opts`: `{ retain }`. Returns `false` when the broker cannot be reached. Level 5 |
| `retoon.subscribe(pattern, fn)` | `fn(topic, payload)` for every message on a topic that matches (`+` and `#` as in MQTT); `payload` is a string. Kept (retained) messages arrive right away. A second call with the same pattern replaces `fn`; at most 32 per app. Level 5 |
| `retoon.unsubscribe(pattern)` | Stop that subscription. Level 5 |
| `retoon.app` | `{ id, name, version }` |
| `retoon.log(...)`, `console.log(...)` | Print to the screen program's output, see [trying-an-app.md](trying-an-app.md) |
| `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval` | As in a browser |

### MQTT on the Toon

Every ReToon from 1.20 on has its own MQTT broker. The Toon puts its state
there, each as one JSON object, kept (retained) so a new subscriber gets it
at once:

| Topic | What |
|---|---|
| `retoon/climate` | `temperature`, `humidity`, `illuminance` |
| `retoon/voc` | the air-quality sensor: `index`, `quality` (`good`, `fair`, `moderate`, `poor`) and more (Toon 2) |
| `retoon/boiler` | the thermostat and boiler: `hvac` (`heat`/`off`), `target`, `room`, `preset`, `heat` (1 while heating), `link`, `message` and more |
| `retoon/display` | `{ "on": true, "brightness": 80 }` |
| `retoon/notify/event` | a tap on a message on the screen |

and takes commands:

| Topic | Payload |
|---|---|
| `retoon/boiler/set` | `"target 20.5"`, `"hvac heat"`, `"hvac off"`, `"preset comfort"` (`home`, `sleep`, `away`), `"program resume"` |
| `retoon/display/set` | `"ON"`, `"OFF"` or a brightness 0–100 |
| `retoon/notify/set` | the JSON of `retoon.notify` |
| `retoon/ui/set` | `"view 2"` (show that page) or `"wake"` |

For data of its own an app uses topics under `app/<its id>/`, for example
to share a value with another app. When the user opened the broker to the
network, devices and scripts can use the same topics. Only command the
thermostat when that is what the user set the app up for.

```js
let room = null;
retoon.subscribe("retoon/boiler", (topic, payload) => {
	room = JSON.parse(payload).room;
	retoon.update();
});
retoon.tile(el => {
	el.text(room === null ? "-" : room.toFixed(1) + " °C", { font: "mid" });
	// a button that sets the thermostat
	el.button("21 °C", { x: 0, y: 60 }, () => retoon.publish("retoon/boiler/set", "target 21"));
});
```

A retained message lasts until the Toon restarts. An app also receives the
messages it sends itself when it subscribed to their topic.

### Notifications

`retoon.notify` takes the same message as Home Assistant sends to the Toon:

```js
retoon.notify({ title: "Cheap hour", message: "Electricity is cheapest from 14:00.",
	icon: "mdi:flash", tag: "cheap" });

retoon.notify({ title: "Bin day", message: "Put the green bin out tonight.",
	level: "warning", buttons: ["Done", "Remind me later"], tag: "bins" },
	button => retoon.log("answer: " + button));	// "Done", "Remind me later" or null
```

| Field | |
|---|---|
| `title`, `message` | The text; a message alone is fine |
| `level` | `"info"` (default), `"warning"` or `"alert"`: colour, icon and default sound |
| `icon` | An `mdi:` icon instead of the one for the level |
| `style` | `"banner"` or `"popup"`. Default: a popup for an alert, with buttons or with `timeout` 0, a banner otherwise |
| `timeout` | Seconds until it goes by itself, 0 = until tapped. Default 10 for a banner, 0 for a popup |
| `buttons` | Up to three labels (popup only) |
| `sound` | `"none"`, `"beep"`, `"chime"`, `"alarm"` (repeats while the popup is open) or a WAV file name. Default: none for info, beep for a warning, chime for an alert |
| `volume` | 0–100 |
| `tag` | A new message with the same tag replaces the old one; `{ tag: "bins", dismiss: true }` takes it away |
| `wake` | `false`: a dimmed screen stays dimmed |

A banner that is tapped opens as a popup. Use a `tag` for anything that can
come again, so the Toon shows the newest one instead of a pile, and keep
sounds for what really needs attention: the Toon hangs on a wall in
someone's living room.

### Drawing

A draw function gets `el`, an empty area. Everything drawn on it, or on
anything drawn on it, is an `el` again, so you can draw inside a box.
Positions are in pixels of the screen as if it is 1024 wide; on a Toon 1
(800 wide) everything is scaled. `(0, 0)` is the top left of the area.

| | |
|---|---|
| `el.width`, `el.height` | The size of the area. A card's area is the card minus 12 px padding; the full screen's area is about 990 × 520 |
| `el.box(opts)` | A rectangle, for backgrounds, bars and groups |
| `el.text(string, opts)` | Text. `font`, `textAlign` (`left`, `center`, `right`; needs `w`) |
| `el.button(label, opts, fn)` | A button, 48 px high; `fn()` on a tap |
| `el.icon("mdi:name", opts)` | A [Material Design icon](https://pictogrammers.com/library/mdi/); `size`: `small` (26 px), `mid` (32), `big` (48) |
| `el.circle(opts)` | `x`, `y` are the centre, `r` the radius |
| `el.line([x1, y1, x2, y2, ...], opts)` | A line through these points (at least two); `width` (default 2), `color`, `opacity` |
| `el.flow(opts)` | Dots moving from `x1, y1` to `x2, y2` by themselves; `speed` in pixels a second (below 0 the other way, 0 still), `gap` (30), `size` (8), `color` |
| `el.time(opts, fn)` | A time picker: an hour wheel and a minute wheel the user scrolls. `value` (`"HH:MM"`), `step` (minutes between the minute wheel's entries, a divisor of 60, default 1), `rows` (visible rows, 1–7, default 3), `font`. `fn("HH:MM")` is called after the user turns a wheel |
| `el.onClick(fn)` | `fn()` when it is tapped |
| `el.set(opts)` | Change something already drawn: its options, a text's `text`, a flow's `speed` or `color`, a time picker's `value` (without calling its `fn`) |

Options:

| | |
|---|---|
| `x`, `y` | The position. With `align`, the offset from that spot |
| `w`, `h` | The size; without it, a text or icon is as large as it needs |
| `align` | `top-left`, `top-mid`, `top-right`, `left-mid`, `center`, `right-mid`, `bottom-left`, `bottom-mid`, `bottom-right`, within the parent |
| `color` | Text, icon and line colour |
| `bg` | Background colour |
| `opacity` | 0–1 |
| `radius`, `border`, `borderColor` | Rounded corners, a border |
| `font` | `small` (16 px), `body` (19, the default), `head` (22, semibold), `mid` (34), `big` (78, light) |

Colours are `"#rrggbb"` or a theme name: `text`, `muted`, `accent`, `ok`,
`warn`, `bad`, `card`, `background`. The theme names follow the Toon's
colours, so use them where you can.

The font has Latin, Greek and Cyrillic letters and the usual symbols
(`°`, `€`, `–`, `…`), but no emoji.

### Drawing efficiently

`retoon.update()` throws away everything drawn before and calls the draw
functions again. That is fine every few seconds. For something that changes
several times a second, keep the element and change it with `el.set`:

```js
let clock = null;	// the text element of the last drawing

function tick() {
	if (clock) clock.set({ text: new Date().toTimeString().slice(0, 8) });
}
retoon.tile(el => {
	clock = el.text("", { align: "center", font: "mid" });
	tick();
});
setInterval(tick, 1000);
```

Other tips:

- Fetch in the background (on a timer) and keep the result in a variable;
  draw from that variable. Never fetch inside a draw function.
- Call `retoon.update()` once after a change, not once per value.
- Keep drawings small: a few dozen elements, not hundreds. For a bar graph,
  one `el.box` per bar is fine.

### Errors

When the code throws while starting or drawing, the card shows the error
instead. A failing fetch rejects its Promise: catch it, and draw a message
from a variable.

## API levels

The manifest's `api` is the lowest level of this interface the app needs. A
ReToon with a lower level does not offer the app for installing, and does not
start it.

| Level | Added |
|---|---|
| 1 | `retoon.tile`, `screen`, `update`, `settings`, `onSettings`, `fetch`, `app`, `log`, timers; `el.box`, `text`, `button`, `onClick`, `width`, `height` |
| 2 | `retoon.watch`, `retoon.state`; `el.icon`, `el.circle`, `el.line`, `el.flow`, `el.set` |
| 3 | `retoon.notify`, `retoon.sound` (ReToon 1.15 and later) |
| 4 | `retoon.fetch` with `user`/`password`/`auth` and an answer `headers`; `el.time` (ReToon 1.19 and later) |
| 5 | `retoon.publish`, `retoon.subscribe`, `retoon.unsubscribe`: MQTT on the Toon's own broker (ReToon 1.20 and later) |

## Trying it, and publishing it

Put the app on your own Toon over SSH while you work on it:
[trying-an-app.md](trying-an-app.md). When it works, add it to the catalogue
with a pull request, see the [README](../README.md#adding-your-app).

## Using AI

[`AGENTS.md`](../AGENTS.md) in the root of this repository is written for AI
coding assistants: the complete interface, the rules, and a checklist.
Assistants that work in a copy of this repository (Claude Code, Codex,
Cursor, Copilot and others) read it by themselves. With a chat assistant,
attach or paste `AGENTS.md` and describe your app, for example:

> Write a ReToon app that shows the next three departures from my bus stop
> on the card, using this API: ... Follow AGENTS.md.

Then try the result on your Toon with [trying-an-app.md](trying-an-app.md),
and give the assistant whatever the card shows when something is wrong.
