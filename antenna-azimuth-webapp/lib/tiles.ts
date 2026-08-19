/**
 * Fetch and stitch Esri World Imagery tiles around a point — server-only
 * (uses `sharp` and Node's `fetch`). Ported from
 * antenna-azimuth-mapper/azimuth_mapper/imagery.py.
 *
 * Esri's World Imagery basemap needs no API key. It's a mosaic assembled
 * from many source images of different dates and viewing angles, which is
 * exactly why the shadow-based estimate in shadow.ts has to stay a
 * heuristic: there is no single, known capture geometry for a tile.
 */
import sharp from "sharp";

import { type LatLon, TILE_SIZE_PX, lonlatToGlobalPixel } from "./geometry";

const TILE_URL = (z: number, y: number, x: number) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

export interface MapSnapshot {
  /** Raw RGB pixel buffer, width * height * 3 bytes, row-major. */
  raw: Buffer;
  width: number;
  height: number;
  center: LatLon;
  zoom: number;
  /** Global Web Mercator pixel coords of the image's top-left corner. */
  originPx: [number, number];
}

/** Fetch just enough Esri World Imagery tiles to cover a sizePx square centered on center. */
export async function fetchSnapshot(
  center: LatLon,
  zoom: number,
  sizePx = 512
): Promise<MapSnapshot> {
  const [centerX, centerY] = lonlatToGlobalPixel(center, zoom);
  const half = sizePx / 2;
  const left = centerX - half;
  const top = centerY - half;
  const right = centerX + half;
  const bottom = centerY + half;

  const firstTileX = Math.floor(left / TILE_SIZE_PX);
  const firstTileY = Math.floor(top / TILE_SIZE_PX);
  const lastTileX = Math.floor((right - 1) / TILE_SIZE_PX);
  const lastTileY = Math.floor((bottom - 1) / TILE_SIZE_PX);
  const nTiles = 2 ** zoom;

  const mosaicW = (lastTileX - firstTileX + 1) * TILE_SIZE_PX;
  const mosaicH = (lastTileY - firstTileY + 1) * TILE_SIZE_PX;

  const tileCoords: { tx: number; ty: number }[] = [];
  for (let ty = firstTileY; ty <= lastTileY; ty++) {
    for (let tx = firstTileX; tx <= lastTileX; tx++) {
      tileCoords.push({ tx, ty });
    }
  }

  const composites = await Promise.all(
    tileCoords.map(async ({ tx, ty }) => {
      const wrappedX = ((tx % nTiles) + nTiles) % nTiles;
      const url = TILE_URL(zoom, ty, wrappedX);
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`Tile fetch failed (${resp.status}) for ${url}`);
      }
      const buf = Buffer.from(await resp.arrayBuffer());
      return {
        input: buf,
        left: (tx - firstTileX) * TILE_SIZE_PX,
        top: (ty - firstTileY) * TILE_SIZE_PX,
      };
    })
  );

  const mosaicOriginX = firstTileX * TILE_SIZE_PX;
  const mosaicOriginY = firstTileY * TILE_SIZE_PX;
  const cropLeft = Math.round(left - mosaicOriginX);
  const cropTop = Math.round(top - mosaicOriginY);

  const { data, info } = await sharp({
    create: {
      width: mosaicW,
      height: mosaicH,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite(composites)
    .extract({ left: cropLeft, top: cropTop, width: sizePx, height: sizePx })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    raw: data,
    width: info.width,
    height: info.height,
    center,
    zoom,
    originPx: [mosaicOriginX + cropLeft, mosaicOriginY + cropTop],
  };
}
