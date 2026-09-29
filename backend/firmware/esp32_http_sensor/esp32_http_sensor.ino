// VISTASpace ESP32 Wi-Fi sensor node: POSTs JSON telemetry to the backend's /api/telemetry (shown as LIVE API).
// Sensor: BME280 on I2C (SDA 21, SCL 22). Libraries: "Adafruit BME280", "Adafruit Unified Sensor".
// Set WIFI_SSID / WIFI_PASS / BACKEND_URL below. BACKEND_URL must be the backend machine's LAN IP, and the backend
// must listen on it: run uvicorn with --host 0.0.0.0 (VISTA_HOST=0.0.0.0).
#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_BME280.h>

const char* WIFI_SSID   = "YOUR_WIFI";
const char* WIFI_PASS   = "YOUR_PASSWORD";
const char* BACKEND_URL = "http://192.168.1.50:8000/api/telemetry";
const char* INGEST_TOKEN = "";              // set if VISTA_INGEST_TOKEN is configured
const char* DEVICE_ID   = "rack-a2-esp32";

Adafruit_BME280 bme;
bool bmeOk = false;

void setup() {
  Serial.begin(115200);
  bmeOk = bme.begin(0x76) || bme.begin(0x77);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) { delay(300); Serial.print("."); }
  Serial.println("\nWi-Fi connected");
}

void loop() {
  String body = String("{\"device_id\":\"") + DEVICE_ID + "\"";
  if (bmeOk) {
    body += ",\"ambient_temp_c\":" + String(bme.readTemperature(), 2);
    body += ",\"humidity_pct\":" + String(bme.readHumidity(), 1);
    body += ",\"pressure_hpa\":" + String(bme.readPressure() / 100.0F, 2);
  }
  body += ",\"device_temp_c\":" + String(temperatureRead(), 1);   // ESP32 die temperature (approximate)
  body += ",\"custom\":{\"rssi_dbm\":" + String(WiFi.RSSI()) + "}}";

  HTTPClient http;
  http.begin(BACKEND_URL);
  http.addHeader("Content-Type", "application/json");
  if (strlen(INGEST_TOKEN)) http.addHeader("Authorization", String("Bearer ") + INGEST_TOKEN);
  int code = http.POST(body);
  Serial.printf("POST %d %s\n", code, body.c_str());
  http.end();
  delay(1000);
}
