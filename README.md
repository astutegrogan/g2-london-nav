# Even Realities Car Nav

![G2 lens interface](docs/images/interface3.png)

## Purpose

The Even Realities G2 ships an official walking/cycling Navigate app — but **no driving app**. This project fills that gap: live turn-by-turn directions on the G2 lens while you drive.

## Stack

```
┌────────────────────────────────────────────────┐
│ iPhone — Even Realities App (Flutter host)     │
│  ┌──────────────────────────────────────────┐  │
│  │ WKWebView                                │  │
│  │  • this app (TypeScript + Vite)          │  │
│  │  • navigator.geolocation                 │  │
│  │  • Mapbox Directions + Geocoding         │  │
│  │  • HUD render loop (2 Hz)                │  │
│  └──────────────┬───────────────────────────┘  │
│                 │ even_hub_sdk bridge          │
└─────────────────┼──────────────────────────────┘
                  │ Bluetooth LE
                  ▼
            ┌───────────┐
            │ G2 lenses │  display + input only
            └───────────┘
```

## Setup

Requirements:
- Node.js 18+
- iPhone with the Even Realities app, paired with G2 glasses
- Mapbox public token (free tier — https://account.mapbox.com/access-tokens/)

Steps:
```bash
npm install
echo "VITE_MAPBOX_TOKEN=pk.your_token_here" > .env.local
```

## Usage

### Dev runner (recommended)

`run.py` is a small TUI that manages both processes (simulator + dev server) from a single window:

```bash
python run.py
```

Single-key controls:
- `1` start simulator · `2` start dev server · `3` start both
- `4` stop both · `5` restart both
- `q` quit (also stops both)

Logs stream to `logs/sim.log` and `logs/server.log`.

### Manual

**Browser simulator** (fastest dev loop, no glasses needed):
```bash
npm run simulate     # one shell
npm run dev          # another shell
```

**Sideload onto glasses** (HUD test, mock GPS):
```bash
echo "VITE_GPS_MODE=mock" >> .env.local
npm run dev
npx evenhub qr --url http://<your-LAN-ip>:5173
# scan QR with Even Hub app — real GPS is denied in sideload, mock track replays
```

**Production install** (real GPS, real driving):
```bash
npm run pack         # produces .ehpk
# upload via https://hub.evenrealities.com, install via Even Hub app
```

In the app:
1. Type a destination on your phone, tap a result.
2. Tap **Start Navigation**.
3. Look at the glasses for turn-by-turn.
4. **Double-tap** the glasses to end nav.

See `docs/plans.md` for the full roadmap and `docs/goal.md` for the original spec.
