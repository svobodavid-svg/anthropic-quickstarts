import { NextRequest, NextResponse } from "next/server";

import { globalPixelToLonlat, metersPerPixel, type LatLon } from "@/lib/geometry";
import { bestEstimate, detectShadows } from "@/lib/shadow";
import { solarPosition } from "@/lib/solar";
import { fetchSnapshot } from "@/lib/tiles";

// `sharp` needs native bindings, so this route must run on Node, not Edge.
export const runtime = "nodejs";

const SNAPSHOT_ZOOM = 19; // close-up crop; shadows need real resolution to detect at all
const SNAPSHOT_SIZE_PX = 512;

interface RequestBody {
  lat: number;
  lon: number;
  captureDatetime?: string;
}

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { lat, lon, captureDatetime } = body;
  if (typeof lat !== "number" || typeof lon !== "number" || Number.isNaN(lat) || Number.isNaN(lon)) {
    return NextResponse.json({ error: "lat and lon must be numbers" }, { status: 400 });
  }

  const dt = captureDatetime ? new Date(captureDatetime) : new Date();
  if (Number.isNaN(dt.getTime())) {
    return NextResponse.json({ error: "captureDatetime is not a valid date" }, { status: 400 });
  }

  const origin: LatLon = { lat, lon };
  const sun = solarPosition(lat, lon, dt);

  let snapshot;
  try {
    snapshot = await fetchSnapshot(origin, SNAPSHOT_ZOOM, SNAPSHOT_SIZE_PX);
  } catch (err) {
    return NextResponse.json(
      {
        found: false,
        sun,
        captureDatetime: dt.toISOString(),
        error: `Could not fetch satellite imagery: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 502 }
    );
  }

  const originPxInCrop: [number, number] = [snapshot.width / 2, snapshot.height / 2];
  const observations = detectShadows(snapshot.raw, snapshot.width, snapshot.height, originPxInCrop);
  const metersPerPx = metersPerPixel(lat, SNAPSHOT_ZOOM);
  const estimate = bestEstimate(observations, sun, metersPerPx);

  if (!estimate) {
    return NextResponse.json({
      found: false,
      sun,
      captureDatetime: dt.toISOString(),
    });
  }

  const [globalOriginX, globalOriginY] = snapshot.originPx;
  const shadowLocation = globalPixelToLonlat(
    globalOriginX + estimate.centroidPx[0],
    globalOriginY + estimate.centroidPx[1],
    SNAPSHOT_ZOOM
  );

  return NextResponse.json({
    found: true,
    shadowAzimuthDeg: estimate.shadowAzimuthDeg,
    angularErrorDeg: estimate.angularErrorDeg,
    shadowLengthM: estimate.shadowLengthM,
    estimatedObjectHeightM: estimate.estimatedObjectHeightM,
    confidence: estimate.confidence,
    shadowLocation,
    sun,
    captureDatetime: dt.toISOString(),
  });
}
