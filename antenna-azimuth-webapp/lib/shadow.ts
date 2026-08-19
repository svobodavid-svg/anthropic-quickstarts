/**
 * Heuristic shadow-blob detection + obstruction-height estimate — server-only
 * (operates on a raw RGB pixel buffer from tiles.ts). Ported from
 * antenna-azimuth-mapper/azimuth_mapper/{shadow_detect,correction}.py.
 *
 * There's no OpenCV here, so this reimplements the same pipeline shape by
 * hand: grayscale -> Otsu threshold -> morphological open/close -> connected
 * components -> PCA orientation per blob. Two deliberate simplifications
 * versus the Python/OpenCV version, both fine for a heuristic: (1) area and
 * orientation are computed from every filled pixel in a blob rather than
 * just its boundary contour, and (2) the oriented bounding extent is
 * computed by projecting onto the PCA axes rather than a true
 * minimum-area rotated rect — for the elongated, roughly-rectangular blobs
 * shadows produce, both track the OpenCV originals closely.
 *
 * What's actually computable without per-tile sensor metadata: shadow
 * length in the image, combined with the astronomically-true sun elevation
 * for the place/time, gives a real estimate of a nearby object's height.
 * What is *not* computable from a shadow alone is the satellite's viewing
 * azimuth, so this module never invents a lean direction — see the
 * project README's "Accuracy & limitations" section.
 */
import type { SolarPosition } from "./solar";

const MIN_BLOB_AREA_PX = 25;
const MIN_ELONGATION = 2.0;
const MIN_SUN_ELEVATION_FOR_HEIGHT_DEG = 5.0;
const MAX_AXIS_ANGULAR_ERROR_DEG = 45.0;

export interface ShadowObservation {
  centroidPx: [number, number];
  /** One of the two 180-degree-apart candidate directions, compass bearing. */
  axisDegA: number;
  axisDegB: number;
  lengthPx: number;
  areaPx: number;
  distanceFromOriginPx: number;
}

export interface ShadowEstimate {
  /** Resolved direction, object base -> shadow tip. */
  shadowAzimuthDeg: number;
  /** Distance from the astronomically-expected shadow direction. */
  angularErrorDeg: number;
  shadowLengthM: number;
  estimatedObjectHeightM: number | null;
  confidence: "low" | "medium" | "high";
  centroidPx: [number, number];
}

function toGrayscale(raw: Buffer, width: number, height: number): Uint8Array {
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = raw[i * 3];
    const g = raw[i * 3 + 1];
    const b = raw[i * 3 + 2];
    // Same luma weights OpenCV's cv2.COLOR_RGB2GRAY uses.
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  return gray;
}

function otsuThreshold(gray: Uint8Array): number {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];

  let sumB = 0;
  let wB = 0;
  let maxVariance = -1;
  let threshold = 0;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const meanB = sumB / wB;
    const meanF = (sum - sumB) / wF;
    const variance = wB * wF * (meanB - meanF) * (meanB - meanF);
    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }
  return threshold;
}

function morphPass(
  mask: Uint8Array,
  width: number,
  height: number,
  mode: "erode" | "dilate"
): Uint8Array {
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = mode === "erode" ? 1 : 0;
      for (let dy = -1; dy <= 1 && (mode === "erode" ? value === 1 : value === 0); dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          const neighbor = nx >= 0 && nx < width && ny >= 0 && ny < height ? mask[ny * width + nx] : 0;
          if (mode === "erode" && neighbor === 0) {
            value = 0;
            break;
          }
          if (mode === "dilate" && neighbor === 1) {
            value = 1;
            break;
          }
        }
      }
      out[y * width + x] = value;
    }
  }
  return out;
}

function morphOpen(mask: Uint8Array, width: number, height: number): Uint8Array {
  return morphPass(morphPass(mask, width, height, "erode"), width, height, "dilate");
}

function morphClose(mask: Uint8Array, width: number, height: number): Uint8Array {
  return morphPass(morphPass(mask, width, height, "dilate"), width, height, "erode");
}

function connectedComponents(mask: Uint8Array, width: number, height: number): [number, number][][] {
  const visited = new Uint8Array(width * height);
  const components: [number, number][][] = [];

  for (let start = 0; start < mask.length; start++) {
    if (mask[start] !== 1 || visited[start] === 1) continue;

    const component: [number, number][] = [];
    const stack = [start];
    visited[start] = 1;
    while (stack.length > 0) {
      const idx = stack.pop()!;
      const x = idx % width;
      const y = Math.floor(idx / width);
      component.push([x, y]);

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const nIdx = ny * width + nx;
          if (mask[nIdx] === 1 && visited[nIdx] === 0) {
            visited[nIdx] = 1;
            stack.push(nIdx);
          }
        }
      }
    }
    components.push(component);
  }
  return components;
}

function principalAxis(points: [number, number][]) {
  const n = points.length;
  let sx = 0;
  let sy = 0;
  for (const [x, y] of points) {
    sx += x;
    sy += y;
  }
  const cx = sx / n;
  const cy = sy / n;

  let cxx = 0;
  let cyy = 0;
  let cxy = 0;
  for (const [x, y] of points) {
    const dx = x - cx;
    const dy = y - cy;
    cxx += dx * dx;
    cyy += dy * dy;
    cxy += dx * dy;
  }
  cxx /= n;
  cyy /= n;
  cxy /= n;

  const trace = cxx + cyy;
  const det = cxx * cyy - cxy * cxy;
  const disc = Math.sqrt(Math.max(0, (trace * trace) / 4 - det));
  const lambdaMajor = trace / 2 + disc;

  let vx: number;
  let vy: number;
  if (Math.abs(cxy) > 1e-9) {
    vx = lambdaMajor - cyy;
    vy = cxy;
  } else if (cxx >= cyy) {
    vx = 1;
    vy = 0;
  } else {
    vx = 0;
    vy = 1;
  }
  const norm = Math.hypot(vx, vy) || 1;
  vx /= norm;
  vy /= norm;
  // Perpendicular (minor) axis.
  const mvx = -vy;
  const mvy = vx;

  let majorMin = Infinity;
  let majorMax = -Infinity;
  let minorMin = Infinity;
  let minorMax = -Infinity;
  for (const [x, y] of points) {
    const dx = x - cx;
    const dy = y - cy;
    const projMajor = dx * vx + dy * vy;
    const projMinor = dx * mvx + dy * mvy;
    if (projMajor < majorMin) majorMin = projMajor;
    if (projMajor > majorMax) majorMax = projMajor;
    if (projMinor < minorMin) minorMin = projMinor;
    if (projMinor > minorMax) minorMax = projMinor;
  }

  // Image space: x right, y down. Compass bearing: 0 = up (north), clockwise.
  const angleDeg = (((Math.atan2(vx, -vy) * 180) / Math.PI) % 360 + 360) % 360;

  return {
    centroid: [cx, cy] as [number, number],
    majorLen: majorMax - majorMin,
    minorLen: minorMax - minorMin,
    axisDegA: angleDeg,
    axisDegB: (angleDeg + 180) % 360,
  };
}

export function detectShadows(
  raw: Buffer,
  width: number,
  height: number,
  originPx: [number, number]
): ShadowObservation[] {
  const gray = toGrayscale(raw, width, height);
  const threshold = otsuThreshold(gray);

  let mask: Uint8Array<ArrayBufferLike> = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i++) mask[i] = gray[i] <= threshold ? 1 : 0;

  mask = morphOpen(mask, width, height);
  mask = morphClose(mask, width, height);

  const components = connectedComponents(mask, width, height);
  const [ox, oy] = originPx;

  const observations: ShadowObservation[] = [];
  for (const component of components) {
    if (component.length < MIN_BLOB_AREA_PX) continue;

    const { centroid, majorLen, minorLen, axisDegA, axisDegB } = principalAxis(component);
    if (majorLen / Math.max(minorLen, 1e-6) < MIN_ELONGATION) continue;

    const distance = Math.hypot(centroid[0] - ox, centroid[1] - oy);
    observations.push({
      centroidPx: centroid,
      axisDegA,
      axisDegB,
      lengthPx: majorLen,
      areaPx: component.length,
      distanceFromOriginPx: distance,
    });
  }

  observations.sort((a, b) => a.distanceFromOriginPx - b.distanceFromOriginPx);
  return observations;
}

function angularDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

export function estimateFromShadow(
  obs: ShadowObservation,
  sun: SolarPosition,
  metersPerPx: number
): ShadowEstimate | null {
  const expectedShadowAzimuth = (sun.azimuthDeg + 180) % 360;
  const errA = angularDiff(obs.axisDegA, expectedShadowAzimuth);
  const errB = angularDiff(obs.axisDegB, expectedShadowAzimuth);
  const [shadowAzimuthDeg, angularErrorDeg] = errA <= errB ? [obs.axisDegA, errA] : [obs.axisDegB, errB];

  if (sun.elevationDeg <= 0 || angularErrorDeg > MAX_AXIS_ANGULAR_ERROR_DEG) {
    return null;
  }

  const shadowLengthM = obs.lengthPx * metersPerPx;
  const estimatedObjectHeightM =
    sun.elevationDeg > MIN_SUN_ELEVATION_FOR_HEIGHT_DEG
      ? shadowLengthM * Math.tan((sun.elevationDeg * Math.PI) / 180)
      : null;

  let confidence: ShadowEstimate["confidence"];
  if (angularErrorDeg < 10 && obs.areaPx > 60) confidence = "high";
  else if (angularErrorDeg < 25) confidence = "medium";
  else confidence = "low";

  return {
    shadowAzimuthDeg,
    angularErrorDeg,
    shadowLengthM,
    estimatedObjectHeightM,
    confidence,
    centroidPx: obs.centroidPx,
  };
}

/** Nearest-to-origin candidate first; returns the first one that looks like a real shadow. */
export function bestEstimate(
  observations: ShadowObservation[],
  sun: SolarPosition,
  metersPerPx: number
): ShadowEstimate | null {
  for (const obs of observations) {
    const estimate = estimateFromShadow(obs, sun, metersPerPx);
    if (estimate !== null) return estimate;
  }
  return null;
}
