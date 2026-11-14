# Martian Map 🇴🇲
**Created by MR_PSG · Team Starseekers** (NASA Space Apps Challenge)

An interactive Mars explorer and 3D mission planner where **everything comes from real data**: real elevation, real orbital images, real place names, real rover paths. Nothing is simulated.

## What it does
- **🌍 Global map**: Viking color, MOLA elevation and hillshade layers. It marks the planning sites and every lander and rover, and draws the **real paths driven by Perseverance and Curiosity**. Tap anywhere on Mars to open that spot in real 3D.
- **🛰 3D mission**: risk-aware route planning on the real terrain:
  - hazards covered: slope, slip, radiation, UV, temperature, dust, power and signal delay
  - places are labelled with their **IAU-approved names**
  - one tap sets the conditions to *today on Mars*
- **📡 Mars today**: live Mars clock and season, Earth–Mars distance and radio delay, the current sol and local time of each active rover, the newest raw rover images, and the NASA Image Library.
- **Original designs by MR_PSG / Starseekers**. These are new concepts, not NASA hardware:
  - **SINBAD**: a hard-shell EVA suit with a rear-entry suitport hatch, a bronze wraparound visor and a halo HUD.
  - **RAHHAL (رحّال)**: an autonomous scout on four articulated wheel-legs, with a folding solar wing and a lidar dome.
  - **QAFILA (قافلة)**: an articulated two-module pressurized crew rover with 8 airless wheels and suitports for SINBAD.
- **Physics on real terrain** (`physics.js`):
  - **Vehicles:** each wheel samples the real ground, a plane is fitted through the contact points, and spring-damper suspension follows it for height, pitch and roll. Each wheel keeps its own suspension travel. Wheels roll by distance ÷ radius, plus slip.
  - **Steering:** heading changes are rate-limited, and QAFILA bends at its joint.
  - **Astronaut:** a low-gravity gait (Mars is 0.38 g).
  - **Dust:** falls back to the ground under Mars gravity.

## Real data sources
| Data | Source | How it is used |
|---|---|---|
| Elevation, Jezero | Mars 2020 Science Team CTX DEM, 20 m/px (USGS Astrogeology) | `api/terrain.js` reads only the window it needs (HTTP range requests) |
| Elevation, anywhere | HRSC + MOLA blended global DEM, 200 m/px (ESA/DLR/FU Berlin, NASA/GSFC; USGS) | as above; overviews are used for very large areas |
| Surface image | CTX global mosaic ≈5 m/px (NASA/JPL/MSSS, Caltech Murray Lab, Dickson et al. 2024; tiles by Esri) | mosaicked and resampled by `api/terrain.js` |
| Place names | IAU / USGS Gazetteer of Planetary Nomenclature | `api/names.js` reads the official shapefile download |
| Rover paths | NASA/JPL-Caltech mission maps (MMGIS) | `api/traverse.js` |
| Newest rover images | NASA/JPL-Caltech raw image feeds | `api/rover-images.js` |
| Mars time, season | NASA GISS Mars24 algorithm (Allison & McEwen 2000) | computed in the browser (`marsclock.js`) |
| Earth–Mars distance | JPL approximate Keplerian elements | computed in the browser |
| Flag of Oman | Royal Decree 53/2004 layout (4:7) | `flag.js` |

Every `/api` answer for a given place stays the same, so Vercel's CDN keeps it. Only the first visit to a new place computes anything.

- **Easiest route, explained**: the A* planner weighs every step by slope, roughness, soft sand and how close the climb is to the vehicle's limit. "💡 Why?" lists the reasons in plain words (what a straight line would cross, what the shortest path costs), and "Why not another way?" compares any point you tap. Red stretches pulse, carry ⚠ signs and raise an alert while the traveler crosses them.
- **Arrival celebrations**: the flag of Oman rises (cloth simulation with folds), then SINBAD performs **al-Bar'ah** (khanjar above the shoulder, Dhofar, UNESCO 2010) and **al-Razha** (sword raised, shaken and thrown, flying 1.6 s in Mars gravity). Vehicles raise the flag on a mast. The suit has a joint-limited skeleton; `tools/selfcheck.html` checks every frame for parts passing through each other.
- **Calm sound** (`sound.js`, Web Audio, no files): Mars wind, footsteps, rover hum, soft warning tone, arrival chime and Omani frame-drum rhythms. One button mutes it.

## Files
`index.html`, `style.css` · `script.js` (3D app) · `models.js` (SINBAD, RAHHAL, QAFILA) · `physics.js` · `worldmap.js` · `marstoday.js` · `marsclock.js` · `nasa.js` · `hazards.js` · `flag.js` · `sound.js` · `api/` (Vercel functions: `terrain`, `names`, `traverse`, `rover-images`, plus `_lib` readers for TIFF, PNG and JPEG) · `tools/devserver.js` · `tools/selfcheck.html` (suit self-intersection test) · `tools/poses.html` (pose viewer)

## Run locally
```
node tools/devserver.js        # http://localhost:8080  (Node 18+, needs internet: the API reads NASA/USGS data)
```

## Credits and AI use
- Elevation: MOLA (NASA, CC0) and HRSC (ESA/DLR, CC BY-SA 3.0 IGO) blend by USGS Astrogeology (Fergason, Hare & Laura 2018); Mars 2020 Science Investigation CTX DEM (USGS). Image: Global CTX Mosaic, NASA/JPL/MSSS, The Murray Lab (Dickson et al. 2024).
- AI assistance: the team used Claude (Anthropic) as a coding and writing assistant for parts of the code, the procedural 3D models, the tests and the documentation. The team directed the design and reviewed the results. No data in the app are AI-generated.

© 2026 MR_PSG · Team Starseekers
