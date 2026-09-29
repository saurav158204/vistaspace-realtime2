#!/usr/bin/env python3
"""Hardware-data simulator for TESTING the ingest paths without real sensors.

It pretends to be a device, so the backend will label its data like a real device's (LIVE API / LIVE HARDWARE).
Use it only to test wiring; its device_id is "bench-sim" so the readings stay identifiable in the log.

  # HTTP device (→ LIVE API)
  python tools/device_simulator.py http --url http://127.0.0.1:8000/api/telemetry

  # USB-serial device via a virtual serial port (→ LIVE HARDWARE). Prints the port path; start the backend with
  # VISTA_SERIAL_PORT=<that path>. Linux/macOS only (uses a pseudo-terminal).
  python tools/device_simulator.py serial --link /tmp/vista-serial

  # MQTT device (→ LIVE HARDWARE); needs a broker, e.g. `mosquitto`
  python tools/device_simulator.py mqtt --host 127.0.0.1 --topic vistaspace/telemetry/bench-sim
"""
from __future__ import annotations

import argparse
import json
import math
import os
import random
import sys
import time
import urllib.request


def reading(t: float, device: str, spike: bool) -> dict:
    temp = 23.0 + 0.8 * math.sin(t / 30) + random.gauss(0, 0.05) + (9.0 if spike else 0.0)
    return {
        "device_id": device,
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "ambient_temp_c": round(temp, 2),
        "device_temp_c": round(44 + 1.5 * math.sin(t / 20) + random.gauss(0, 0.1), 2),
        "humidity_pct": round(41 + 2 * math.sin(t / 50) + random.gauss(0, 0.2), 1),
        "pressure_hpa": round(1012.8 + random.gauss(0, 0.05), 2),
        "imu": {"ax": round(random.gauss(0, 0.03), 3), "ay": round(random.gauss(0, 0.03), 3), "az": round(9.81 + random.gauss(0, 0.03), 3),
                "gx": round(random.gauss(0, 0.4), 2), "gy": round(random.gauss(0, 0.4), 2), "gz": round(random.gauss(0, 0.4), 2)},
        "battery": {"voltage_v": round(4.05 - t / 20000, 3), "percent": round(max(0, 92 - t / 400), 1), "charging": False},
        "power_w": round(1.1 + 0.05 * math.sin(t), 2),
        "custom": {"sample_chamber_c": round(4.2 + 0.1 * math.sin(t / 15), 2)},
    }


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("mode", choices=["http", "serial", "mqtt"])
    p.add_argument("--url", default="http://127.0.0.1:8000/api/telemetry")
    p.add_argument("--token", default="", help="bearer token if VISTA_INGEST_TOKEN is set")
    p.add_argument("--link", default="/tmp/vista-serial", help="serial mode: symlink to create for the virtual port")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=1883)
    p.add_argument("--topic", default="vistaspace/telemetry/bench-sim")
    p.add_argument("--device", default="bench-sim")
    p.add_argument("--hz", type=float, default=1.0)
    p.add_argument("--count", type=int, default=0, help="stop after N readings (0 = forever)")
    p.add_argument("--spike-at", type=int, default=0, help="add +9 °C to ambient temperature from reading N on (tests alerts)")
    a = p.parse_args()

    send = None
    if a.mode == "http":
        def send(msg: dict) -> None:
            req = urllib.request.Request(a.url, data=json.dumps(msg).encode(), method="POST",
                                         headers={"Content-Type": "application/json", **({"Authorization": "Bearer " + a.token} if a.token else {})})
            urllib.request.urlopen(req, timeout=3).read()
    elif a.mode == "serial":
        import pty
        import tty
        master, slave = pty.openpty()
        tty.setraw(slave)
        name = os.ttyname(slave)
        try:
            if os.path.islink(a.link):
                os.unlink(a.link)
            os.symlink(name, a.link)
            name = a.link
        except OSError:
            pass
        print(f"virtual serial port: {name}  (start the backend with VISTA_SERIAL_PORT={name})", flush=True)
        print("Arduino-style boot banner…", flush=True)
        os.write(master, b"VISTASpace sensor node v1.0 booting\r\n")

        def send(msg: dict) -> None:
            os.write(master, (json.dumps(msg) + "\n").encode())
    else:
        import paho.mqtt.client as mqtt
        c = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="vista-device-sim")
        c.connect(a.host, a.port)
        c.loop_start()

        def send(msg: dict) -> None:
            c.publish(a.topic, json.dumps(msg), qos=0)

    t0, n = time.monotonic(), 0
    while a.count == 0 or n < a.count:
        n += 1
        msg = reading(time.monotonic() - t0, a.device, bool(a.spike_at and n >= a.spike_at))
        try:
            send(msg)
            print(f"sent #{n}: {msg['ambient_temp_c']} °C", flush=True)
        except Exception as e:
            print(f"send failed: {e}", file=sys.stderr, flush=True)
        time.sleep(1.0 / a.hz)


if __name__ == "__main__":
    main()
