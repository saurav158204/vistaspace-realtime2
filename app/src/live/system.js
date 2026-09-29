import { useEffect, useState } from 'react';

/*
 * Real browser/device metrics. Anything the browser cannot measure is reported as null ("unavailable"), never guessed.
 *   online           navigator.onLine
 *   connection       navigator.connection (Chromium): effectiveType, downlink Mb/s, rtt ms — browser estimates
 *   heap             performance.memory (Chromium): used / limit JS heap, MB
 *   battery          navigator.getBattery(): level, charging
 *   permissions      camera / microphone permission state via navigator.permissions
 */
export function useSystemMetrics() {
  const [m, setM] = useState({ online: navigator.onLine, connection: null, heap: null, battery: null, permissions: {} });
  useEffect(() => {
    let battery = null, stop = false;
    const perms = {};
    const watchPerm = async name => {
      try {
        const p = await navigator.permissions.query({ name });
        perms[name] = p.state; p.onchange = () => { perms[name] = p.state; };
      } catch { perms[name] = null; }
    };
    if (navigator.permissions) { watchPerm('camera'); watchPerm('microphone'); }
    if (navigator.getBattery) navigator.getBattery().then(b => { battery = b; }).catch(() => {});
    const read = () => {
      if (stop) return;
      const c = navigator.connection;
      const mem = performance.memory;
      setM({
        online: navigator.onLine,
        connection: c ? { type: c.effectiveType || null, downlink: c.downlink ?? null, rtt: c.rtt ?? null } : null,
        heap: mem ? { used: mem.usedJSHeapSize / 1048576, limit: mem.jsHeapSizeLimit / 1048576 } : null,
        battery: battery ? { level: battery.level, charging: battery.charging } : null,
        permissions: { ...perms },
      });
    };
    read();
    const id = setInterval(read, 1000);
    window.addEventListener('online', read); window.addEventListener('offline', read);
    return () => { stop = true; clearInterval(id); window.removeEventListener('online', read); window.removeEventListener('offline', read); };
  }, []);
  return m;
}
