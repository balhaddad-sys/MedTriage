import { addAuditEntry } from './storage.js';

let currentWardPin = '';
let currentUserId = '';
let currentDeviceId = '';

export function setAuditContext({ wardPin, userId, deviceId }) {
  if (wardPin) currentWardPin = wardPin;
  if (userId) currentUserId = userId;
  if (deviceId) currentDeviceId = deviceId;
}

export async function logAction(action, entityType, entityId, { previousValue, newValue } = {}) {
  await addAuditEntry({
    action,
    entityType,
    entityId,
    previousValue,
    newValue,
    wardPin: currentWardPin,
    userId: currentUserId,
    deviceId: currentDeviceId,
    dataVersion: '3.0.0',
  });
}

export async function logTriageChange(patientId, oldTriage, newTriage) {
  return logAction('TRIAGE_CHANGE', 'patient', patientId, {
    previousValue: oldTriage,
    newValue: newTriage,
  });
}

export async function logEvacStatusChange(patientId, oldStatus, newStatus) {
  return logAction('EVAC_STATUS_CHANGE', 'patient', patientId, {
    previousValue: oldStatus,
    newValue: newStatus,
  });
}
