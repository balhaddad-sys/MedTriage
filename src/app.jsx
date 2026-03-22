import React, { useState, useReducer, useCallback, useEffect, createContext, useContext } from 'react';
import { colors, fonts, triageColors, evacColors } from './design/tokens.js';
import { HospitalIcon, PillIcon, CalcIcon, ProtocolIcon, ChartIcon, WifiIcon, WifiOffIcon, AlertTriangle } from './design/icons.jsx';
import PinScreen from './auth/PinScreen.jsx';
import EvacModule from './modules/evacuation/EvacModule.jsx';
import DrugModule from './modules/drugs/DrugModule.jsx';
import CalcModule from './modules/calculators/CalcModule.jsx';
import ProtoModule from './modules/protocols/ProtoModule.jsx';
import ScoresModule from './modules/scores/ScoresModule.jsx';
import { getDeviceId, registerDevice } from './data/device.js';
import { setAuditContext } from './data/audit.js';
import { recoverData, startAutoExport, getPatients, savePatient, deletePatient } from './data/storage.js';
import { preloadOcrModels } from './modules/evacuation/ocrEngine.js';

// ====== APP CONTEXT ======
export const AppContext = createContext(null);

// ====== PATIENT REDUCER ======
function patientReducer(state, action) {
  switch (action.type) {
    case 'SET_ALL':
      return action.patients;
    case 'ADD':
      return [action.patient, ...state];
    case 'UPDATE':
      return state.map(p => p.id === action.patient.id ? action.patient : p);
    case 'DELETE':
      return state.filter(p => p.id !== action.id);
    default:
      return state;
  }
}

// ====== TAB DEFINITIONS ======
const TABS = [
  { id: 'evac', label: 'Registry', icon: HospitalIcon },
  { id: 'drugs', label: 'Drugs', icon: PillIcon },
  { id: 'calc', label: 'Calculators', icon: CalcIcon },
  { id: 'proto', label: 'Protocols', icon: ProtocolIcon },
  { id: 'scores', label: 'Scores', icon: ChartIcon },
];

// ====== STYLES ======
const styles = {
  app: {
    display: 'flex', flexDirection: 'column', height: '100%',
    background: colors.bg0, color: colors.text0, fontFamily: fonts.sans,
  },
  topBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 16px', background: colors.bg1,
    borderBottom: `1px solid ${colors.border}`,
    minHeight: '44px', flexShrink: 0,
  },
  topTitle: {
    fontSize: '15px', fontWeight: 700, color: colors.text0,
  },
  topRight: {
    display: 'flex', alignItems: 'center', gap: '12px',
  },
  connectivity: {
    display: 'flex', alignItems: 'center', gap: '4px',
    fontSize: '10px', fontWeight: 600, fontFamily: fonts.mono,
  },
  evacBanner: {
    background: colors.red + '22', borderBottom: `1px solid ${colors.red}44`,
    padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '8px',
    fontSize: '12px', fontWeight: 700, color: colors.red, flexShrink: 0,
  },
  content: {
    flex: 1, overflow: 'auto', position: 'relative',
  },
  tabBar: {
    display: 'flex', background: colors.bg1,
    borderTop: `1px solid ${colors.border}`,
    paddingBottom: 'env(safe-area-inset-bottom, 0)',
    flexShrink: 0,
  },
  tab: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '8px 0 6px', gap: '2px', cursor: 'pointer',
    background: 'none', border: 'none', color: colors.text3,
    fontSize: '10px', fontWeight: 600, fontFamily: fonts.sans,
    transition: 'color 150ms',
  },
  tabActive: {
    color: colors.blue,
  },
};

export default function App() {
  const [auth, setAuth] = useState(null);
  const [activeTab, setActiveTab] = useState('evac');
  const [online, setOnline] = useState(navigator.onLine);
  const [patients, dispatch] = useReducer(patientReducer, []);
  const [evacActive, setEvacActive] = useState(false);
  const [mciMode, setMciMode] = useState(false);
  const [recoveryWarning, setRecoveryWarning] = useState(null);

  // Online/offline detection
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Load patients on auth
  useEffect(() => {
    if (!auth) return;
    (async () => {
      const result = await recoverData();
      dispatch({ type: 'SET_ALL', patients: result.patients });
      if (result.warning) {
        setRecoveryWarning(`Data recovered from ${result.source}. Verify patient records.`);
        setTimeout(() => setRecoveryWarning(null), 10000);
      }
      setAuditContext({ wardPin: auth.pin, deviceId: getDeviceId() });
      registerDevice(auth.pin);
      startAutoExport();
      // Preload OCR models in background so scanning is instant during emergencies
      preloadOcrModels();
    })();
  }, [auth]);

  const addPatient = useCallback(async (patient) => {
    // Persistence validation gate — reject records that cannot identify a patient
    // (Civil ID scanner bypasses this since it has civilId; OCR must have name or bed)
    if (!patient.civilId && !patient.fullName && !patient.bed) {
      throw new Error('Cannot persist patient without at least a Civil ID, name, or bed number');
    }
    patient.id = patient.id || crypto.randomUUID();
    patient.createdAt = new Date().toISOString();
    patient.modifiedAt = new Date().toISOString();
    patient.deviceId = getDeviceId();
    patient.syncStatus = 'PENDING';
    patient.dataVersion = '3.0.0';
    await savePatient(patient);
    dispatch({ type: 'ADD', patient });
    return patient;
  }, []);

  const updatePatient = useCallback(async (patient) => {
    patient.modifiedAt = new Date().toISOString();
    await savePatient(patient);
    dispatch({ type: 'UPDATE', patient });
  }, []);

  const removePatient = useCallback(async (id) => {
    await deletePatient(id);
    dispatch({ type: 'DELETE', id });
  }, []);

  if (!auth) {
    return <PinScreen onAuth={setAuth} />;
  }

  const ctxValue = {
    auth, patients, addPatient, updatePatient, removePatient,
    online, evacActive, setEvacActive, mciMode, setMciMode,
  };

  const renderModule = () => {
    switch (activeTab) {
      case 'evac': return <EvacModule />;
      case 'drugs': return <DrugModule />;
      case 'calc': return <CalcModule />;
      case 'proto': return <ProtoModule />;
      case 'scores': return <ScoresModule />;
      default: return null;
    }
  };

  return (
    <AppContext.Provider value={ctxValue}>
      <div style={styles.app}>
        {/* Top bar */}
        <div style={styles.topBar}>
          <span style={styles.topTitle}>MedEvac</span>
          <div style={styles.topRight}>
            {mciMode && (
              <span style={{ fontSize: '10px', fontWeight: 800, color: colors.red,
                padding: '2px 8px', background: colors.red + '22', borderRadius: '4px' }}>
                MCI ACTIVE
              </span>
            )}
            <span style={{ fontSize: '10px', color: colors.text3, fontFamily: fonts.mono }}>
              {auth.ward?.name}
            </span>
            <div style={styles.connectivity}>
              {online ?
                <WifiIcon size={14} color={colors.green} /> :
                <WifiOffIcon size={14} color={colors.red} />
              }
              <span style={{ color: online ? colors.green : colors.red }}>
                {online ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
          </div>
        </div>

        {/* Evacuation banner */}
        {evacActive && (
          <div style={styles.evacBanner}>
            <AlertTriangle size={14} color={colors.red} />
            EVACUATION ACTIVE
            <span style={{ marginLeft: 'auto', fontSize: '10px', fontFamily: fonts.mono }}>
              {patients.filter(p => p.evac === 'EVACUATED').length}/{patients.length} evacuated
            </span>
          </div>
        )}

        {/* Recovery warning */}
        {recoveryWarning && (
          <div style={{
            background: colors.amber + '22', borderBottom: `1px solid ${colors.amber}44`,
            padding: '8px 16px', fontSize: '12px', color: colors.amber, fontWeight: 600,
          }}>
            {recoveryWarning}
          </div>
        )}

        {/* Content */}
        <div style={styles.content}>
          {renderModule()}
        </div>

        {/* Bottom tabs */}
        <div style={styles.tabBar}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button key={tab.id}
                style={{ ...styles.tab, ...(active ? styles.tabActive : {}) }}
                onClick={() => setActiveTab(tab.id)}>
                <Icon size={20} color={active ? colors.blue : colors.text3} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
