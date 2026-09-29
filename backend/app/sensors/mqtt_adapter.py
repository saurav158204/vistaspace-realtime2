"""MQTT adapter: subscribes to VISTA_MQTT_TOPIC; each message is one JSON payload. device_id defaults to the topic's
last segment (vistaspace/telemetry/<device>)."""
from __future__ import annotations

import logging

from .manager import SensorHub
from .parsing import parse_payload

log = logging.getLogger("vista.mqtt")


class MqttAdapter:
    name = "mqtt"

    def __init__(self, hub: SensorHub, host: str, port: int, topic: str, username: str = "", password: str = ""):
        self.hub, self.host, self.port, self.topic = hub, host, port, topic
        self.username, self.password = username, password
        self.client = None

    def start(self) -> None:
        import paho.mqtt.client as mqtt

        self.hub.set_adapter(self.name, enabled=True, host=self.host, port=self.port, topic=self.topic, state="connecting", error=None)
        c = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="vistaspace-backend")
        if self.username:
            c.username_pw_set(self.username, self.password or None)
        c.on_connect = self._on_connect
        c.on_disconnect = lambda *a, **k: self.hub.set_adapter(self.name, state="disconnected")
        c.on_message = self._on_message
        c.reconnect_delay_set(1, 15)
        try:
            c.connect_async(self.host, self.port, keepalive=30)
            c.loop_start()
        except Exception as e:
            self.hub.set_adapter(self.name, state="disconnected", error=str(e))
            log.warning("mqtt: %s", e)
        self.client = c

    def _on_connect(self, client, userdata, flags, reason_code, properties=None):
        if reason_code == 0:
            client.subscribe(self.topic)
            self.hub.set_adapter(self.name, state="connected", error=None)
        else:
            self.hub.set_adapter(self.name, state="disconnected", error=str(reason_code))

    def _on_message(self, client, userdata, msg):
        try:
            reading = parse_payload(msg.payload, default_device=msg.topic.rsplit("/", 1)[-1])
        except ValueError as e:
            self.hub.set_adapter(self.name, last_error=str(e))
            return
        if reading:
            self.hub.ingest(reading, "hardware", "mqtt")

    def stop(self) -> None:
        if self.client:
            self.client.loop_stop()
            self.client.disconnect()
