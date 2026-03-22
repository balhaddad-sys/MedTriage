// OCR Seed — Radiology Report Intelligence
// Complete radiology vocabulary: report structure, findings by modality,
// measurement patterns, recommendation phrases, critical findings,
// comparison language, anatomic variants, incidental findings

export const RADIOLOGY_REPORT_STRUCTURE = [
  // Report sections
  'EXAMINATION','EXAM','Examination','Study','Procedure',
  'CLINICAL INDICATION','INDICATION','Clinical History','History','Reason for exam',
  'COMPARISON','Comparison','Prior','Previous','No prior','No comparison available',
  'TECHNIQUE','Technique','Protocol','Contrast','Without contrast','With contrast',
  'With and without contrast','Post-contrast','Delayed images',
  'Non-contrast','NCCT','CECT','CT with IV contrast','CT without contrast',
  'MRI with gadolinium','MRI without gadolinium','MRI with and without',
  'FINDINGS','Findings','IMPRESSION','Impression','CONCLUSION','Conclusion',
  'RECOMMENDATION','Recommendations','ADDENDUM','Addendum','AMENDED REPORT',
  // Report qualifiers
  'CRITICAL','URGENT','ROUTINE','STAT','WET READ','PRELIMINARY','FINAL',
  'DICTATED BY','READ BY','VERIFIED BY','ATTENDING','Resident',
  'Teleradiology','Outside read',
  // Communication
  'Critical finding communicated','Results communicated to',
  'Findings discussed with','Called to','Paged','Spoke with',
  'Dr.','at','on','via phone','via page','acknowledged',
];

export const CHEST_XRAY_FINDINGS = [
  // Normal
  'Normal chest radiograph','No acute cardiopulmonary abnormality',
  'No acute findings','Unremarkable','Clear lungs','No effusion',
  'Normal heart size','Normal mediastinum','No pneumothorax',
  // Cardiac
  'Cardiomegaly','Mild cardiomegaly','Moderate cardiomegaly','Severe cardiomegaly',
  'Enlarged cardiac silhouette','Boot-shaped heart','Globular heart',
  'Pericardial effusion','Mediastinal widening','Aortic calcification',
  'Tortuous aorta','Aortic aneurysm','Unfolded aorta',
  'Sternotomy wires','Valve prosthesis','Pacemaker','ICD','CRT device',
  // Lungs
  'Opacity','Opacification','Consolidation','Infiltrate','Air bronchograms',
  'Ground glass opacity','GGO','Ground glass opacification',
  'Reticular pattern','Reticulonodular pattern','Interstitial pattern',
  'Honeycombing','Traction bronchiectasis','Septal thickening',
  'Mass','Nodule','Lung nodule','Pulmonary nodule','Spiculated','Round opacity',
  'Cavity','Cavitary lesion','Air-fluid level',
  'Atelectasis','Subsegmental atelectasis','Plate-like atelectasis',
  'Bibasilar atelectasis','Left lower lobe atelectasis','RML atelectasis',
  'Lobar collapse','RUL collapse','LUL collapse','Complete opacification',
  'Pleural effusion','Small effusion','Moderate effusion','Large effusion',
  'Bilateral pleural effusions','Loculated effusion','Empyema',
  'Pneumothorax','Small pneumothorax','Large pneumothorax',
  'Tension pneumothorax','Hydropneumothorax','Subcutaneous emphysema',
  'Pulmonary edema','Cephalization','Kerley B lines','Bat-wing pattern',
  'Interstitial edema','Alveolar edema','Flash pulmonary edema',
  'Pulmonary congestion','Vascular engorgement','Upper lobe diversion',
  // Mediastinum
  'Lymphadenopathy','Hilar lymphadenopathy','Mediastinal lymphadenopathy',
  'Paratracheal lymph node','Hilar prominence',
  'Mediastinal mass','Anterior mediastinal mass','Thymoma',
  'Tracheal deviation','Tracheal narrowing',
  // Bones
  'Rib fracture','Multiple rib fractures','Flail segment',
  'Clavicle fracture','Vertebral compression fracture',
  'Degenerative changes','Osteopenia','Lytic lesion','Blastic lesion',
  // Lines/Tubes
  'ETT in good position','ETT tip above carina',
  'NG tube tip in stomach','NG tube coiled','NG tube in esophagus',
  'Central line tip in SVC','PICC tip at cavoatrial junction',
  'Right IJ','Left subclavian','Right subclavian',
  'Chest tube in good position','Chest tube with residual effusion',
  'Pacemaker leads in good position','Lead in RV','Lead in RA',
  'Swan-Ganz catheter','PA catheter tip','IABP tip',
  'Tracheostomy tube in situ','Trach in good position',
];

export const CT_FINDINGS = [
  // CT Head
  'No acute intracranial abnormality','No hemorrhage','No mass effect',
  'No midline shift','No hydrocephalus',
  'Acute intraparenchymal hemorrhage','IPH','ICH',
  'Subdural hematoma','SDH','Acute SDH','Chronic SDH','Mixed density SDH',
  'Epidural hematoma','EDH','Biconvex','Lenticular',
  'Subarachnoid hemorrhage','SAH','Intraventricular hemorrhage','IVH',
  'Acute ischemic infarct','Loss of gray-white differentiation',
  'Hypodense area','Insular ribbon sign','Dense MCA sign',
  'Cerebral edema','Effacement of sulci','Effacement of basal cisterns',
  'Uncal herniation','Tonsillar herniation','Subfalcine herniation',
  'Midline shift','Midline shift of X mm',
  'Hydrocephalus','Ventriculomegaly','Dilated ventricles',
  'Mass','Enhancing mass','Ring-enhancing lesion',
  'Calcification','Choroid plexus calcification',
  'Chronic microvascular ischemic changes','White matter changes',
  'Brain atrophy','Cortical atrophy','Cerebellar atrophy',
  'Skull fracture','Calvarial fracture','Basilar skull fracture',
  'Pneumocephalus','Orbital fracture','Facial fracture',
  // CT Chest
  'Pulmonary embolism','PE','Filling defect in pulmonary artery',
  'Saddle embolus','Right heart strain','RV enlargement',
  'Aortic dissection','Intimal flap','True lumen','False lumen',
  'Aortic aneurysm','Maximum diameter','Interval change',
  'Lymphadenopathy','Mediastinal adenopathy','Hilar adenopathy',
  'Pleural thickening','Pleural calcification','Mesothelioma',
  'Pericardial effusion','Pericardial thickening',
  // CT Abdomen/Pelvis
  'No acute intra-abdominal pathology','No free fluid','No free air',
  'Hepatomegaly','Liver size','Hepatic steatosis','Fatty liver',
  'Hepatic lesion','Liver mass','Hemangioma','FNH','HCC',
  'Cirrhotic morphology','Nodular liver','Portal hypertension','Varices',
  'Splenomegaly','Splenic infarct',
  'Gallstones','Cholelithiasis','Cholecystitis','Wall thickening',
  'Pericholecystic fluid','CBD dilatation','Biliary dilatation',
  'Pancreatic head mass','Pancreatic duct dilatation',
  'Double duct sign','Peripancreatic stranding','Pancreatic necrosis',
  'Kidney stone','Renal calculus','Hydronephrosis','Hydroureter',
  'Renal mass','Renal cyst','Bosniak classification',
  'Adrenal mass','Adrenal adenoma','Adrenal incidentaloma',
  'Appendicitis','Dilated appendix','Periappendiceal fat stranding',
  'Appendicolith','Appendiceal perforation',
  'Small bowel obstruction','SBO','Transition point',
  'Large bowel obstruction','LBO','Cecal volvulus','Sigmoid volvulus',
  'Diverticulitis','Pericolic stranding','Diverticular abscess',
  'Free air','Pneumoperitoneum','Free fluid','Ascites',
  'Mesenteric stranding','Fat stranding','Inflammatory changes',
  'Abscess','Collection','Rim-enhancing collection',
  'Lymphadenopathy','Retroperitoneal adenopathy','Mesenteric adenopathy',
  'AAA','Abdominal aortic aneurysm','Iliac aneurysm',
  'Aortic calcification','Vascular calcification',
  // Measurements
  'measuring','measures','diameter','maximal diameter',
  'mm','cm','x','by',
  'previously measured','compared to prior','interval increase',
  'interval decrease','stable','unchanged','new','resolved',
  'increased in size','decreased in size','stable in size',
];

export const RADIOLOGY_RECOMMENDATIONS = [
  'No follow-up necessary','Routine follow-up',
  'Recommend clinical correlation','Clinical correlation advised',
  'Suggest correlation with clinical findings',
  'Recommend follow-up CT','Recommend follow-up MRI',
  'Recommend follow-up ultrasound','Recommend follow-up in 3 months',
  'Recommend follow-up in 6 months','Recommend follow-up in 12 months',
  'Recommend CTA','Recommend CTPA','Recommend MRA',
  'Recommend biopsy','CT-guided biopsy recommended',
  'Recommend surgical consultation','Recommend GI consultation',
  'Recommend further evaluation with MRI',
  'Recommend PET-CT for further characterization',
  'Recommend dedicated study','Recommend contrast-enhanced study',
  'Fleischner criteria','Follow Fleischner guidelines',
  'LI-RADS','LI-RADS 1','LI-RADS 2','LI-RADS 3','LI-RADS 4','LI-RADS 5',
  'BI-RADS','BI-RADS 0','BI-RADS 1','BI-RADS 2','BI-RADS 3','BI-RADS 4','BI-RADS 5',
  'TI-RADS','Lung-RADS','PI-RADS',
  'ACR Appropriateness Criteria',
  'If clinically indicated','If symptoms persist',
  'Urgent/emergent findings','Critical finding',
  'Incidental finding','Incidentaloma',
  'Discussed with referring physician','Results called to',
];

export const ULTRASOUND_FINDINGS = [
  // General
  'Echogenic','Hypoechoic','Hyperechoic','Anechoic','Isoechoic',
  'Heterogeneous','Homogeneous','Mixed echogenicity',
  'Well-defined','Ill-defined','Lobulated','Irregular margins',
  'Posterior acoustic enhancement','Posterior acoustic shadowing',
  'Color Doppler flow','Power Doppler','Spectral Doppler',
  'Resistive index','RI','Pulsatility index','PI',
  // Abdominal US
  'Normal liver echotexture','Increased echogenicity','Fatty infiltration',
  'Hepatic cyst','Simple cyst','Complex cyst',
  'Gallbladder wall thickening','Murphy sign positive','Sonographic Murphy',
  'Cholelithiasis','Sludge','CBD dilated','CBD normal caliber',
  'Common bile duct','CBD measures','Intrahepatic ductal dilatation',
  'Pancreas visualized','Pancreas obscured by bowel gas',
  'Spleen normal size','Splenomegaly',
  'Right kidney','Left kidney','Cortical thinning','Cortical echogenicity',
  'Hydronephrosis','Mild hydronephrosis','Moderate hydronephrosis','Severe hydronephrosis',
  'Renal cyst','Simple renal cyst','Complex renal cyst',
  'Renal stone','Twinkling artifact',
  'Bladder well-distended','Post-void residual','PVR',
  'Free fluid','Ascites','Trace free fluid','No free fluid',
  'Morrison pouch','Pouch of Douglas','Paracolic gutters',
  // Vascular US
  'DVT','No DVT','Deep venous thrombosis','Non-compressible',
  'Compressible','Normal compressibility','Augmentation',
  'Acute thrombus','Chronic thrombus','Partial occlusion','Complete occlusion',
  'Common femoral vein','CFV','Superficial femoral vein','SFV',
  'Popliteal vein','Great saphenous vein','GSV',
  'Carotid stenosis','ICA stenosis','Peak systolic velocity','PSV',
  'End-diastolic velocity','EDV','ICA/CCA ratio',
  '<50% stenosis','>50% stenosis','>70% stenosis','Near occlusion','Occlusion',
  'Plaque','Calcified plaque','Soft plaque','Mixed plaque',
  // OB US
  'Intrauterine pregnancy','IUP','Fetal heart rate','FHR',
  'Crown-rump length','CRL','Biparietal diameter','BPD',
  'Femur length','FL','Abdominal circumference','AC',
  'Estimated fetal weight','EFW','Amniotic fluid index','AFI',
  'Oligohydramnios','Polyhydramnios','Normal amniotic fluid',
  'Placenta','Anterior placenta','Posterior placenta','Fundal placenta',
  'Placenta previa','Low-lying placenta','Marginal placenta previa',
  'Gestational sac','Yolk sac','Fetal pole',
  'Ectopic pregnancy','Adnexal mass','Free fluid in pelvis',
  'Nuchal translucency','NT','Nasal bone',
];

export const MRI_FINDINGS = [
  // Signal characteristics
  'T1 hyperintense','T1 hypointense','T1 isointense',
  'T2 hyperintense','T2 hypointense','T2 isointense',
  'FLAIR hyperintensity','FLAIR signal abnormality',
  'DWI restriction','Diffusion restriction','Restricted diffusion',
  'ADC low','ADC map','Apparent diffusion coefficient',
  'Enhancement','Enhancing','Non-enhancing','Rim enhancement',
  'Homogeneous enhancement','Heterogeneous enhancement',
  'Blooming artifact','Susceptibility artifact','GRE signal loss',
  'SWI','Susceptibility weighted imaging','Microhemorrhage',
  // MRI Brain
  'Acute infarct','DWI positive','Cytotoxic edema',
  'Vasogenic edema','Perilesional edema',
  'Demyelinating lesion','Demyelination','White matter lesion',
  'Periventricular lesion','Dawson fingers','Juxtacortical lesion',
  'Corpus callosum lesion','Enhancing lesion','Ring-enhancing',
  'Leptomeningeal enhancement','Pachymeningeal enhancement',
  'Cranial nerve enhancement','CN VII enhancement',
  'Empty sella','Pituitary microadenoma','Pituitary macroadenoma',
  'Optic nerve enhancement','Optic neuritis',
  // MRI Spine
  'Disc herniation','Disc protrusion','Disc extrusion','Sequestered disc',
  'Central canal stenosis','Foraminal stenosis','Lateral recess stenosis',
  'Spinal cord compression','Cord signal abnormality',
  'Vertebral body fracture','Compression fracture','Burst fracture',
  'Marrow edema','STIR hyperintensity','Bone marrow signal',
  'Enhancing vertebral body','Discitis','Osteomyelitis','Epidural abscess',
  'Syrinx','Syringomyelia','Cord expansion',
  'Nerve root enhancement','Nerve root compression',
  'Degenerative disc disease','Modic changes','Schmorl node',
  // MRI Abdomen
  'Hepatic lesion','Arterial enhancement','Portal venous washout',
  'Enhancing capsule','Threshold growth',
  'Diffusion restriction in lesion',
  'Adrenal signal drop on opposed phase','Chemical shift',
  'India ink artifact','Signal drop on out-of-phase',
  // MRI Knee
  'ACL tear','Complete tear','Partial tear','Intact ACL',
  'PCL tear','MCL sprain','Grade I','Grade II','Grade III',
  'Meniscal tear','Medial meniscal tear','Lateral meniscal tear',
  'Bucket handle tear','Complex tear','Horizontal tear',
  'Bone marrow edema','Bone bruise','Contusion',
  'Joint effusion','Baker cyst','Popliteal cyst',
  'Chondral defect','Chondromalacia','Cartilage loss',
  'Osteochondral defect','OCD','Loose body',
];

export function loadRadiologySeedData(models) {
  const now = new Date().toISOString();
  const allTerms = [
    ...RADIOLOGY_REPORT_STRUCTURE,
    ...CHEST_XRAY_FINDINGS,
    ...CT_FINDINGS,
    ...RADIOLOGY_RECOMMENDATIONS,
    ...ULTRASOUND_FINDINGS,
    ...MRI_FINDINGS,
  ];
  for (const term of allTerms) {
    const key = term.toLowerCase();
    if (key.length < 2) continue;
    if (!models.diagnoses[key]) {
      models.diagnoses[key] = { count: 1, entity: 'RADIOLOGY', lastSeen: now, confidence: 0.65, seeded: true };
    }
  }
  models.radiologySeeded = true;
  return models;
}
