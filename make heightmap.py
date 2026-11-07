#!/usr/bin/env python3
"""
make_heightmap.py  -  Team Starseekers / Martian Map

Turns a Mars elevation GeoTIFF (for example the USGS CTX DEM) into the two files
the website needs:  heightmap.png  and  terrain.json

Usage:
    python make_heightmap.py dem.tif
    python make_heightmap.py dem.tif --size 2048 --name "My region" --source "USGS CTX DEM"

Readers tried in this order: rasterio, GDAL (osgeo), Pillow (+numpy).
The PNG is "rg16": red = high byte, green = low byte of a 16-bit elevation,
so the full height precision is kept (a normal gray PNG has only 256 levels).
A gray preview (heightmap_preview.png) is also written for you to look at.
"""
import argparse, json, os, sys
import numpy as np


def read_dem(path):
    """Returns (array float32 with NaN for no-data, width_m or None, lat_lon_info)."""
    try:
        import rasterio
        with rasterio.open(path) as ds:
            a = ds.read(1).astype("float64")
            if ds.nodata is not None:
                a[a == ds.nodata] = np.nan
            res = abs(ds.transform.a)
            unit = (ds.crs.linear_units if ds.crs and ds.crs.is_projected else "degree")
            width_m = res * ds.width if str(unit).lower().startswith("met") else None
            lonlat = None
            try:
                from rasterio.warp import transform_bounds
                lonlat = transform_bounds(ds.crs, ds.crs.geodetic_crs, *ds.bounds)  # west, south, east, north
            except Exception:
                lonlat = None
            return a.astype("float32"), width_m, "rasterio", lonlat
    except ImportError:
        pass
    try:
        from osgeo import gdal
        ds = gdal.Open(path)
        band = ds.GetRasterBand(1)
        a = band.ReadAsArray().astype("float64")
        nd = band.GetNoDataValue()
        if nd is not None:
            a[a == nd] = np.nan
        gt = ds.GetGeoTransform()
        proj = (ds.GetProjection() or "").upper()
        width_m = abs(gt[1]) * ds.RasterXSize if ("PROJCS" in proj or "PROJCRS" in proj) else None
        return a.astype("float32"), width_m, "gdal", None
    except ImportError:
        pass
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = None
    im = Image.open(path)
    a = np.array(im, dtype="float64")
    if a.ndim == 3:
        a = a[..., 0]
    return a.astype("float32"), None, "pillow", None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("dem", help="elevation GeoTIFF (meters)")
    ap.add_argument("--size", type=int, default=2048, help="output PNG size in pixels (default 2048)")
    ap.add_argument("--width-m", type=float, default=None, help="real width of the region in meters (needed if it cannot be read from the file)")
    ap.add_argument("--pixel-m", type=float, default=None, help="meters per pixel of the input (alternative to --width-m; USGS CTX = 20)")
    ap.add_argument("--name", default="Mars region")
    ap.add_argument("--lat", type=float, default=None, help="latitude of the region center (degrees north). Used for the Sun, UV and temperature model")
    ap.add_argument("--bounds", type=float, nargs=4, metavar=("LONMIN", "LONMAX", "LATMIN", "LATMAX"), default=None,
                    help="east longitude / latitude limits of the DEM. Needed by make_texture.py if they cannot be read from the file")
    ap.add_argument("--source", default="Mars elevation model (add the citation here)")
    ap.add_argument("--out", default=".", help="output folder")
    args = ap.parse_args()

    from PIL import Image
    Image.MAX_IMAGE_PIXELS = None
    a, width_m, reader, lonlat = read_dem(args.dem)
    print(f"Read {args.dem} with {reader}: {a.shape[1]} x {a.shape[0]} pixels")

    if args.width_m:
        width_m = args.width_m
    elif args.pixel_m:
        width_m = args.pixel_m * a.shape[1]
    if not width_m:
        sys.exit("Cannot tell the real width of the region. Re-run with --pixel-m 20 (meters per pixel) or --width-m <meters>.")

    # fill no-data with the lowest valid value so the map has no holes
    valid = np.isfinite(a)
    if not valid.any():
        sys.exit("The file has no valid elevation values.")
    lo, hi = float(np.nanmin(a)), float(np.nanmax(a))
    a = np.where(valid, a, lo)

    # keep the aspect ratio; the website expects a square map, so crop the center square
    h, w = a.shape
    s = min(h, w)
    y0, x0 = (h - s) // 2, (w - s) // 2
    a = a[y0:y0 + s, x0:x0 + s]
    pixel_m = width_m / w
    width_m = pixel_m * s
    bounds = None
    if args.bounds:
        bounds = {"lonMin": args.bounds[0], "lonMax": args.bounds[1], "latMin": args.bounds[2], "latMax": args.bounds[3]}
    elif lonlat:
        west, south, east, north = lonlat
        fx0, fx1 = x0 / w, (x0 + s) / w
        fy0, fy1 = y0 / h, (y0 + s) / h
        bounds = {"lonMin": round(west + fx0 * (east - west), 5), "lonMax": round(west + fx1 * (east - west), 5),
                  "latMax": round(north - fy0 * (north - south), 5), "latMin": round(north - fy1 * (north - south), 5)}
    if (h, w) != (s, s):
        print(f"Cropped the center square ({s} x {s} pixels) because the website uses a square map.")

    lo, hi = float(a.min()), float(a.max())
    norm = (a - lo) / ((hi - lo) or 1.0)
    img16 = Image.fromarray((norm * 65535).round().astype("uint16"))  # I;16 for resizing
    size = min(args.size, s)
    img16 = img16.resize((size, size), Image.BILINEAR)
    v = np.array(img16, dtype="uint32")

    rgb = np.zeros((size, size, 3), dtype="uint8")
    rgb[..., 0] = v >> 8
    rgb[..., 1] = v & 255
    os.makedirs(args.out, exist_ok=True)
    Image.fromarray(rgb, "RGB").save(os.path.join(args.out, "heightmap.png"))
    Image.fromarray((v >> 8).astype("uint8"), "L").save(os.path.join(args.out, "heightmap_preview.png"))

    meta = {
        "name": args.name,
        "source": args.source,
        "heightmap": "heightmap.png",
        "encoding": "rg16",
        "elevMin": round(lo, 2),
        "elevMax": round(hi, 2),
        "regionWidthM": round(width_m, 1),
        "gridSize": 256,
        "landmarks": []
    }
    if bounds:
        meta["bounds"] = bounds
        meta["lat"] = round((bounds["latMin"] + bounds["latMax"]) / 2, 4)
    if args.lat is not None:
        meta["lat"] = args.lat
    if "lat" not in meta:
        print("TIP: add --lat <degrees north> so the Sun, UV and temperature model use the right latitude (default 18.4 = Jezero).")
    with open(os.path.join(args.out, "terrain.json"), "w") as f:
        json.dump(meta, f, indent=2)

    print(f"Wrote heightmap.png ({size} x {size}), heightmap_preview.png and terrain.json in {os.path.abspath(args.out)}")
    print(f"Elevation {lo:.0f} to {hi:.0f} m, region width {width_m/1000:.1f} km ({pixel_m:.1f} m per pixel)")
    print("Landmarks are empty: the website will detect big craters by itself. To name them, edit terrain.json:")
    print('  "landmarks": [{"name": "Crater A", "u": 0.3, "v": 0.5, "rM": 3000}]   (u,v = 0..1 from the top-left corner)')


if __name__ == "__main__":
    main()
