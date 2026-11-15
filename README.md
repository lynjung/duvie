# Duvie

A cozy app for couples to organize schedules, track daily routines, reflect together, and work toward shared goals.

[Open Duvie](https://duvie.vercel.app/)

## Features

- **Planner** has Day, Week, and Month views for the shared schedule. Week shows the full week’s events. In Month, pick a date to see its agenda.
- **Goals** brings daily routine logging, individual and combined commitment, and goal milestones together.
- **Profile** shows the two linked accounts and their profile photos. Use the gear to open Settings. Manual sync lives under **Settings → Troubleshooting**.
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

## Sign in

Use **Create account** with your email address and password, then confirm your email once. Returning users use **Sign in**. **Forgot password?** sends a reset link.

After signing up, start a private space or join your partner with their couple code. To share a code, go to **Profile → Couple connection**. Codes are single-use and expire after 24 hours. Existing accounts go directly to their shared space when they sign in.

Hosted sign-up and password recovery need an [email sender configured in Supabase](https://supabase.com/docs/guides/auth/auth-smtp) for addresses outside the project team.

Duvie keeps your session in the browser that completed sign-in. Each browser, website address, or private browsing session can require its own sign-in. In an ordinary Safari tab, reopening Duvie should restore your session, and Safari can autofill your saved password when sign-in is needed.

## Profile photos

Use **Profile → Edit your profile** to choose, save, or remove your photo. Duvie center-crops images to 256 × 256 pixels. Both members of a shared space can see the photo, and each account can change its own. For a new Supabase project, apply the migrations in `supabase/migrations` in filename order.

## Checks

```sh
node --check app.js
node --check sync.js
git diff --check
```
