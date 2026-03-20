# MedEvac v3 — Comprehensive Implementation Plan

**Hospital Patient Evacuation Registry + Clinical Decision Support**
**Mubarak Al-Kabeer Hospital, Kuwait**

**Classification:** Life-Safety Critical
**Author:** Bader Al-Haddad, MD
**Date:** March 2026

---

## 0. Non-Negotiable Constraints

This is a crisis application. Every decision below is governed by these constraints. If a design choice violates any of these, the design choice is wrong.

1. **Must function with zero network.** The hospital's network infrastructure may be physically destroyed. WiFi may be down. Cell towers may be overloaded. The app must deliver 100% of clinical functionality — calculators, drug references, protocols, patient tracking — from cached local data alone.

2. **Must be operable under stress by any clinical staff member with zero training.** The user may be a junior doctor at 3 AM during an earthquake. Their hands may be shaking. They may be wearing gloves. Every action must be self-evident from the visual hierarchy alone. No tooltips. No onboarding flows.

3. **Must render triage decisions visible in under 2 seconds.** Color is clinical information. A triage color change must be reflected on screen before the user's finger lifts. Calculator results must appear as inputs are typed. Protocol steps must transition instantly.

4. **Must never lose patient data under any failure condition.** Browser crashes, device shutdowns, battery deaths, storage eviction, network loss mid-sync — no scenario may result in unrecoverable data loss.

5. **Must support mass casualty surge beyond normal capacity.** The system must handle 200+ patients across improvised wards (hallways, parking structures, lobbies) without performance degradation.

6. **Clinical data must be evidence-based and verifiable.** Every calculator formula must cite a peer-reviewed publication. Every drug dose must be traceable to WHO EML, BNF, or equivalent. Every protocol must follow current AHA/ERC guidelines.

---

## 1. Architecture

### 1.1 Technology Stack

**Frontend:** Single-entry-point React 18 application, built with esbuild (single-command bundler) into a deployable set of cached files. Development is modular; deployment is a cacheable bundle.

**State:** React useReducer + Context for UI state. IndexedDB (via idb-keyval) as the persistent local data store. Firebase Realtime Database for cross-device sync when network is available.

**Offline:** Service Worker with cache-first strategy for all static assets. Drug database, protocol decision trees, and calculator definitions are embedded JSON loaded into IndexedDB on first launch. After initial load, the app never requires network for clinical functionality.

**Auth:** Ward-level 4-digit PIN for zero-friction access, with optional 2-digit personal suffix for audit accountability. Admin operations require a 6-digit PIN.

**Hosting:** Firebase Hosting (primary) with GitHub Pages as a disaster-recovery mirror. CI/CD via GitHub Actions — push to main triggers deployment to both.

**PWA:** Full Progressive Web App with Web App Manifest. Installable to home screen on Android and iOS. `navigator.storage.persist()` called on first launch to prevent browser eviction.

### 1.2 Offline-First Data Flow

IndexedDB is the source of truth on each device. Firebase syncs when network is available. Clinical reference data (drugs, calculators, protocols) is embedded and requires zero network.

**Patient data writes:**
1. Write to IndexedDB immediately
2. UI updates from IndexedDB (instant)
3. Push change to sync queue
4. If online, push to Firebase Realtime DB
5. If offline, queue persists until connectivity resumes

**Patient data reads:**
1. Read from IndexedDB (instant)
2. Firebase listener merges remote changes when online
3. Conflict detection at field level (not record level)

**Clinical reference data:**
No sync required. Loaded from embedded JSON into IndexedDB on first launch. Optional manual update check from admin panel when online.

### 1.3 Data Resilience — Defense in Depth

IndexedDB can be silently wiped by iOS Safari under storage pressure, by private browsing mode, or by the user clearing browser data. A single storage layer is unacceptable for life-safety data.

**Layer 1 — IndexedDB (primary store):** All patient records, sync queue, audit log, preferences.

**Layer 2 — localStorage (compressed snapshot):** On every write, a compressed JSON snapshot of current patient data is written to localStorage. Smaller capacity but survives some eviction scenarios IndexedDB does not.

**Layer 3 — Cache API (rolling backups):** The Service Worker maintains the last 3 timestamped snapshots of patient data in a dedicated cache. Independent of both IndexedDB and localStorage.

**Layer 4 — Firebase (cloud backup):** When online, all data is synced to Firebase Realtime Database with server-side timestamps.

**Layer 5 — Periodic auto-export:** Every 30 minutes during active use, a timestamped JSON backup file is offered for download (File System Access API where available).

**Startup recovery sequence:**
1. Check IndexedDB — if data present, use it
2. If IndexedDB empty, check localStorage backup — restore and warn
3. If localStorage empty, check Cache API — restore and warn
4. If all local stores empty but online, pull from Firebase — restore and warn
5. If all stores empty and offline, start fresh — show prominent alert

### 1.4 Conflict Resolution — Field-Level Merge

"Last-write-wins" at the record level is unacceptable. During an evacuation with 5 devices updating the same patient, a record-level overwrite could silently discard a triage change, an evacuation status update, or a clinical note.

**Strategy: Field-level operational merge.**

Each change is recorded as a discrete operation:
```
{ patientId, field, newValue, oldValue, timestamp, deviceId, wardPin }
```

Non-conflicting changes to different fields merge automatically (Device A changes triage while Device B changes bed — both apply). Conflicting changes to the same field within a 60-second window are flagged as CONFLICT and surfaced to the user for manual resolution.

**Evacuation status is monotonic.** The state machine IN_WARD → STAGED → IN_TRANSIT → EVACUATED can only move forward. A write that regresses the state is rejected unless issued by an admin PIN with an explicit reversal action.

### 1.5 Clinical Data Versioning

Every piece of clinical reference data carries a version identifier:
```
{
  drugDb:       { version: "2026.03.1", sha256: "...", minAppVersion: "3.0.0" },
  protocols:    { version: "2026.03.1", sha256: "...", minAppVersion: "3.0.0" },
  calculators:  { version: "2026.03.1", sha256: "...", minAppVersion: "3.0.0" },
  labReference: { version: "2026.03.1", sha256: "...", minAppVersion: "3.0.0" }
}
```

On app startup (if online), the manifest is checked against the server. If a critical update exists, a non-dismissible banner is shown until updated. The data version is logged in every audit entry and embedded in every export.

---

## 2. Design System

### 2.1 Design Philosophy

**Operating-room monitor aesthetic.** Dark backgrounds. Color is clinical meaning — red is critical, yellow is caution, green is stable. No decorative color. No gradients on surfaces. No rounded-corner-everything softness. Precise, dense, information-first.

Every pixel exists to convey clinical state. If a visual element does not communicate patient status, triage priority, evacuation progress, or drug information, it does not belong on screen.

### 2.2 Color Tokens

**Surfaces (four levels of elevation):**
- `bg0: #0A0E14` — canvas / deepest background
- `bg1: #111318` — cards, primary containers
- `bg2: #191D24` — inputs, secondary containers
- `bg3: #22272F` — active states, pressed buttons

**Borders:**
- `border: #2A2F38` — standard dividers
- `borderLight: #343A45` — emphasized dividers

**Text (four levels of hierarchy):**
- `text0: #F0F2F5` — primary content, names, values
- `text1: #C4CAD4` — secondary content, descriptions
- `text2: #8892A0` — tertiary, labels
- `text3: #5C6370` — disabled, decorative

**Triage (SALT mapping — these are the ONLY saturated surface colors):**
- RED `#EF4444` — Immediate (life threat requiring intervention now)
- YELLOW `#FACC15` — Delayed (serious but can wait 1–4 hours)
- GREEN `#22C55E` — Minor (walking wounded, minimal intervention)
- GRAY `#6B7280` — Expectant (survivability unlikely given resources)
- BLACK `#18181B` — Deceased

**Evacuation status:**
- IN_WARD `#3B82F6` (blue)
- STAGED `#A855F7` (purple)
- IN_TRANSIT `#F59E0B` (amber)
- EVACUATED `#22C55E` (green)

**Functional accents:**
- `blue: #3B82F6` — interactive elements, links, primary actions
- `purple: #A855F7` — medication, pharmacological data
- `amber: #F59E0B` — warnings, timers, caution states
- `teal: #14B8A6` — reference data, tools

### 2.3 Typography

**UI text:** DM Sans — weights 400 (body), 500 (labels), 600 (emphasis), 700 (headings), 800 (display values). Loaded from Google Fonts CDN, cached by service worker.

**Data / numbers:** JetBrains Mono — weights 400 (body), 500 (labels), 600 (emphasis), 700 (values). All numeric displays (ages, bed numbers, calculator results, vital signs, civil IDs, timer countdowns) render in monospace for tabular alignment and rapid scanning.

### 2.4 Icons

All icons are inline SVG functions. No emoji. No icon font. No external icon library CDN dependency. Each icon accepts `(size, color)` parameters for consistent scaling. Approximately 25 icons cover the full interface: hospital, pill, calculator, alert-triangle, chart, chevron, search, syringe, droplet, shield, bed, truck, wifi, wifi-off, clock, zap, user, check, plus, x-close, back-arrow, delete, box, heart.

### 2.5 Touch Targets and Stress Ergonomics

- **Standard interactive elements:** minimum 44px touch target
- **Triage-critical buttons:** minimum 46px height, full-width where possible
- **Triage strip on patient card:** 50px wide, full card height
- **Protocol decision buttons:** 52px minimum height, full width
- **Active press feedback:** `transform: scale(0.97)` on all buttons via CSS `:active`
- **Focus states:** border-color shift to blue on all inputs
- **No webkit tap highlight:** `-webkit-tap-highlight-color: transparent` globally

### 2.6 Animation

Minimal, purposeful, fast:
- `fadeIn: 150ms` — screen transitions
- `slideUp: 200ms ease-out` — modal entry
- `slideDown: 200ms ease-out` — expandable sections
- `shake: 400ms` — error feedback (wrong PIN)
- `pulseDot: 1.5s infinite` — evacuation active indicator only

No decorative animation. No loading spinners (data is local). No skeleton screens (render is instant).

---

## 3. Module Specifications

### 3.1 Module 1 — Evacuation Registry

#### Patient Record Schema

```typescript
interface Patient {
  // Identity
  id: string;                    // UUID v4
  fullName: string;              // REQUIRED — Arabic + Latin support
  civilId: string;               // Kuwait Civil ID or MRN
  age: number;
  gender: "M" | "F";

  // Location
  ward: string;                  // "A-Male" | "A-Female" | "ICU" | "ER" | "Surge-1" etc.
  bed: string;                   // Free text — may be "Floor" in MCI mode

  // Clinical
  triage: "RED" | "YELLOW" | "GREEN" | "GRAY" | "BLACK";
  dx: string;                    // Primary diagnosis
  meds: string;                  // Key medications
  allergies: string;             // "NKDA" if none
  code: "FULL" | "DNR" | "COMFORT";
  iso: "NONE" | "CONTACT" | "DROPLET" | "AIRBORNE";

  // Transport requirements
  mobility: "AMBULATORY" | "WHEELCHAIR" | "STRETCHER" | "CRITICAL_TRANSPORT";
  o2: "NONE" | "NASAL_CANNULA" | "FACE_MASK" | "NON_REBREATHER" | "BIPAP" | "VENTILATOR";

  // Evacuation state machine
  evac: "IN_WARD" | "STAGED" | "IN_TRANSIT" | "EVACUATED" | "RETURNED" | "DECEASED";
  evacDest: string;              // Receiving facility
  evacTeam: string;              // Transport team ID
  evacTime: string;              // ISO timestamp of last status change

  // Metadata
  notes: string;
  createdAt: string;
  modifiedAt: string;
  modifiedBy: string;            // Ward PIN + optional personal suffix
  deviceId: string;
  syncStatus: "SYNCED" | "PENDING" | "CONFLICT";
  dataVersion: string;           // Clinical data version at time of record
}
```

#### UI Patterns

**Patient card (collapsed) — information hierarchy:**
1. Triage color strip (left edge, 50px wide, full height) — tap to cycle
2. Name (14px, weight 800, text0) + Age/Gender (10px, mono, text3)
3. Bed number (mono, weight 600) + Diagnosis (text2, truncated)
4. Evacuation status badge (tap to advance) + O₂/Isolation/Code/Critical tags

**Patient card (expanded) — adds:**
1. Full clinical details grid (2-column: Civil ID, Code, Mobility, O₂, Isolation, Allergies, Medications, Notes)
2. Triage quick-set row (5 buttons, direct selection)
3. Evacuation progression track (4-stage visual with past/current/next states)

**Quick Add modal — crisis-optimized entry:**
1. Triage selection FIRST (5 large buttons, pre-selected RED)
2. Name + Bed (side by side)
3. Diagnosis (single line)
4. Mobility (4 segmented buttons)
5. Toggle to Full mode for remaining fields
6. Submit button colored to match selected triage

Target: 15 seconds from tap "Add" to patient created in Quick mode.

**Mass Casualty Mode (MCI) — activated from admin panel:**
- Quick Add becomes default (full record hidden behind toggle)
- Triage is mandatory before save (no default)
- Auto-numbering for unidentified patients: MCI-001, MCI-002, etc.
- Surge wards appear in ward list (Surge-1 through Surge-5, Hallway, Lobby, Parking)
- Bed field becomes optional
- Command Center shows intake rate, triage distribution, evacuation throughput
- Deactivation requires confirmation from two admin PINs

#### Search and Filtering

- Full-text search across name, bed, civil ID — instant (< 100ms for 200 patients)
- Filter by triage category (tap count badges to toggle)
- Automatic sort: RED → YELLOW → GREEN → GRAY → BLACK

#### Command Center (Admin/Command PIN required)

- Hospital-wide census: total patients by ward, by triage, by evacuation status
- Evacuation progress: percentage complete per ward, overall
- Device fleet status: active devices, ward assignment, last sync time, battery level
- MCI toggle with dual-PIN confirmation
- Activate/deactivate evacuation event

---

### 3.2 Module 2 — Drug Reference

#### Data Sources

| Source | Content | Size | License |
|--------|---------|------|---------|
| WHO Essential Medicines List 24th ed. (2025) | ~667 medicines | ~1.5 MB | Public / WHO |
| Hospital Formulary Extension | ~200 additional drugs common at Mubarak Al-Kabeer | ~800 KB | Curated |
| Emergency Drug Cards | 30 critical drugs with precise doses, dilutions, rates | ~100 KB | Original |
| Drug Interaction Pairs | Common interaction pairs with severity and management | ~500 KB | Compiled from public sources |

Total embedded: approximately 3 MB compressed, loaded into IndexedDB on first launch.

#### Drug Record Schema

```typescript
interface Drug {
  id: string;
  genericName: string;
  brandNames: string[];
  pharmacologicalClass: string;
  atcCode: string;
  whoEml: boolean;

  indications: string[];
  contraindications: string[];
  sideEffects: { common: string[]; serious: string[] };
  warnings: string[];

  dosing: {
    indication: string;
    adult: string;
    pediatric: string;
    renalAdjustment: string;
    hepaticAdjustment: string;
    maxDose: string;
    route: string;
    frequency: string;
    notes: string;
  }[];

  emergencyCard: {
    cardiacArrestDose: string;
    anaphylaxisDose: string;
    infusionRate: string;
    dilutionInstructions: string;
    pearls: string[];
  } | null;

  interactionIds: string[];
  formulations: string[];
  searchTerms: string[];        // Aliases for fuzzy search
}
```

#### UI Patterns

**Search:** Fuzzy search across generic name, brand names, class, indications. Results in < 200ms for 800+ drugs. Recent drugs shown below search bar.

**Drug monograph screen:** Tabbed sections — Dosing (with renal/hepatic adjustments highlighted in amber), Warnings, Interactions, Formulations.

**Emergency drug cards:** Accessible from drug list AND from protocol medication steps. Large text. Dose, route, dilution, rate. Designed to be read from arm's length.

**Interaction checker:** Add 2+ drugs → check → results ranked by severity (Contraindicated, Major, Moderate, Minor) with mechanism and management.

**IV drip calculator:** Weight-based dosing. Concentration-aware. Output in mL/hr AND drops/min (configurable drop factor). Step-by-step calculation shown for verification. Pre-built profiles for: norepinephrine, dopamine, dobutamine, nitroglycerin, insulin, heparin, amiodarone.

---

### 3.3 Module 3 — Clinical Calculators

#### Input Validation Layer

Every calculator input passes through a validation wrapper before computation:

```typescript
interface InputBounds {
  hard: [number, number];   // Reject outside this range
  soft: [number, number];   // Warn but allow override
  unit: string;
}

const BOUNDS = {
  creatinine: { hard: [0.05, 40], soft: [0.2, 15], unit: "mg/dL" },
  weight:     { hard: [0.3, 400], soft: [2, 250], unit: "kg" },
  age:        { hard: [0, 130], soft: [0, 110], unit: "years" },
  heartRate:  { hard: [0, 400], soft: [20, 250], unit: "bpm" },
  sodium:     { hard: [80, 200], soft: [110, 170], unit: "mEq/L" },
  potassium:  { hard: [0.5, 15], soft: [2.0, 8.0], unit: "mEq/L" },
  glucose:    { hard: [1, 2000], soft: [20, 800], unit: "mg/dL" },
};
```

Hard limit violations are rejected with an error message. Soft limit violations show an amber warning with the entered value prominently displayed, allowing override.

#### Unit Awareness

Kuwait uses SI units. Every input field with unit ambiguity has a visible toggle:

| Parameter | Default (SI) | Alternative | Conversion |
|-----------|-------------|-------------|------------|
| Creatinine | µmol/L | mg/dL | ÷ 88.4 |
| Glucose | mmol/L | mg/dL | ÷ 0.0555 |
| BUN/Urea | mmol/L (Urea) | mg/dL (BUN) | ÷ 0.357 |
| Calcium | mmol/L | mg/dL | ÷ 0.25 |
| Bilirubin | µmol/L | mg/dL | ÷ 17.1 |

Unit preference persists in IndexedDB. Conversion happens at the input boundary — formulas always receive standard units internally.

#### Calculator Registry (50+)

**Renal:** CKD-EPI 2021 (Creatinine), CKD-EPI (Cystatin C), Cockcroft-Gault, FENa, FEUrea, Creatinine Clearance (24h), Free Water Deficit, Corrected Na (Hyperglycemia), TTKG.

**Cardiology:** CHA₂DS₂-VASc, HAS-BLED, HEART Score, TIMI (STEMI), TIMI (NSTEMI/UA), Wells PE, Wells DVT, Revised Geneva, PERC Rule, Framingham, MAP, Corrected QT (Bazett + Fridericia), ASCVD 10-Year Risk.

**Neurology:** NIHSS (15 items), GCS, Hunt & Hess, Modified Rankin Scale, ABCD², Fisher Grade, ICH Score.

**ICU / Critical Care:** APACHE II, SOFA, qSOFA, SAPS II, CURB-65, PSI/PORT, MELD-Na, Child-Pugh.

**General / Metabolic:** BMI, BSA (Mosteller + Du Bois), Ideal Body Weight, Adjusted Body Weight, Corrected Calcium, Anion Gap, Delta-Delta, Serum Osmolality, Osmolar Gap, A-a Gradient, Winter's Formula, Maintenance Fluids (4-2-1), Calvert AUC.

#### UI Pattern

**Calculator result display:**
- Value in large monospace (42px, weight 800, colored by interpretation)
- Unit below value (11px, mono, text2)
- Interpretation tag (13px, weight 700, colored)
- Citation at bottom (10px, text3)
- All inputs remain visible above result so clinician can verify what they entered

**Calculator list:**
- Grouped by category with section headers
- "Frequently Used" section at top (adaptive based on usage history stored in IndexedDB)
- Fuzzy search across all calculator names and aliases

---

### 3.4 Module 4 — Emergency Protocols

#### Protocol Engine

Protocols are structured JSON decision trees traversed step by step. The engine maintains full state:

```typescript
interface ProtocolState {
  protocolId: string;
  currentStepId: string;
  history: { stepId: string; timestamp: number; choice?: string }[];
  loopCount: Record<string, number>;
  medicationsGiven: {
    drug: string;
    dose: string;
    route: string;
    time: string;
    cumulativeDose: string;
  }[];
  timers: { id: string; startedAt: number; duration: number }[];
}
```

**Key features:**
- Full back/forward navigation without losing state
- Loop awareness for cyclic protocols (CPR cycles counted)
- Cumulative medication tally displayed persistently
- 2-minute CPR timer with countdown and color shift (amber → red → green at zero)
- Medication steps link to emergency drug cards (modal overlay, not tab switch)

#### Protocol List (30 protocols)

**ACLS (8):** Adult Cardiac Arrest VF/pVT, Adult Cardiac Arrest PEA/Asystole, Bradycardia with Pulse, Tachycardia Narrow Stable, Tachycardia Narrow Unstable, Tachycardia Wide Complex, Acute Coronary Syndrome, Suspected Stroke.

**BLS (3):** Adult BLS (Healthcare Provider), Pediatric BLS, Choking / FBAO.

**Emergency Medicine (12):** Anaphylaxis, Sepsis / Septic Shock (Hour-1 Bundle), DKA, HHS, Status Epilepticus, Acute Severe Asthma, COPD Exacerbation, Acute Heart Failure / Pulmonary Edema, Hypertensive Emergency, Massive Transfusion Protocol, RSI Checklist, Acute Upper GI Bleed.

**Toxicology (4):** General Approach + Toxidromes, Paracetamol Overdose + Rumack-Matthew, Opioid Overdose, Organophosphate Poisoning.

**Trauma (3):** Primary Survey (ATLS ABCDE), Blast Injury Assessment, Tourniquet / Hemorrhage Control (TCCC).

#### Protocol Validation

Every protocol JSON is validated at build time by a CI script:
- Every `nextStepId` references an existing step
- Every decision has ≥ 2 options
- No orphan steps (unreachable from any path)
- Every medication step references a drug in the drug database
- Every protocol has at least one endpoint step
- Timer values are positive integers

---

### 3.5 Module 5 — Scores and Tools

**Clinical Scoring Systems:** NEWS2, CURB-65, MELD-Na, Child-Pugh, SOFA, qSOFA, PSI/PORT, Caprini VTE, Padua Prediction, RCRI, 4Ts Score, PESI/sPESI, DAS28.

**Converters:** Steroid equivalence (prednisolone ↔ dexamethasone ↔ hydrocortisone ↔ methylprednisolone), Opioid equivalence (morphine milligram equivalents for 10+ opioids with route adjustments), Unit converter (SI ↔ conventional for 50+ lab values).

**Reference Tables:** Normal lab values (CBC, BMP, CMP, LFT, coags, thyroid, cardiac enzymes), Antibiotic spectrum quick reference, Acid-base interpreter (enter pH, pCO₂, HCO₃ → automated interpretation with expected compensations), Dermatome map.

---

## 4. Data Architecture

### 4.1 IndexedDB Schema

```
medevac-db
├── patients           — Patient records (synced with Firebase)
├── syncQueue          — Pending field-level operations
├── wards              — Ward configuration + PINs
├── evacuationEvents   — Active/historical evacuations
├── auditLog           — Timestamped change records
├── drugs              — Drug monographs (from embedded JSON)
├── interactions       — Drug interaction pairs
├── protocols          — Protocol decision trees
├── calcHistory        — Recent calculator results
├── devices            — Device registry entries
├── userPrefs          — UI preferences, recent drugs, unit preferences, favorites
└── backupMeta         — Backup timestamps and checksums
```

### 4.2 Audit Log Schema

```typescript
interface AuditEntry {
  id: string;
  timestamp: string;
  deviceId: string;
  wardPin: string;
  userId?: string;              // Personal suffix if used
  action:
    | "CREATE" | "UPDATE" | "DELETE"
    | "TRIAGE_CHANGE" | "EVAC_STATUS_CHANGE"
    | "LOGIN" | "EXPORT"
    | "MCI_ACTIVATE" | "MCI_DEACTIVATE"
    | "EVAC_ACTIVATE" | "EVAC_DEACTIVATE"
    | "CONFLICT_RESOLVED";
  entityType: "patient" | "ward" | "config" | "evacuation";
  entityId: string;
  previousValue?: any;
  newValue?: any;
  dataVersion: string;
}
```

### 4.3 Firebase Security Rules

```json
{
  "rules": {
    "hospitals": {
      "$hospitalId": {
        "patients": {
          "$patientId": {
            ".validate": "newData.hasChildren(['fullName','ward','triage'])",
            "triage": {
              ".validate": "newData.val().matches(/^(RED|YELLOW|GREEN|GRAY|BLACK)$/)"
            },
            "evac": {
              ".validate": "newData.val().matches(/^(IN_WARD|STAGED|IN_TRANSIT|EVACUATED|RETURNED|DECEASED)$/)"
            }
          }
        },
        "devices": { ".write": true, ".read": true },
        "audit": { ".write": true, ".read": "auth != null" }
      }
    }
  }
}
```

Firebase Anonymous Auth combined with a custom token encoding the ward PIN. Individual accounts are not required.

---

## 5. Export Specifications

| Export | Purpose | Format | Content |
|--------|---------|--------|---------|
| Triage Tag | Print and attach to patient | PDF, 1/page, full-page triage color BG | Name, ID, triage, bed, ward, dx, allergies, code status, QR linking to record |
| Handover Report | Transfer to receiving facility | PDF, structured | Complete patient record, medications, evacuation timeline |
| Ward Census | Operational tracking | CSV | All patient fields, filterable |
| MCI Log | Post-incident review | PDF + CSV | Timestamped log of all triage decisions, evacuations, conflicts |
| Command Summary | Administration / MOH | PDF, 1-page | Hospital census, triage breakdown, evacuation %, timeline |

---

## 6. Build Phases

### Phase 1 — Foundation (8 hours)
PWA shell with service worker, web app manifest, IndexedDB wrapper, bottom tab navigation (5 tabs), PIN authentication screen with ward selector, connectivity indicator, evacuation active banner. DM Sans + JetBrains Mono loaded and cached. All SVG icons implemented.
**Exit criteria:** App loads offline. PIN works. Tabs navigate. Installable as PWA on Android and iOS. Lighthouse PWA ≥ 90.

### Phase 2 — Core Calculators (16 hours)
Calculator framework: input definition → validation → unit conversion → compute → interpretation → display. Implement the 15 highest-priority calculators first (CKD-EPI, CHA₂DS₂-VASc, GCS, Wells PE, Wells DVT, NIHSS, SOFA, qSOFA, Anion Gap, Corrected Calcium, Corrected Na, A-a Gradient, MAP, BMI, BSA). Calculator search, category browsing, result interpretation with color coding. Verify each calculator against MDCalc + original publication.
**Exit criteria:** 15 calculators produce verified results. Unit toggle works for creatinine and glucose. Input validation catches implausible values.

### Phase 3 — Evacuation Registry, Offline Only (14 hours)
Patient cards with triage color coding and inline controls. Quick Add modal. Full record editing. Triage cycling (one-tap on strip). Evacuation status advancement (one-tap on badge). Sort/filter by triage, search by name/bed/ID. Triage summary bar. Ward census. All data persisted in IndexedDB with localStorage and Cache API backups.
**Exit criteria:** Can add 30 patients, triage them, advance evacuation status for all. All offline. Data persists across browser restart. Backup layers verified.

### Phase 4 — Firebase Sync Engine (16 hours)
Firebase Realtime Database integration. Field-level sync operations. Sync queue for offline operations. Real-time listeners for remote changes. Field-level conflict detection. Conflict resolution UI. Monotonic evacuation state enforcement. Audit trail writer. Device registration with heartbeat.
**Exit criteria:** Two devices sync field-level changes within 2 seconds. Offline changes sync on reconnect. Conflicting triage changes surface for resolution. Evacuation status cannot regress without admin override.

### Phase 5 — Emergency Protocols (24 hours)
Protocol engine (JSON decision tree traversal). Interactive step-by-step walkthrough UI. Decision branching with visual differentiation. Medication steps with dose/route/frequency. CPR timer (2-min cycle with audio/visual alert). Cumulative medication tally. Loop counter for cyclic protocols. Back navigation without state loss. Author all 30 protocols in JSON. Validate protocol JSON structure in CI.
**Exit criteria:** Walk through all 30 protocols end-to-end. ACLS cardiac arrest loops correctly. Timer works. Drug doses verified against AHA 2025.

### Phase 6 — Drug Reference (35 hours)
Curate drug database JSON: WHO EML 24th ed. base + hospital formulary extension (200 drugs). Drug search (fuzzy, by name/class/indication). Drug monograph display (dosing with renal/hepatic adjustments, warnings, formulations). Emergency drug cards (30 critical drugs). Drug interaction checker (multi-drug). IV drip calculator with weight-based dosing. Category browsing.
**Exit criteria:** Search "enoxaparin" → complete monograph with renal dosing. Check warfarin + amiodarone → major interaction with management. IV norepinephrine dose calculates correctly at 0.3 mcg/kg/min for 70kg patient. All offline.

### Phase 7 — Remaining Calculators + Scores (12 hours)
Implement remaining 35+ calculators. All scoring systems (NEWS2, CURB-65, MELD-Na, etc.). Steroid converter, opioid converter, unit converter. Normal lab values reference. Antibiotic spectrum reference. Acid-base interpreter.
**Exit criteria:** All scoring systems verified against published sources. Steroid and opioid converters match BNF equivalencies.

### Phase 8 — Command Center, Admin, MCI Mode (14 hours)
Hospital-wide census dashboard. Triage breakdown across all wards. Evacuation progress. Device fleet manager. Activate/deactivate evacuation. MCI mode with dual-PIN activation. OCR import (Gemini Vision API with editable review screen and confidence indicators). Ward/PIN configuration. Export (CSV, PDF triage tags, handover report, command summary). Audit log viewer. Drug DB version check.
**Exit criteria:** Command center shows accurate real-time hospital census. OCR parses a patient list photo with editable review. MCI mode changes app behavior as specified. Export generates valid files.

### Phase 9 — CI/CD and Deployment (4 hours)
GitHub Actions: auto-deploy to Firebase Hosting on push to main. GitHub Actions: mirror to GitHub Pages (disaster fallback). Build script with esbuild. Protocol validation script in CI. Calculator verification test suite in CI. QR code generation for install URL. README with setup and deployment instructions.
**Exit criteria:** `git push` triggers deployment to both mirrors. Protocol validation runs on every PR. QR code posted at nursing stations.

### Phase 10 — Verification and Hardening (20 hours)
Every calculator formula verified against original publication + MDCalc (3 test cases each). 50 drugs spot-checked against BNF/WHO EML (dosing, renal adjustment, one interaction each). All 30 protocols walked through against published guideline flowcharts. Stress test: 200+ patients, 50+ offline changes, 3+ devices. Data resilience test: simulate IndexedDB eviction, localStorage clear, Cache API clear — verify recovery. Accessibility audit (touch targets, contrast, screen reader). Performance audit (Lighthouse ≥ 90). Error boundaries (app never shows white screen). Print-friendly CSS (ward census, triage tags).
**Exit criteria:** Verification matrix 100% complete. Stress test passed. Recovery from every storage failure scenario verified.

### Total Estimated Effort: 163 hours

---

## 7. Operational Readiness

### Pre-Deployment Checklist

- [ ] All 10 phases complete
- [ ] Calculator verification matrix 100% (50+ calculators × 3 test cases)
- [ ] Drug data spot-check complete (50 drugs verified)
- [ ] Protocol verification complete (30 protocols walked through)
- [ ] Firebase project configured with security rules
- [ ] Admin PIN changed from default
- [ ] Ward PINs assigned and distributed to charge nurses
- [ ] Gemini API key configured for OCR
- [ ] QR code generated and printed for each ward
- [ ] Lighthouse PWA score ≥ 90
- [ ] Offline stress test passed (200 patients, 3 devices)
- [ ] Data resilience test passed (all recovery paths verified)
- [ ] Multi-device sync test passed
- [ ] Print CSS verified (triage tags, census)
- [ ] MCI mode tested with simulated scenario

### Go-Live Sequence

1. Deploy to Firebase Hosting + verify GitHub Pages mirror
2. Install PWA on at least one device per ward
3. Verify all 5 modules work offline on installed devices
4. Brief charge nurses — 5 minutes per ward (show PIN entry, patient add, triage change, evacuation advance)
5. Brief on-call registrar — Command Center access and MCI activation
6. Print QR codes — post at each nursing station
7. Run tabletop exercise with department heads
8. Run live drill — simulated MCI, 30 mock patients, 5 wards, 3 devices
9. Debrief and iterate

### Training Mode

A **Drill Mode** accessible from the admin panel:
- Populates the app with 30 simulated patients across 5 wards
- Watermarked "DRILL — NOT REAL DATA" on every screen
- Allows staff to practice full workflow
- Resets cleanly without affecting production data

---

## 8. File Structure

```
MedEvac/
├── src/
│   ├── app.jsx                 # Root component, routing, tabs
│   ├── design/
│   │   ├── tokens.js           # Color, typography, spacing tokens
│   │   └── icons.jsx           # All SVG icon functions
│   ├── modules/
│   │   ├── evacuation/
│   │   │   ├── EvacModule.jsx
│   │   │   ├── PatientCard.jsx
│   │   │   ├── QuickAdd.jsx
│   │   │   ├── PatientDetail.jsx
│   │   │   └── CommandCenter.jsx
│   │   ├── drugs/
│   │   │   ├── DrugModule.jsx
│   │   │   ├── DrugMonograph.jsx
│   │   │   ├── InteractionChecker.jsx
│   │   │   └── IVDripCalc.jsx
│   │   ├── calculators/
│   │   │   ├── CalcModule.jsx
│   │   │   ├── CalcEngine.jsx
│   │   │   ├── InputValidator.js
│   │   │   ├── UnitConverter.js
│   │   │   └── definitions/    # One file per calculator
│   │   ├── protocols/
│   │   │   ├── ProtoModule.jsx
│   │   │   ├── ProtoEngine.jsx
│   │   │   └── ProtoWalkthrough.jsx
│   │   └── scores/
│   │       ├── ScoresModule.jsx
│   │       └── tools/          # Converters, references
│   ├── data/
│   │   ├── sync.js             # Firebase sync engine
│   │   ├── storage.js          # IndexedDB + backup layers
│   │   ├── audit.js            # Audit log writer
│   │   └── device.js           # Device registration
│   ├── auth/
│   │   └── PinScreen.jsx
│   └── shared/
│       ├── Tag.jsx
│       ├── Modal.jsx
│       └── Timer.jsx
├── data/
│   ├── drugs.json              # ~3 MB compressed
│   ├── interactions.json
│   ├── protocols.json          # 30 protocol decision trees
│   └── labs-reference.json
├── public/
│   ├── index.html              # Shell HTML
│   ├── sw.js                   # Service worker
│   ├── manifest.json           # PWA manifest
│   └── icons/                  # App icons (192, 512)
├── scripts/
│   ├── build.sh                # esbuild one-liner → dist/
│   ├── validate-protocols.js   # CI: protocol JSON validation
│   └── verify-calculators.js   # CI: calculator test suite
├── firebase.json
├── database.rules.json
├── .github/
│   └── workflows/
│       ├── deploy.yml          # Firebase + GitHub Pages
│       └── validate.yml        # Protocol + calculator checks
└── README.md
```

Development is modular. Deployment is bundled. `build.sh` runs esbuild to produce a single JS bundle + static assets, all cached by the service worker. One command, one output, sub-second build.

---

## 9. What This Plan Does Not Cover (Future Work)

- **Vitals trending:** Timestamped HR, BP, RR, SpO₂, Temp, GCS entries with trend arrows and NEWS2 auto-calculation. Requires additional patient schema fields and a vitals entry UI. Phase 11 candidate.
- **Handover generator:** Structured shift-change handover grouped by acuity with change-since-last-handover highlighting. Phase 11 candidate.
- **Multi-language UI:** Arabic labels for critical UI elements, RTL text support in name fields. Phase 12 candidate.
- **WASM computation:** If future features require heavy computation (offline pharmacokinetic modeling, AI triage), the calculator architecture is designed to be replaceable with WASM modules compiled from Rust.
- **Native app:** The PWA approach is correct for initial deployment. A native wrapper via Capacitor or similar may be warranted if persistent storage guarantees prove insufficient on iOS Safari.

---

*This plan is designed to be executed sequentially and verified continuously. Each phase has explicit exit criteria. Clinical data is verified against published sources before deployment. The architecture prioritizes resilience over elegance, speed over features, and accuracy over scope. Lives depend on it.*
