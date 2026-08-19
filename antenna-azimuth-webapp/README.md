# Antenna Azimuth Mapper — Web App

A real-time web app that plots compass azimuths (e.g. for aiming a
directional or sector antenna) from your **live browser GPS position** onto
a satellite map, with a best-effort obstruction-height estimate from
shadows detected near your position.

**Live demo:** https://antenna-azimuth-webapp.vercel.app

This is the browser-based companion to
[`../antenna-azimuth-mapper`](../antenna-azimuth-mapper), which is a
CLI/Cowork-skill version of the same idea for use inside a Claude session
(no device GPS there, so coordinates are typed in). This app exists
specifically for the piece the CLI/skill can't do: continuous, real GPS
tracking straight from your phone or laptop's browser.

## Setup

```bash
cd antenna-azimuth-webapp
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No API key or `.env`
file is needed — satellite imagery comes from Esri's public World Imagery
basemap.

**GPS requires HTTPS** (or `localhost`) — `navigator.geolocation` is blocked
by browsers on a plain-HTTP, non-localhost origin. Local dev on `localhost`
works fine; once deployed (e.g. to Vercel) HTTPS is automatic.

## Usage

1. Allow the location permission prompt — your position appears as a white
   dot and the map recenters on it.
2. Add one or more azimuths (degrees, 0 = north) with a distance; give one
   a beamwidth to draw a sector wedge instead of a line, for planning a
   directional/sector antenna's coverage cone.
3. Click **Analyze obstruction near origin** to look for a shadow near your
   position and estimate the height of whatever cast it.
4. If GPS is unavailable or you want to check a different spot, type
   coordinates directly into the Latitude/Longitude fields — this switches
   to a manual override; "Use live GPS instead" switches back.

## Accuracy & limitations

The azimuth rays themselves are exact geodesic math from your GPS
coordinates — the "real-time" and "azimuth" parts are as accurate as your
device's GPS fix.

**The shadow-based obstruction estimate is a heuristic, not a certified
measurement** — same caveat as the CLI/skill version, and for the same
reason: public satellite basemaps (Esri, Mapbox, Google) are mosaics with
no exposed per-tile sensor viewing-angle or capture-date metadata, so there
is no way to compute a rigorous photogrammetric correction (which way a
tall object leans in the image). What this app *can* and does compute: it
detects an elongated dark blob near your position in the imagery, checks
whether its orientation matches the astronomically-true sun direction for
the assumed time, and if so reports the shadow's length and — from
`length × tan(sun elevation)` — an estimated height for whatever cast it,
with a confidence level and how many degrees off the expected shadow
direction it was. Treat it as "there may be an obstruction of roughly this
height near here," not a survey-grade figure, and never as a claim about
which direction an object leans, since that isn't recoverable without the
sensor's viewing azimuth.

## How it works

- `lib/geometry.ts`, `lib/solar.ts` — geodesic and solar-position math,
  ported 1:1 from the CLI's `azimuth_mapper/geometry.py` and `solar.py` so
  both tools agree.
- `components/AzimuthMap.tsx` — a `react-leaflet` map with an Esri World
  Imagery tile layer, your live GPS marker, and the azimuth rays/wedges
  (computed client-side, no server round-trip).
- `app/api/shadow-estimate/route.ts` (Node runtime — needs `sharp`) —
  server-side only, because reading pixel data from a cross-origin tile
  image in the browser would hit canvas CORS tainting: it fetches/stitches
  Esri tiles, decodes them, and runs the shadow-detection + sun-position
  heuristic (`lib/shadow.ts`, `lib/tiles.ts` — ported from the CLI's
  `shadow_detect.py`/`correction.py`/`imagery.py`, since there's no OpenCV
  here). This only runs when you click **Analyze**, not on every GPS
  update, to avoid hammering the public tile endpoint.

## Deployment

Running live at https://antenna-azimuth-webapp.vercel.app. To deploy your
own copy:

```bash
npx vercel --cwd antenna-azimuth-webapp
```

or connect the repo in the Vercel dashboard with **Root Directory** set to
`antenna-azimuth-webapp`. No environment variables are required.

Note that Vercel enables **Vercel Authentication** on new projects, which
makes the deployment reachable only by members of the owning team — turn it
off under *Project Settings → Deployment Protection* if you want the URL to
be publicly usable (e.g. to open it on a phone that isn't logged into
Vercel).
