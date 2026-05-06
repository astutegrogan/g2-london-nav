# Plans — Even Realities Car Nav

Living roadmap. Check items off as they ship.

---

## Phase 0 · Research & decisions

- [x] Confirm Waze has no public routing API (partner-only Transport SDK)
- [x] Confirm Google Maps TOS forbids in-vehicle hardware rendering
- [x] Pick **Mapbox Directions API** as routing provider
- [x] Confirm Even Hub apps run as a WebView on the phone (not on glasses)
- [x] Confirm `navigator.geolocation` works in production (fails in sideload)
- [x] Display spec: 576×288, 4-bit green, 16 shades
- [x] Audio out via SDK: not supported (mic input only)
- [x] `even-terminal` is for Claude Code, not generic display — build a proper Hub app

---

## Phase 1 · Scaffold & core modules

- [x] Clone `evenhub-templates`, copy `minimal/` as base
- [x] Customize `package.json` (name = `even-realities-car-nav`)
- [x] Customize `app.json` (`package_id`, `permissions: ["location"]`)
- [x] `src/sdk.ts` — `GlassesSurface` wrapper, serialized text upgrades, input binding
- [x] `src/gps.ts` — `liveGps` + `mockGps` (toggle via `VITE_GPS_MODE`)
- [x] `src/routing/types.ts` — shared types
- [x] `src/routing/mapbox.ts` — Directions + Geocoding (`annotations=maxspeed,speed,duration`)
- [x] `src/routing/tracker.ts` — GPS → step, distance-to-next, speed-limit, off-route detect
- [x] `src/hud/layout.ts` — 3 zones (header / maneuver / thennext)
- [x] `src/hud/format.ts` — ETA, ft/mi, mph
- [x] `src/hud/arrows.ts` — maneuver → glyph
- [x] `src/hud/render.ts` — `HudLoop`, 2 Hz, diff-only
- [x] `src/ui/search.ts` — phone-side destination search
- [x] `src/ui/preview.ts` — phone-side route preview screen
- [x] `src/input.ts` — glasses gestures (double-tap = end)
- [x] `src/main.ts` — boot + orchestration
- [x] `npm run build` clean

---

## Phase 2 · Local validation (no real device)

- [x] TypeScript build passes
- [ ] Run `npm run simulate` + `npm run dev`, confirm WebView renders search screen
- [ ] Acquire Mapbox public token, store in `.env.local`
- [ ] Smoke-test geocoding (search a known address, confirm results)
- [ ] Smoke-test directions (pick result, see preview screen with distance + ETA)
- [ ] Run with `VITE_GPS_MODE=mock`, confirm tracker advances steps and HUD frames diff correctly
- [ ] Verify off-route → reroute path with a mock GPS that drifts off the polyline

---

## Phase 3 · Sideload onto glasses (HUD-only test)

- [ ] Find LAN IP, run `npx evenhub qr --url http://<ip>:5173`
- [ ] Scan QR with Even Hub companion app, confirm app loads
- [ ] Force `VITE_GPS_MODE=mock` (real GPS denied in sideload)
- [ ] Verify all 3 zones render without flicker on the lens
- [ ] Verify text fits — header on one line, maneuver legible, thennext truncates cleanly
- [ ] Verify maneuver arrow glyphs render in the lens font (fall back to bitmaps if not)
- [ ] Verify double-tap ends nav

---

## Phase 4 · Hub upload (real driving)

- [ ] `npm run pack` → produces `.ehpk`
- [ ] Upload via https://hub.evenrealities.com console
- [ ] Install on phone via Even Hub app
- [ ] **Stationary** test: real GPS fix, route preview, manual step advance
- [ ] Short residential drive: confirm step transitions, distance ticks down
- [ ] Highway drive: confirm `driving-traffic` profile reflects live conditions
- [ ] Off-route + reroute confirmed end-to-end
- [ ] Speed-limit display matches reality on segments where Mapbox has data

---

## Phase 5 · Mini-map render

- [x] `src/compass.ts` — DeviceOrientation wrapper with iOS user-gesture permission flow + GPS-heading fallback
- [x] `src/map/types.ts` — RoadSegment, MapFrame
- [x] `src/map/roads.ts` — Overpass API client + RoadCache (300m refetch threshold, 800m radius)
- [x] `src/map/render.ts` — canvas → PNG bytes, north-up, lines-only roads, rotating arrow at center
- [x] SDK: image container support (`pushImage`, serialized chain)
- [x] Layout: maneuver text shrunk to 372 wide, map occupies 200×100 top-right
- [x] Map loop in `main.ts` — 0.5 Hz, skip ticks if moved <5m AND turned <5°
- [x] Build clean
- [ ] Live test compass permission flow on iOS WKWebView
- [ ] Confirm Overpass CORS works from inside the Even Hub WebView
- [ ] Tune `PX_PER_METER` (currently 0.3 → ~667m horizontal, 333m vertical visible)
- [ ] Verify arrow doesn't fall behind heading at speed (compass lag)
- [ ] Decide: keep `driving-traffic` highway zoom-out, or stay fixed-zoom

---

## Phase 6 · HUD iteration & polish

- [ ] Drive packed v1, note which fields are noise
- [ ] Strip noisy fields; reflow zones if zones empty out
- [ ] Replace text-glyph arrows with 200×100 bitmaps if glanceability suffers
- [ ] Pre-render arrow bitmaps once at boot (don't re-transmit per frame)
- [ ] Tune render rate (2 Hz → 1 Hz) if BLE latency lags
- [ ] Battery / thermal pass on a 30-min drive

---

## Phase 7 · Stretch (deferred)

- [ ] Voice cues via phone speaker (`<audio>` in WebView, if WKWebView allows autoplay)
- [ ] Lane-guidance bitmaps from Mapbox `bannerInstructions.sub`
- [ ] Live traffic alerts (Mapbox incidents) — explicitly out per user, may revisit
- [ ] Multi-stop / waypoints
- [ ] Offline tile cache for highway dead-zones
- [ ] Native iOS companion fallback if WebView background pauses kill nav

---

## Known risks (live tracking)

- [ ] Confirm WKWebView keeps the app foregrounded during a drive (lock-screen behavior)
- [ ] Confirm Mapbox `maxspeed` annotations are reliable in the user's area
- [ ] Watch for BLE bandwidth saturation at 2 Hz with 3 zones
