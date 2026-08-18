"""Render a self-contained HTML snapshot: satellite image + SVG azimuth overlay.

The image is embedded as a base64 data: URI (no external requests at view
time), so the output works when published as a Claude Artifact, whose CSP
blocks live calls to tile servers, and when just opened as a plain file.
"""

from __future__ import annotations

import base64
import math
from dataclasses import dataclass
from datetime import datetime
from io import BytesIO
from typing import Optional

from .correction import ShadowEstimate
from .geometry import LatLon
from .imagery import MapSnapshot
from .solar import SolarPosition


@dataclass(frozen=True)
class AzimuthLine:
    azimuth_deg: float
    distance_m: float
    label: str | None = None
    beamwidth_deg: float | None = None  # draws a sector wedge instead of a single ray


_COLORS = ["#ff5a36", "#2e8bff", "#ffd23f", "#33d17a", "#c77dff"]


def _polar_offset_px(azimuth_deg: float, radius_px: float) -> tuple[float, float]:
    rad = math.radians(azimuth_deg)
    return radius_px * math.sin(rad), -radius_px * math.cos(rad)


def _wedge_path(origin_px: tuple[float, float], azimuth_deg: float, beamwidth_deg: float, radius_px: float) -> str:
    ox, oy = origin_px
    start = azimuth_deg - beamwidth_deg / 2
    end = azimuth_deg + beamwidth_deg / 2
    points = [(ox, oy)]
    steps = max(2, int(abs(beamwidth_deg) / 2))
    for i in range(steps + 1):
        az = start + (end - start) * i / steps
        dx, dy = _polar_offset_px(az, radius_px)
        points.append((ox + dx, oy + dy))
    points.append((ox, oy))
    return "M " + " L ".join(f"{x:.1f},{y:.1f}" for x, y in points) + " Z"


def _escape(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def render_html(
    snapshot: MapSnapshot,
    origin_px: tuple[float, float],
    origin_latlon: LatLon,
    lines: list[AzimuthLine],
    meters_per_pixel: float,
    sun: Optional[SolarPosition] = None,
    sun_datetime: Optional[datetime] = None,
    shadow_estimate: Optional[ShadowEstimate] = None,
) -> str:
    size = snapshot.image.size[0]
    buf = BytesIO()
    snapshot.image.save(buf, format="PNG")
    data_uri = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")

    ox, oy = origin_px
    svg_parts: list[str] = []

    for i, line in enumerate(lines):
        color = _COLORS[i % len(_COLORS)]
        radius_px = line.distance_m / meters_per_pixel
        if line.beamwidth_deg:
            path = _wedge_path((ox, oy), line.azimuth_deg, line.beamwidth_deg, radius_px)
            svg_parts.append(
                f'<path d="{path}" fill="{color}" fill-opacity="0.22" '
                f'stroke="{color}" stroke-width="2"/>'
            )
        else:
            dx, dy = _polar_offset_px(line.azimuth_deg, radius_px)
            svg_parts.append(
                f'<line x1="{ox:.1f}" y1="{oy:.1f}" x2="{ox + dx:.1f}" y2="{oy + dy:.1f}" '
                f'stroke="{color}" stroke-width="3" stroke-linecap="round"/>'
            )
            svg_parts.append(f'<circle cx="{ox + dx:.1f}" cy="{oy + dy:.1f}" r="4" fill="{color}"/>')

        label = line.label or f"{line.azimuth_deg:.1f}°"
        lx, ly = _polar_offset_px(line.azimuth_deg, radius_px * 0.55)
        svg_parts.append(
            f'<text x="{ox + lx:.1f}" y="{oy + ly:.1f}" fill="{color}" font-size="13" '
            f'font-family="system-ui,sans-serif" font-weight="600" '
            f'paint-order="stroke" stroke="#0008" stroke-width="3">{_escape(label)}</text>'
        )

    if shadow_estimate is not None:
        cx, cy = shadow_estimate.centroid_px
        svg_parts.append(
            f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="9" fill="none" '
            f'stroke="#ffffff" stroke-width="2" stroke-dasharray="3,3"/>'
        )

    svg_parts.append(
        f'<circle cx="{ox:.1f}" cy="{oy:.1f}" r="6" fill="#ffffff" stroke="#111" stroke-width="2"/>'
    )

    # Compass rose (top-right)
    rose_cx, rose_cy, rose_r = size - 46, 46, 26
    svg_parts.append(
        f'<circle cx="{rose_cx}" cy="{rose_cy}" r="{rose_r}" fill="#0006" stroke="#fff" stroke-width="1.5"/>'
        f'<line x1="{rose_cx}" y1="{rose_cy + rose_r - 4}" x2="{rose_cx}" y2="{rose_cy - rose_r + 4}" '
        f'stroke="#fff" stroke-width="2"/>'
        f'<text x="{rose_cx}" y="{rose_cy - rose_r + 2}" fill="#fff" font-size="13" '
        f'font-family="system-ui,sans-serif" font-weight="700" text-anchor="middle">N</text>'
    )

    # Scale bar (bottom-left)
    bar_m = _nice_scale_length(size * 0.25 * meters_per_pixel)
    bar_px = bar_m / meters_per_pixel
    bar_x, bar_y = 16, size - 22
    svg_parts.append(
        f'<line x1="{bar_x}" y1="{bar_y}" x2="{bar_x + bar_px:.1f}" y2="{bar_y}" stroke="#fff" stroke-width="3"/>'
        f'<line x1="{bar_x}" y1="{bar_y - 5}" x2="{bar_x}" y2="{bar_y + 5}" stroke="#fff" stroke-width="3"/>'
        f'<line x1="{bar_x + bar_px:.1f}" y1="{bar_y - 5}" x2="{bar_x + bar_px:.1f}" y2="{bar_y + 5}" stroke="#fff" stroke-width="3"/>'
        f'<text x="{bar_x}" y="{bar_y - 8}" fill="#fff" font-size="12" '
        f'font-family="system-ui,sans-serif" paint-order="stroke" stroke="#0008" stroke-width="3">'
        f'{_format_distance(bar_m)}</text>'
    )

    legend_lines = [f"Origin: {origin_latlon.lat:.6f}, {origin_latlon.lon:.6f}"]
    for i, line in enumerate(lines):
        legend_lines.append(
            f"● azimuth {line.azimuth_deg:.1f}°"
            + (f" ±{line.beamwidth_deg:.0f}°" if line.beamwidth_deg else "")
            + f", {_format_distance(line.distance_m)}"
            + (f" — {line.label}" if line.label else "")
        )
    if sun is not None and sun_datetime is not None:
        legend_lines.append(
            f"Sun position used: az {sun.azimuth_deg:.1f}°, elev {sun.elevation_deg:.1f}° "
            f"at {sun_datetime.strftime('%Y-%m-%d %H:%M UTC')}"
        )
    if shadow_estimate is not None:
        height_txt = (
            f"{shadow_estimate.estimated_object_height_m:.1f} m"
            if shadow_estimate.estimated_object_height_m is not None
            else "n/a (sun too low)"
        )
        legend_lines.append(
            f"Shadow found near origin (dashed circle): length "
            f"{_format_distance(shadow_estimate.shadow_length_m)}, "
            f"estimated object height ≈ {height_txt} "
            f"[{shadow_estimate.confidence} confidence, "
            f"{shadow_estimate.angular_error_deg:.0f}° from expected sun-shadow direction]"
        )
    else:
        legend_lines.append(
            "No usable shadow detected near the origin — no obstruction-height estimate available."
        )
    legend_lines.append(
        "Note: this is a heuristic estimate from image shadows + true sun position, not a "
        "metadata-verified correction — public satellite basemaps do not expose the sensor's "
        "viewing angle. See README 'Accuracy & limitations'."
    )

    legend_html = "".join(f"<div>{_escape(t)}</div>" for t in legend_lines)

    return f"""<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Azimuth map</title>
<style>
  :root {{ color-scheme: light dark; }}
  body {{ margin: 0; font-family: system-ui, sans-serif; background: #111; color: #eee; }}
  .wrap {{ max-width: {size}px; margin: 0 auto; }}
  .map {{ position: relative; width: 100%; }}
  .map svg {{ display: block; width: 100%; height: auto; }}
  .legend {{ padding: 10px 14px; font-size: 13px; line-height: 1.5; background: #1a1a1a; }}
  .legend div:last-child {{ margin-top: 6px; opacity: 0.7; font-size: 12px; }}
</style>
</head>
<body>
<div class="wrap">
  <div class="map">
    <svg viewBox="0 0 {size} {size}" xmlns="http://www.w3.org/2000/svg">
      <image href="{data_uri}" x="0" y="0" width="{size}" height="{size}"/>
      {''.join(svg_parts)}
    </svg>
  </div>
  <div class="legend">{legend_html}</div>
</div>
</body>
</html>
"""


def _nice_scale_length(raw_m: float) -> float:
    if raw_m <= 0:
        return 10.0
    magnitude = 10 ** math.floor(math.log10(raw_m))
    for mult in (1, 2, 5, 10):
        candidate = magnitude * mult
        if candidate >= raw_m:
            return candidate
    return magnitude * 10


def _format_distance(meters: float) -> str:
    return f"{meters / 1000:.1f} km" if meters >= 1000 else f"{meters:.0f} m"
