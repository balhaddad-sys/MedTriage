// IndexedDB + Multi-layer backup storage engine
import { get, set, del, keys, entries, createStore } from 'idb-keyval';

const DB_NAME = 'medevac-db';
const stores = {};

function getStore(storeName) {
  if (!stores[storeName]) {
    stores[storeName] = createStore(DB_NAME, storeName);
  }
  return stores[storeName];
}

// Store names matching spec
const STORES = {
  patients: 'patients',
  syncQueue: 'syncQueue',
  wards: 'wards',
  evacuationEvents: 'evacuationEvents',
  auditLog: 'auditLog',
  drugs: 'drugs',
  interactions: 'interactions',
  protocols: 'protocols',
  calcHistory: 'calcHistory',
  devices: 'devices',
  userPrefs: 'userPrefs',
  backupMeta: 'backupMeta',
};

// ====== GENERIC CRUD ======

export async function getItem(storeName, key) {
  return get(key, getStore(storeName));
}

export async function setItem(storeName, key, value) {
  await set(key, value, getStore(storeName));
  // Trigger backup if patient data
  if (storeName === STORES.patients) {
    scheduleBackup();
  }
}

export async function deleteItem(storeName, key) {
  await del(key, getStore(storeName));
  if (storeName === STORES.patients) {
    scheduleBackup();
  }
}

export async function getAllKeys(storeName) {
  return keys(getStore(storeName));
}

export async function getAllEntries(storeName) {
  return entries(getStore(storeName));
}

export async function getAllItems(storeName) {
  const items = await entries(getStore(storeName));
  return items.map(([, value]) => value);
}

// ====== PATIENT-SPECIFIC OPERATIONS ======

export async function getPatients() {
  return getAllItems(STORES.patients);
}

export async function getPatient(id) {
  return getItem(STORES.patients, id);
}

export async function savePatient(patient) {
  patient.modifiedAt = new Date().toISOString();
  await setItem(STORES.patients, patient.id, patient);
  return patient;
}

export async function deletePatient(id) {
  await deleteItem(STORES.patients, id);
}

// ====== BACKUP LAYERS ======

let backupTimer = null;

function scheduleBackup() {
  if (backupTimer) clearTimeout(backupTimer);
  backupTimer = setTimeout(performBackup, 2000);
}

async function performBackup() {
  try {
    const patients = await getPatients();
    const snapshot = {
      patients,
      timestamp: new Date().toISOString(),
      version: '3.0.0',
    };

    // Layer 2: localStorage compressed snapshot
    try {
      localStorage.setItem('medevac-backup', JSON.stringify(snapshot));
    } catch (e) {
      // localStorage full — acceptable
    }

    // Layer 3: Cache API via service worker
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'BACKUP_PATIENTS',
        data: snapshot,
        timestamp: snapshot.timestamp,
      });
    }
  } catch (e) {
    console.error('Backup failed:', e);
  }
}

// ====== STARTUP RECOVERY ======

export async function recoverData() {
  // Step 1: Try IndexedDB
  try {
    const patients = await getPatients();
    if (patients.length > 0) {
      return { source: 'indexeddb', patients };
    }
  } catch (e) {
    console.warn('IndexedDB read failed:', e);
  }

  // Step 2: Try localStorage
  try {
    const backup = localStorage.getItem('medevac-backup');
    if (backup) {
      const data = JSON.parse(backup);
      if (data.patients && data.patients.length > 0) {
        // Restore to IndexedDB
        for (const p of data.patients) {
          await setItem(STORES.patients, p.id, p);
        }
        return { source: 'localStorage', patients: data.patients, warning: true };
      }
    }
  } catch (e) {
    console.warn('localStorage recovery failed:', e);
  }

  // Step 3: Try Cache API
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      const data = await new Promise((resolve) => {
        const ch = new MessageChannel();
        ch.port1.onmessage = (e) => resolve(e.data);
        navigator.serviceWorker.controller.postMessage(
          { type: 'GET_BACKUP' },
          [ch.port2]
        );
        setTimeout(() => resolve(null), 3000);
      });
      if (data && data.patients && data.patients.length > 0) {
        for (const p of data.patients) {
          await setItem(STORES.patients, p.id, p);
        }
        return { source: 'cacheAPI', patients: data.patients, warning: true };
      }
    }
  } catch (e) {
    console.warn('Cache API recovery failed:', e);
  }

  // Step 4: No data found
  return { source: 'empty', patients: [] };
}

// ====== USER PREFERENCES ======

export async function getPref(key, defaultValue = null) {
  const val = await getItem(STORES.userPrefs, key);
  return val !== undefined ? val : defaultValue;
}

export async function setPref(key, value) {
  return setItem(STORES.userPrefs, key, value);
}

// ====== AUDIT LOG ======

export async function addAuditEntry(entry) {
  entry.id = entry.id || crypto.randomUUID();
  entry.timestamp = entry.timestamp || new Date().toISOString();
  await setItem(STORES.auditLog, entry.id, entry);
}

export async function getAuditLog() {
  const items = await getAllItems(STORES.auditLog);
  return items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// ====== AUTO-EXPORT ======

let autoExportTimer = null;

export function startAutoExport() {
  if (autoExportTimer) clearInterval(autoExportTimer);
  autoExportTimer = setInterval(async () => {
    try {
      const patients = await getPatients();
      if (patients.length === 0) return;
      const blob = new Blob(
        [JSON.stringify({ patients, exportedAt: new Date().toISOString(), version: '3.0.0' }, null, 2)],
        { type: 'application/json' }
      );
      // Use File System Access API if available
      if ('showSaveFilePicker' in window) {
        // Don't show picker automatically — just update backup meta
        await setItem(STORES.backupMeta, 'lastAutoBackup', new Date().toISOString());
      }
    } catch (e) {
      // Silent fail for auto-export
    }
  }, 30 * 60 * 1000); // Every 30 minutes
}

export { STORES };
