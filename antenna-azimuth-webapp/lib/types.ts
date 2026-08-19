export interface AzimuthRay {
  id: string;
  azimuthDeg: number;
  distanceM: number;
  beamwidthDeg: number | null;
  label: string;
}

export interface ShadowEstimateResponse {
  found: boolean;
  shadowAzimuthDeg?: number;
  angularErrorDeg?: number;
  shadowLengthM?: number;
  estimatedObjectHeightM?: number | null;
  confidence?: "low" | "medium" | "high";
  shadowLocation?: { lat: number; lon: number };
  sun: { azimuthDeg: number; elevationDeg: number };
  captureDatetime: string;
  error?: string;
}

export const RAY_COLORS = ["#ff6a3d", "#3ea1ff", "#ffd23f", "#3ddc84", "#c792ff"];
