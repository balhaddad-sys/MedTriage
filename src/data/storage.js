// IndexedDB storage engine — single database, multiple object stores
// Replaces idb-keyval which creates separate DBs per store (causes transaction conflicts)
import { validatePatient, assessOcrImportReadiness } from '../modules/evacuation/ocrPatientSchema.js';

const DB_NAME = 'medevac-v3';
const DB_VERSION = 1;

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

const ALL_STORE_NAMES = Object.values(STORES);

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of ALL_STORE_NAMES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name);
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(storeName, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const result = fn(store);
    transaction.oncomplete = () => resolve(result._result);
    transaction.onerror = () => reject(transaction.error);
    // For get operations, resolve with the request result
    if (result instanceof IDBRequest) {
      result.onsuccess = () => { result._result = result.result; };
    }
  });
}

// ====== GENERIC CRUD ======

// Robust transaction with retry + timeout
async function txRetry(storeName, mode, fn, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const db = await openDB();
      return await new Promise((resolve, reject) => {
        let t, timeout;
        try {
          t = db.transaction(storeName, mode);
        } catch (e) {
          dbPromise = null; // Force reconnect
          throw e;
        }
        const store = t.objectStore(storeName);
        const result = fn(store);
        timeout = setTimeout(() => reject(new Error('Transaction timeout')), 15000);
        t.oncomplete = () => { clearTimeout(timeout); resolve(result instanceof IDBRequest ? result.result : undefined); };
        t.onerror = () => { clearTimeout(timeout); reject(t.error); };
        t.onabort = () => { clearTimeout(timeout); reject(new Error('Transaction aborted')); };
        if (result instanceof IDBRequest) { result.onsuccess = () => {}; }
      });
    } catch (e) {
      if (attempt === retries - 1) throw e;
      dbPromise = null;
      await new Promise(r => setTimeout(r, 100 * (attempt + 1)));
    }
  }
}

export async function getItem(storeName, key) {
  return txRetry(storeName, 'readonly', s => s.get(key));
}

export async function setItem(storeName, key, value) {
  await txRetry(storeName, 'readwrite', s => s.put(value, key));
  if (storeName === STORES.patients) scheduleBackup();
}

export async function deleteItem(storeName, key) {
  await txRetry(storeName, 'readwrite', s => s.delete(key));
  if (storeName === STORES.patients) scheduleBackup();
}

export async function getAllKeys(storeName) {
  return txRetry(storeName, 'readonly', s => s.getAllKeys());
}

export async function getAllItems(storeName) {
  const result = await txRetry(storeName, 'readonly', s => s.getAll());
  return result || [];
}

// ====== PATIENT-SPECIFIC OPERATIONS ======

export async function getPatients() {
  return getAllItems(STORES.patients);
}

export async function getPatient(id) {
  return getItem(STORES.patients, id);
}

export async function savePatient(patient) {
  const validation = validatePatient(patient);
  if (!validation.valid) {
    throw new Error(validation.errors[0] || 'Patient record failed validation');
  }
  const existingPatient = patient?.id ? await getPatient(patient.id) : null;
  if (patient?.ocrImported && !existingPatient) {
    const readiness = assessOcrImportReadiness(patient, validation);
    if (!readiness.ready) {
      throw new Error(readiness.message);
    }
  }
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
    try {
      localStorage.setItem('medevac-backup', JSON.stringify(snapshot));
    } catch { /* localStorage full */ }

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
  try {
    const patients = await getPatients();
    if (patients.length > 0) return { source: 'indexeddb', patients };
  } catch (e) {
    console.warn('IndexedDB read failed:', e);
  }

  try {
    const backup = localStorage.getItem('medevac-backup');
    if (backup) {
      const data = JSON.parse(backup);
      if (data.patients && data.patients.length > 0) {
        for (const p of data.patients) await setItem(STORES.patients, p.id, p);
        return { source: 'localStorage', patients: data.patients, warning: true };
      }
    }
  } catch (e) {
    console.warn('localStorage recovery failed:', e);
  }

  try {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      const data = await new Promise((resolve) => {
        const ch = new MessageChannel();
        ch.port1.onmessage = (e) => resolve(e.data);
        navigator.serviceWorker.controller.postMessage({ type: 'GET_BACKUP' }, [ch.port2]);
        setTimeout(() => resolve(null), 3000);
      });
      if (data?.patients?.length > 0) {
        for (const p of data.patients) await setItem(STORES.patients, p.id, p);
        return { source: 'cacheAPI', patients: data.patients, warning: true };
      }
    }
  } catch (e) {
    console.warn('Cache API recovery failed:', e);
  }

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
      await setItem(STORES.backupMeta, 'lastAutoBackup', new Date().toISOString());
    } catch { /* silent */ }
  }, 30 * 60 * 1000);
}

export { STORES };
