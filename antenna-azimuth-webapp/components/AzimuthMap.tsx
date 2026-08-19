"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useRef } from "react";
import { MapContainer, Marker, Polygon, Polyline, TileLayer, useMap } from "react-leaflet";

import { destinationPoint, type LatLon } from "@/lib/geometry";
import { RAY_COLORS, type AzimuthRay, type ShadowEstimateResponse } from "@/lib/types";

const ESRI_WORLD_IMAGERY_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_ATTRIBUTION =
  "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community";

function dotIcon(color: string, size: number, ring = true) {
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span style="
      display:block;width:${size}px;height:${size}px;border-radius:999px;
      background:${color};box-shadow:0 0 0 2px #fff${ring ? ", 0 0 0 4px " + color + "66" : ""};
    "></span>`,
  });
}

const originIcon = dotIcon("#ffffff", 14);
const shadowIcon = dotIcon("#ffffff", 12, false);

function wedgePoints(origin: LatLon, azimuthDeg: number, beamwidthDeg: number, distanceM: number) {
  const start = azimuthDeg - beamwidthDeg / 2;
  const end = azimuthDeg + beamwidthDeg / 2;
  const steps = Math.max(2, Math.round(Math.abs(beamwidthDeg) / 3));
  const points: [number, number][] = [[origin.lat, origin.lon]];
  for (let i = 0; i <= steps; i++) {
    const angle = start + ((end - start) * i) / steps;
    const dest = destinationPoint(origin, angle, distanceM);
    points.push([dest.lat, dest.lon]);
  }
  points.push([origin.lat, origin.lon]);
  return points;
}

function RecenterOnFirstFix({ origin }: { origin: LatLon | null }) {
  const map = useMap();
  const hasCentered = useRef(false);
  useEffect(() => {
    if (origin && !hasCentered.current) {
      map.setView([origin.lat, origin.lon], 18);
      hasCentered.current = true;
    }
  }, [origin, map]);
  return null;
}

function ScaleControl() {
  const map = useMap();
  useEffect(() => {
    const control = L.control.scale({ imperial: false }).addTo(map);
    return () => {
      control.remove();
    };
  }, [map]);
  return null;
}

export interface AzimuthMapProps {
  origin: LatLon | null;
  rays: AzimuthRay[];
  shadowEstimate: ShadowEstimateResponse | null;
}

export default function AzimuthMap({ origin, rays, shadowEstimate }: AzimuthMapProps) {
  const fallbackCenter: [number, number] = [50.0755, 14.4378]; // Prague, shown until GPS resolves

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-border">
      <MapContainer
        center={origin ? [origin.lat, origin.lon] : fallbackCenter}
        zoom={origin ? 18 : 13}
        className="h-full w-full"
        scrollWheelZoom
      >
        <TileLayer url={ESRI_WORLD_IMAGERY_URL} attribution={ESRI_ATTRIBUTION} maxZoom={19} />
        <ScaleControl />
        <RecenterOnFirstFix origin={origin} />

        {origin &&
          rays.map((ray, i) => {
            const color = RAY_COLORS[i % RAY_COLORS.length];
            if (ray.beamwidthDeg) {
              return (
                <Polygon
                  key={ray.id}
                  positions={wedgePoints(origin, ray.azimuthDeg, ray.beamwidthDeg, ray.distanceM)}
                  pathOptions={{ color, weight: 2, fillOpacity: 0.2 }}
                />
              );
            }
            const dest = destinationPoint(origin, ray.azimuthDeg, ray.distanceM);
            return (
              <Polyline
                key={ray.id}
                positions={[
                  [origin.lat, origin.lon],
                  [dest.lat, dest.lon],
                ]}
                pathOptions={{ color, weight: 3 }}
              />
            );
          })}

        {origin && <Marker position={[origin.lat, origin.lon]} icon={originIcon} />}

        {shadowEstimate?.found && shadowEstimate.shadowLocation && (
          <Marker
            position={[shadowEstimate.shadowLocation.lat, shadowEstimate.shadowLocation.lon]}
            icon={shadowIcon}
          />
        )}
      </MapContainer>

      <div className="pointer-events-none absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 font-sans text-sm font-bold text-white backdrop-blur-sm">
        N
      </div>
    </div>
  );
}
