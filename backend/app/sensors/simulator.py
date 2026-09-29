"""Simulation fallback. Emits readings ONLY while no live hardware/API source is reporting, and only when
VISTA_SIM_FALLBACK=true. Every reading is tagged source="simulated" and device_id="SIMULATOR"."""
from __future__ import annotations

import asyncio
import math
import random
import time

from ..models import IMU, Battery, TelemetryIn
from .manager import SensorHub


async def run_simulator(hub: SensorHub, interval: float) -> None:
    hub.set_adapter("simulator", enabled=True, state="standby")
    t0 = time.monotonic()
    while True:
        await asyncio.sleep(interval)
        if hub.live_source():
            hub.set_adapter("simulator", state="standby")
            continue
        hub.set_adapter("simulator", state="emitting")
        t = time.monotonic() - t0
        reading = TelemetryIn(
            device_id="SIMULATOR",
            ambient_temp_c=round(22.0 + 0.6 * math.sin(t / 90) + random.gauss(0, 0.05), 2),
            device_temp_c=round(41.0 + 2.0 * math.sin(t / 45) + random.gauss(0, 0.1), 2),
            humidity_pct=round(38 + 3 * math.sin(t / 120) + random.gauss(0, 0.2), 1),
            pressure_hpa=round(1013.2 + 0.4 * math.sin(t / 200) + random.gauss(0, 0.05), 2),
            imu=IMU(ax=round(random.gauss(0, 0.02), 3), ay=round(random.gauss(0, 0.02), 3), az=round(random.gauss(0, 0.02), 3),
                    gx=round(random.gauss(0, 0.3), 2), gy=round(random.gauss(0, 0.3), 2), gz=round(random.gauss(0, 0.3), 2)),
            battery=Battery(voltage_v=round(3.95 - t / 36000, 3), percent=max(0, round(84 - t / 600, 1)), charging=False),
            power_w=round(1.3 + 0.1 * math.sin(t / 7), 2),
            custom={"sample_chamber_c": round(4.0 + 0.2 * math.sin(t / 60), 2)},
        )
        hub.ingest(reading, "simulated", "sim")
