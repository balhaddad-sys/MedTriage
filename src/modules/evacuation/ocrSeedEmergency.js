// OCR Seed — Emergency Medicine & Mass Casualty Intelligence
// Triage systems, trauma protocols, resuscitation, toxicology management,
// disaster medicine, field medicine, ambulance handover, MCI documentation

export const TRIAGE_SYSTEMS = [
  // START Triage
  'START','Simple Triage and Rapid Treatment',
  'Walking wounded','Can walk','Cannot walk',
  'Breathing after repositioning','Not breathing after repositioning',
  'Respiratory rate >30','Respiratory rate <30',
  'Radial pulse present','Radial pulse absent',
  'Follows commands','Does not follow commands',
  'Immediate','Delayed','Minor','Expectant','Dead',
  'Red tag','Yellow tag','Green tag','Black tag','Gray tag',
  // JumpSTART (Pediatric)
  'JumpSTART','Pediatric triage',
  'Spontaneous breathing','Apneic','Five rescue breaths',
  'Pulse present','No pulse',
  'AVPU','Alert','Verbal','Pain','Unresponsive',
  // SALT
  'SALT','Sort Assess Lifesaving interventions Treatment/Transport',
  'Walk','Wave','Still',
  'Lifesaving interventions','LSI',
  'Obey commands','Purposeful movement','No purposeful movement',
  'Peripheral pulse','Controlled hemorrhage','Uncontrolled hemorrhage',
  // CESIRA
  'CESIRA','Cammina','Emorragia','Shock','Insufficienza respiratoria',
  'Rottura ossea','Altro',
  // Sieve & Sort
  'Triage Sieve','Triage Sort','Military triage',
  'Priority 1','P1','T1','Priority 2','P2','T2',
  'Priority 3','P3','T3','Priority 4','P4','Dead',
  // Emergency Severity Index
  'ESI','ESI Level 1','ESI Level 2','ESI Level 3','ESI Level 4','ESI Level 5',
  'Resuscitation','Emergent','Urgent','Less urgent','Non-urgent',
  // Manchester Triage
  'MTS','Manchester Triage System',
  'Red','Orange','Yellow','Green','Blue',
  // Canadian Triage
  'CTAS','Canadian Triage and Acuity Scale',
  'CTAS 1','CTAS 2','CTAS 3','CTAS 4','CTAS 5',
  // Kuwait MCI
  'Mass casualty incident','MCI','Major incident',
  'Disaster response','Emergency response','Activation',
  'Command post','Incident commander','Triage officer',
  'Treatment area','Transport area','Staging area',
  'Hot zone','Warm zone','Cold zone',
  'Decontamination','Decon','Hazmat',
  'CBRN','Chemical','Biological','Radiological','Nuclear',
  'Blast injury','Explosion','Building collapse',
  'Multiple casualties','Mass shooting','Chemical attack',
];

export const TRAUMA_PROTOCOLS = [
  // ATLS
  'ATLS','Advanced Trauma Life Support',
  'Primary survey','Secondary survey','Tertiary survey',
  'ABCDE','Airway','Breathing','Circulation','Disability','Exposure',
  'C-spine precautions','Cervical collar','Log roll',
  'Jaw thrust','Chin lift','Oral airway','OPA','Nasal airway','NPA',
  'Bag-valve mask','BVM','Intubation','Cricothyrotomy','Surgical airway',
  'Needle decompression','Chest seal','Occlusive dressing',
  'Tourniquet','TQ','CAT tourniquet','SOFTT','Windlass',
  'Pelvic binder','SAM pelvic sling','Sheet wrap',
  'Massive transfusion protocol','MTP','Walking blood bank',
  'Damage control resuscitation','DCR',
  'Permissive hypotension','Target SBP 80-90',
  'Tranexamic acid','TXA','1g IV over 10 min',
  'Whole blood','PRBC','FFP','Platelets','Cryoprecipitate',
  '1:1:1 ratio','Balanced resuscitation',
  'FAST','Focused Assessment with Sonography for Trauma',
  'eFAST','Extended FAST',
  'Positive FAST','Negative FAST','Indeterminate FAST',
  'Pericardial fluid','Free fluid in Morrisons','Free fluid in pelvis',
  'Pneumothorax on FAST','Hemothorax on FAST',
  // Trauma scores
  'GCS','Glasgow Coma Scale','GCS 3-8','GCS 9-12','GCS 13-15',
  'ISS','Injury Severity Score','AIS','Abbreviated Injury Scale',
  'RTS','Revised Trauma Score','TRISS','Trauma Score',
  'Mechanism of injury','MOI',
  'High-energy mechanism','Low-energy mechanism',
  'Ejected','Unrestrained','Rollover','T-bone',
  'Pedestrian struck','Cyclist struck','Motorcycle',
  'Fall from height','Fall >3 meters','Fall >10 feet',
  'Penetrating trauma','Stab wound','Gunshot wound','GSW',
  'Blast injury','Primary blast','Secondary blast','Tertiary blast',
  // Trauma injuries
  'Tension pneumothorax','Open pneumothorax','Sucking chest wound',
  'Massive hemothorax','Flail chest','Cardiac tamponade',
  'Traumatic aortic injury','Diaphragmatic rupture',
  'Splenic injury','Splenic laceration','Grade I-V',
  'Hepatic injury','Hepatic laceration',
  'Renal injury','Renal laceration',
  'Mesenteric injury','Bowel injury','Hollow viscus injury',
  'Pelvic fracture','Unstable pelvis','Open book','Vertical shear',
  'Femur fracture','Open fracture','Gustilo classification',
  'Gustilo I','Gustilo II','Gustilo IIIA','Gustilo IIIB','Gustilo IIIC',
  'Spinal cord injury','SCI','Complete SCI','Incomplete SCI',
  'ASIA scale','ASIA A','ASIA B','ASIA C','ASIA D','ASIA E',
  'Neurogenic shock','Spinal shock',
  'Traumatic brain injury','TBI','Mild TBI','Moderate TBI','Severe TBI',
  'Diffuse axonal injury','DAI',
  'Epidural hematoma','Subdural hematoma','Contusion','Skull fracture',
  'Le Fort fracture','Le Fort I','Le Fort II','Le Fort III',
  'Orbital blowout fracture','Zygomatic fracture','Mandible fracture',
  // Burns
  'Burn injury','Thermal burn','Chemical burn','Electrical burn',
  'Inhalation injury','Smoke inhalation',
  'TBSA','Total body surface area','Rule of nines','Lund-Browder',
  'Superficial burn','Partial thickness','Full thickness',
  '1st degree','2nd degree','3rd degree','4th degree',
  'Circumferential burn','Escharotomy',
  'Parkland formula','Fluid resuscitation for burns',
  '4mL x kg x %TBSA','Lactated Ringers',
  'Silver sulfadiazine','Silvadene','Bacitracin',
  'Burn center referral','Burn center criteria',
];

export const RESUSCITATION = [
  // ACLS
  'ACLS','Advanced Cardiovascular Life Support',
  'Cardiac arrest','Pulseless','No pulse','CPR','Chest compressions',
  'Rate 100-120/min','Depth 5-6cm','Full recoil','Minimize interruptions',
  'Shockable rhythm','Non-shockable rhythm',
  'VF','Ventricular fibrillation','Pulseless VT',
  'PEA','Pulseless electrical activity','Asystole',
  'Defibrillation','Shock','360J mono','200J biphasic','120-200J biphasic',
  'Epinephrine 1mg IV q3-5min','Epi q3-5min',
  'Amiodarone 300mg','Amiodarone 150mg','Lidocaine',
  'ROSC','Return of spontaneous circulation',
  'Post-cardiac arrest care','TTM','Targeted temperature management',
  '32-36°C','Cooling','Rewarming',
  'Coronary angiography post-arrest','PCI post-arrest',
  // H's and T's
  'Hypovolemia','Hypoxia','Hydrogen ion','Acidosis',
  'Hypo/hyperkalemia','Hypothermia',
  'Tension pneumothorax','Tamponade','Toxins',
  'Thrombosis pulmonary','Thrombosis coronary',
  // Pediatric
  'PALS','Pediatric Advanced Life Support',
  'Weight-based dosing','Broselow tape','Length-based',
  'IO access','Intraosseous','EZ-IO',
  'Epinephrine 0.01mg/kg','Epi 0.1mL/kg of 1:10000',
  'Defibrillation 2J/kg','4J/kg',
  'Amiodarone 5mg/kg','Adenosine 0.1mg/kg',
  // Neonatal
  'NRP','Neonatal Resuscitation Program',
  'Initial steps','Warmth','Dry','Stimulate','Position',
  'PPV','Positive pressure ventilation','40-60 breaths/min',
  'CPAP','Intubation','Chest compressions 3:1',
  'Epinephrine 0.01-0.03mg/kg IV/IO',
  'Volume expansion','10mL/kg NS',
  // Anaphylaxis
  'Anaphylaxis','Anaphylactic shock','Anaphylactoid',
  'Epinephrine IM','0.3-0.5mg IM','1:1000 IM',
  'Anterolateral thigh','EpiPen','Autoinjector',
  'IV fluids','NS bolus 20mL/kg',
  'Diphenhydramine','H1 blocker','Ranitidine','H2 blocker',
  'Methylprednisolone','Dexamethasone',
  'Bronchodilator','Salbutamol nebulizer',
  'Biphasic reaction','Observation 4-6 hours',
  // Rapid Response
  'Rapid response team','RRT','Medical emergency team','MET',
  'Code blue','Code red','Code pink','Code orange',
  'MET call','MET criteria','Calling criteria',
  'Early warning score','NEWS','NEWS2','MEWS',
  'Deteriorating patient','Clinical deterioration',
  'Escalation','Escalation of care',
  'ICU review','ICU outreach','Critical care outreach',
];

export const AMBULANCE_HANDOVER = [
  // Pre-hospital
  'EMS','Emergency Medical Services','Ambulance','Paramedic',
  'EMT','Emergency Medical Technician',
  'Pre-hospital','Field','Scene','En route',
  'Response time','On scene time','Transport time',
  'Mechanism of injury','MOI',
  'MIST handover','MIST','Mechanism','Injuries','Signs','Treatment',
  'ATMIST','Age','Time','Mechanism','Injuries','Signs','Treatment',
  'ASHICE','Age','Sex','History','Injuries','Condition','ETA',
  'SBAR handover','Situation','Background','Assessment','Recommendation',
  'GCS on scene','GCS on arrival','GCS trend',
  'Vitals on scene','Vitals en route','Vitals on arrival',
  'Interventions performed','IV access obtained','Fluid given',
  'Medications given','Immobilization','Splinting done',
  'Airway managed','Intubated on scene','LMA placed',
  'CPR in progress','CPR duration','Shocks delivered',
  'ETA','Estimated time of arrival',
  'Trauma alert','Stroke alert','STEMI alert','Sepsis alert',
  'Receiving hospital','Destination','Diversion',
  'Patient handover','Verbal report','Written report',
  'PCR','Patient care report','Run sheet',
];

export const EMERGENCY_PROCEDURES = [
  // Airway
  'Rapid sequence intubation','RSI',
  'Induction agents','Etomidate','Ketamine','Propofol','Thiopental',
  'Paralytic','Succinylcholine','Rocuronium',
  'Direct laryngoscopy','DL','Video laryngoscopy','VL',
  'Glidescope','C-MAC','McGrath','King Vision',
  'Bougie','Stylet','Eschmann','Endotracheal tube','Cuff inflated',
  'Confirm placement','EtCO2','Colorimetric','Waveform capnography',
  'Bilateral breath sounds','CXR confirmation',
  'Grade 1 view','Grade 2 view','Grade 3 view','Grade 4 view',
  'Cormack-Lehane','C-L Grade',
  'Difficult airway','Cannot intubate','Failed intubation',
  'Supraglottic airway','SGA','LMA','i-gel',
  'Front of neck access','FONA','Cricothyrotomy',
  'Surgical cricothyrotomy','Needle cricothyrotomy',
  'Percutaneous tracheostomy','Surgical tracheostomy',
  // Circulation
  'IV access','Large bore IV','18G','16G','14G',
  'IO access','Intraosseous','EZ-IO','Proximal tibia','Humeral head',
  'Central venous access','IJ','Subclavian','Femoral',
  'Ultrasound-guided','US-guided','Landmark technique',
  'Arterial line placement','Radial artery','Femoral artery',
  'Chest tube insertion','Tube thoracostomy',
  'Pericardiocentesis','Subxiphoid approach',
  'Emergency thoracotomy','Resuscitative thoracotomy','EDT',
  'Aortic cross-clamp','REBOA',
  'Resuscitative Endovascular Balloon Occlusion of the Aorta',
  // Other ED procedures
  'Lumbar puncture','LP','Lateral decubitus','Sitting position',
  'Opening pressure','CSF studies',
  'Paracentesis','Diagnostic paracentesis','Therapeutic paracentesis',
  'Thoracentesis','Diagnostic thoracentesis','Therapeutic thoracentesis',
  'Joint aspiration','Arthrocentesis','Knee aspiration','Shoulder aspiration',
  'Incision and drainage','I&D','Abscess drainage',
  'Wound closure','Suturing','Staples','Tissue adhesive',
  'Laceration repair','Simple repair','Complex repair','Layered closure',
  'Fracture reduction','Closed reduction','Splint application',
  'Dislocation reduction','Shoulder reduction','Hip reduction',
  'Foreign body removal','Ear irrigation','Nasal packing',
  'Foley catheter insertion','Difficult catheterization',
  'NG tube insertion','Gastric lavage','Activated charcoal',
  'Cardioversion','Synchronized cardioversion','50J','100J','150J','200J',
  'Electrical cardioversion','Chemical cardioversion',
  'Transcutaneous pacing','TCP','External pacing',
  'Defibrillation','Unsynchronized shock',
  'Procedural sedation','Conscious sedation','Moderate sedation',
  'Ketamine sedation','Propofol sedation','Fentanyl/midazolam',
  'Time out','Informed consent','Procedure consent',
  'Sterile technique','Chlorhexidine prep','Betadine prep',
  'Local anesthesia','Lidocaine','Bupivacaine','Digital block',
  'Hematoma block','Femoral nerve block','Fascia iliaca block',
  'Regional anesthesia','Nerve block','Ultrasound-guided nerve block',
];

export function loadEmergencySeedData(models) {
  const now = new Date().toISOString();
  const allTerms = [
    ...TRIAGE_SYSTEMS,
    ...TRAUMA_PROTOCOLS,
    ...RESUSCITATION,
    ...AMBULANCE_HANDOVER,
    ...EMERGENCY_PROCEDURES,
  ];
  for (const term of allTerms) {
    const key = term.toLowerCase();
    if (key.length < 2) continue;
    if (!models.diagnoses[key]) {
      models.diagnoses[key] = { count: 2, entity: 'EMERGENCY', lastSeen: now, confidence: 0.72, seeded: true };
    }
  }
  models.emergencySeeded = true;
  return models;
}
