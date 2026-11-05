# ReToon apps

Apps for ReToon, the open system for the Eneco/Quby Toon. An app is a small
JavaScript program that draws its own card on a page of the Toon's screen,
and optionally a full screen that opens when the card is tapped.

| App | What it does |
|---|---|
| [spotenergy](spotenergy) | Dynamic electricity prices for the Netherlands, with taxes, as a card and a full-screen graph |
| [powerflow](powerflow) | Where the power in your home comes from and goes to, with moving dots |
| [trash-calendar](trash-calendar) | Next trash pickups from an ICS calendar, with a reminder the evening before |

## Installing an app

In the Toon's web interface, open **Apps**. Under **Available**, press
**Install**. The app's settings then appear with the installed apps, and an
**Update** button appears when a newer version is published here.

To show the app, add an **App** card to a page.

## Making your own

| | |
|---|---|
| [docs/writing-apps.md](docs/writing-apps.md) | How an app works, and everything it can use |
| [docs/example-app](docs/example-app) | A small working app to copy and change |
| [docs/trying-an-app.md](docs/trying-an-app.md) | Putting your app on your own Toon before it is published |
| [AGENTS.md](AGENTS.md) | The same, written for AI assistants: give it to yours and describe the app you want |

## Adding your app

Open a pull request that adds your app's folder at the top level, or changes
it.

- One folder per app, named after its `id`.
- Raise `version` with every change; the Toons offer an update when the
  version here is higher than the installed one.
- Set `api` to the lowest level your app needs.
- Try it on a Toon first ([docs/trying-an-app.md](docs/trying-an-app.md)).

Every pull request is read before it is merged. An app can read your Home
Assistant states and send data to the internet, so every change is checked.
The automatic check runs `node --check` on the code and
`tools/build-index.py` on all apps.

When a change reaches `main`, every app is packed as `<id>-<version>.tar.gz`
and published, with `index.json` and `index.txt`, in the release
[`apps`](../../releases/tag/apps). That release is what the Toons read.

## Licence

Each app carries its own licence; without one, GPL-2.0-or-later.
