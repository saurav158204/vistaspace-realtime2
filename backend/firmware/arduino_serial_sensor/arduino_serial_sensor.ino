// VISTASpace serial sensor node (Arduino Uno/Nano/Mega, ESP32 over USB, Pi Pico with Arduino core).
// Prints one JSON telemetry object per line at 115200 baud. The backend reads it with VISTA_SERIAL_PORT.
//
// Wiring (defaults): DHT22 data -> D2 (10k pull-up to 5V/3V3).  Optional: TMP36 analog -> A0 as "device" temperature.
// Libraries: "DHT sensor library" by Adafruit (+ "Adafruit Unified Sensor").
#include <DHT.h>

#define DHT_PIN 2
#define DHT_TYPE DHT22
#define TMP36_PIN A0          // comment out if not fitted
#define DEVICE_ID "rack-a2-uno"
#define PERIOD_MS 1000

DHT dht(DHT_PIN, DHT_TYPE);

void setup() {
  Serial.begin(115200);
  dht.begin();
  Serial.println("VISTASpace sensor node booting");   // non-JSON lines are ignored by the backend
}

void loop() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  Serial.print("{\"device_id\":\"" DEVICE_ID "\"");
  if (!isnan(t)) { Serial.print(",\"ambient_temp_c\":"); Serial.print(t, 2); }
  if (!isnan(h)) { Serial.print(",\"humidity_pct\":"); Serial.print(h, 1); }
#ifdef TMP36_PIN
  float mv = analogRead(TMP36_PIN) * (5000.0 / 1023.0);       // use 3300.0 on 3.3 V boards
  Serial.print(",\"device_temp_c\":"); Serial.print((mv - 500.0) / 10.0, 2);
#endif
  Serial.print(",\"custom\":{\"uptime_s\":"); Serial.print(millis() / 1000); Serial.print("}");
  Serial.println("}");
  delay(PERIOD_MS);
}
