# Martian Map 🇴🇲
Interactive Mars explorer and 3D mission planner, built by **Team Starseekers** for the NASA Space Apps Challenge.

## What it does
- **🌍 Global map** – Viking color mosaic, MOLA elevation and hillshade layers. Planning sites plus every lander and rover (Viking, Pathfinder, Spirit, Opportunity, Phoenix, Curiosity, InSight, Perseverance, Zhurong), each with a card, NASA photos of the place and a link to its mission page.
- **🛰 3D mission** – risk-aware route planning on terrain (slope, slip, radiation, UV, temperature, dust, power and signal delay), with an astronaut, a robotic rover or a crew rover, and a flag-of-Oman celebration on arrival. One tap sets the conditions to *today on Mars*.
- **📡 Mars today** – live Coordinated Mars Time, Mars year and season, Earth–Mars distance and radio delay with an orbit diagram, the current sol and local time of Perseverance and Curiosity, the newest raw images from both rovers, and the NASA Image and Video Library.
- Works on phones (bottom sheets, large touch targets, safe areas) and can be added to the home screen.

## Data sources
| Data | Source |
|---|---|
| Global imagery and elevation | NASA / JPL / USGS (Viking MDIM 2.1, MGS MOLA) via OpenPlanetary tiles |
| Newest rover images | NASA/JPL-Caltech raw image feeds, through `api/rover-images.js` (Vercel function, cached 30 min) |
| Place photos | NASA Image and Video Library (`images-api.nasa.gov`) |
| Mars time and season | NASA GISS Mars24 algorithm (Allison & McEwen 2000), computed in the browser |
| Earth–Mars distance | JPL approximate Keplerian elements, computed in the browser |
| Flag of Oman | Royal Decree 53/2004 layout (4:7, hoist band one third), drawn in `flag.js` |

## Files
`index.html`, `style.css` · `script.js` (3D app) · `worldmap.js` (global map) · `marstoday.js` (Mars today page) · `marsclock.js` (Mars time and orbits) · `nasa.js` (NASA data in the browser) · `api/rover-images.js` (server function) · `hazards.js` · `models.js` · `flag.js`

## Run locally
Open the folder with any static server (for example VS Code *Live Server*). The rover images use `/api/rover-images` on Vercel and fall back to NASA directly when run locally.

Real elevation packs and NASA 3D models are optional: see `regions/README.txt` and `models/README.txt`.
