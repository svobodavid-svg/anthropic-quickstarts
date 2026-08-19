"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

import { AzimuthControls, type GpsStatus } from "@/components/AzimuthControls";
import { ShadowReadout } from "@/components/ShadowReadout";
import { haversineDistanceM, type LatLon } from "@/lib/geometry";
import type { AzimuthRay, ShadowEstimateResponse } from "@/lib/types";

const AzimuthMap = dynamic(() => import("@/components/AzimuthMap"), { ssr: false });

/**
 * Ignore GPS fixes that haven't actually moved. A high-accuracy watch reports
 * a new position roughly once a second and consumer GPS jitters by well under
 * a metre between fixes, so without this the map re-renders (and every ray is
 * re-projected) continuously while standing still.
 */
const MIN_GPS_MOVE_M = 0.5;

function defaultRays(): AzimuthRay[] {
  return [
    {
      id: typeof crypto !== "undefined" ? crypto.randomUUID() : "ray-1",
      azimuthDeg: 45,
      distanceM: 1000,
      beamwidthDeg: null,
      label: "Ray 1",
    },
  ];
}

export default function Home() {
  const [liveOrigin, setLiveOrigin] = useState<LatLon | null>(null);
  const [manualOrigin, setManualOrigin] = useState<LatLon | null>(null);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("idle");
  const [gpsAccuracyM, setGpsAccuracyM] = useState<number | null>(null);
  const [rays, setRays] = useState<AzimuthRay[]>(defaultRays);
  const [shadowEstimate, setShadowEstimate] = useState<ShadowEstimateResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGpsStatus("unsupported");
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setLiveOrigin((prev) =>
          prev && haversineDistanceM(prev, next) < MIN_GPS_MOVE_M ? prev : next
        );
        // Rounded because it's displayed to the metre — keeping the raw float
        // would re-render on every fix even when nothing visibly changed.
        setGpsAccuracyM(Math.round(pos.coords.accuracy));
        setGpsStatus("watching");
      },
      (err) => {
        setGpsStatus(err.code === err.PERMISSION_DENIED ? "denied" : "error");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const origin = manualOrigin ?? liveOrigin;

  const handleUseLiveGps = useCallback(() => setManualOrigin(null), []);

  const handleAnalyze = useCallback(async () => {
    if (!origin) return;
    setAnalyzing(true);
    try {
      const resp = await fetch("/api/shadow-estimate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lat: origin.lat, lon: origin.lon }),
      });
      const data: ShadowEstimateResponse = await resp.json();
      setShadowEstimate(data);
    } catch (err) {
      setShadowEstimate({
        found: false,
        sun: { azimuthDeg: 0, elevationDeg: 0 },
        captureDatetime: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setAnalyzing(false);
    }
  }, [origin]);

  return (
    <main className="flex h-dvh flex-col md:flex-row">
      <div className="relative h-[45vh] p-3 md:h-full md:flex-1 md:p-4">
        <AzimuthMap
          origin={origin}
          rays={rays}
          shadowEstimate={shadowEstimate}
          onOriginMove={setManualOrigin}
        />
      </div>

      <aside className="flex min-h-0 flex-1 flex-col overflow-y-auto border-t border-border md:h-full md:w-[380px] md:flex-none md:border-l md:border-t-0">
        <div className="flex-none border-b border-border px-4 py-3">
          <h1 className="text-sm font-bold uppercase tracking-wide text-brand">Azimuth Mapper</h1>
          <p className="text-[11px] text-muted-foreground">Live GPS + satellite azimuth plotting</p>
        </div>

        <AzimuthControls
          rays={rays}
          onRaysChange={setRays}
          origin={origin}
          gpsStatus={gpsStatus}
          gpsAccuracyM={manualOrigin ? null : gpsAccuracyM}
          manualOverride={manualOrigin !== null}
          onManualOriginChange={setManualOrigin}
          onUseLiveGps={handleUseLiveGps}
          onAnalyze={handleAnalyze}
          analyzing={analyzing}
        />

        {shadowEstimate && (
          <div className="flex-none px-4 pb-4">
            <ShadowReadout result={shadowEstimate} />
          </div>
        )}
      </aside>
    </main>
  );
}
