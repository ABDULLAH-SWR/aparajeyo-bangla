// Web Mercator z12 snapping, so that neighbouring viewports share one query and one cache entry (C9).
const TILES = 2 ** 12;

export type Bbox = readonly [minLng: number, minLat: number, maxLng: number, maxLat: number];

export interface TileRange {
  x0: number;
  x1: number;
  /** y grows southwards: y0 is the northern row. */
  y0: number;
  y1: number;
  /** The area those tiles cover; always contains the snapped bbox. */
  envelope: Bbox;
}

const lngToX = (lng: number) => Math.floor(((lng + 180) / 360) * TILES);
const latToY = (lat: number) => Math.floor(((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * TILES);
/** West edge of column x. */
const xToLng = (x: number) => (x / TILES) * 360 - 180;
/** North edge of row y. */
const yToLat = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / TILES))) * 180) / Math.PI;

export function snapToZ12TileRange([minLng, minLat, maxLng, maxLat]: Bbox): TileRange {
  const x0 = lngToX(minLng);
  const x1 = lngToX(maxLng);
  const y0 = latToY(maxLat);
  const y1 = latToY(minLat);
  return { x0, x1, y0, y1, envelope: [xToLng(x0), yToLat(y1 + 1), xToLng(x1 + 1), yToLat(y0)] };
}
