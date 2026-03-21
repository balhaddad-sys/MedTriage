// MedEvac Drug Database — 200+ Hospital Drugs with Clinical Data
// Sources: WHO EML 24th ed. (2025), BNF, Mubarak Al-Kabeer Hospital Formulary
// Each drug: genericName, brandNames, class, indications, contraindications, warnings,
//            sideEffects, dosing (with renal/hepatic adjustments), interactions, formulations

// Helper to create a drug entry with defaults
const D = (id, genericName, brandNames, pharmacologicalClass, data) => ({
  id, genericName, brandNames, pharmacologicalClass,
  atcCode: data.atc || '', whoEml: data.who ?? false,
  indications: data.ind || [], contraindications: data.ci || [],
  sideEffects: data.se || { common: [], serious: [] },
  warnings: data.warn || [],
  dosing: data.dose || [],
  emergencyCard: data.emg || null,
  interactions: data.ix || [],
  formulations: data.form || [],
  searchTerms: data.search || [],
});

// ═══════════════════════════════════════════════════════════
//  CARDIOVASCULAR
// ═══════════════════════════════════════════════════════════

const CARDIOVASCULAR = [
  D('adrenaline', 'Adrenaline (Epinephrine)', ['EpiPen'], 'Sympathomimetic', {
    atc: 'C01CA24', who: true,
    ind: ['Cardiac arrest', 'Anaphylaxis', 'Severe asthma', 'Septic shock'],
    ci: ['None absolute in emergency'],
    se: { common: ['Tachycardia', 'Tremor', 'Anxiety'], serious: ['Ventricular arrhythmia', 'Myocardial ischaemia', 'Hypertensive crisis'] },
    warn: ['Ensure correct concentration (1:1000 IM vs 1:10,000 IV)', 'Extravasation causes tissue necrosis'],
    dose: [
      { indication: 'Cardiac Arrest', adult: '1mg IV/IO every 3-5 min', pediatric: '0.01 mg/kg IV/IO (max 1mg)', renalAdjustment: 'No adjustment', hepaticAdjustment: 'No adjustment', maxDose: '1mg per dose', route: 'IV/IO', frequency: 'Every 3-5 min', notes: 'Use 1:10,000 concentration IV' },
      { indication: 'Anaphylaxis', adult: '0.5mg IM (0.5mL of 1:1000)', pediatric: '0.01 mg/kg IM (max 0.5mg)', renalAdjustment: 'No adjustment', hepaticAdjustment: 'No adjustment', maxDose: '0.5mg IM per dose', route: 'IM (anterolateral thigh)', frequency: 'Every 5-15 min PRN', notes: 'IM preferred over IV in non-arrest' },
    ],
    emg: { cardiacArrestDose: '1mg IV q3-5min', anaphylaxisDose: '0.5mg IM (1:1000)', infusionRate: '2-10 mcg/min', dilutionInstructions: 'Infusion: 1mg in 250mL NS = 4 mcg/mL', pearls: ['IM before IV for anaphylaxis', '1:1000 IM, 1:10000 IV — NEVER mix up', 'Repeat IM q5-15min if no response'] },
    ix: [{ drug: 'Beta-blockers', severity: 'Major', mechanism: 'Reduced efficacy, refractory anaphylaxis', management: 'May need glucagon if on beta-blocker' }],
    form: ['1:1000 (1mg/mL) ampoule 1mL', '1:10,000 (0.1mg/mL) pre-filled syringe 10mL'],
    search: ['epinephrine', 'epi'],
  }),
  D('noradrenaline', 'Noradrenaline (Norepinephrine)', ['Levophed'], 'Vasopressor', {
    atc: 'C01CA03', who: true,
    ind: ['Septic shock', 'Cardiogenic shock', 'Distributive shock'],
    ci: ['Hypovolaemia (correct first)'],
    se: { common: ['Hypertension', 'Bradycardia (reflex)'], serious: ['Peripheral ischaemia', 'Arrhythmia', 'Tissue necrosis (extravasation)'] },
    warn: ['Central line preferred', 'Monitor for extravasation', 'Correct hypovolaemia before starting'],
    dose: [{ indication: 'Septic Shock', adult: '0.1-0.5 mcg/kg/min, titrate to MAP >= 65', pediatric: '0.05-0.1 mcg/kg/min', renalAdjustment: 'No adjustment', hepaticAdjustment: 'No adjustment', maxDose: '3.3 mcg/kg/min', route: 'IV infusion (central)', frequency: 'Continuous', notes: 'Titrate to MAP target' }],
    emg: { cardiacArrestDose: null, anaphylaxisDose: null, infusionRate: '0.1-0.5 mcg/kg/min, titrate to MAP >= 65', dilutionInstructions: '4mg in 250mL D5W = 16 mcg/mL', pearls: ['First-line vasopressor in septic shock (SSC 2021)', 'Central line strongly preferred', 'Extravasation antidote: phentolamine 5-10mg in 10mL NS locally'] },
    form: ['4mg/4mL ampoule', '8mg/4mL ampoule'], search: ['norepinephrine', 'levophed', 'norepi'],
  }),
  D('dopamine', 'Dopamine', ['Intropin'], 'Vasopressor / Inotrope', {
    atc: 'C01CA04', who: true,
    ind: ['Cardiogenic shock', 'Symptomatic bradycardia (bridge)'],
    ci: ['Phaeochromocytoma', 'Tachyarrhythmias'],
    se: { common: ['Tachycardia', 'Nausea'], serious: ['Arrhythmia', 'Tissue necrosis'] },
    warn: ['Dose-dependent effects: low=renal, mid=inotrope, high=vasopressor'],
    dose: [{ indication: 'Shock', adult: '2-20 mcg/kg/min IV', pediatric: '2-20 mcg/kg/min', renalAdjustment: 'No adjustment', hepaticAdjustment: 'No adjustment', maxDose: '20 mcg/kg/min', route: 'IV central', frequency: 'Continuous', notes: '2-5 renal, 5-10 inotrope, 10-20 vasopressor' }],
    form: ['200mg/5mL ampoule', '400mg/5mL ampoule'], search: ['intropin'],
  }),
  D('dobutamine', 'Dobutamine', ['Dobutrex'], 'Inotrope', {
    atc: 'C01CA07', who: true,
    ind: ['Acute heart failure', 'Cardiogenic shock', 'Stress testing'],
    ci: ['HOCM', 'Severe aortic stenosis'],
    se: { common: ['Tachycardia', 'Headache'], serious: ['Arrhythmia', 'Myocardial ischaemia'] },
    dose: [{ indication: 'Acute HF / Shock', adult: '2.5-20 mcg/kg/min', pediatric: '2-20 mcg/kg/min', renalAdjustment: 'No adjustment', hepaticAdjustment: 'No adjustment', maxDose: '20 mcg/kg/min', route: 'IV', frequency: 'Continuous', notes: 'Can combine with noradrenaline' }],
    form: ['250mg/20mL vial'], search: ['dobutrex'],
  }),
  D('amiodarone', 'Amiodarone', ['Cordarone', 'Pacerone'], 'Antiarrhythmic (Class III)', {
    atc: 'C01BD01', who: true,
    ind: ['VF/pVT cardiac arrest', 'Atrial fibrillation', 'Ventricular tachycardia', 'SVT'],
    ci: ['Severe sinus node disease', 'Iodine hypersensitivity', 'Thyrotoxicosis'],
    se: { common: ['Nausea', 'Photosensitivity', 'Corneal deposits'], serious: ['Pulmonary fibrosis', 'Thyroid dysfunction', 'Hepatotoxicity', 'QT prolongation'] },
    warn: ['Monitor thyroid function', 'Monitor LFTs', 'Long half-life (40-55 days)', 'Drug interaction with warfarin — reduce dose 50%'],
    dose: [
      { indication: 'VF/pVT Cardiac Arrest', adult: '300mg IV bolus, then 150mg IV', pediatric: '5mg/kg IV/IO bolus', renalAdjustment: 'No adjustment', hepaticAdjustment: 'Use with caution', maxDose: '2.2g/24h', route: 'IV', frequency: 'Per ACLS', notes: 'Dilute in D5W only' },
      { indication: 'Stable VT/AF', adult: '150mg IV over 10min, then 1mg/min x 6h, then 0.5mg/min x 18h', pediatric: '5mg/kg IV over 20-60min', renalAdjustment: 'No adjustment', hepaticAdjustment: 'Use with caution', maxDose: '2.2g/24h', route: 'IV', frequency: '24h infusion', notes: '' },
    ],
    emg: { cardiacArrestDose: '300mg IV push, then 150mg', anaphylaxisDose: null, infusionRate: '1mg/min x 6h, then 0.5mg/min x 18h', dilutionInstructions: '900mg in 500mL D5W (1.8mg/mL). Glass bottle or polyolefin bag.', pearls: ['Dilute in D5W ONLY', 'Incompatible with NS', 'Reduce warfarin dose by 50%'] },
    ix: [
      { drug: 'Warfarin', severity: 'Major', mechanism: 'Inhibits CYP2C9 — increases warfarin levels', management: 'Reduce warfarin dose by 33-50%, monitor INR closely' },
      { drug: 'Digoxin', severity: 'Major', mechanism: 'Inhibits P-glycoprotein — increases digoxin levels', management: 'Reduce digoxin dose by 50%, monitor levels' },
      { drug: 'Simvastatin', severity: 'Contraindicated', mechanism: 'Increased risk of rhabdomyolysis', management: 'Switch to pravastatin or rosuvastatin' },
    ],
    form: ['150mg/3mL ampoule', '200mg tablets'], search: ['cordarone'],
  }),
  D('adenosine', 'Adenosine', ['Adenocard'], 'Antiarrhythmic', {
    atc: 'C01EB10', who: true,
    ind: ['SVT (diagnosis and treatment)', 'Narrow complex tachycardia'],
    ci: ['2nd/3rd degree heart block', 'Sick sinus syndrome', 'Severe asthma'],
    se: { common: ['Flushing', 'Chest tightness', 'Dyspnoea'], serious: ['Transient asystole', 'Bronchospasm', 'AF'] },
    warn: ['Give as rapid IV push followed by flush', 'Transient asystole is expected', 'Reduce dose if on dipyridamole or carbamazepine'],
    dose: [{ indication: 'SVT', adult: '6mg rapid IV push, then 12mg, then 12mg', pediatric: '0.1mg/kg (max 6mg), then 0.2mg/kg (max 12mg)', renalAdjustment: 'No adjustment', hepaticAdjustment: 'No adjustment', maxDose: '12mg per dose', route: 'IV rapid push + flush', frequency: 'q1-2min between doses', notes: 'Must be rapid push via proximal vein' }],
    emg: { cardiacArrestDose: null, anaphylaxisDose: null, infusionRate: null, dilutionInstructions: 'Use undiluted. Rapid push + 20mL NS flush.', pearls: ['6-12-12 dosing', 'Give FAST — half-life 10 seconds', 'Warn patient: chest tightness, brief asystole is normal'] },
    form: ['6mg/2mL vial'], search: ['adenocard'],
  }),
  D('atropine', 'Atropine', ['Atropine'], 'Anticholinergic', {
    atc: 'A03BA01', who: true,
    ind: ['Symptomatic bradycardia', 'Organophosphate poisoning', 'RSI premedication'],
    ci: ['Closed-angle glaucoma (relative)'],
    warn: ['Ineffective for infra-nodal block (Mobitz II, 3rd degree)'],
    dose: [
      { indication: 'Symptomatic Bradycardia', adult: '0.5mg IV q3-5min, max 3mg', pediatric: '0.02mg/kg IV (min 0.1mg)', renalAdjustment: 'No adjustment', hepaticAdjustment: 'No adjustment', maxDose: '3mg total', route: 'IV', frequency: 'q3-5min', notes: 'Doses <0.5mg may cause paradoxical bradycardia' },
      { indication: 'Organophosphate Poisoning', adult: '2-4mg IV q5-10min until secretions dry', pediatric: '0.05mg/kg IV', renalAdjustment: 'No adjustment', hepaticAdjustment: 'No adjustment', maxDose: 'No max — titrate to effect', route: 'IV', frequency: 'q5-10min', notes: 'May need 100mg+ cumulative' },
    ],
    emg: { cardiacArrestDose: null, anaphylaxisDose: null, infusionRate: null, dilutionInstructions: 'Use undiluted', pearls: ['Min dose 0.5mg (paradoxical bradycardia below this)', 'Not effective for Mobitz II or 3rd degree — pace', 'OrgP: atropinize until secretions dry'] },
    form: ['0.6mg/mL ampoule 1mL', '1mg/mL ampoule 1mL'],
  }),
  D('digoxin', 'Digoxin', ['Lanoxin'], 'Cardiac Glycoside', {
    atc: 'C01AA05', who: true,
    ind: ['AF rate control', 'Heart failure (symptomatic)'],
    ci: ['VT', 'HOCM', 'WPW', 'Hypokalaemia (correct first)'],
    se: { common: ['Nausea', 'Anorexia', 'Visual disturbance (yellow)'], serious: ['Arrhythmia', 'Heart block', 'Toxicity (narrow TI)'] },
    warn: ['Narrow therapeutic index (0.5-2.0 ng/mL)', 'Toxicity potentiated by hypokalaemia', 'Reduce dose with amiodarone'],
    dose: [{ indication: 'AF Rate Control', adult: 'Load: 500mcg PO then 250mcg q6h x2. Maint: 62.5-250mcg daily', pediatric: 'Load: 25-35mcg/kg in divided doses', renalAdjustment: 'Reduce dose if CrCl<50. 62.5mcg daily if CrCl<30', hepaticAdjustment: 'No adjustment', maxDose: '500mcg/day (loading excluded)', route: 'PO/IV', frequency: 'Once daily', notes: 'Check level 6h post-dose' }],
    ix: [{ drug: 'Amiodarone', severity: 'Major', mechanism: 'Increases digoxin levels 70-100%', management: 'Halve digoxin dose' }],
    form: ['62.5mcg tablets', '125mcg tablets', '250mcg tablets', '500mcg/2mL ampoule'],
  }),
  D('lidocaine', 'Lidocaine', ['Xylocaine'], 'Antiarrhythmic (Class Ib) / Local Anaesthetic', {
    atc: 'C01BB01', who: true,
    ind: ['VT (refractory)', 'VF (refractory)', 'Local anaesthesia'],
    ci: ['High-degree heart block', 'Severe liver disease'],
    dose: [{ indication: 'VT/VF (refractory)', adult: '1-1.5mg/kg IV bolus, then 1-4mg/min infusion', pediatric: '1mg/kg IV bolus', renalAdjustment: 'No adjustment', hepaticAdjustment: 'Reduce dose 50%', maxDose: '3mg/kg total bolus', route: 'IV', frequency: 'Bolus then infusion', notes: 'Alternative to amiodarone in VF/VT' }],
    form: ['1% (10mg/mL) vial', '2% (20mg/mL) vial'],
  }),
  D('nitroglycerin', 'Glyceryl Trinitrate (Nitroglycerin)', ['GTN', 'Nitrostat'], 'Nitrate', {
    atc: 'C01DA02', who: true,
    ind: ['Angina', 'ACS', 'Acute heart failure', 'Hypertensive emergency'],
    ci: ['Severe hypotension (SBP<90)', 'PDE5 inhibitor use (sildenafil within 24h)', 'Right ventricular infarction', 'Severe aortic stenosis'],
    se: { common: ['Headache', 'Flushing', 'Hypotension'], serious: ['Severe hypotension', 'Reflex tachycardia'] },
    dose: [
      { indication: 'Angina / ACS', adult: '0.4mg SL q5min x3, then consider infusion', pediatric: 'Not established', renalAdjustment: 'No adjustment', hepaticAdjustment: 'Use with caution', maxDose: '3 SL doses, then infusion', route: 'SL/IV', frequency: 'q5min SL', notes: 'Check BP before each dose' },
      { indication: 'IV Infusion (ACS/APO)', adult: '5-200 mcg/min IV, titrate to symptoms + BP', pediatric: '0.25-0.5 mcg/kg/min', renalAdjustment: 'No adjustment', hepaticAdjustment: 'Use with caution', maxDose: '200 mcg/min', route: 'IV', frequency: 'Continuous', notes: 'Use non-PVC tubing' },
    ],
    emg: { cardiacArrestDose: null, anaphylaxisDose: null, infusionRate: '5-200 mcg/min', dilutionInstructions: '50mg in 250mL D5W = 200 mcg/mL. Use non-PVC tubing.', pearls: ['Check SBP>90 before giving', 'Ask about PDE5 inhibitors (sildenafil, tadalafil)', 'Right ventricular MI = CONTRAINDICATED'] },
    form: ['0.4mg SL tablet', '0.4mg SL spray', '50mg/10mL ampoule (IV)'], search: ['gtn', 'nitro', 'nitrostat'],
  }),
  D('aspirin', 'Aspirin', ['Aspirin', 'Disprin'], 'Antiplatelet / NSAID', {
    atc: 'B01AC06', who: true,
    ind: ['ACS / STEMI / NSTEMI', 'Secondary prevention CVD', 'Stroke prevention'],
    ci: ['Active GI bleeding', 'Aspirin-exacerbated respiratory disease', 'Children <16 (Reye syndrome)'],
    se: { common: ['GI upset', 'Bruising'], serious: ['GI bleeding', 'Haemorrhagic stroke', 'Bronchospasm'] },
    dose: [
      { indication: 'ACS (loading)', adult: '300mg PO chewed stat', pediatric: 'Not recommended', renalAdjustment: 'Avoid if GFR<10', hepaticAdjustment: 'Avoid in severe disease', maxDose: '300mg loading', route: 'PO', frequency: 'Stat', notes: 'Chew for faster absorption' },
      { indication: 'Secondary prevention', adult: '75-100mg PO daily', pediatric: 'Not recommended', renalAdjustment: 'Avoid if GFR<10', hepaticAdjustment: 'Avoid in severe disease', maxDose: '100mg daily', route: 'PO', frequency: 'Once daily', notes: '' },
    ],
    emg: { cardiacArrestDose: null, anaphylaxisDose: null, infusionRate: null, dilutionInstructions: null, pearls: ['300mg CHEWED stat for ACS', 'Do not delay — give before ECG', 'Check for aspirin allergy/asthma'] },
    ix: [{ drug: 'Warfarin', severity: 'Major', mechanism: 'Additive bleeding risk', management: 'Use with caution, add PPI' }],
    form: ['75mg tablets', '300mg tablets', '300mg dispersible'], search: ['asa'],
  }),
  D('clopidogrel', 'Clopidogrel', ['Plavix'], 'Antiplatelet (P2Y12 Inhibitor)', {
    atc: 'B01AC04', who: true,
    ind: ['ACS (with aspirin)', 'Post-PCI', 'Stroke prevention', 'PAD'],
    ci: ['Active pathological bleeding', 'Severe liver disease'],
    se: { common: ['Bruising', 'Diarrhoea'], serious: ['Major bleeding', 'TTP (rare)'] },
    warn: ['Avoid omeprazole (use pantoprazole)', 'CYP2C19 poor metabolizers may not respond'],
    dose: [{ indication: 'ACS', adult: 'Load: 300-600mg PO. Maint: 75mg daily', pediatric: 'Not established', renalAdjustment: 'No adjustment', hepaticAdjustment: 'Avoid in severe disease', maxDose: '600mg load, 75mg daily', route: 'PO', frequency: 'Once daily', notes: '12 months DAPT post-ACS' }],
    ix: [{ drug: 'Omeprazole', severity: 'Major', mechanism: 'Reduces clopidogrel activation via CYP2C19', management: 'Use pantoprazole instead' }],
    form: ['75mg tablets', '300mg tablets'], search: ['plavix'],
  }),
  D('ticagrelor', 'Ticagrelor', ['Brilinta', 'Brilique'], 'Antiplatelet (P2Y12 Inhibitor)', {
    atc: 'B01AC24', who: false,
    ind: ['ACS (with aspirin)', 'Post-MI prevention'],
    ci: ['Active bleeding', 'History of ICH', 'Severe hepatic impairment'],
    se: { common: ['Dyspnoea', 'Bleeding', 'Headache'], serious: ['Major bleeding', 'Bradycardia'] },
    warn: ['Dyspnoea is common — not allergic, usually self-limiting', 'Do not use aspirin >100mg daily (reduces efficacy)'],
    dose: [{ indication: 'ACS', adult: 'Load: 180mg PO. Maint: 90mg BD', pediatric: 'Not established', renalAdjustment: 'No adjustment', hepaticAdjustment: 'Avoid in severe disease', maxDose: '90mg BD', route: 'PO', frequency: 'BD', notes: 'Preferred over clopidogrel in ACS' }],
    form: ['60mg tablets', '90mg tablets'], search: ['brilinta', 'brilique'],
  }),
  D('warfarin', 'Warfarin', ['Coumadin', 'Marevan'], 'Anticoagulant (Vitamin K Antagonist)', {
    atc: 'B01AA03', who: true,
    ind: ['AF stroke prevention', 'VTE treatment', 'Mechanical heart valve', 'PE'],
    ci: ['Active bleeding', 'Pregnancy (1st/3rd trimester)', 'Severe liver disease'],
    se: { common: ['Bruising', 'Minor bleeding'], serious: ['Major haemorrhage', 'Skin necrosis (rare)', 'Purple toe syndrome'] },
    warn: ['INR target 2.0-3.0 (2.5-3.5 for mechanical valves)', 'Multiple drug interactions', 'Vitamin K reversal available'],
    dose: [{ indication: 'AF / VTE', adult: '5mg daily initially, adjust by INR', pediatric: '0.2mg/kg daily, adjust by INR', renalAdjustment: 'Increased sensitivity — start low', hepaticAdjustment: 'Enhanced effect — start low', maxDose: 'Titrate to INR', route: 'PO', frequency: 'Once daily', notes: 'Check INR day 3-5, then weekly until stable' }],
    ix: [
      { drug: 'Amiodarone', severity: 'Major', mechanism: 'Increases warfarin levels 2-3x', management: 'Reduce warfarin 33-50%, monitor INR' },
      { drug: 'Aspirin', severity: 'Major', mechanism: 'Additive bleeding', management: 'Add PPI, monitor closely' },
      { drug: 'Rifampicin', severity: 'Major', mechanism: 'Induces CYP — reduces warfarin effect', management: 'Avoid combination or increase dose with close INR monitoring' },
    ],
    form: ['1mg tablets', '3mg tablets', '5mg tablets'],
  }),
  D('apixaban', 'Apixaban', ['Eliquis'], 'DOAC (Factor Xa Inhibitor)', {
    atc: 'B01AF02', who: false,
    ind: ['AF stroke prevention', 'VTE treatment', 'VTE prophylaxis (post-op)'],
    ci: ['Active pathological bleeding', 'Severe hepatic impairment with coagulopathy'],
    se: { common: ['Bruising', 'Minor bleeding', 'Nausea'], serious: ['Major bleeding', 'GI haemorrhage'] },
    warn: ['No routine monitoring needed', 'Reversal: andexanet alfa', 'Dose reduce if 2 of: age>=80, weight<=60kg, Cr>=133umol/L'],
    dose: [
      { indication: 'AF', adult: '5mg BD (reduced: 2.5mg BD)', pediatric: 'Not established', renalAdjustment: '2.5mg BD if Cr>=133 + (age>=80 OR wt<=60kg)', hepaticAdjustment: 'Avoid if severe', maxDose: '5mg BD', route: 'PO', frequency: 'BD', notes: 'Dose reduction criteria: 2 of 3 (age>=80, wt<=60, Cr>=133)' },
      { indication: 'VTE Treatment', adult: '10mg BD x 7 days, then 5mg BD', pediatric: 'Not established', renalAdjustment: 'Use with caution if CrCl<25', hepaticAdjustment: 'Avoid if severe', maxDose: '10mg BD (acute phase)', route: 'PO', frequency: 'BD', notes: '' },
    ],
    form: ['2.5mg tablets', '5mg tablets'], search: ['eliquis'],
  }),
  D('rivaroxaban', 'Rivaroxaban', ['Xarelto'], 'DOAC (Factor Xa Inhibitor)', {
    atc: 'B01AF01', who: false,
    ind: ['AF stroke prevention', 'VTE treatment', 'VTE prophylaxis', 'ACS (low dose)'],
    ci: ['Active bleeding', 'Severe hepatic impairment with coagulopathy'],
    se: { common: ['Bleeding', 'Nausea'], serious: ['Major haemorrhage', 'Hepatotoxicity (rare)'] },
    dose: [
      { indication: 'AF', adult: '20mg OD with food', pediatric: 'Not established', renalAdjustment: 'CrCl 15-49: 15mg OD. CrCl<15: avoid', hepaticAdjustment: 'Avoid if severe', maxDose: '20mg daily', route: 'PO', frequency: 'Once daily with evening meal', notes: 'Must take with food for absorption' },
      { indication: 'VTE Treatment', adult: '15mg BD x 21 days, then 20mg OD', pediatric: 'Not established', renalAdjustment: 'CrCl<30: avoid', hepaticAdjustment: 'Avoid if severe', maxDose: '15mg BD (acute)', route: 'PO', frequency: 'BD then OD', notes: '' },
    ],
    form: ['10mg tablets', '15mg tablets', '20mg tablets'], search: ['xarelto'],
  }),
  D('enoxaparin', 'Enoxaparin', ['Clexane', 'Lovenox'], 'Low Molecular Weight Heparin', {
    atc: 'B01AB05', who: true,
    ind: ['DVT/PE treatment', 'ACS', 'VTE prophylaxis', 'AF bridge'],
    ci: ['Active major bleeding', 'HIT', 'Severe thrombocytopenia'],
    se: { common: ['Injection site bruising'], serious: ['Major bleeding', 'HIT', 'Epidural haematoma'] },
    warn: ['Monitor platelets', 'Adjust dose in renal impairment', 'Caution with neuraxial anaesthesia'],
    dose: [
      { indication: 'DVT/PE Treatment', adult: '1.5mg/kg SC daily OR 1mg/kg SC q12h', pediatric: '1mg/kg SC q12h', renalAdjustment: 'CrCl<30: 1mg/kg SC daily', hepaticAdjustment: 'Use with caution', maxDose: '180mg/dose', route: 'SC', frequency: 'Daily or q12h', notes: 'Anti-Xa monitoring for obesity/renal' },
      { indication: 'VTE Prophylaxis', adult: '40mg SC daily', pediatric: '0.5mg/kg SC q12h', renalAdjustment: 'CrCl<30: 20mg SC daily', hepaticAdjustment: 'No adjustment', maxDose: '40mg daily', route: 'SC', frequency: 'Once daily', notes: '' },
    ],
    form: ['20mg syringe', '40mg syringe', '60mg syringe', '80mg syringe', '100mg syringe'], search: ['clexane', 'lovenox', 'lmwh'],
  }),
  D('heparin', 'Heparin (Unfractionated)', ['Heparin'], 'Anticoagulant', {
    atc: 'B01AB01', who: true,
    ind: ['VTE treatment', 'ACS', 'PE', 'DIC', 'Circuit anticoagulation'],
    ci: ['Active major bleeding', 'HIT'],
    warn: ['Monitor aPTT', 'Monitor platelets (HIT risk peaks day 5-10)', 'Protamine reversal available'],
    dose: [
      { indication: 'VTE Treatment', adult: '80 units/kg bolus, then 18 units/kg/h', pediatric: '75 units/kg bolus, then 20 units/kg/h', renalAdjustment: 'Monitor aPTT closely', hepaticAdjustment: 'Use with caution', maxDose: 'Titrate to aPTT 1.5-2.5x control', route: 'IV', frequency: 'Continuous', notes: 'aPTT q6h after changes' },
      { indication: 'VTE Prophylaxis', adult: '5000 units SC q8-12h', pediatric: 'Not typically used', renalAdjustment: 'No adjustment', hepaticAdjustment: 'No adjustment', maxDose: '5000 units/dose', route: 'SC', frequency: 'q8-12h', notes: '' },
    ],
    emg: { cardiacArrestDose: null, anaphylaxisDose: null, infusionRate: '18 units/kg/h', dilutionInstructions: '25,000 units in 500mL NS = 50 units/mL', pearls: ['Protamine: 1mg per 100 units given in last 2-3h', 'Check platelets baseline + day 3-5', 'aPTT target: 60-100s (lab-specific)'] },
    form: ['1000 units/mL', '5000 units/mL', '25000 units/mL'], search: ['ufh'],
  }),
  // Beta-blockers
  D('bisoprolol', 'Bisoprolol', ['Concor'], 'Beta-blocker (Selective)', {
    atc: 'C07AB07', who: true, ind: ['Heart failure', 'Hypertension', 'AF rate control'], ci: ['Severe bradycardia', 'Cardiogenic shock', 'Severe asthma'], warn: ['Do not stop abruptly', 'Mask hypoglycaemia symptoms'],
    dose: [{ indication: 'Heart Failure', adult: '1.25mg daily, titrate to 10mg', pediatric: 'Not established', renalAdjustment: 'Max 10mg daily', hepaticAdjustment: 'Max 10mg daily', maxDose: '10mg daily', route: 'PO', frequency: 'Once daily', notes: 'Titrate slowly q2 weeks' }],
    form: ['1.25mg', '2.5mg', '5mg', '10mg tablets'],
  }),
  D('metoprolol', 'Metoprolol', ['Lopressor', 'Betaloc'], 'Beta-blocker (Selective)', {
    atc: 'C07AB02', who: true, ind: ['Hypertension', 'Angina', 'AF rate control', 'Post-MI', 'Heart failure (succinate)'],
    ci: ['Severe bradycardia', 'Cardiogenic shock', 'Severe asthma'],
    dose: [
      { indication: 'Hypertension / Angina', adult: '50-100mg BD (tartrate) or 50-200mg OD (succinate)', pediatric: '1-2mg/kg/day', renalAdjustment: 'No adjustment', hepaticAdjustment: 'Reduce dose', maxDose: '200mg BD', route: 'PO', frequency: 'BD (tartrate) or OD (succinate)', notes: '' },
      { indication: 'Acute AF/SVT', adult: '2.5-5mg IV over 2min, repeat q5min x3', pediatric: 'Not recommended IV', renalAdjustment: 'No adjustment', hepaticAdjustment: 'Reduce dose', maxDose: '15mg IV total', route: 'IV', frequency: 'q5min', notes: 'Monitor BP and HR' },
    ],
    form: ['25mg', '50mg', '100mg tartrate tablets', '25mg', '50mg', '100mg', '200mg succinate XL', '1mg/mL injection'], search: ['lopressor', 'betaloc'],
  }),
  D('carvedilol', 'Carvedilol', ['Dilatrend'], 'Beta-blocker (Non-selective + Alpha)', {
    atc: 'C07AG02', who: false, ind: ['Heart failure', 'Hypertension', 'Post-MI LV dysfunction'],
    ci: ['Severe bradycardia', 'Cardiogenic shock', 'Severe asthma', 'Decompensated HF'],
    dose: [{ indication: 'Heart Failure', adult: '3.125mg BD, double q2wks to max 25-50mg BD', pediatric: 'Not established', renalAdjustment: 'No adjustment', hepaticAdjustment: 'Avoid in severe', maxDose: '25mg BD (<85kg), 50mg BD (>85kg)', route: 'PO', frequency: 'BD with food', notes: 'Titrate slowly' }],
    form: ['3.125mg', '6.25mg', '12.5mg', '25mg tablets'],
  }),
  D('atenolol', 'Atenolol', ['Tenormin'], 'Beta-blocker (Selective)', {
    atc: 'C07AB03', who: true, ind: ['Hypertension', 'Angina', 'AF rate control'],
    ci: ['Severe bradycardia', 'Cardiogenic shock'],
    dose: [{ indication: 'Hypertension / Angina', adult: '25-100mg OD', pediatric: '0.5-1mg/kg OD', renalAdjustment: 'CrCl 15-35: 50mg OD. CrCl<15: 25mg OD', hepaticAdjustment: 'No adjustment', maxDose: '100mg daily', route: 'PO', frequency: 'Once daily', notes: '' }],
    form: ['25mg', '50mg', '100mg tablets'],
  }),
  // ACE inhibitors
  D('ramipril', 'Ramipril', ['Tritace', 'Altace'], 'ACE Inhibitor', {
    atc: 'C09AA05', who: true, ind: ['Hypertension', 'Heart failure', 'Post-MI', 'Diabetic nephropathy', 'CVD prevention'],
    ci: ['Bilateral renal artery stenosis', 'Pregnancy', 'Angioedema history with ACEI'],
    se: { common: ['Dry cough', 'Hyperkalaemia', 'Dizziness'], serious: ['Angioedema', 'Renal failure', 'Hypotension'] },
    warn: ['Check renal function + K at baseline, 1-2 weeks, and after dose change', 'Stop if creatinine rises >30% or K>5.5'],
    dose: [{ indication: 'Hypertension / HF', adult: '1.25-2.5mg OD, titrate to 10mg OD', pediatric: 'Not established', renalAdjustment: 'Start 1.25mg if CrCl<40', hepaticAdjustment: 'Start low', maxDose: '10mg daily', route: 'PO', frequency: 'Once daily', notes: '' }],
    form: ['1.25mg', '2.5mg', '5mg', '10mg capsules'], search: ['tritace', 'altace', 'acei'],
  }),
  D('lisinopril', 'Lisinopril', ['Zestril', 'Prinivil'], 'ACE Inhibitor', {
    atc: 'C09AA03', who: true, ind: ['Hypertension', 'Heart failure', 'Post-MI', 'Diabetic nephropathy'],
    ci: ['Bilateral RAS', 'Pregnancy', 'Angioedema history'],
    dose: [{ indication: 'Hypertension / HF', adult: '2.5-5mg OD, titrate to 20-40mg OD', pediatric: '0.07mg/kg OD', renalAdjustment: 'Start 2.5mg if CrCl<30', hepaticAdjustment: 'No specific adjustment', maxDose: '40mg daily', route: 'PO', frequency: 'Once daily', notes: '' }],
    form: ['2.5mg', '5mg', '10mg', '20mg tablets'], search: ['zestril'],
  }),
  D('enalapril', 'Enalapril', ['Vasotec', 'Renitec'], 'ACE Inhibitor', {
    atc: 'C09AA02', who: true, ind: ['Hypertension', 'Heart failure'],
    ci: ['Bilateral RAS', 'Pregnancy', 'Angioedema history'],
    dose: [{ indication: 'Hypertension / HF', adult: '2.5-5mg OD, titrate to 20mg BD', pediatric: '0.08mg/kg/day', renalAdjustment: 'Start 2.5mg if CrCl<30', hepaticAdjustment: 'No specific adjustment', maxDose: '40mg daily', route: 'PO', frequency: 'OD-BD', notes: '' }],
    form: ['2.5mg', '5mg', '10mg', '20mg tablets'], search: ['vasotec', 'renitec'],
  }),
  // ARBs
  D('losartan', 'Losartan', ['Cozaar'], 'Angiotensin II Receptor Blocker', {
    atc: 'C09CA01', who: true, ind: ['Hypertension', 'Diabetic nephropathy', 'HF if ACEI intolerant'],
    ci: ['Pregnancy', 'Bilateral RAS'],
    dose: [{ indication: 'Hypertension', adult: '50mg OD, max 100mg', pediatric: '0.7mg/kg OD', renalAdjustment: 'No specific adjustment', hepaticAdjustment: 'Start 25mg if hepatic impairment', maxDose: '100mg daily', route: 'PO', frequency: 'Once daily', notes: '' }],
    form: ['25mg', '50mg', '100mg tablets'], search: ['cozaar', 'arb'],
  }),
  D('valsartan', 'Valsartan', ['Diovan'], 'Angiotensin II Receptor Blocker', {
    atc: 'C09CA03', who: false, ind: ['Hypertension', 'Heart failure', 'Post-MI'],
    ci: ['Pregnancy', 'Bilateral RAS'],
    dose: [{ indication: 'Hypertension', adult: '80mg OD, max 320mg', pediatric: '1.3mg/kg OD', renalAdjustment: 'No adjustment', hepaticAdjustment: 'Avoid if severe', maxDose: '320mg daily', route: 'PO', frequency: 'Once daily', notes: '' }],
    form: ['40mg', '80mg', '160mg', '320mg tablets'], search: ['diovan'],
  }),
  D('candesartan', 'Candesartan', ['Atacand'], 'Angiotensin II Receptor Blocker', {
    atc: 'C09CA06', who: false, ind: ['Hypertension', 'Heart failure'],
    ci: ['Pregnancy', 'Bilateral RAS', 'Severe hepatic impairment'],
    dose: [{ indication: 'Hypertension', adult: '8mg OD, max 32mg', pediatric: '4-8mg OD', renalAdjustment: 'Start 4mg if CrCl<30', hepaticAdjustment: 'Start 4mg', maxDose: '32mg daily', route: 'PO', frequency: 'Once daily', notes: '' }],
    form: ['4mg', '8mg', '16mg', '32mg tablets'], search: ['atacand'],
  }),
  // CCBs
  D('amlodipine', 'Amlodipine', ['Norvasc'], 'Calcium Channel Blocker (Dihydropyridine)', {
    atc: 'C08CA01', who: true, ind: ['Hypertension', 'Angina'],
    ci: ['Severe aortic stenosis', 'Cardiogenic shock'],
    se: { common: ['Ankle oedema', 'Flushing', 'Headache'], serious: ['Severe hypotension'] },
    dose: [{ indication: 'Hypertension / Angina', adult: '5mg OD, max 10mg', pediatric: '0.1mg/kg OD', renalAdjustment: 'No adjustment', hepaticAdjustment: 'Start 2.5mg', maxDose: '10mg daily', route: 'PO', frequency: 'Once daily', notes: '' }],
    form: ['5mg', '10mg tablets'], search: ['norvasc'],
  }),
  D('diltiazem', 'Diltiazem', ['Cardizem', 'Tildiem'], 'Calcium Channel Blocker (Non-DHP)', {
    atc: 'C08DB01', who: false, ind: ['AF rate control', 'Angina', 'Hypertension'],
    ci: ['Severe bradycardia', 'Heart failure with reduced EF', 'Concurrent beta-blocker IV'],
    dose: [
      { indication: 'AF Rate Control (acute)', adult: '0.25mg/kg IV over 2min, then 5-15mg/h infusion', pediatric: 'Not recommended', renalAdjustment: 'No adjustment', hepaticAdjustment: 'Reduce dose', maxDose: '0.35mg/kg bolus', route: 'IV', frequency: 'Bolus then infusion', notes: '' },
      { indication: 'AF Rate Control / Angina (chronic)', adult: '60-120mg TDS or 120-360mg OD (MR)', pediatric: 'Not established', renalAdjustment: 'No adjustment', hepaticAdjustment: 'Reduce dose', maxDose: '360mg daily', route: 'PO', frequency: 'TDS or OD (MR)', notes: '' },
    ],
    form: ['60mg', '90mg', '120mg tablets', '120mg', '180mg', '240mg', '300mg MR capsules', '5mg/mL injection'], search: ['cardizem', 'tildiem'],
  }),
  D('verapamil', 'Verapamil', ['Isoptin'], 'Calcium Channel Blocker (Non-DHP)', {
    atc: 'C08DA01', who: true, ind: ['SVT', 'AF rate control', 'Angina', 'Hypertension'],
    ci: ['Severe bradycardia', 'Heart failure', 'WPW', 'Concurrent IV beta-blocker', 'Wide-complex tachycardia'],
    dose: [{ indication: 'SVT (acute)', adult: '2.5-5mg IV over 2min, repeat 5-10mg after 15-30min', pediatric: '0.1-0.3mg/kg IV (max 5mg)', renalAdjustment: 'No adjustment', hepaticAdjustment: 'Reduce dose', maxDose: '20mg IV total', route: 'IV/PO', frequency: 'Per response', notes: 'NEVER give IV with beta-blocker' }],
    form: ['40mg', '80mg', '120mg tablets', '240mg SR', '2.5mg/mL injection'], search: ['isoptin'],
  }),
  // Diuretics
  D('furosemide', 'Furosemide', ['Lasix'], 'Loop Diuretic', {
    atc: 'C03CA01', who: true, ind: ['Heart failure', 'Pulmonary oedema', 'Oedema', 'Hyperkalaemia'],
    ci: ['Anuria', 'Severe hyponatraemia'],
    warn: ['Monitor K, Na, renal function', 'Ototoxicity at high doses/rapid infusion'],
    dose: [
      { indication: 'Acute Pulmonary Oedema', adult: '40-80mg IV', pediatric: '0.5-1mg/kg IV', renalAdjustment: 'Higher doses may be needed', hepaticAdjustment: 'Use with caution', maxDose: '600mg/day', route: 'IV/PO', frequency: 'q6-12h', notes: 'Max IV push rate 4mg/min' },
    ],
    emg: { cardiacArrestDose: null, anaphylaxisDose: null, infusionRate: '4mg/min max IV push rate', dilutionInstructions: 'Can give undiluted IV', pearls: ['Max IV push rate 4mg/min', 'Double home dose for acute decompensation'] },
    form: ['20mg', '40mg', '500mg tablets', '10mg/mL ampoule'], search: ['lasix'],
  }),
  D('spironolactone', 'Spironolactone', ['Aldactone'], 'Potassium-Sparing Diuretic (MRA)', {
    atc: 'C03DA01', who: true, ind: ['Heart failure (HFrEF)', 'Ascites', 'Resistant hypertension', 'Primary hyperaldosteronism'],
    ci: ['Hyperkalaemia (K>5.0)', 'Severe renal failure', 'Addison disease'],
    warn: ['Monitor K closely — hyperkalaemia risk', 'Gynaecomastia (dose-related)'],
    dose: [{ indication: 'Heart Failure', adult: '25mg OD, max 50mg', pediatric: '1-3mg/kg/day', renalAdjustment: 'Avoid if CrCl<30 or K>5.0', hepaticAdjustment: 'Start 25mg in cirrhosis', maxDose: '50mg daily (HF), 400mg (ascites)', route: 'PO', frequency: 'Once daily', notes: '' }],
    form: ['25mg', '50mg', '100mg tablets'], search: ['aldactone'],
  }),
  D('hydrochlorothiazide', 'Hydrochlorothiazide', ['Microzide'], 'Thiazide Diuretic', {
    atc: 'C03AA03', who: true, ind: ['Hypertension', 'Oedema'],
    ci: ['Anuria', 'Severe renal failure', 'Severe hyponatraemia'],
    dose: [{ indication: 'Hypertension', adult: '12.5-25mg OD', pediatric: '1mg/kg OD', renalAdjustment: 'Ineffective if CrCl<30', hepaticAdjustment: 'Use with caution (electrolytes)', maxDose: '50mg daily', route: 'PO', frequency: 'Once daily', notes: '' }],
    form: ['12.5mg', '25mg tablets'], search: ['hctz'],
  }),
  D('indapamide', 'Indapamide', ['Natrilix'], 'Thiazide-like Diuretic', {
    atc: 'C03BA11', who: false, ind: ['Hypertension'],
    dose: [{ indication: 'Hypertension', adult: '1.5mg OD (SR) or 2.5mg OD', pediatric: 'Not established', renalAdjustment: 'Avoid if CrCl<30', hepaticAdjustment: 'Avoid in severe', maxDose: '2.5mg daily', route: 'PO', frequency: 'Once daily (morning)', notes: '' }],
    form: ['1.5mg SR', '2.5mg tablets'], search: ['natrilix'],
  }),
  // Statins
  D('atorvastatin', 'Atorvastatin', ['Lipitor'], 'Statin (HMG-CoA Reductase Inhibitor)', {
    atc: 'C10AA05', who: true, ind: ['Hyperlipidaemia', 'CVD prevention', 'ACS (high intensity)'],
    ci: ['Active liver disease', 'Pregnancy'],
    warn: ['Monitor LFTs', 'Myopathy risk — report unexplained muscle pain'],
    dose: [{ indication: 'Primary/Secondary Prevention', adult: '10-80mg OD (high intensity: 40-80mg)', pediatric: '10-20mg daily', renalAdjustment: 'No adjustment', hepaticAdjustment: 'Contraindicated', maxDose: '80mg daily', route: 'PO', frequency: 'Once daily (any time)', notes: 'High-intensity for ACS' }],
    form: ['10mg', '20mg', '40mg', '80mg tablets'], search: ['lipitor'],
  }),
  D('rosuvastatin', 'Rosuvastatin', ['Crestor'], 'Statin', {
    atc: 'C10AA07', who: false, ind: ['Hyperlipidaemia', 'CVD prevention'],
    ci: ['Active liver disease', 'Pregnancy', 'Severe renal impairment (40mg dose)'],
    dose: [{ indication: 'Hyperlipidaemia', adult: '5-20mg OD (max 40mg)', pediatric: '5-20mg OD', renalAdjustment: 'Max 20mg if CrCl<30', hepaticAdjustment: 'Contraindicated', maxDose: '40mg daily', route: 'PO', frequency: 'Once daily', notes: '' }],
    form: ['5mg', '10mg', '20mg', '40mg tablets'], search: ['crestor'],
  }),
  D('simvastatin', 'Simvastatin', ['Zocor'], 'Statin', {
    atc: 'C10AA01', who: true, ind: ['Hyperlipidaemia', 'CVD prevention'],
    ci: ['Active liver disease', 'Pregnancy', 'Concurrent amiodarone (>20mg)'],
    dose: [{ indication: 'Hyperlipidaemia', adult: '20-40mg OD', pediatric: '10-40mg OD', renalAdjustment: 'Start 5mg if CrCl<30', hepaticAdjustment: 'Contraindicated', maxDose: '80mg daily (rarely used)', route: 'PO', frequency: 'Once daily (evening)', notes: 'Max 20mg with amiodarone/amlodipine' }],
    ix: [{ drug: 'Amiodarone', severity: 'Contraindicated', mechanism: 'Rhabdomyolysis risk', management: 'Max 20mg simvastatin or switch statin' }],
    form: ['10mg', '20mg', '40mg tablets'], search: ['zocor'],
  }),
];

// ═══════════════════════════════════════════════════════════
//  ANTIBIOTICS & ANTI-INFECTIVES
// ═══════════════════════════════════════════════════════════

const ANTIBIOTICS = [
  D('amoxicillin', 'Amoxicillin', ['Amoxil'], 'Penicillin', {
    atc: 'J01CA04', who: true, ind: ['URTI', 'LRTI', 'UTI', 'H. pylori', 'Endocarditis prophylaxis'],
    ci: ['Penicillin allergy'],
    dose: [{ indication: 'General Infection', adult: '500mg TDS', pediatric: '25mg/kg TDS', renalAdjustment: 'CrCl<30: max 500mg BD', hepaticAdjustment: 'No adjustment', maxDose: '3g/day', route: 'PO', frequency: 'TDS', notes: '' }],
    form: ['250mg', '500mg capsules', '125mg/5mL', '250mg/5mL suspension'], search: ['amoxil'],
  }),
  D('co-amoxiclav', 'Co-Amoxiclav', ['Augmentin'], 'Penicillin + Beta-lactamase Inhibitor', {
    atc: 'J01CR02', who: true, ind: ['CAP', 'Bite wounds', 'UTI', 'Intra-abdominal', 'Diabetic foot'],
    ci: ['Penicillin allergy', 'Previous cholestatic jaundice with co-amoxiclav'],
    dose: [
      { indication: 'Moderate Infection', adult: '625mg TDS PO or 1.2g TDS IV', pediatric: '25/3.6mg/kg TDS', renalAdjustment: 'CrCl<30: 625mg BD PO or 1.2g BD IV', hepaticAdjustment: 'Monitor LFTs', maxDose: '625mg TDS PO', route: 'PO/IV', frequency: 'TDS', notes: '' },
    ],
    form: ['375mg', '625mg tablets', '1.2g IV vial', '228mg/5mL', '457mg/5mL suspension'], search: ['augmentin'],
  }),
  D('flucloxacillin', 'Flucloxacillin', ['Floxapen'], 'Penicillinase-Resistant Penicillin', {
    atc: 'J01CF05', who: false, ind: ['Cellulitis', 'Skin/soft tissue infection', 'Bone/joint infection', 'MSSA bacteraemia'],
    ci: ['Penicillin allergy', 'Previous flucloxacillin hepatitis'],
    dose: [{ indication: 'Skin Infection', adult: '500mg-1g QDS PO, or 1-2g QDS IV', pediatric: '25mg/kg QDS', renalAdjustment: 'No adjustment', hepaticAdjustment: 'Use with caution — hepatitis risk', maxDose: '8g/day IV', route: 'PO/IV', frequency: 'QDS', notes: 'Take on empty stomach (PO)' }],
    form: ['250mg', '500mg capsules', '250mg/5mL', '500mg', '1g IV vials'], search: ['floxapen'],
  }),
  D('piperacillin-tazobactam', 'Piperacillin-Tazobactam', ['Tazocin', 'Zosyn'], 'Penicillin + BLI (Extended Spectrum)', {
    atc: 'J01CR05', who: true, ind: ['Severe sepsis', 'HAP', 'Intra-abdominal infection', 'Febrile neutropenia'],
    ci: ['Penicillin allergy'],
    dose: [{ indication: 'Severe Infection', adult: '4.5g IV q6-8h', pediatric: '90mg/kg IV q6-8h', renalAdjustment: 'CrCl 20-40: 4.5g q8h. CrCl<20: 4.5g q12h', hepaticAdjustment: 'No adjustment', maxDose: '4.5g q6h', route: 'IV', frequency: 'q6-8h (infuse over 30min)', notes: 'Extended infusion (4h) may improve outcomes in severe sepsis' }],
    form: ['4.5g vial'], search: ['tazocin', 'zosyn', 'pip-taz'],
  }),
  D('ceftriaxone', 'Ceftriaxone', ['Rocephin'], 'Cephalosporin (3rd gen)', {
    atc: 'J01DD04', who: true, ind: ['CAP', 'Meningitis', 'UTI', 'Sepsis', 'Gonorrhoea'],
    ci: ['Cephalosporin allergy', 'Neonates with jaundice receiving calcium'],
    warn: ['Do not mix with calcium-containing solutions in neonates'],
    dose: [{ indication: 'CAP / Sepsis', adult: '1-2g IV daily', pediatric: '50-100mg/kg IV daily', renalAdjustment: 'No adjustment', hepaticAdjustment: 'No adjustment', maxDose: '4g/day', route: 'IV/IM', frequency: 'Once daily', notes: '' }],
    form: ['250mg', '500mg', '1g', '2g vials'], search: ['rocephin'],
  }),
  D('cefuroxime', 'Cefuroxime', ['Zinnat', 'Zinacef'], 'Cephalosporin (2nd gen)', {
    atc: 'J01DC02', who: true, ind: ['LRTI', 'UTI', 'Skin infection', 'Surgical prophylaxis'],
    ci: ['Cephalosporin allergy'],
    dose: [{ indication: 'Moderate Infection', adult: '250-500mg BD PO or 750mg-1.5g TDS IV', pediatric: '15mg/kg BD PO or 30mg/kg TDS IV', renalAdjustment: 'CrCl<20: reduce dose', hepaticAdjustment: 'No adjustment', maxDose: '1.5g TDS IV', route: 'PO/IV', frequency: 'BD (PO) or TDS (IV)', notes: '' }],
    form: ['250mg', '500mg tablets', '750mg', '1.5g vials'], search: ['zinnat', 'zinacef'],
  }),
  D('ceftazidime', 'Ceftazidime', ['Fortum'], 'Cephalosporin (3rd gen, Anti-Pseudomonal)', {
    atc: 'J01DD02', who: true, ind: ['Pseudomonal infections', 'Febrile neutropenia', 'HAP', 'Melioidosis'],
    ci: ['Cephalosporin allergy'],
    dose: [{ indication: 'Severe Infection', adult: '1-2g IV q8h', pediatric: '50mg/kg IV q8h', renalAdjustment: 'CrCl 15-30: 1g q12h. CrCl<15: 1g q24h', hepaticAdjustment: 'No adjustment', maxDose: '6g/day', route: 'IV', frequency: 'q8h', notes: '' }],
    form: ['500mg', '1g', '2g vials'], search: ['fortum'],
  }),
  D('cefepime', 'Cefepime', ['Maxipime'], 'Cephalosporin (4th gen)', {
    atc: 'J01DE01', who: true, ind: ['Febrile neutropenia', 'HAP', 'Severe UTI', 'Pseudomonal infections'],
    ci: ['Cephalosporin allergy'],
    dose: [{ indication: 'Severe Infection', adult: '2g IV q8-12h', pediatric: '50mg/kg IV q8h', renalAdjustment: 'CrCl 30-60: 2g q12h. CrCl 11-29: 2g q24h', hepaticAdjustment: 'No adjustment', maxDose: '6g/day', route: 'IV', frequency: 'q8-12h', notes: '' }],
    form: ['1g', '2g vials'], search: ['maxipime'],
  }),
  D('meropenem', 'Meropenem', ['Meronem'], 'Carbapenem', {
    atc: 'J01DH02', who: true, ind: ['Severe sepsis', 'Febrile neutropenia', 'Meningitis', 'ESBL infections', 'HAP'],
    ci: ['Carbapenem allergy'],
    warn: ['Reserve for resistant organisms', 'Seizure risk (less than imipenem)', 'Reduces valproate levels'],
    dose: [{ indication: 'Severe Infection', adult: '1g IV q8h (meningitis: 2g q8h)', pediatric: '20-40mg/kg IV q8h', renalAdjustment: 'CrCl 26-50: 1g q12h. CrCl 10-25: 500mg q12h. CrCl<10: 500mg q24h', hepaticAdjustment: 'No adjustment', maxDose: '6g/day', route: 'IV', frequency: 'q8h (infuse over 15-30min)', notes: 'Extended infusion (3h) for resistant organisms' }],
    form: ['500mg', '1g vials'], search: ['meronem'],
  }),
  D('vancomycin', 'Vancomycin', ['Vancocin'], 'Glycopeptide Antibiotic', {
    atc: 'J01XA01', who: true, ind: ['MRSA', 'C. difficile (oral)', 'Endocarditis', 'Meningitis'],
    ci: ['Vancomycin hypersensitivity'],
    warn: ['Trough levels required (15-20 mcg/mL for serious)', 'Red man syndrome — infuse slowly >=60min', 'Nephrotoxic — monitor renal function'],
    dose: [{ indication: 'Systemic MRSA', adult: '15-20mg/kg IV q8-12h', pediatric: '15mg/kg IV q6h', renalAdjustment: 'Dose by trough levels', hepaticAdjustment: 'No adjustment', maxDose: '2g/dose', route: 'IV', frequency: 'q8-12h', notes: 'Infuse over >=60min' },
      { indication: 'C. difficile', adult: '125mg PO QDS x 10 days', pediatric: '10mg/kg PO QDS', renalAdjustment: 'No adjustment (oral not absorbed)', hepaticAdjustment: 'No adjustment', maxDose: '500mg QDS (severe)', route: 'PO', frequency: 'QDS', notes: 'Oral for CDI ONLY — not absorbed' },
    ],
    form: ['500mg', '1g IV vials', '125mg capsules'], search: ['vancocin'],
  }),
  D('ciprofloxacin', 'Ciprofloxacin', ['Cipro', 'Ciproxin'], 'Fluoroquinolone', {
    atc: 'J01MA02', who: true, ind: ['UTI', 'Prostatitis', 'GI infection', 'Pseudomonal infection', 'Bone/joint'],
    ci: ['Tendon disorders with FQ', 'Concurrent tizanidine', 'Pregnancy'],
    warn: ['Tendon rupture risk (esp elderly, steroids)', 'QT prolongation', 'Aortic aneurysm risk'],
    dose: [{ indication: 'UTI / Moderate Infection', adult: '500mg BD PO or 400mg BD-TDS IV', pediatric: '10-15mg/kg BD (restricted)', renalAdjustment: 'CrCl<30: 250-500mg BD PO', hepaticAdjustment: 'No specific adjustment', maxDose: '750mg BD PO, 400mg TDS IV', route: 'PO/IV', frequency: 'BD', notes: '' }],
    form: ['250mg', '500mg', '750mg tablets', '200mg/100mL', '400mg/200mL IV bags'], search: ['cipro', 'ciproxin'],
  }),
  D('levofloxacin', 'Levofloxacin', ['Levaquin', 'Tavanic'], 'Fluoroquinolone', {
    atc: 'J01MA12', who: false, ind: ['CAP', 'Complicated UTI', 'TB (MDR)'],
    ci: ['Tendon disorders with FQ', 'Pregnancy'],
    dose: [{ indication: 'CAP / UTI', adult: '500-750mg OD', pediatric: 'Not recommended', renalAdjustment: 'CrCl 20-49: 500mg then 250mg OD. CrCl<20: 500mg then 250mg q48h', hepaticAdjustment: 'No adjustment', maxDose: '750mg daily', route: 'PO/IV', frequency: 'Once daily', notes: '' }],
    form: ['250mg', '500mg', '750mg tablets', '500mg/100mL IV'], search: ['tavanic'],
  }),
  D('azithromycin', 'Azithromycin', ['Zithromax'], 'Macrolide', {
    atc: 'J01FA10', who: true, ind: ['CAP (atypical cover)', 'Pharyngitis', 'STI', 'MAC prophylaxis'],
    ci: ['Macrolide allergy', 'Severe hepatic impairment'],
    warn: ['QT prolongation', 'Hepatotoxicity (rare)'],
    dose: [{ indication: 'CAP', adult: '500mg OD x 3-5 days', pediatric: '10mg/kg OD x 3 days', renalAdjustment: 'No adjustment', hepaticAdjustment: 'Avoid in severe', maxDose: '500mg daily', route: 'PO/IV', frequency: 'Once daily', notes: '' }],
    form: ['250mg', '500mg tablets', '200mg/5mL suspension', '500mg IV vial'], search: ['zithromax', 'z-pack'],
  }),
  D('clarithromycin', 'Clarithromycin', ['Klacid', 'Biaxin'], 'Macrolide', {
    atc: 'J01FA09', who: true, ind: ['CAP', 'H. pylori', 'MAC', 'Skin infection'],
    ci: ['Macrolide allergy', 'Concurrent simvastatin/atorvastatin (high dose)'],
    warn: ['QT prolongation', 'Multiple CYP3A4 interactions'],
    dose: [{ indication: 'CAP / General', adult: '500mg BD x 7-14 days', pediatric: '7.5mg/kg BD', renalAdjustment: 'CrCl<30: halve dose', hepaticAdjustment: 'Use with caution', maxDose: '500mg BD', route: 'PO/IV', frequency: 'BD', notes: '' }],
    form: ['250mg', '500mg tablets', '500mg IV vial'], search: ['klacid', 'biaxin'],
  }),
  D('doxycycline', 'Doxycycline', ['Vibramycin'], 'Tetracycline', {
    atc: 'J01AA02', who: true, ind: ['CAP (atypical)', 'Acne', 'Malaria prophylaxis', 'Chlamydia', 'Lyme disease'],
    ci: ['Pregnancy', 'Children <12 (teeth staining)'],
    dose: [{ indication: 'Infection', adult: '100mg BD (or 200mg OD) x 7-14 days', pediatric: '2mg/kg BD (>12y)', renalAdjustment: 'No adjustment', hepaticAdjustment: 'Use with caution', maxDose: '200mg daily', route: 'PO', frequency: 'BD', notes: 'Take upright with water — oesophageal ulceration risk' }],
    form: ['50mg', '100mg capsules'], search: ['vibramycin'],
  }),
  D('metronidazole', 'Metronidazole', ['Flagyl'], 'Nitroimidazole', {
    atc: 'J01XD01', who: true, ind: ['Anaerobic infection', 'C. difficile', 'H. pylori', 'Intra-abdominal', 'Dental abscess'],
    ci: ['Disulfiram-like reaction with alcohol'],
    warn: ['Avoid alcohol during and 48h after', 'Peripheral neuropathy with prolonged use'],
    dose: [{ indication: 'Anaerobic Infection', adult: '400-500mg TDS PO or 500mg TDS IV', pediatric: '7.5mg/kg TDS', renalAdjustment: 'No adjustment', hepaticAdjustment: 'Reduce dose in severe disease', maxDose: '4g/day', route: 'PO/IV', frequency: 'TDS', notes: '' }],
    form: ['200mg', '400mg tablets', '500mg/100mL IV bag'], search: ['flagyl'],
  }),
  D('trimethoprim', 'Trimethoprim', ['Monotrim'], 'Dihydrofolate Reductase Inhibitor', {
    atc: 'J01EA01', who: true, ind: ['Uncomplicated UTI', 'UTI prophylaxis'],
    ci: ['Severe renal impairment', 'Blood dyscrasias', 'Folate deficiency'],
    dose: [{ indication: 'UTI', adult: '200mg BD x 3 days (uncomplicated)', pediatric: '4mg/kg BD', renalAdjustment: 'CrCl 15-30: 200mg OD. CrCl<15: avoid', hepaticAdjustment: 'No adjustment', maxDose: '200mg BD', route: 'PO', frequency: 'BD', notes: '' }],
    form: ['100mg', '200mg tablets'], search: ['monotrim'],
  }),
  D('co-trimoxazole', 'Co-Trimoxazole (TMP-SMX)', ['Bactrim', 'Septrin'], 'Sulfonamide Combination', {
    atc: 'J01EE01', who: true, ind: ['PCP prophylaxis/treatment', 'UTI', 'Nocardia', 'Stenotrophomonas'],
    ci: ['Severe renal impairment', 'Severe hepatic impairment', 'Porphyria'],
    dose: [
      { indication: 'PCP Treatment', adult: '120mg/kg/day IV in 2-4 divided doses x 21 days', pediatric: '120mg/kg/day', renalAdjustment: 'CrCl 15-30: half dose. CrCl<15: avoid', hepaticAdjustment: 'Avoid in severe', maxDose: 'Per weight', route: 'IV/PO', frequency: 'BD-QDS', notes: 'High dose for PCP' },
      { indication: 'PCP Prophylaxis', adult: '960mg OD or 480mg OD', pediatric: '450mg/m2 BD', renalAdjustment: 'CrCl<30: avoid long-term', hepaticAdjustment: 'Avoid', maxDose: '960mg OD', route: 'PO', frequency: 'Once daily', notes: '' },
    ],
    form: ['480mg', '960mg tablets', '96mg/mL IV ampoule'], search: ['bactrim', 'septrin', 'tmp-smx'],
  }),
  D('fluconazole', 'Fluconazole', ['Diflucan'], 'Antifungal (Azole)', {
    atc: 'J02AC01', who: true, ind: ['Candidaemia', 'Oropharyngeal candidiasis', 'Cryptococcal meningitis', 'Vaginal candidiasis'],
    ci: ['Concurrent terfenadine/cisapride'],
    dose: [{ indication: 'Invasive Candidiasis', adult: 'Load: 800mg, then 400mg OD', pediatric: '12mg/kg load, then 6-12mg/kg OD', renalAdjustment: 'CrCl<50: halve dose', hepaticAdjustment: 'Use with caution', maxDose: '800mg/day', route: 'PO/IV', frequency: 'Once daily', notes: '' }],
    form: ['50mg', '100mg', '150mg', '200mg capsules', '200mg/100mL IV'], search: ['diflucan'],
  }),
  D('gentamicin', 'Gentamicin', ['Garamycin'], 'Aminoglycoside', {
    atc: 'J01GB03', who: true, ind: ['Endocarditis (synergy)', 'Severe sepsis (gram-neg)', 'UTI (severe)'],
    ci: ['Myasthenia gravis'],
    warn: ['Nephrotoxic + ototoxic', 'Monitor levels (trough <1mg/L, peak 5-10mg/L)', 'Once-daily dosing preferred'],
    dose: [{ indication: 'Once-Daily Dosing', adult: '5-7mg/kg IV once daily', pediatric: '7mg/kg IV once daily', renalAdjustment: 'Extend interval: CrCl 40-60: q36h, CrCl 20-40: q48h', hepaticAdjustment: 'No adjustment', maxDose: '7mg/kg/dose', route: 'IV', frequency: 'Once daily (or per levels)', notes: 'Check trough level before 2nd dose' }],
    form: ['80mg/2mL ampoule'], search: ['garamycin'],
  }),
];

// ═══════════════════════════════════════════════════════════
//  ENDOCRINE & METABOLIC
// ═══════════════════════════════════════════════════════════

const ENDOCRINE = [
  D('metformin', 'Metformin', ['Glucophage'], 'Biguanide (Antidiabetic)', {
    atc: 'A10BA02', who: true, ind: ['Type 2 Diabetes', 'Pre-diabetes', 'PCOS'],
    ci: ['eGFR < 30', 'Acute metabolic acidosis', 'Severe hepatic impairment'],
    se: { common: ['Nausea', 'Diarrhoea', 'Metallic taste'], serious: ['Lactic acidosis (rare)', 'B12 deficiency'] },
    warn: ['Withhold before iodinated contrast', 'Withhold during acute illness'],
    dose: [{ indication: 'T2DM', adult: '500mg BD, titrate to 1g BD', pediatric: '500mg daily, max 2g/day', renalAdjustment: 'eGFR 30-45: max 1g/day. eGFR<30: STOP', hepaticAdjustment: 'Avoid in severe', maxDose: '2g/day', route: 'PO', frequency: 'BD-TDS with meals', notes: 'XR may reduce GI effects' }],
    ix: [{ drug: 'Iodinated contrast', severity: 'Major', mechanism: 'Lactic acidosis risk with AKI', management: 'Withhold 48h pre/post contrast' }],
    form: ['500mg', '850mg', '1000mg tablets', '500mg', '1000mg XR'], search: ['glucophage'],
  }),
  D('gliclazide', 'Gliclazide', ['Diamicron'], 'Sulfonylurea', {
    atc: 'A10BB09', who: true, ind: ['Type 2 Diabetes'],
    ci: ['T1DM', 'DKA', 'Severe hepatic/renal impairment'],
    warn: ['Hypoglycaemia risk — especially elderly, renal impairment', 'Weight gain'],
    dose: [{ indication: 'T2DM', adult: '40-160mg BD (IR) or 30-120mg OD (MR)', pediatric: 'Not recommended', renalAdjustment: 'Avoid if eGFR<30', hepaticAdjustment: 'Avoid in severe', maxDose: '320mg/day (IR) or 120mg (MR)', route: 'PO', frequency: 'BD (IR) or OD (MR)', notes: '' }],
    form: ['40mg', '80mg tablets', '30mg', '60mg MR tablets'], search: ['diamicron'],
  }),
  D('empagliflozin', 'Empagliflozin', ['Jardiance'], 'SGLT2 Inhibitor', {
    atc: 'A10BK03', who: false, ind: ['T2DM', 'Heart failure (HFrEF + HFpEF)', 'CKD'],
    ci: ['T1DM (DKA risk)', 'eGFR<20 (for glycaemic benefit)'],
    warn: ['Euglycaemic DKA risk', 'Genital mycotic infections', 'Stop before surgery'],
    dose: [{ indication: 'T2DM / HF / CKD', adult: '10mg OD, may increase to 25mg', pediatric: 'Not established', renalAdjustment: 'eGFR<20: avoid for glycaemia (continue for HF/CKD)', hepaticAdjustment: 'No adjustment', maxDose: '25mg daily', route: 'PO', frequency: 'Once daily', notes: 'HF benefit independent of diabetes' }],
    form: ['10mg', '25mg tablets'], search: ['jardiance', 'sglt2'],
  }),
  D('dapagliflozin', 'Dapagliflozin', ['Forxiga'], 'SGLT2 Inhibitor', {
    atc: 'A10BK01', who: false, ind: ['T2DM', 'Heart failure', 'CKD'],
    ci: ['T1DM'],
    dose: [{ indication: 'T2DM / HF / CKD', adult: '10mg OD', pediatric: 'Not established', renalAdjustment: 'eGFR<25: avoid for glycaemia (continue for HF/CKD)', hepaticAdjustment: 'No adjustment', maxDose: '10mg daily', route: 'PO', frequency: 'Once daily', notes: '' }],
    form: ['5mg', '10mg tablets'], search: ['forxiga'],
  }),
  D('sitagliptin', 'Sitagliptin', ['Januvia'], 'DPP-4 Inhibitor', {
    atc: 'A10BH01', who: false, ind: ['Type 2 Diabetes'],
    dose: [{ indication: 'T2DM', adult: '100mg OD', pediatric: 'Not established', renalAdjustment: 'eGFR 30-45: 50mg OD. eGFR<30: 25mg OD', hepaticAdjustment: 'No adjustment', maxDose: '100mg daily', route: 'PO', frequency: 'Once daily', notes: '' }],
    form: ['25mg', '50mg', '100mg tablets'], search: ['januvia'],
  }),
  D('semaglutide', 'Semaglutide', ['Ozempic', 'Rybelsus', 'Wegovy'], 'GLP-1 Receptor Agonist', {
    atc: 'A10BJ06', who: false, ind: ['T2DM', 'Obesity', 'CVD risk reduction'],
    ci: ['Personal/family history of medullary thyroid carcinoma', 'MEN2'],
    warn: ['Pancreatitis risk', 'Gastroparesis', 'Gallbladder disease'],
    dose: [{ indication: 'T2DM', adult: '0.25mg SC weekly x 4wks, then 0.5mg, max 1mg (Ozempic). PO: 3mg OD, titrate to 14mg (Rybelsus)', pediatric: 'Not established', renalAdjustment: 'No adjustment', hepaticAdjustment: 'No adjustment', maxDose: '2.4mg SC weekly (Wegovy)', route: 'SC weekly / PO daily', frequency: 'Weekly (SC) or daily (PO)', notes: 'Rybelsus: take 30min before food with sip of water only' }],
    form: ['0.25mg/0.5mg pen', '1mg pen', '3mg', '7mg', '14mg tablets'], search: ['ozempic', 'rybelsus', 'wegovy'],
  }),
  D('insulin-regular', 'Insulin (Regular/Soluble)', ['Actrapid', 'Humulin R'], 'Insulin (Short-acting)', {
    atc: 'A10AB01', who: true, ind: ['DKA', 'HHS', 'Hyperkalaemia', 'Diabetes'],
    ci: ['Hypoglycaemia'],
    warn: ['Monitor glucose hourly in DKA', 'Monitor potassium'],
    dose: [
      { indication: 'DKA', adult: '0.1 units/kg/h IV infusion', pediatric: '0.05-0.1 units/kg/h', renalAdjustment: 'Reduced clearance', hepaticAdjustment: 'Reduced clearance', maxDose: 'Titrate to glucose', route: 'IV', frequency: 'Continuous', notes: 'Fixed rate protocol' },
      { indication: 'Hyperkalaemia', adult: '10 units with 25g glucose IV', pediatric: '0.1 units/kg with 0.5g/kg glucose', renalAdjustment: 'No adjustment', hepaticAdjustment: 'No adjustment', maxDose: '10 units', route: 'IV', frequency: 'Once, repeat PRN', notes: 'Check glucose at 15, 30, 60min' },
    ],
    emg: { cardiacArrestDose: null, anaphylaxisDose: null, infusionRate: '0.1 units/kg/h (DKA)', dilutionInstructions: '50 units in 50mL NS = 1 unit/mL', pearls: ['DKA: target glucose drop 3-4 mmol/h', 'HyperK: 10 units + 25g glucose (50mL 50% dextrose)', 'ALWAYS give glucose with insulin for hyperkalaemia'] },
    form: ['100 units/mL vial', '3mL cartridge'],
  }),
  D('insulin-glargine', 'Insulin Glargine', ['Lantus', 'Toujeo'], 'Insulin (Long-acting)', {
    atc: 'A10AE04', who: true, ind: ['T1DM', 'T2DM (basal insulin)'],
    ci: ['Hypoglycaemia'],
    dose: [{ indication: 'Basal Insulin', adult: '10 units SC OD, titrate by 2 units q3 days to fasting glucose target', pediatric: '0.2 units/kg SC OD', renalAdjustment: 'Reduced clearance — lower doses', hepaticAdjustment: 'Reduced clearance', maxDose: 'Titrate to target', route: 'SC', frequency: 'Once daily (same time)', notes: 'Do NOT mix with other insulins' }],
    form: ['100 units/mL 3mL pen (Lantus)', '300 units/mL 1.5mL pen (Toujeo)'], search: ['lantus', 'toujeo'],
  }),
  D('levothyroxine', 'Levothyroxine', ['Synthroid', 'Euthyrox'], 'Thyroid Hormone', {
    atc: 'H03AA01', who: true, ind: ['Hypothyroidism', 'TSH suppression (thyroid cancer)', 'Myxoedema coma'],
    ci: ['Thyrotoxicosis', 'Uncorrected adrenal insufficiency'],
    warn: ['Start low in elderly/cardiac patients (25mcg)', 'Many drug interactions (take on empty stomach)'],
    dose: [{ indication: 'Hypothyroidism', adult: '1.6mcg/kg/day (typical: 50-100mcg OD)', pediatric: '10-15mcg/kg/day (infants)', renalAdjustment: 'No adjustment', hepaticAdjustment: 'No adjustment', maxDose: '200mcg/day (typical)', route: 'PO', frequency: 'Once daily (fasting, 30min before food)', notes: 'Check TSH 6 weeks after dose change' }],
    form: ['25mcg', '50mcg', '75mcg', '100mcg', '125mcg', '150mcg tablets'], search: ['synthroid', 'euthyrox', 't4'],
  }),
  // Steroids
  D('prednisolone', 'Prednisolone', ['Prednisolone'], 'Corticosteroid', {
    atc: 'H02AB06', who: true, ind: ['Asthma exacerbation', 'COPD exacerbation', 'Autoimmune disease', 'Allergic reaction', 'IBD'],
    ci: ['Systemic fungal infection (relative)'],
    warn: ['Taper if >7 days use', 'Hyperglycaemia', 'Osteoporosis risk', 'Adrenal suppression'],
    dose: [{ indication: 'Acute Asthma/COPD', adult: '40-50mg OD x 5 days', pediatric: '1-2mg/kg OD (max 40mg)', renalAdjustment: 'No adjustment', hepaticAdjustment: 'No adjustment', maxDose: '60mg/day', route: 'PO', frequency: 'Once daily (morning)', notes: 'No taper needed if <7 days' }],
    form: ['1mg', '5mg', '25mg tablets', '5mg/5mL solution'],
  }),
  D('dexamethasone', 'Dexamethasone', ['Decadron'], 'Corticosteroid (Potent)', {
    atc: 'H02AB02', who: true, ind: ['Cerebral oedema', 'Croup', 'Chemotherapy N/V', 'COVID-19 (hypoxic)', 'Meningitis (adjunct)', 'Adrenal crisis'],
    dose: [
      { indication: 'Cerebral Oedema', adult: '8-16mg IV then 4mg q6h', pediatric: '0.5-1mg/kg', renalAdjustment: 'No adjustment', hepaticAdjustment: 'No adjustment', maxDose: '16mg/day', route: 'IV/PO', frequency: 'q6h', notes: '' },
      { indication: 'COVID-19 (hypoxic)', adult: '6mg OD x 10 days', pediatric: '0.15mg/kg OD', renalAdjustment: 'No adjustment', hepaticAdjustment: 'No adjustment', maxDose: '6mg/day', route: 'PO/IV', frequency: 'Once daily', notes: 'Only if requiring O2' },
    ],
    form: ['0.5mg', '4mg tablets', '4mg/mL injection'], search: ['decadron'],
  }),
  D('hydrocortisone', 'Hydrocortisone', ['Solu-Cortef'], 'Corticosteroid', {
    atc: 'H02AB09', who: true, ind: ['Adrenal crisis', 'Anaphylaxis (adjunct)', 'Severe asthma', 'Adrenal insufficiency replacement'],
    dose: [
      { indication: 'Adrenal Crisis', adult: '100mg IV stat, then 50mg q6-8h', pediatric: '2mg/kg IV stat', renalAdjustment: 'No adjustment', hepaticAdjustment: 'No adjustment', maxDose: '100mg stat', route: 'IV', frequency: 'q6-8h', notes: '' },
      { indication: 'Replacement', adult: '10mg morning, 5mg noon, 5mg evening', pediatric: '8-10mg/m2/day in 3 doses', renalAdjustment: 'No adjustment', hepaticAdjustment: 'No adjustment', maxDose: '20-30mg/day', route: 'PO', frequency: 'TDS', notes: 'Double dose during illness (sick day rules)' },
    ],
    emg: { cardiacArrestDose: null, anaphylaxisDose: null, infusionRate: null, dilutionInstructions: 'Reconstitute 100mg with 2mL water', pearls: ['100mg IV stat for adrenal crisis', '200mg IV for anaphylaxis (adjunct after adrenaline)', 'Sick day rules: double dose during febrile illness'] },
    form: ['10mg', '20mg tablets', '100mg IV vial'], search: ['solu-cortef'],
  }),
  D('methylprednisolone', 'Methylprednisolone', ['Solu-Medrol', 'Depo-Medrol'], 'Corticosteroid', {
    atc: 'H02AB04', who: false, ind: ['Acute MS relapse', 'Severe asthma', 'Transplant rejection', 'Spinal cord injury'],
    dose: [{ indication: 'IV Pulse Therapy', adult: '500mg-1g IV daily x 3-5 days', pediatric: '30mg/kg IV daily (max 1g)', renalAdjustment: 'No adjustment', hepaticAdjustment: 'No adjustment', maxDose: '1g/day', route: 'IV', frequency: 'Once daily x 3-5 days', notes: 'Infuse over 30-60min. Monitor glucose + BP' }],
    form: ['40mg', '125mg', '500mg', '1g IV vials'], search: ['solu-medrol'],
  }),
];

// ═══════════════════════════════════════════════════════════
//  ANALGESICS, ANAESTHETICS & SEDATIVES
// ═══════════════════════════════════════════════════════════

const ANALGESICS = [
  D('paracetamol', 'Paracetamol', ['Panadol', 'Tylenol'], 'Analgesic / Antipyretic', {
    atc: 'N02BE01', who: true, ind: ['Pain', 'Fever'],
    ci: ['Severe hepatic impairment'],
    warn: ['Max 4g/day adults', 'Reduce dose if <50kg or malnourished'],
    dose: [{ indication: 'Pain/Fever', adult: '1g PO/IV q6h', pediatric: '15mg/kg PO q4-6h', renalAdjustment: 'No adjustment', hepaticAdjustment: 'Max 2g/day', maxDose: '4g/day', route: 'PO/IV/PR', frequency: 'q4-6h', notes: '' }],
    form: ['500mg tablets', '1g IV bag', '120mg/5mL susp', '250mg suppository'], search: ['panadol', 'tylenol', 'acetaminophen'],
  }),
  D('morphine', 'Morphine', ['MS Contin', 'Sevredol', 'Oramorph'], 'Opioid Analgesic', {
    atc: 'N02AA01', who: true, ind: ['Severe pain', 'ACS', 'Acute pulmonary oedema', 'Palliative care'],
    ci: ['Acute respiratory depression', 'Acute asthma', 'Paralytic ileus'],
    se: { common: ['Nausea', 'Constipation', 'Drowsiness'], serious: ['Respiratory depression', 'Hypotension'] },
    warn: ['Naloxone must be available', 'Reduce dose in elderly and renal impairment'],
    dose: [
      { indication: 'Acute Severe Pain', adult: '2.5-10mg IV/SC q4h PRN', pediatric: '0.1-0.2mg/kg q4h', renalAdjustment: 'Reduce 50% if eGFR<30, avoid if eGFR<10', hepaticAdjustment: 'Reduce dose', maxDose: 'Titrate to effect', route: 'IV/SC/PO', frequency: 'q4h PRN', notes: 'Titrate in 2mg increments IV' },
    ],
    emg: { cardiacArrestDose: null, anaphylaxisDose: null, infusionRate: '1-5mg/h IV', dilutionInstructions: '1mg/mL in NS', pearls: ['Always have naloxone available', 'Give antiemetic concurrently'] },
    ix: [{ drug: 'Benzodiazepines', severity: 'Major', mechanism: 'Additive CNS/respiratory depression', management: 'Avoid if possible, reduce both doses' }],
    form: ['10mg/mL ampoule', '10mg IR tablets', '30mg SR tablets', '10mg/5mL oral solution'], search: ['ms contin', 'oramorph'],
  }),
  D('fentanyl', 'Fentanyl', ['Durogesic', 'Sublimaze'], 'Opioid Analgesic (Potent)', {
    atc: 'N02AB03', who: true, ind: ['Severe pain', 'Anaesthesia', 'Chronic pain (patch)', 'Procedural sedation'],
    ci: ['Opioid-naive patients (patch)', 'Respiratory depression'],
    dose: [
      { indication: 'Acute Pain / Sedation', adult: '25-100mcg IV', pediatric: '1-2mcg/kg IV', renalAdjustment: 'Reduce dose', hepaticAdjustment: 'Reduce dose', maxDose: 'Titrate', route: 'IV', frequency: 'q30-60min PRN', notes: '50-100x more potent than morphine' },
      { indication: 'Chronic Pain (patch)', adult: 'Start 12-25mcg/h patch q72h', pediatric: 'Not for opioid-naive', renalAdjustment: 'Reduce dose', hepaticAdjustment: 'Reduce dose', maxDose: 'Titrate', route: 'Transdermal', frequency: 'q72h', notes: 'Only for opioid-tolerant patients' },
    ],
    form: ['50mcg/mL ampoule', '12mcg/h', '25mcg/h', '50mcg/h', '75mcg/h', '100mcg/h patches'], search: ['durogesic', 'sublimaze'],
  }),
  D('tramadol', 'Tramadol', ['Tramal'], 'Opioid Analgesic (Weak)', {
    atc: 'N02AX02', who: false, ind: ['Moderate-severe pain'],
    ci: ['Uncontrolled epilepsy', 'Concurrent MAOIs'],
    warn: ['Seizure risk', 'Serotonin syndrome risk with SSRIs'],
    dose: [{ indication: 'Pain', adult: '50-100mg q4-6h', pediatric: '1-2mg/kg q6h (>12y)', renalAdjustment: 'CrCl<30: 50mg q12h', hepaticAdjustment: '50mg q12h', maxDose: '400mg/day', route: 'PO/IV', frequency: 'q4-6h', notes: '' }],
    form: ['50mg capsules', '100mg SR', '50mg/mL injection'], search: ['tramal'],
  }),
  D('diclofenac', 'Diclofenac', ['Voltaren', 'Voltarol'], 'NSAID', {
    atc: 'M01AB05', who: true, ind: ['Pain', 'Inflammation', 'Renal colic', 'Post-op pain'],
    ci: ['Active GI bleeding', 'Severe renal impairment', 'Severe HF', 'Post-CABG'],
    warn: ['CV risk — shortest duration possible', 'GI protection with PPI'],
    dose: [{ indication: 'Pain', adult: '50mg TDS PO or 75mg BD IM', pediatric: '1mg/kg TDS (>1y)', renalAdjustment: 'Avoid if eGFR<30', hepaticAdjustment: 'Use lowest dose', maxDose: '150mg/day', route: 'PO/IM/PR', frequency: 'BD-TDS', notes: 'Max 2 days IM' }],
    form: ['25mg', '50mg tablets', '75mg/3mL IM injection', '100mg suppository'], search: ['voltaren'],
  }),
  D('ibuprofen', 'Ibuprofen', ['Brufen', 'Advil', 'Nurofen'], 'NSAID', {
    atc: 'M01AE01', who: true, ind: ['Pain', 'Fever', 'Inflammation', 'Dysmenorrhoea'],
    ci: ['Active GI bleeding', 'Severe renal/hepatic/cardiac impairment'],
    dose: [{ indication: 'Pain/Fever', adult: '200-400mg TDS', pediatric: '5-10mg/kg TDS', renalAdjustment: 'Avoid if eGFR<30', hepaticAdjustment: 'Use with caution', maxDose: '2.4g/day', route: 'PO', frequency: 'TDS', notes: 'Take with food' }],
    form: ['200mg', '400mg', '600mg tablets', '100mg/5mL suspension'], search: ['brufen', 'advil', 'nurofen'],
  }),
  D('gabapentin', 'Gabapentin', ['Neurontin'], 'Gabapentinoid', {
    atc: 'N03AX12', who: false, ind: ['Neuropathic pain', 'Epilepsy (adjunct)', 'Post-herpetic neuralgia'],
    dose: [{ indication: 'Neuropathic Pain', adult: '300mg OD, titrate to 300mg TDS (max 3600mg/day)', pediatric: '10-15mg/kg/day', renalAdjustment: 'CrCl 30-60: max 600mg BD. CrCl 15-30: max 300mg OD. CrCl<15: max 300mg every other day', hepaticAdjustment: 'No adjustment', maxDose: '3600mg/day', route: 'PO', frequency: 'TDS', notes: 'Titrate slowly over weeks' }],
    form: ['100mg', '300mg', '400mg capsules'], search: ['neurontin'],
  }),
  D('pregabalin', 'Pregabalin', ['Lyrica'], 'Gabapentinoid', {
    atc: 'N03AX16', who: false, ind: ['Neuropathic pain', 'Fibromyalgia', 'Generalised anxiety', 'Epilepsy'],
    dose: [{ indication: 'Neuropathic Pain', adult: '75mg BD, titrate to 150-300mg BD', pediatric: 'Not established', renalAdjustment: 'CrCl 30-60: 75-300mg/day. CrCl 15-30: 25-150mg/day. CrCl<15: 25-75mg/day', hepaticAdjustment: 'No adjustment', maxDose: '600mg/day', route: 'PO', frequency: 'BD', notes: '' }],
    form: ['25mg', '50mg', '75mg', '150mg', '300mg capsules'], search: ['lyrica'],
  }),
  D('naloxone', 'Naloxone', ['Narcan'], 'Opioid Antagonist', {
    atc: 'V03AB15', who: true, ind: ['Opioid overdose', 'Reversal of opioid effects'],
    ci: [],
    warn: ['Short duration (30-90min) — may need repeat dosing', 'Can precipitate acute withdrawal'],
    dose: [{ indication: 'Opioid Overdose', adult: '0.4-2mg IV/IM/SC, repeat q2-3min', pediatric: '0.1mg/kg IV (max 2mg)', renalAdjustment: 'No adjustment', hepaticAdjustment: 'No adjustment', maxDose: '10mg total', route: 'IV/IM/SC/IN', frequency: 'q2-3min until response', notes: 'Half-life shorter than most opioids — observe for re-sedation' }],
    emg: { cardiacArrestDose: null, anaphylaxisDose: null, infusionRate: '0.4-0.8mg/h if recurrent sedation', dilutionInstructions: '2mg in 500mL NS = 4mcg/mL', pearls: ['Start 0.4mg IV, titrate up if no response', 'Duration shorter than opioids — monitor for re-sedation 2-4h', 'Intranasal: 4mg spray if no IV access'] },
    form: ['0.4mg/mL ampoule', '4mg nasal spray'], search: ['narcan'],
  }),
  D('midazolam', 'Midazolam', ['Versed', 'Hypnovel'], 'Benzodiazepine (Short-acting)', {
    atc: 'N05CD08', who: true, ind: ['Procedural sedation', 'Status epilepticus', 'Anxiety pre-op', 'ICU sedation'],
    ci: ['Severe respiratory depression', 'Sleep apnoea (uncontrolled)', 'Myasthenia gravis'],
    dose: [
      { indication: 'Procedural Sedation', adult: '1-2.5mg IV slowly, titrate in 0.5-1mg increments', pediatric: '0.05-0.1mg/kg IV', renalAdjustment: 'Reduce dose', hepaticAdjustment: 'Reduce dose — prolonged action', maxDose: '5mg IV (non-intubated)', route: 'IV', frequency: 'Titrate q2-3min', notes: 'Flumazenil for reversal' },
      { indication: 'Status Epilepticus (buccal)', adult: '10mg buccal', pediatric: '0.3mg/kg buccal (max 10mg)', renalAdjustment: 'No adjustment', hepaticAdjustment: 'Reduce dose', maxDose: '10mg', route: 'Buccal/IM', frequency: 'Single dose, may repeat once', notes: 'If no IV access' },
    ],
    form: ['1mg/mL', '5mg/mL ampoule', '10mg buccal solution'], search: ['versed', 'hypnovel'],
  }),
  D('diazepam', 'Diazepam', ['Valium'], 'Benzodiazepine (Long-acting)', {
    atc: 'N05BA01', who: true, ind: ['Seizures', 'Alcohol withdrawal', 'Anxiety', 'Muscle spasm', 'Status epilepticus'],
    dose: [
      { indication: 'Status Epilepticus', adult: '10mg IV at 2mg/min', pediatric: '0.3-0.5mg/kg IV/PR', renalAdjustment: 'Reduce dose', hepaticAdjustment: 'Reduce dose significantly', maxDose: '20mg IV', route: 'IV/PR', frequency: 'May repeat once after 10min', notes: '' },
      { indication: 'Alcohol Withdrawal', adult: '10-20mg PO, repeat q1-2h PRN (symptom-triggered)', pediatric: 'Not applicable', renalAdjustment: 'Reduce dose', hepaticAdjustment: 'Reduce dose — long half-life in liver disease', maxDose: 'Symptom-triggered', route: 'PO/IV', frequency: 'q1-2h PRN', notes: 'Use CIWA score' },
    ],
    form: ['2mg', '5mg', '10mg tablets', '5mg/mL ampoule', '2.5mg', '5mg', '10mg rectal tubes'], search: ['valium'],
  }),
  D('lorazepam', 'Lorazepam', ['Ativan'], 'Benzodiazepine', {
    atc: 'N05BA06', who: true, ind: ['Status epilepticus (first-line)', 'Anxiety', 'Alcohol withdrawal', 'Sedation'],
    dose: [{ indication: 'Status Epilepticus', adult: '4mg IV at 2mg/min, may repeat once', pediatric: '0.1mg/kg IV (max 4mg)', renalAdjustment: 'No specific adjustment', hepaticAdjustment: 'Reduce dose — safer than diazepam in liver disease', maxDose: '8mg total for SE', route: 'IV/IM', frequency: 'Repeat once after 10min if needed', notes: 'Preferred BZD for status epilepticus' }],
    form: ['1mg', '2.5mg tablets', '4mg/mL ampoule'], search: ['ativan'],
  }),
  D('propofol', 'Propofol', ['Diprivan'], 'General Anaesthetic / Sedative', {
    atc: 'N01AX10', who: true, ind: ['Induction of anaesthesia', 'ICU sedation', 'Procedural sedation'],
    ci: ['Allergy to soya/egg lecithin'],
    warn: ['Propofol infusion syndrome (PRIS) — avoid >4mg/kg/h for >48h', 'Hypotension', 'Respiratory depression'],
    dose: [
      { indication: 'Induction', adult: '1.5-2.5mg/kg IV', pediatric: '2.5-3.5mg/kg IV', renalAdjustment: 'No adjustment', hepaticAdjustment: 'Reduce dose', maxDose: '2.5mg/kg', route: 'IV', frequency: 'Single dose', notes: '' },
      { indication: 'ICU Sedation', adult: '0.3-4mg/kg/h IV', pediatric: 'Not recommended for prolonged ICU use', renalAdjustment: 'No adjustment', hepaticAdjustment: 'Reduce dose', maxDose: '4mg/kg/h (monitor for PRIS)', route: 'IV', frequency: 'Continuous', notes: 'Check triglycerides, CK, lactate' },
    ],
    form: ['10mg/mL (20mL, 50mL vials)'], search: ['diprivan'],
  }),
];

// ═══════════════════════════════════════════════════════════
//  RESPIRATORY
// ═══════════════════════════════════════════════════════════

const RESPIRATORY = [
  D('salbutamol', 'Salbutamol', ['Ventolin'], 'Short-Acting Beta-2 Agonist', {
    atc: 'R03AC02', who: true, ind: ['Acute asthma', 'COPD exacerbation', 'Hyperkalaemia'],
    dose: [
      { indication: 'Acute Asthma', adult: '5mg nebulised q20min x 3, then q1-4h', pediatric: '2.5-5mg nebulised', renalAdjustment: 'No adjustment', hepaticAdjustment: 'No adjustment', maxDose: 'Continuous neb in severe', route: 'Inhaled/Nebulised', frequency: 'q20min-4h', notes: '' },
      { indication: 'Hyperkalaemia', adult: '10-20mg nebulised', pediatric: '2.5-5mg', renalAdjustment: 'No adjustment', hepaticAdjustment: 'No adjustment', maxDose: '20mg', route: 'Nebulised', frequency: 'Single dose', notes: 'Adjunct only' },
    ],
    emg: { cardiacArrestDose: null, anaphylaxisDose: null, infusionRate: null, dilutionInstructions: 'Use undiluted 5mg/2.5mL', pearls: ['Back-to-back nebs for severe asthma', '10-20mg neb for hyperkalaemia', 'IV: 250mcg slow IV for life-threatening asthma'] },
    form: ['100mcg MDI', '5mg/2.5mL nebules', '5mg/mL respirator solution', '500mcg/mL injection'], search: ['ventolin', 'albuterol'],
  }),
  D('ipratropium', 'Ipratropium', ['Atrovent'], 'Short-Acting Muscarinic Antagonist', {
    atc: 'R03BB01', who: true, ind: ['Acute asthma (with salbutamol)', 'COPD exacerbation'],
    dose: [{ indication: 'Acute Asthma/COPD', adult: '500mcg nebulised q4-6h', pediatric: '250mcg nebulised', renalAdjustment: 'No adjustment', hepaticAdjustment: 'No adjustment', maxDose: '500mcg q4h', route: 'Nebulised', frequency: 'q4-6h', notes: 'Combine with salbutamol in acute asthma' }],
    form: ['250mcg/mL nebules', '500mcg/2mL nebules', '20mcg MDI'], search: ['atrovent'],
  }),
  D('tiotropium', 'Tiotropium', ['Spiriva'], 'Long-Acting Muscarinic Antagonist', {
    atc: 'R03BB04', who: false, ind: ['COPD maintenance', 'Asthma (step-up therapy)'],
    dose: [{ indication: 'COPD', adult: '18mcg inhaled OD (HandiHaler) or 5mcg OD (Respimat)', pediatric: 'Not established', renalAdjustment: 'No adjustment', hepaticAdjustment: 'No adjustment', maxDose: '18mcg/day', route: 'Inhaled', frequency: 'Once daily', notes: '' }],
    form: ['18mcg capsule + HandiHaler', '2.5mcg Respimat'], search: ['spiriva', 'lama'],
  }),
  D('budesonide', 'Budesonide', ['Pulmicort'], 'Inhaled Corticosteroid', {
    atc: 'R03BA02', who: true, ind: ['Asthma maintenance', 'COPD', 'Croup'],
    dose: [
      { indication: 'Asthma', adult: '200-800mcg BD inhaled', pediatric: '100-400mcg BD', renalAdjustment: 'No adjustment', hepaticAdjustment: 'No adjustment', maxDose: '1600mcg/day', route: 'Inhaled', frequency: 'BD', notes: 'Rinse mouth after use' },
      { indication: 'Croup', adult: 'N/A', pediatric: '2mg nebulised single dose', renalAdjustment: 'No adjustment', hepaticAdjustment: 'No adjustment', maxDose: '2mg', route: 'Nebulised', frequency: 'Single dose', notes: '' },
    ],
    form: ['100mcg', '200mcg', '400mcg Turbuhaler', '0.5mg/2mL', '1mg/2mL nebules'], search: ['pulmicort', 'ics'],
  }),
  D('fluticasone', 'Fluticasone', ['Flixotide', 'Flovent'], 'Inhaled Corticosteroid', {
    atc: 'R03BA05', who: false, ind: ['Asthma maintenance'],
    dose: [{ indication: 'Asthma', adult: '100-500mcg BD inhaled', pediatric: '50-200mcg BD', renalAdjustment: 'No adjustment', hepaticAdjustment: 'No adjustment', maxDose: '1000mcg/day', route: 'Inhaled', frequency: 'BD', notes: 'Rinse mouth after use' }],
    form: ['50mcg', '125mcg', '250mcg MDI', '100mcg', '250mcg', '500mcg Accuhaler'], search: ['flixotide', 'flovent'],
  }),
  D('montelukast', 'Montelukast', ['Singulair'], 'Leukotriene Receptor Antagonist', {
    atc: 'R03DC03', who: false, ind: ['Asthma (add-on)', 'Allergic rhinitis', 'Exercise-induced bronchospasm'],
    dose: [{ indication: 'Asthma', adult: '10mg OD (evening)', pediatric: '4mg OD (2-5y), 5mg OD (6-14y)', renalAdjustment: 'No adjustment', hepaticAdjustment: 'No adjustment', maxDose: '10mg daily', route: 'PO', frequency: 'Once daily (evening)', notes: '' }],
    form: ['4mg chewable', '5mg chewable', '10mg tablets'], search: ['singulair'],
  }),
  D('aminophylline', 'Aminophylline', ['Aminophylline'], 'Methylxanthine', {
    atc: 'R03DA05', who: true, ind: ['Severe acute asthma (refractory)', 'COPD exacerbation'],
    ci: ['Concurrent theophylline'],
    warn: ['Narrow therapeutic index', 'Monitor levels (10-20 mg/L)', 'Arrhythmia risk'],
    dose: [{ indication: 'Severe Asthma', adult: 'Load: 5mg/kg IV over 20min (omit if on theophylline). Infusion: 0.5mg/kg/h', pediatric: 'Load: 5mg/kg. Infusion: 1mg/kg/h', renalAdjustment: 'No adjustment', hepaticAdjustment: 'Reduce infusion rate', maxDose: '500mg loading', route: 'IV', frequency: 'Continuous infusion', notes: 'Check level 4-6h after loading' }],
    form: ['250mg/10mL ampoule'], search: ['theophylline'],
  }),
];

// ═══════════════════════════════════════════════════════════
//  GI, ANTIEMETICS & PPI
// ═══════════════════════════════════════════════════════════

const GI = [
  D('omeprazole', 'Omeprazole', ['Losec', 'Prilosec'], 'Proton Pump Inhibitor', {
    atc: 'A02BC01', who: true, ind: ['GORD', 'Peptic ulcer', 'H. pylori', 'Stress ulcer prophylaxis', 'Upper GI bleed'],
    warn: ['Long-term: monitor Mg, B12, Ca', 'May mask gastric malignancy'],
    dose: [
      { indication: 'GORD / PUD', adult: '20mg OD', pediatric: '0.7-1.4mg/kg/day', renalAdjustment: 'No adjustment', hepaticAdjustment: 'Max 20mg', maxDose: '40mg daily', route: 'PO/IV', frequency: 'Once daily before breakfast', notes: '' },
      { indication: 'Upper GI Bleed', adult: '80mg IV bolus, then 8mg/h x 72h', pediatric: 'Not established', renalAdjustment: 'No adjustment', hepaticAdjustment: 'Use with caution', maxDose: '80mg bolus + 8mg/h', route: 'IV', frequency: 'Continuous', notes: 'After endoscopic haemostasis' },
    ],
    ix: [{ drug: 'Clopidogrel', severity: 'Major', mechanism: 'Reduces clopidogrel activation', management: 'Use pantoprazole instead' }],
    form: ['20mg', '40mg capsules', '40mg IV vial'], search: ['losec', 'ppi'],
  }),
  D('pantoprazole', 'Pantoprazole', ['Protonix', 'Controloc'], 'Proton Pump Inhibitor', {
    atc: 'A02BC02', who: true, ind: ['GORD', 'Peptic ulcer', 'Stress ulcer prophylaxis', 'GI bleed'],
    dose: [{ indication: 'GORD / GI Protection', adult: '20-40mg OD', pediatric: '0.5-1mg/kg OD', renalAdjustment: 'No adjustment', hepaticAdjustment: 'Max 20mg', maxDose: '40mg daily (80mg for GI bleed)', route: 'PO/IV', frequency: 'Once daily', notes: 'Preferred PPI with clopidogrel' }],
    form: ['20mg', '40mg tablets', '40mg IV vial'], search: ['protonix', 'controloc'],
  }),
  D('ondansetron', 'Ondansetron', ['Zofran'], 'Antiemetic (5-HT3 Antagonist)', {
    atc: 'A04AA01', who: true, ind: ['Nausea/vomiting', 'Post-op N/V', 'Chemo-induced N/V'],
    ci: ['Congenital long QT'],
    warn: ['QT prolongation risk'],
    dose: [{ indication: 'N/V', adult: '4-8mg IV/PO', pediatric: '0.15mg/kg IV (max 4mg)', renalAdjustment: 'No adjustment', hepaticAdjustment: 'Max 8mg/day in severe', maxDose: '16mg/day', route: 'IV/PO', frequency: 'q8h PRN', notes: '' }],
    form: ['4mg', '8mg tablets', '4mg/2mL ampoule', '4mg/5mL syrup'], search: ['zofran'],
  }),
  D('metoclopramide', 'Metoclopramide', ['Maxolon', 'Reglan'], 'Antiemetic (Dopamine Antagonist)', {
    atc: 'A03FA01', who: true, ind: ['Nausea/vomiting', 'Gastroparesis', 'Migraine (adjunct)'],
    ci: ['GI obstruction', 'Phaeochromocytoma', 'Epilepsy'],
    warn: ['Max 5 days use (extrapyramidal risk)', 'Dystonic reactions — especially young adults'],
    dose: [{ indication: 'N/V', adult: '10mg TDS', pediatric: '0.1-0.15mg/kg TDS (max 0.5mg/kg/day)', renalAdjustment: 'Reduce dose if eGFR<30', hepaticAdjustment: 'Reduce dose', maxDose: '30mg/day', route: 'PO/IV', frequency: 'TDS', notes: 'Max 5 days' }],
    form: ['10mg tablets', '5mg/mL injection'], search: ['maxolon', 'reglan'],
  }),
  D('lactulose', 'Lactulose', ['Duphalac'], 'Osmotic Laxative', {
    atc: 'A06AD11', who: true, ind: ['Constipation', 'Hepatic encephalopathy'],
    dose: [
      { indication: 'Constipation', adult: '15-30mL BD', pediatric: '5-10mL BD', renalAdjustment: 'No adjustment', hepaticAdjustment: 'No adjustment', maxDose: '60mL/day', route: 'PO', frequency: 'BD', notes: '' },
      { indication: 'Hepatic Encephalopathy', adult: '30-50mL q1-2h until bowel movement, then TDS-QDS', pediatric: '10-20mL TDS', renalAdjustment: 'No adjustment', hepaticAdjustment: 'No adjustment', maxDose: 'Titrate to 2-3 soft stools/day', route: 'PO', frequency: 'TDS-QDS', notes: '' },
    ],
    form: ['10g/15mL solution'], search: ['duphalac'],
  }),
];

// ═══════════════════════════════════════════════════════════
//  NEUROLOGY & PSYCHIATRY
// ═══════════════════════════════════════════════════════════

const NEURO = [
  D('levetiracetam', 'Levetiracetam', ['Keppra'], 'Antiepileptic', {
    atc: 'N03AX14', who: true, ind: ['Epilepsy', 'Status epilepticus (2nd line)', 'Seizure prophylaxis'],
    ci: [],
    dose: [
      { indication: 'Status Epilepticus (2nd line)', adult: '60mg/kg IV (max 4.5g) over 10min', pediatric: '40-60mg/kg IV', renalAdjustment: 'CrCl<50: reduce dose', hepaticAdjustment: 'No adjustment', maxDose: '4.5g loading', route: 'IV', frequency: 'Single loading dose', notes: '' },
      { indication: 'Epilepsy Maintenance', adult: '500mg BD, max 1.5g BD', pediatric: '10mg/kg BD, max 30mg/kg BD', renalAdjustment: 'CrCl 30-50: 250-750mg BD. CrCl<30: 250-500mg BD', hepaticAdjustment: 'No adjustment', maxDose: '3g/day', route: 'PO/IV', frequency: 'BD', notes: '' },
    ],
    form: ['250mg', '500mg', '1000mg tablets', '100mg/mL oral solution', '500mg/5mL IV'], search: ['keppra'],
  }),
  D('phenytoin', 'Phenytoin', ['Dilantin', 'Epanutin'], 'Antiepileptic', {
    atc: 'N03AB02', who: true, ind: ['Status epilepticus (2nd line)', 'Epilepsy'],
    ci: ['Sinus bradycardia', '2nd/3rd degree heart block'],
    warn: ['Cardiac monitoring required during IV loading', 'Narrow therapeutic index (10-20 mg/L)', 'Zero-order kinetics — small dose changes = large level changes'],
    dose: [{ indication: 'Status Epilepticus', adult: '20mg/kg IV at max 50mg/min', pediatric: '20mg/kg IV at max 1mg/kg/min', renalAdjustment: 'Free levels if hypoalbuminaemia', hepaticAdjustment: 'Reduce dose', maxDose: '30mg/kg loading', route: 'IV', frequency: 'Loading dose', notes: 'Cardiac monitor required. Give in NS only (precipitates in dextrose)' }],
    form: ['100mg capsules', '250mg/5mL IV ampoule'], search: ['dilantin', 'epanutin'],
  }),
  D('sodium-valproate', 'Sodium Valproate', ['Epilim', 'Depakote'], 'Antiepileptic', {
    atc: 'N03AG01', who: true, ind: ['Epilepsy (generalised)', 'Status epilepticus (2nd line)', 'Migraine prophylaxis', 'Bipolar disorder'],
    ci: ['Pregnancy (teratogenic)', 'Active liver disease', 'Urea cycle disorders'],
    warn: ['TERATOGENIC — pregnancy prevention programme required', 'Hepatotoxicity risk in children <3', 'Reduces meropenem levels'],
    dose: [{ indication: 'Epilepsy', adult: '600mg daily in 1-2 doses, titrate to 1-2g daily', pediatric: '20-30mg/kg/day', renalAdjustment: 'No adjustment', hepaticAdjustment: 'Avoid', maxDose: '2.5g/day', route: 'PO/IV', frequency: 'BD', notes: 'Monitor LFTs, FBC' }],
    form: ['200mg', '500mg tablets', '200mg', '500mg EC tablets', '400mg/4mL IV'], search: ['epilim', 'depakote', 'valproic acid'],
  }),
  D('carbamazepine', 'Carbamazepine', ['Tegretol'], 'Antiepileptic', {
    atc: 'N03AF01', who: true, ind: ['Epilepsy (focal)', 'Trigeminal neuralgia', 'Bipolar disorder'],
    ci: ['AV block', 'Porphyria', 'Concurrent MAOIs'],
    warn: ['Auto-induction of metabolism', 'HLA-B*1502 testing in SE Asian patients (SJS risk)', 'Multiple drug interactions (CYP inducer)'],
    dose: [{ indication: 'Epilepsy', adult: '100-200mg BD, titrate to 400-600mg BD', pediatric: '5mg/kg/day, titrate', renalAdjustment: 'No adjustment', hepaticAdjustment: 'Use with caution', maxDose: '1.6g/day', route: 'PO', frequency: 'BD-TDS', notes: 'Monitor levels (4-12 mg/L)' }],
    form: ['100mg', '200mg', '400mg tablets', '200mg', '400mg MR'], search: ['tegretol'],
  }),
  D('lamotrigine', 'Lamotrigine', ['Lamictal'], 'Antiepileptic', {
    atc: 'N03AX09', who: true, ind: ['Epilepsy', 'Bipolar depression'],
    ci: [],
    warn: ['SLOW titration essential (SJS risk)', 'Risk increased with valproate (halve dose)', 'Rash — stop and review immediately'],
    dose: [{ indication: 'Epilepsy (monotherapy)', adult: '25mg OD x 2wks, 50mg OD x 2wks, then 100-200mg OD', pediatric: '0.3mg/kg/day, slow titration', renalAdjustment: 'Reduce dose in severe', hepaticAdjustment: 'Reduce dose in moderate-severe', maxDose: '500mg/day (200mg with valproate)', route: 'PO', frequency: 'OD-BD', notes: 'Halve all doses if on valproate' }],
    form: ['25mg', '50mg', '100mg', '200mg tablets'], search: ['lamictal'],
  }),
];

// ═══════════════════════════════════════════════════════════
//  THROMBOLYTICS & OTHER
// ═══════════════════════════════════════════════════════════

const OTHER = [
  D('alteplase', 'Alteplase (tPA)', ['Actilyse', 'Activase'], 'Thrombolytic', {
    atc: 'B01AD02', who: true, ind: ['STEMI', 'Acute ischaemic stroke', 'Massive PE'],
    ci: ['Active bleeding', 'Recent surgery <3wks', 'Intracranial haemorrhage', 'Severe uncontrolled HTN'],
    warn: ['Strict time windows', 'ICH risk 6-7%'],
    dose: [
      { indication: 'Acute Ischaemic Stroke', adult: '0.9mg/kg (max 90mg): 10% bolus, 90% over 60min', pediatric: 'Not established', renalAdjustment: 'No adjustment', hepaticAdjustment: 'Caution', maxDose: '90mg', route: 'IV', frequency: 'Single dose', notes: 'Within 4.5h of symptom onset' },
      { indication: 'STEMI', adult: '15mg bolus, 0.75mg/kg over 30min (max 50mg), 0.5mg/kg over 60min (max 35mg)', pediatric: 'Not established', renalAdjustment: 'No adjustment', hepaticAdjustment: 'Caution', maxDose: '100mg', route: 'IV', frequency: 'Single dose', notes: 'Only if PCI not available within 120min' },
    ],
    emg: { cardiacArrestDose: null, anaphylaxisDose: null, infusionRate: 'Stroke: 0.9mg/kg over 60min', dilutionInstructions: '50mg vial + 50mL water = 1mg/mL', pearls: ['Stroke: 10% bolus, 90% over 60min', 'Check glucose, platelets, INR before giving', 'STEMI: only if PCI not available within 120min'] },
    form: ['10mg', '20mg', '50mg vials'], search: ['tpa', 'actilyse', 'activase'],
  }),
  D('tranexamic-acid', 'Tranexamic Acid', ['Cyklokapron', 'TXA'], 'Antifibrinolytic', {
    atc: 'B02AA02', who: true, ind: ['Trauma haemorrhage', 'PPH', 'Menorrhagia', 'Epistaxis', 'Dental bleeding'],
    ci: ['Active thromboembolic disease (relative)'],
    dose: [{ indication: 'Trauma Haemorrhage', adult: '1g IV over 10min within 3h of injury, then 1g over 8h', pediatric: '15mg/kg IV', renalAdjustment: 'Reduce dose if CrCl<50', hepaticAdjustment: 'No adjustment', maxDose: '2g', route: 'IV', frequency: 'As per CRASH-2', notes: 'Must give within 3h of injury (CRASH-2 trial)' }],
    form: ['500mg/5mL ampoule', '500mg tablets'], search: ['txa', 'cyklokapron'],
  }),
  D('n-acetylcysteine', 'N-Acetylcysteine (NAC)', ['Parvolex'], 'Antidote / Mucolytic', {
    atc: 'V03AB23', who: true, ind: ['Paracetamol overdose', 'Mucolytic (nebulised)'],
    ci: [],
    warn: ['Anaphylactoid reactions common — slow infusion, treat with antihistamine, do NOT stop NAC'],
    dose: [{ indication: 'Paracetamol Overdose', adult: '200mg/kg in 500mL 5% dextrose over 4h, then 100mg/kg in 1L 5% dextrose over 16h', pediatric: 'Same mg/kg, adjust volume', renalAdjustment: 'No adjustment', hepaticAdjustment: 'No adjustment', maxDose: 'Per protocol', route: 'IV', frequency: 'Modified 2-bag regimen', notes: 'Continue if ALT rising, INR>1.3, or paracetamol still detectable' }],
    emg: { cardiacArrestDose: null, anaphylaxisDose: null, infusionRate: 'Bag 1: 200mg/kg over 4h. Bag 2: 100mg/kg over 16h', dilutionInstructions: 'Bag 1: in 500mL D5W. Bag 2: in 1000mL D5W.', pearls: ['Anaphylactoid reaction ≠ stop NAC — slow rate, give antihistamine', 'Effective up to 24h+ post-ingestion', 'Continue NAC if ALT rising or INR elevated'] },
    form: ['200mg/mL ampoule (10mL, 25mL)'], search: ['nac', 'parvolex', 'acetylcysteine'],
  }),
  D('calcium-gluconate', 'Calcium Gluconate', ['Calcium Gluconate'], 'Electrolyte', {
    atc: 'A12AA03', who: true, ind: ['Hyperkalaemia (cardiac protection)', 'Hypocalcaemia', 'Calcium channel blocker overdose', 'Magnesium sulphate toxicity reversal'],
    dose: [
      { indication: 'Hyperkalaemia', adult: '10mL 10% IV over 2min (repeat if ECG changes persist)', pediatric: '0.5mL/kg 10% IV', renalAdjustment: 'No adjustment', hepaticAdjustment: 'No adjustment', maxDose: '30mL 10%', route: 'IV', frequency: 'May repeat q5min', notes: 'Does NOT lower K — stabilises myocardium only' },
      { indication: 'Hypocalcaemia', adult: '10-20mL 10% IV over 10-20min', pediatric: '0.5mL/kg IV', renalAdjustment: 'No adjustment', hepaticAdjustment: 'No adjustment', maxDose: 'Titrate to symptoms/levels', route: 'IV', frequency: 'Repeat PRN', notes: 'Monitor ECG' },
    ],
    emg: { cardiacArrestDose: null, anaphylaxisDose: null, infusionRate: null, dilutionInstructions: '10% = 100mg/mL. Can dilute in NS for infusion.', pearls: ['HyperK: 10mL 10% IV over 2min — cardiac protection ONLY', 'Does NOT lower potassium — combine with insulin/glucose', 'Extravasation causes tissue necrosis — check IV site'] },
    form: ['10% (100mg/mL) 10mL ampoule'],
  }),
  D('magnesium-sulphate', 'Magnesium Sulphate', ['MgSO4'], 'Electrolyte', {
    atc: 'A12CC02', who: true, ind: ['Eclampsia/pre-eclampsia', 'Severe asthma', 'Hypomagnesaemia', 'Torsades de pointes', 'Tetanus'],
    dose: [
      { indication: 'Eclampsia', adult: '4g IV over 5-15min, then 1g/h infusion', pediatric: 'Not applicable', renalAdjustment: 'Avoid in severe renal impairment', hepaticAdjustment: 'No adjustment', maxDose: '4g loading', route: 'IV', frequency: 'Loading then infusion', notes: 'Monitor patellar reflexes, RR, urine output' },
      { indication: 'Severe Asthma', adult: '2g IV over 20min', pediatric: '40mg/kg IV over 20min', renalAdjustment: 'Use with caution', hepaticAdjustment: 'No adjustment', maxDose: '2g', route: 'IV', frequency: 'Single dose', notes: '' },
      { indication: 'Torsades de Pointes', adult: '2g IV over 2-5min', pediatric: '25-50mg/kg IV', renalAdjustment: 'Use with caution', hepaticAdjustment: 'No adjustment', maxDose: '2g bolus', route: 'IV', frequency: 'May repeat once', notes: '' },
    ],
    emg: { cardiacArrestDose: null, anaphylaxisDose: null, infusionRate: 'Eclampsia: 4g load then 1g/h', dilutionInstructions: '4g in 100mL NS over 15min (loading)', pearls: ['Eclampsia: 4g IV load over 15min, then 1g/h', 'Torsades: 2g IV over 2-5min', 'Toxicity reversal: calcium gluconate 10mL 10% IV'] },
    form: ['50% (500mg/mL) 2mL, 5mL, 10mL ampoules'],
  }),
  D('potassium-chloride', 'Potassium Chloride', ['KCl'], 'Electrolyte', {
    atc: 'A12BA01', who: true, ind: ['Hypokalaemia', 'Potassium replacement'],
    ci: ['Hyperkalaemia'],
    warn: ['NEVER give IV push — fatal', 'Max peripheral concentration 40mmol/L', 'Max rate 20mmol/h (40mmol/h with cardiac monitoring)'],
    dose: [{ indication: 'Hypokalaemia', adult: '20-40mmol IV in 500mL-1L NS over 2-4h', pediatric: '0.5-1mmol/kg IV', renalAdjustment: 'Use with extreme caution', hepaticAdjustment: 'No adjustment', maxDose: '40mmol/h with cardiac monitoring', route: 'IV/PO', frequency: 'Per level', notes: 'Check Mg — replace Mg first if low' }],
    form: ['600mg (8mmol) tablets', '15% (20mmol/10mL) ampoule', 'Pre-mixed IV bags'], search: ['kcl', 'potassium'],
  }),
  D('sodium-bicarbonate', 'Sodium Bicarbonate', ['NaHCO3'], 'Alkalinising Agent', {
    atc: 'B05CB04', who: true, ind: ['Severe metabolic acidosis (pH<7.1)', 'Tricyclic overdose', 'Hyperkalaemia (severe)'],
    warn: ['Can worsen hypokalaemia', 'Risk of hypernatraemia and fluid overload'],
    dose: [{ indication: 'Severe Acidosis', adult: '50-100mL 8.4% IV over 30-60min', pediatric: '1-2mmol/kg IV', renalAdjustment: 'Use with caution (Na/fluid)', hepaticAdjustment: 'No adjustment', maxDose: 'Titrate to pH', route: 'IV', frequency: 'Per ABG', notes: '8.4% = 1mmol/mL' }],
    form: ['8.4% (1mmol/mL) 50mL, 100mL vials'], search: ['bicarb', 'nahco3'],
  }),
];

// ═══════════════════════════════════════════════════════════
//  COMBINE ALL
// ═══════════════════════════════════════════════════════════

export const DRUG_DATABASE = [
  ...CARDIOVASCULAR,
  ...ANTIBIOTICS,
  ...ENDOCRINE,
  ...ANALGESICS,
  ...RESPIRATORY,
  ...GI,
  ...NEURO,
  ...OTHER,
];

export const EMERGENCY_DRUGS = DRUG_DATABASE.filter(d => d.emergencyCard);

export const INTERACTION_PAIRS = [
  { drug1: 'Warfarin', drug2: 'Amiodarone', severity: 'Major', mechanism: 'Amiodarone inhibits CYP2C9 — increases warfarin levels 2-3x', management: 'Reduce warfarin dose by 33-50%, monitor INR within 1 week, then weekly x 4' },
  { drug1: 'Warfarin', drug2: 'Aspirin', severity: 'Major', mechanism: 'Additive bleeding risk (anticoagulant + antiplatelet)', management: 'Add PPI if combination essential, monitor for bleeding' },
  { drug1: 'Warfarin', drug2: 'Rifampicin', severity: 'Major', mechanism: 'CYP induction — dramatically reduces warfarin levels', management: 'Avoid combination. If unavoidable, monitor INR twice weekly and increase warfarin dose' },
  { drug1: 'Warfarin', drug2: 'Ciprofloxacin', severity: 'Major', mechanism: 'Inhibits CYP1A2 — increases warfarin levels', management: 'Monitor INR within 3-5 days of starting, dose-adjust' },
  { drug1: 'Warfarin', drug2: 'Fluconazole', severity: 'Major', mechanism: 'Inhibits CYP2C9 — increases warfarin levels', management: 'Reduce warfarin dose, check INR within 3-5 days' },
  { drug1: 'Clopidogrel', drug2: 'Omeprazole', severity: 'Major', mechanism: 'Omeprazole inhibits CYP2C19 — reduces clopidogrel activation by 45%', management: 'Switch to pantoprazole (lower CYP2C19 inhibition)' },
  { drug1: 'Simvastatin', drug2: 'Amiodarone', severity: 'Contraindicated', mechanism: 'Increased risk of rhabdomyolysis — amiodarone inhibits CYP3A4', management: 'Max simvastatin 20mg/day or switch to pravastatin/rosuvastatin' },
  { drug1: 'Simvastatin', drug2: 'Clarithromycin', severity: 'Contraindicated', mechanism: 'CYP3A4 inhibition — rhabdomyolysis risk', management: 'Withhold statin during clarithromycin course or switch to pravastatin' },
  { drug1: 'Metformin', drug2: 'Iodinated contrast', severity: 'Major', mechanism: 'Risk of lactic acidosis if contrast-induced AKI occurs', management: 'Withhold metformin 48h pre/post contrast, check creatinine before restart' },
  { drug1: 'Morphine', drug2: 'Benzodiazepines', severity: 'Major', mechanism: 'Additive CNS and respiratory depression', management: 'Avoid combination if possible. If essential, reduce both doses and monitor SpO2/RR' },
  { drug1: 'Enoxaparin', drug2: 'Aspirin', severity: 'Moderate', mechanism: 'Additive bleeding risk', management: 'Expected in ACS treatment — monitor for bleeding, ensure PPI co-prescribed' },
  { drug1: 'ACE Inhibitor', drug2: 'Potassium', severity: 'Major', mechanism: 'Both raise serum potassium — risk of hyperkalaemia', management: 'Monitor K within 1 week, avoid K supplements if K>5.0' },
  { drug1: 'ACE Inhibitor', drug2: 'Spironolactone', severity: 'Major', mechanism: 'Additive hyperkalaemia risk', management: 'Monitor K within 1 week of starting, then monthly. Avoid if K>5.0 or eGFR<30' },
  { drug1: 'Digoxin', drug2: 'Amiodarone', severity: 'Major', mechanism: 'Amiodarone inhibits P-glycoprotein — increases digoxin levels 70-100%', management: 'Reduce digoxin dose by 50%, check level in 1 week' },
  { drug1: 'Digoxin', drug2: 'Verapamil', severity: 'Major', mechanism: 'Verapamil increases digoxin levels and additive AV block', management: 'Reduce digoxin dose, monitor levels and ECG' },
  { drug1: 'Lithium', drug2: 'Furosemide', severity: 'Major', mechanism: 'Diuretic-induced Na loss increases lithium reabsorption — toxicity', management: 'Monitor lithium levels, increase frequency of monitoring' },
  { drug1: 'Lithium', drug2: 'ACE Inhibitor', severity: 'Major', mechanism: 'Reduced lithium excretion — toxicity risk', management: 'Monitor lithium levels within 1 week, reduce dose if needed' },
  { drug1: 'Carbamazepine', drug2: 'Clarithromycin', severity: 'Major', mechanism: 'CYP3A4 inhibition increases carbamazepine levels — toxicity', management: 'Avoid combination or reduce carbamazepine dose, monitor levels' },
  { drug1: 'Phenytoin', drug2: 'Valproate', severity: 'Major', mechanism: 'Valproate displaces phenytoin from protein binding — increased free levels', management: 'Monitor free phenytoin levels, not total' },
  { drug1: 'Methotrexate', drug2: 'Trimethoprim', severity: 'Contraindicated', mechanism: 'Both inhibit folate metabolism — pancytopenia risk', management: 'Avoid combination. If used, monitor FBC closely and give folinic acid' },
  { drug1: 'Verapamil', drug2: 'Beta-blocker IV', severity: 'Contraindicated', mechanism: 'Additive AV block and negative inotropy — cardiac arrest risk', management: 'NEVER give IV verapamil with IV beta-blocker' },
  { drug1: 'Ciprofloxacin', drug2: 'Theophylline', severity: 'Major', mechanism: 'CYP1A2 inhibition increases theophylline levels — toxicity', management: 'Halve theophylline dose, monitor levels' },
  { drug1: 'Meropenem', drug2: 'Valproate', severity: 'Contraindicated', mechanism: 'Meropenem reduces valproate levels by 60-80% — seizure risk', management: 'Avoid combination. Use alternative antibiotic or alternative antiepileptic' },
  { drug1: 'Fluconazole', drug2: 'QT-prolonging drugs', severity: 'Major', mechanism: 'Additive QT prolongation', management: 'Avoid combination with amiodarone, haloperidol, ondansetron. ECG monitoring if unavoidable' },
  { drug1: 'Adenosine', drug2: 'Dipyridamole', severity: 'Major', mechanism: 'Dipyridamole blocks adenosine reuptake — potentiates effect', management: 'Reduce adenosine dose by 75% (start with 1-2mg instead of 6mg)' },
];
