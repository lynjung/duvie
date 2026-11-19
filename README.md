# Duvie

A cozy app for couples to organize schedules, track daily routines, reflect together, and work toward shared goals.

[Open Duvie](https://duvie.vercel.app/)

## Features

- **Planner** has Day, Week, and Month views for the shared schedule. Week shows the full week’s events. In Month, pick a date to see its agenda.
- **Goals** brings daily routine logging, individual and combined commitment, and goal milestones together.
- **Profile** shows the two linked accounts and their profile photos. Use the gear to open Settings. Manual sync lives under **Settings → Troubleshooting**.
- Weekly check-ins and an interactive otter companion.
- A shared mobile layout for Nook, Planner, Goals, and Profile with consistent margins, readable headings, and a bottom tab bar that stays visible while scrolling.

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

Use **Sign in** with your existing email address and password. Sign-in and password screens share a narrow, mobile-first layout with the title, messages, fields, and actions aligned. **Reset password** opens the form for requesting a reset link. After submitting, **Check your email** explains what to do next and provides a way back to the form or sign-in. Sign-in and recovery errors use a compact muted red notice above the form. Progress and confirmations use the app accent color.

New account signup and couple codes are prepared. Couple setup uses stacked actions with consistent spacing, and the code screen places **Copy code** below the code and sharing instructions. New passwords must be 12–32 characters. Rate-limit errors say “Too many attempts. Please try again later.” Enable `signupEnabled` in `sync-config.js` after applying the couple onboarding migration and verifying email delivery in the hosted environment. Existing accounts can sign in while signup is disabled.

Supabase’s default sender handles password recovery during testing. To send account emails as **Duvie Team** and reach users outside the project team, connect an email provider through [Supabase Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) and set the sender name there.

Duvie keeps your session in the browser that completed sign-in. Each browser, website address, or private browsing session can require its own sign-in. Open a password reset link in the browser you want to use for Duvie. The session is saved in that browser.

## Profile photos

Use **Profile → Edit your profile** to choose, save, or remove your photo. Duvie center-crops images to 256 × 256 pixels. Both members of a shared space can see the photo, and each account can change its own. For a new Supabase project, apply the migrations in `supabase/migrations` in filename order.

## Checks

```sh
node --check app.js
node --check sync.js
git diff --check
```
