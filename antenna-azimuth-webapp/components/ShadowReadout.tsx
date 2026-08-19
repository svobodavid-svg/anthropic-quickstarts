"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ShadowEstimateResponse } from "@/lib/types";

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

const BADGE_VARIANT: Record<"low" | "medium" | "high", "muted" | "outline" | "default"> = {
  low: "muted",
  medium: "outline",
  high: "default",
};

export function ShadowReadout({ result }: { result: ShadowEstimateResponse }) {
  const captureTime = new Date(result.captureDatetime);

  return (
    <Card>
      <CardContent className="space-y-2 p-4 text-xs">
        <div className="flex items-baseline gap-2">
          <span className="w-14 flex-none text-[10px] uppercase tracking-wide text-muted-foreground">
            Sun
          </span>
          <span className="font-mono tabular-nums">
            az {result.sun.azimuthDeg.toFixed(1)}° · elev {result.sun.elevationDeg >= 0 ? "+" : ""}
            {result.sun.elevationDeg.toFixed(1)}° ·{" "}
            {captureTime.toISOString().slice(0, 16).replace("T", " ")} UTC (assumed)
          </span>
        </div>

        {result.error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-destructive">
            {result.error}
          </div>
        )}

        {!result.error && !result.found && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-background p-2">
            <Badge variant="muted">no shadow</Badge>
            <span className="text-muted-foreground">
              No usable shadow detected near the origin — no obstruction-height estimate available.
            </span>
          </div>
        )}

        {result.found && (
          <div className="flex flex-wrap items-baseline gap-2 rounded-md border border-border bg-background p-2">
            <Badge variant={BADGE_VARIANT[result.confidence ?? "low"]}>
              {result.confidence} confidence
            </Badge>
            <span className="text-muted-foreground">
              shadow {formatDistance(result.shadowLengthM ?? 0)} → est. obstruction height ≈{" "}
              {result.estimatedObjectHeightM != null
                ? `${result.estimatedObjectHeightM.toFixed(1)} m`
                : "n/a — sun too low"}{" "}
              ({(result.angularErrorDeg ?? 0).toFixed(0)}° off the expected sun-shadow direction)
            </span>
          </div>
        )}

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Heuristic estimate from image shadows + true sun position, not a metadata-verified
          correction — public satellite basemaps don&rsquo;t expose the sensor&rsquo;s viewing
          angle. See the README &ldquo;Accuracy &amp; limitations&rdquo; section.
        </p>
      </CardContent>
    </Card>
  );
}
