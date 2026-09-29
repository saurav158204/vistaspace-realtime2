#!/usr/bin/env python3
"""Raspberry Pi sensor node: reads a BME280 (I2C) and the Pi's SoC temperature, POSTs to the backend (LIVE API).

  sudo raspi-config  # enable I2C
  pip install smbus2 RPi.bme280
  python raspberry_pi_bme280.py --url http://<backend-ip>:8000/api/telemetry
"""
import argparse
import json
import time
import urllib.request

import bme280
import smbus2

p = argparse.ArgumentParser()
p.add_argument("--url", default="http://127.0.0.1:8000/api/telemetry")
p.add_argument("--device", default="rack-a2-pi")
p.add_argument("--address", type=lambda x: int(x, 0), default=0x76)
a = p.parse_args()

bus = smbus2.SMBus(1)
cal = bme280.load_calibration_params(bus, a.address)
while True:
    s = bme280.sample(bus, a.address, cal)
    with open("/sys/class/thermal/thermal_zone0/temp") as f:
        soc = int(f.read()) / 1000
    msg = {"device_id": a.device, "ambient_temp_c": round(s.temperature, 2), "humidity_pct": round(s.humidity, 1),
           "pressure_hpa": round(s.pressure, 2), "device_temp_c": round(soc, 1)}
    try:
        urllib.request.urlopen(urllib.request.Request(a.url, json.dumps(msg).encode(), {"Content-Type": "application/json"}), timeout=3)
    except Exception as e:
        print("POST failed:", e)
    time.sleep(1)
