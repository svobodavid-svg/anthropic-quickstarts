"""Turn a detected shadow + the true sun position into a bounded estimate.

What's actually computable without per-tile sensor metadata: shadow length
in the image, combined with the astronomically-true sun elevation for the
place/time, gives a real estimate of a nearby object's height (classic
shadow-length trigonometry). That's reported here.

What is *not* computable from a shadow alone is the satellite's viewing
azimuth, which is what would be needed to say which way a tall object leans
in the image (true photogrammetric relief displacement / collinearity
correction). Public satellite basemaps don't expose that per tile, so this
module never invents a lean direction — see the README's
"Accuracy & limitations" section.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from .shadow_detect import ShadowObservation
from .solar import SolarPosition

MIN_SUN_ELEVATION_FOR_HEIGHT_DEG = 5.0
MAX_AXIS_ANGULAR_ERROR_DEG = 45.0


@dataclass(frozen=True)
class ShadowEstimate:
    shadow_azimuth_deg: float  # resolved direction, object base -> shadow tip
    angular_error_deg: float  # distance from the astronomically-expected shadow direction
    shadow_length_m: float
    estimated_object_height_m: float | None
    confidence: str  # "low" | "medium" | "high"
    centroid_px: tuple[float, float]


def _angular_diff(a: float, b: float) -> float:
    d = abs(a - b) % 360
    return min(d, 360 - d)


def estimate_from_shadow(
    obs: ShadowObservation, sun: SolarPosition, meters_per_px: float
) -> ShadowEstimate | None:
    """None means the blob doesn't look like a solar shadow at this sun position."""
    expected_shadow_azimuth = (sun.azimuth_deg + 180) % 360
    err_a = _angular_diff(obs.axis_deg_a, expected_shadow_azimuth)
    err_b = _angular_diff(obs.axis_deg_b, expected_shadow_azimuth)
    shadow_azimuth, angular_error = (
        (obs.axis_deg_a, err_a) if err_a <= err_b else (obs.axis_deg_b, err_b)
    )

    if sun.elevation_deg <= 0 or angular_error > MAX_AXIS_ANGULAR_ERROR_DEG:
        return None

    shadow_length_m = obs.length_px * meters_per_px
    height = None
    if sun.elevation_deg > MIN_SUN_ELEVATION_FOR_HEIGHT_DEG:
        height = shadow_length_m * math.tan(math.radians(sun.elevation_deg))

    if angular_error < 10 and obs.area_px > 60:
        confidence = "high"
    elif angular_error < 25:
        confidence = "medium"
    else:
        confidence = "low"

    return ShadowEstimate(
        shadow_azimuth_deg=shadow_azimuth,
        angular_error_deg=angular_error,
        shadow_length_m=shadow_length_m,
        estimated_object_height_m=height,
        confidence=confidence,
        centroid_px=obs.centroid_px,
    )


def best_estimate(
    observations: list[ShadowObservation], sun: SolarPosition, meters_per_px: float
) -> ShadowEstimate | None:
    """Nearest-to-origin candidate first; return the first one that looks like a real shadow."""
    for obs in observations:
        estimate = estimate_from_shadow(obs, sun, meters_per_px)
        if estimate is not None:
            return estimate
    return None
