#!/usr/bin/env python3
"""
make_texture.py  -  Team Starseekers / Martian Map

Cuts your site out of the Caltech Murray Lab Global CTX Mosaic (5 m per pixel) and saves it as
texture.jpg. The 3D map then drapes this REAL photo over the elevation model.

1) Download ONE 4x4 degree tile from  https://murray-lab.caltech.edu/CTX/
   Tile names use the lower-left corner: E076_N16 covers 76-80 E, 16-20 N (Jezero is inside it).
   A tile is a few gigabytes. Download only the tile you need.
2) Run, with the same bounds as your elevation data (make_heightmap.py prints them in terrain.json):

     python make_texture.py E076_N16.tif --bounds 77.2 77.9 18.2 18.7 --out regions/jezero

   If regions/jezero/terrain.json already has "bounds", you can leave --bounds out.

How it cuts: best is GDAL (gdal_translate). If GDAL is missing it uses rasterio and plain
equirectangular math (Mars sphere radius 3396190 m). Check the picture before using it:
it should line up with the heightmap preview.

Credit to show on your site: NASA/JPL/MSSS/The Murray Lab (free to use for all purposes).
"""
import argparse, json, math, os, shutil, subprocess, sys

R = 3396190.0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("tile", help="CTX mosaic GeoTIFF tile")
    ap.add_argument("--bounds", type=float, nargs=4, metavar=("LONMIN", "LONMAX", "LATMIN", "LATMAX"))
    ap.add_argument("--size", type=int, default=4096, help="texture size in pixels (default 4096)")
    ap.add_argument("--out", default=".", help="folder that holds terrain.json (default: current folder)")
    args = ap.parse_args()

    meta_path = os.path.join(args.out, "terrain.json")
    meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
    if args.bounds:
        lonmin, lonmax, latmin, latmax = args.bounds
    elif "bounds" in meta:
        b = meta["bounds"]
        lonmin, lonmax, latmin, latmax = b["lonMin"], b["lonMax"], b["latMin"], b["latMax"]
    else:
        sys.exit("No bounds. Pass --bounds LONMIN LONMAX LATMIN LATMAX (east longitude, degrees).")
    os.makedirs(args.out, exist_ok=True)
    out_jpg = os.path.join(args.out, "texture.jpg")
    tmp = os.path.join(args.out, "_texture_tmp.tif")

    ok = False
    if shutil.which("gdal_translate"):
        cmd = ["gdal_translate", "-of", "GTiff", "-projwin_srs", f"+proj=longlat +R={R} +no_defs",
               "-projwin", str(lonmin), str(latmax), str(lonmax), str(latmin),
               "-outsize", str(args.size), str(args.size), "-ot", "Byte", "-scale", args.tile, tmp]
        print("Running:", " ".join(cmd))
        ok = subprocess.call(cmd) == 0
    if not ok:
        try:
            import rasterio
            from rasterio.windows import from_bounds
            with rasterio.open(args.tile) as ds:
                x0, x1 = R * math.radians(lonmin), R * math.radians(lonmax)
                y0, y1 = R * math.radians(latmin), R * math.radians(latmax)
                print("Tile bounds:", ds.bounds, "| wanted (m):", (x0, y0, x1, y1))
                win = from_bounds(x0, y0, x1, y1, ds.transform)
                a = ds.read(1, window=win, out_shape=(args.size, args.size), boundless=False)
            import numpy as np
            from PIL import Image
            lo, hi = np.percentile(a[a > 0], [1, 99]) if (a > 0).any() else (0, 1)
            img = np.clip((a.astype("float32") - lo) / ((hi - lo) or 1) * 255, 0, 255).astype("uint8")
            Image.fromarray(img, "L").convert("RGB").save(out_jpg, quality=90)
            ok = "done"
        except ImportError:
            sys.exit("Need GDAL (gdal_translate) or rasterio. Install one, or cut the area in QGIS: Raster > Extraction > Clip by extent, then export as JPG.")
        except Exception as e:
            sys.exit(f"Could not cut the area ({e}). Check that the bounds are inside the tile.")
    if ok is True:
        from PIL import Image
        import numpy as np
        a = np.array(Image.open(tmp))
        a = a[..., 0] if a.ndim == 3 else a
        Image.fromarray(a, "L").convert("RGB").save(out_jpg, quality=90)
        os.remove(tmp)
    meta["texture"] = "texture.jpg"
    meta["textureSource"] = "Global CTX Mosaic of Mars (NASA/JPL/MSSS/The Murray Lab)"
    json.dump(meta, open(meta_path, "w"), indent=2)
    print(f"Wrote {out_jpg} and updated terrain.json. Open the site and check that it lines up with the terrain.")


if __name__ == "__main__":
    main()
