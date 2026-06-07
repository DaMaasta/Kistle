import mqtt from "mqtt";

const BROKER_URL = import.meta.env.VITE_MQTT_URL  as string;
const MQTT_USER  = import.meta.env.VITE_MQTT_USER as string;
const MQTT_PASS  = import.meta.env.VITE_MQTT_PASS as string;

function publish(topic: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(BROKER_URL, {
      username:        MQTT_USER,
      password:        MQTT_PASS,
      connectTimeout:  8000,
      reconnectPeriod: 0,
      clean:           true,
    });

    const timer = setTimeout(() => {
      client.end(true);
      reject(new Error("Verbindungs-Timeout"));
    }, 10000);

    client.on("connect", () => {
      client.publish(topic, "1", { qos: 1 }, (err) => {
        clearTimeout(timer);
        client.end();
        if (err) reject(err);
        else resolve();
      });
    });

    client.on("error", (err) => {
      clearTimeout(timer);
      client.end(true);
      reject(err);
    });
  });
}

export const publishUnlock = () => publish("kistle/nuki/unlock");
export const publishLock   = () => publish("kistle/nuki/lock");
