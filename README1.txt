REAL 3D DATA PACKS  (one folder per site)

regions/jezero/
    terrain.json     (made by make_heightmap.py)
    heightmap.png    (made by make_heightmap.py)
    texture.jpg      (optional, made by make_texture.py from the Caltech CTX mosaic)

Folder names must match the site list in worldmap.js:
jezero, gale, meridiani, gusev, olympus, valles, hellas, utopia.

Steps for one site:
  python make_heightmap.py dem.tif --pixel-m 20 --name "Jezero Crater" --source "USGS CTX DEM" --out regions/jezero
  python make_texture.py E076_N16.tif --out regions/jezero          (optional, needs the CTX tile)

A site without a folder opens with SIMULATED terrain and the page says so.
