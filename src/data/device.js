import { getItem, setItem, STORES } from './storage.js';

const DEVICE_KEY = 'medevac-device-id';

export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export async function registerDevice(wardPin) {
  const device = {
    id: getDeviceId(),
    wardPin,
    userAgent: navigator.userAgent,
    lastSeen: new Date().toISOString(),
    online: navigator.onLine,
  };
  await setItem(STORES.devices, device.id, device);
  return device;
}

export async function updateDeviceHeartbeat() {
  const id = getDeviceId();
  const device = await getItem(STORES.devices, id);
  if (device) {
    device.lastSeen = new Date().toISOString();
    device.online = navigator.onLine;
    await setItem(STORES.devices, id, device);
  }
}
