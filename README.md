# Duvie

A cozy app for couples to organize schedules, track daily routines, reflect together, and work toward shared goals.

[Open Duvie](https://duvie.vercel.app/)

## Features

- **Planner** has Day, Week, and Month views for the shared schedule. Week shows the full week’s events. In Month, pick a date to see its agenda.
- **Goals** brings daily routine logging, individual and combined commitment, and goal milestones together.
- Weekly check-ins and an interactive otter companion.
- A responsive layout for phones and desktop browsers.

## Run locally

From the project directory, start a static web server.

```sh
python3 -m http.server 8000
```

Open [localhost:8000](http://localhost:8000/). No packages or build step are required.

For a framed phone preview, open [localhost:8000/preview.html](http://localhost:8000/preview.html).

## Project structure

- `index.html` contains the app shell and navigation.
- `style.css` defines the layout and appearance.
- `app.js` renders the screens and handles interactions.
- `preview.html` displays the app in a phone frame.

## Development status

Duvie is under active development. The local checkout is configured for Supabase. Both Duvie accounts are linked to the same shared space. A routine completion has been verified after sign-in and reload. Cross-device sync testing is pending. Earlier browser-only records stay on their original browser and site address until imported.

## Checks

```sh
node --check app.js
git diff --check
```
