"use client";

import { Loader2, Plus, Radar, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LatLon } from "@/lib/geometry";
import { RAY_COLORS, type AzimuthRay } from "@/lib/types";

export type GpsStatus = "idle" | "watching" | "denied" | "unsupported" | "error";

interface AzimuthControlsProps {
  rays: AzimuthRay[];
  onRaysChange: (rays: AzimuthRay[]) => void;
  origin: LatLon | null;
  gpsStatus: GpsStatus;
  gpsAccuracyM: number | null;
  manualOverride: boolean;
  onManualOriginChange: (origin: LatLon) => void;
  onUseLiveGps: () => void;
  onAnalyze: () => void;
  analyzing: boolean;
}

function newRay(index: number): AzimuthRay {
  return {
    id: crypto.randomUUID(),
    azimuthDeg: 0,
    distanceM: 1000,
    beamwidthDeg: null,
    label: `Ray ${index + 1}`,
  };
}

const GPS_STATUS_TEXT: Record<GpsStatus, string> = {
  idle: "Waiting for GPS…",
  watching: "Live GPS",
  denied: "Location permission denied",
  unsupported: "Geolocation not supported by this browser",
  error: "Could not get a GPS fix",
};

export function AzimuthControls({
  rays,
  onRaysChange,
  origin,
  gpsStatus,
  gpsAccuracyM,
  manualOverride,
  onManualOriginChange,
  onUseLiveGps,
  onAnalyze,
  analyzing,
}: AzimuthControlsProps) {
  function updateRay(id: string, patch: Partial<AzimuthRay>) {
    onRaysChange(rays.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRay(id: string) {
    onRaysChange(rays.filter((r) => r.id !== id));
  }

  function addRay() {
    onRaysChange([...rays, newRay(rays.length)]);
  }

  const gpsOk = gpsStatus === "watching" && !manualOverride;

  return (
    <div className="flex flex-col gap-4 p-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-sm">
            <span>Position</span>
            <span
              className={
                "text-[11px] font-normal " + (gpsOk ? "text-brand" : "text-muted-foreground")
              }
            >
              {manualOverride ? "Manual override" : GPS_STATUS_TEXT[gpsStatus]}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="lat">Latitude</Label>
              <Input
                id="lat"
                type="number"
                step="0.000001"
                value={origin ? origin.lat.toFixed(6) : ""}
                onChange={(e) =>
                  onManualOriginChange({ lat: Number(e.target.value), lon: origin?.lon ?? 0 })
                }
              />
            </div>
            <div>
              <Label htmlFor="lon">Longitude</Label>
              <Input
                id="lon"
                type="number"
                step="0.000001"
                value={origin ? origin.lon.toFixed(6) : ""}
                onChange={(e) =>
                  onManualOriginChange({ lat: origin?.lat ?? 0, lon: Number(e.target.value) })
                }
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{gpsAccuracyM ? `Accuracy ~${Math.round(gpsAccuracyM)} m` : " "}</span>
            {manualOverride && (
              <Button variant="link" size="sm" className="h-auto p-0 text-[11px]" onClick={onUseLiveGps}>
                Use live GPS instead
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Tip: drag the white marker on the map to reposition it.
          </p>
        </CardContent>
      </Card>

      <Card className="flex-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Azimuths</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {rays.map((ray, i) => (
            <div key={ray.id} className="rounded-lg border border-border p-3">
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 flex-none rounded-full"
                  style={{ background: RAY_COLORS[i % RAY_COLORS.length] }}
                />
                <Input
                  className="h-7 border-0 bg-transparent px-1 font-sans text-sm shadow-none"
                  value={ray.label}
                  onChange={(e) => updateRay(ray.id, { label: e.target.value })}
                  placeholder="Label"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 flex-none"
                  onClick={() => removeRay(ray.id)}
                  aria-label={`Remove ${ray.label}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label htmlFor={`az-${ray.id}`}>Azimuth °</Label>
                  <Input
                    id={`az-${ray.id}`}
                    type="number"
                    value={ray.azimuthDeg}
                    onChange={(e) => updateRay(ray.id, { azimuthDeg: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor={`dist-${ray.id}`}>Distance m</Label>
                  <Input
                    id={`dist-${ray.id}`}
                    type="number"
                    value={ray.distanceM}
                    onChange={(e) => updateRay(ray.id, { distanceM: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor={`bw-${ray.id}`}>Beamwidth °</Label>
                  <Input
                    id={`bw-${ray.id}`}
                    type="number"
                    placeholder="line"
                    value={ray.beamwidthDeg ?? ""}
                    onChange={(e) =>
                      updateRay(ray.id, {
                        beamwidthDeg: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full" onClick={addRay}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add azimuth
          </Button>
        </CardContent>
      </Card>

      <Button variant="brand" onClick={onAnalyze} disabled={!origin || analyzing}>
        {analyzing ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Radar className="mr-1.5 h-4 w-4" />
        )}
        Analyze obstruction near origin
      </Button>
    </div>
  );
}
