import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const sheetTitlePattern = /ward transfer sheet|morning census|evening census|night census|bed board|unit census|daily census|ward handover|overnight handover|daily transfer list|er census|admission board|weekend census/i;
const sectionTitlePattern = /male list|female list|chronic list|acute list|transfer list|active patients|unassigned list|observation list|stepdown list|pending review/i;
const wardPattern = /ward|icu|ccu|nicu|picu|hdu|mau|amu|er/i;
const statusPattern = /new|active|chronic|pending|transfer|follow-up|icu discharge|er discharge|ward discharge|resolved|deteriorating|review|transferred|awaiting bed/i;
const titledDoctorPattern = /^(?:dr\.?|doctor|consultant(?:\s+dr)?|team(?:\s+dr)?|registrar|resident|on-call(?:\s+dr)?|primary team|assigned consultant)\s+/i;

function requireFile(path) {
  if (!existsSync(path)) throw new Error(`Missing required file: ${path}`);
  return readFileSync(path, 'utf8');
}

function requireNonEmptyLines(path) {
  const content = requireFile(path);
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) throw new Error(`Expected non-empty file: ${path}`);
  return lines;
}

function parseJsonl(path) {
  return requireNonEmptyLines(path).map(line => JSON.parse(line));
}

const generatedLexiconPath = resolve(repoRoot, 'training', 'ocr', 'generated', 'medtriage_domain_lexicon.json');
const charsetPath = resolve(repoRoot, 'training', 'ocr', 'generated', 'medtriage_charset.txt');
const corpusPath = resolve(repoRoot, 'training', 'ocr', 'generated', 'medtriage_corpus.txt');

const lexicon = JSON.parse(requireFile(generatedLexiconPath));
const charset = requireNonEmptyLines(charsetPath);
const corpus = requireNonEmptyLines(corpusPath);

if (!lexicon.medicalTerms?.length) throw new Error('No medical terms found in generated lexicon');
if (!lexicon.medications?.length) throw new Error('No medications found in generated lexicon');
if (!lexicon.rosterNames?.length) throw new Error('No roster names found in generated lexicon');
if (!lexicon.doctorNames?.length) throw new Error('No doctor names found in generated lexicon');
if (!lexicon.sheetHeaders?.some(header => /patient name/i.test(header))) throw new Error('Generated lexicon is missing patient-name sheet headers');
if (!lexicon.sheetHeaders?.some(header => /assigned dr|consultant|doctor|primary team|responsible doctor/i.test(header))) throw new Error('Generated lexicon is missing doctor-header aliases');
if (!lexicon.sheetTitles?.some(title => /ward transfer sheet|morning census/i.test(title))) throw new Error('Generated lexicon is missing roster sheet titles');
if (!lexicon.sheetTitles?.some(title => /evening census|night census|bed board|unit census|daily census|ward handover|overnight handover|daily transfer list|er census|admission board|weekend census/i.test(title))) throw new Error('Generated lexicon is missing expanded sheet titles');
if (!lexicon.sectionTitles?.some(title => /male list|chronic list/i.test(title))) throw new Error('Generated lexicon is missing sheet section titles');
if (!lexicon.sectionTitles?.some(title => /pending|transfer|acute|unassigned|observation|stepdown/i.test(title))) throw new Error('Generated lexicon is missing expanded section titles');
if (!lexicon.roomWardTokens?.some(token => /^\d+(?:-\d+)?$/.test(token))) throw new Error('Generated lexicon is missing room/ward-style numeric tokens');
if (!lexicon.roomWardTokens?.some(token => /^\d+[ab]$|^\d+\/\d+$/i.test(token))) throw new Error('Generated lexicon is missing expanded room/ward token variants');
if (!lexicon.wardTokens?.some(token => /er unassigned|observation|medical ward|surgical ward/i.test(token))) throw new Error('Generated lexicon is missing expanded ward tokens');
if (!lexicon.sheetStatuses?.some(status => /new|chronic|discharge|review|transferred|awaiting bed/i.test(status))) throw new Error('Generated lexicon is missing roster sheet statuses');
if (!lexicon.doctorTitles?.some(title => /registrar|resident|on-call|consultant dr|team dr|assigned consultant|primary team/i.test(title))) throw new Error('Generated lexicon is missing expanded doctor titles');
if (!lexicon.detailDiagnosisPhrases?.some(phrase => /mca occlusion|ischemic stroke|weight loss|biliary/i.test(phrase))) throw new Error('Generated lexicon is missing detail-diagnosis phrases');
if (!lexicon.detailDiagnosisPhrases?.some(phrase => /aspiration pneumonia|septic shock|gi bleeding|nstemi|aphasia|delirium|dka|copd exacerbation/i.test(phrase))) throw new Error('Generated lexicon is missing expanded detail-diagnosis phrases');
if (!charset.some(char => /[A-Z]/.test(char))) throw new Error('Charset is missing Latin uppercase characters');
if (!charset.some(char => /[\u0600-\u06FF]/.test(char))) throw new Error('Charset is missing Arabic characters');
if (!corpus.some(line => /[A-Z]-[MF]-\d{2}/.test(line))) throw new Error('Synthetic corpus is missing bed-format rows');
if (!corpus.some(line => /room\s*\/\s*ward/i.test(line))) throw new Error('Synthetic corpus is missing spreadsheet room/ward headers');
if (!corpus.some(line => /assigned doctor|primary team|responsible doctor/i.test(line))) throw new Error('Synthetic corpus is missing assigned-doctor headers');
if (!corpus.some(line => sheetTitlePattern.test(line))) throw new Error('Synthetic corpus is missing sheet-title rows');
if (!corpus.some(line => /evening census|night census|bed board|unit census|daily census|ward handover|overnight handover|daily transfer list|er census|admission board|weekend census/i.test(line))) throw new Error('Synthetic corpus is missing expanded sheet-title rows');
if (!corpus.some(line => /male list|chronic list/i.test(line))) throw new Error('Synthetic corpus is missing section-title rows');
if (!corpus.some(line => /pending|transfer|acute|unassigned|observation|stepdown/i.test(line) && /list/i.test(line))) throw new Error('Synthetic corpus is missing expanded section-title rows');
if (!corpus.some(line => /^ward\s+\d+$/i.test(line))) throw new Error('Synthetic corpus is missing ward banner rows');
if (!corpus.some(line => /mca occlusion|ischemic stroke|weight loss|biliary/i.test(line))) throw new Error('Synthetic corpus is missing detail-diagnosis rows');
if (!corpus.some(line => /aspiration pneumonia|septic shock|gi bleeding|nstemi|aphasia|delirium|dka|copd exacerbation/i.test(line))) throw new Error('Synthetic corpus is missing expanded detail-diagnosis rows');
if (!corpus.some(line => /^\d+[ab]$/i.test(line) || /^\d+\/\d+$/.test(line))) throw new Error('Synthetic corpus is missing expanded room-token rows');
if (!corpus.some(line => /^\d+(?:-\d+)?\s+[a-z][a-z]+(?:\s+[a-z][a-z]+)+\s+.+\s+[a-z][a-z]+(?:\s+[a-z][a-z]+)*\s+(?:new|active|chronic|pending|transfer|follow-up|icu discharge|er discharge|ward discharge)$/i.test(line))) {
  throw new Error('Synthetic corpus is missing lowercase roster-style patient rows');
}
if (!corpus.some(line => /^\d+\s+[a-z][a-z]+(?:\s+[a-z][a-z]+)+\s+.+\s+(?:dr\.?|doctor|consultant|team)\s+[a-z][a-z]+(?:\s+[a-z][a-z]+)*\s+(?:new|active|chronic|pending|transfer|follow-up|icu discharge|er discharge|ward discharge)$/i.test(line))) {
  throw new Error('Synthetic corpus is missing numeric-room roster rows with titled doctors');
}
if (!corpus.some(line => /^(?:ward\s+\d+|icu|ccu|nicu|picu|hdu|mau|amu|er(?:\/unassigned)?|medical ward|surgical ward)\s+\d+\s+.+\s+(?:dr\.?|doctor|consultant|team|registrar|resident|on-call)\s+.+\s+(?:new|active|chronic|pending|transfer|follow-up|icu discharge|er discharge|ward discharge|resolved|deteriorating)$/i.test(line))) {
  throw new Error('Synthetic corpus is missing ward-inline roster rows');
}
if (!corpus.some(line => /^(?:ward\s+\d+|icu|ccu|nicu|picu|hdu|mau|amu|er(?:\/unassigned)?|medical ward|surgical ward)\s+\|\s+\d+\s+\|.+\|.+\|.+\|.+$/i.test(line))) {
  throw new Error('Synthetic corpus is missing ward pipe rows');
}
if (!corpus.some(line => sheetTitlePattern.test(line) && /patient name|assigned doctor/i.test(line))) {
  throw new Error('Synthetic corpus is missing title-header roster rows');
}
if (!corpus.some(line => sheetTitlePattern.test(line) && sectionTitlePattern.test(line) && /patient name|pt name|assigned doctor|assigned dr|consultant|doctor/i.test(line))) {
  throw new Error('Synthetic corpus is missing title-section-header roster rows');
}
if (!corpus.some(line => sheetTitlePattern.test(line) && sectionTitlePattern.test(line) && /medication|medications|meds/i.test(line) && /assigned doctor|assigned dr|consultant|doctor/i.test(line) && /(?:new|active|chronic|pending|transfer|follow-up|icu discharge|er discharge|ward discharge|resolved|deteriorating).+(?:new|active|chronic|pending|transfer|follow-up|icu discharge|er discharge|ward discharge|resolved|deteriorating)/i.test(line))) {
  throw new Error('Synthetic corpus is missing medication-heavy census block rows');
}
if (!corpus.some(line => sheetTitlePattern.test(line) && sectionTitlePattern.test(line) && /(?:male list|female list|chronic list|acute list|transfer list|active patients).+(?:male list|female list|chronic list|acute list|transfer list|active patients)/i.test(line) && wardPattern.test(line))) {
  throw new Error('Synthetic corpus is missing multi-section census block rows');
}
if (!corpus.some(line => sheetTitlePattern.test(line) && sectionTitlePattern.test(line) && /patient name|pt name|assigned doctor|assigned dr|consultant|doctor/i.test(line) && wardPattern.test(line) && /mca occlusion|ischemic stroke|biliary|aspiration pneumonia|nstemi|aphasia/i.test(line) && /(?:male list|female list|chronic list|acute list|transfer list|active patients)/i.test(line.replace(/^[\s\S]*?(mca occlusion|ischemic stroke|biliary|aspiration pneumonia|nstemi|aphasia)/i, '')))) {
  throw new Error('Synthetic corpus is missing overnight handover-style block rows');
}
if (!corpus.some(line => sheetTitlePattern.test(line) && sectionTitlePattern.test(line) && wardPattern.test(line) && /patient name|pt name|assigned doctor|assigned dr|consultant|doctor/i.test(line) && /(?:new|active|chronic|pending|transfer|follow-up|icu discharge|er discharge|ward discharge|resolved|deteriorating).+(?:new|active|chronic|pending|transfer|follow-up|icu discharge|er discharge|ward discharge|resolved|deteriorating)/i.test(line))) {
  throw new Error('Synthetic corpus is missing screenshot-style section block rows');
}
if (!corpus.some(line => sheetTitlePattern.test(line) && sectionTitlePattern.test(line) && wardPattern.test(line) && /mca occlusion|ischemic stroke|biliary|aspiration pneumonia|nstemi|aphasia/i.test(line) && /mca occlusion|ischemic stroke|biliary|aspiration pneumonia|nstemi|aphasia/i.test(line.replace(/^[\s\S]*?(mca occlusion|ischemic stroke|biliary|aspiration pneumonia|nstemi|aphasia)/i, '')))) {
  throw new Error('Synthetic corpus is missing wrapped-style detail-diagnosis block rows');
}
if (!corpus.some(line => sectionTitlePattern.test(line) && wardPattern.test(line) && /(?:ward\s+\d+|icu|ccu|nicu|picu|hdu|mau|amu|er(?:\/unassigned)?|medical ward|surgical ward).+(?:ward\s+\d+|icu|ccu|nicu|picu|hdu|mau|amu|er(?:\/unassigned)?|medical ward|surgical ward)/i.test(line))) {
  throw new Error('Synthetic corpus is missing stacked ward block rows');
}
if (!corpus.some(line => sheetTitlePattern.test(line) && sectionTitlePattern.test(line) && /patient name diagnosis assigned dr|room\s*\/\s*ward patient name diagnosis assigned doctor/i.test(line) && wardPattern.test(line))) {
  throw new Error('Synthetic corpus is missing partial-header block rows');
}
if (!corpus.some(line => /ward\s*\/\s*bed|ward\s*\/\s*room|room no|pt name|assigned dr|consultant name|list status|category/i.test(line))) {
  throw new Error('Synthetic corpus is missing header-alias rows');
}
if (!corpus.some(line => /medication notes|plan \/ notes|primary team|responsible doctor|assigned consultant/i.test(line))) {
  throw new Error('Synthetic corpus is missing deeper medication/team header rows');
}
if (!corpus.some(line => sheetTitlePattern.test(line) && /male list \(active\)|male list active/i.test(line) && /chronic list/i.test(line) && /active.+chronic/i.test(line))) {
  throw new Error('Synthetic corpus is missing active/chronic mixed sheet rows');
}
if (!corpus.some(line => /unassigned list/i.test(line) && /ER\/Unassigned/i.test(line) && /review|awaiting bed|transferred/i.test(line))) {
  throw new Error('Synthetic corpus is missing unassigned transfer rows');
}
if (!corpus.some(line => /^(?:dr\.?|doctor|consultant|team)\s+.+\s+(?:new|active|chronic|pending|transfer|follow-up|icu discharge|er discharge|ward discharge)$/i.test(line))) {
  throw new Error('Synthetic corpus is missing doctor-status roster rows');
}
if (!corpus.some(line => /^(?:dr\.?|doctor|consultant|team|registrar|resident|on-call)\s+.+\s+(?:ward\s+\d+|icu|ccu|nicu|picu|hdu|mau|amu|er(?:\/unassigned)?|medical ward|surgical ward)\s+(?:new|active|chronic|pending|transfer|follow-up|icu discharge|er discharge|ward discharge|resolved|deteriorating)$/i.test(line))) {
  throw new Error('Synthetic corpus is missing doctor-ward-status roster rows');
}

const preparedRoot = resolve(repoRoot, 'training', 'ocr', 'prepared', 'paddle', 'rec');
const syntheticRoot = resolve(repoRoot, 'training', 'ocr', 'raw', 'medtriage_synthetic');
const syntheticLabelsPath = resolve(syntheticRoot, 'labels.jsonl');
const syntheticStatsPath = resolve(syntheticRoot, 'stats.json');
const trainPath = resolve(preparedRoot, 'train.txt');

if (existsSync(syntheticLabelsPath)) {
  const labels = parseJsonl(syntheticLabelsPath);
  if (!labels.every(entry => entry.kind && entry.layout && Array.isArray(entry.cells) && entry.renderStyle && entry.difficulty)) {
    throw new Error('Synthetic labels are missing kind/layout/cells/renderStyle/difficulty metadata');
  }
  if (!labels.every(entry => entry.layout !== 'sheet-block' || (Array.isArray(entry.rows) && entry.rows.length >= 4))) {
    throw new Error('Synthetic sheet-block labels are missing rows metadata');
  }
  if (!labels.some(entry => entry.kind === 'patient-name' && /^[A-Za-z][A-Za-z -]+$/i.test(entry.text))) {
    throw new Error('Synthetic labels are missing patient-name samples');
  }
  if (!labels.some(entry => entry.kind === 'doctor-titled' && titledDoctorPattern.test(entry.text))) {
    throw new Error('Synthetic labels are missing titled doctor samples');
  }
  if (!labels.some(entry => entry.kind === 'pipe-row' && /\|/.test(entry.text))) {
    throw new Error('Synthetic labels are missing pipe-delimited roster rows');
  }
  if (!labels.some(entry => entry.kind === 'status-banner' && /new|chronic|discharge/i.test(entry.text))) {
    throw new Error('Synthetic labels are missing status-banner samples');
  }
  if (!labels.some(entry => entry.kind === 'header-pipe-row' && /room\s*\/\s*ward.*assigned doctor/i.test(entry.text))) {
    throw new Error('Synthetic labels are missing pipe-style header rows');
  }
  if (!labels.some(entry => entry.kind === 'section-header-row' && /male list|chronic list/i.test(entry.text))) {
    throw new Error('Synthetic labels are missing section-header rows');
  }
  if (!labels.some(entry => entry.kind === 'sheet-title' && sheetTitlePattern.test(entry.text))) {
    throw new Error('Synthetic labels are missing sheet-title samples');
  }
  if (!labels.some(entry => entry.kind === 'detail-diagnosis' && /mca occlusion|ischemic stroke|weight loss|biliary/i.test(entry.text))) {
    throw new Error('Synthetic labels are missing detail-diagnosis samples');
  }
  if (!labels.some(entry => entry.kind === 'sparse-spreadsheet-row' && entry.cells.some(cell => cell === ''))) {
    throw new Error('Synthetic labels are missing sparse spreadsheet rows with blank cells');
  }
  if (!labels.some(entry => entry.kind === 'section-context-row' && /male list|female list/i.test(entry.text) && wardPattern.test(entry.text))) {
    throw new Error('Synthetic labels are missing section-context rows');
  }
  if (!labels.some(entry => entry.kind === 'room-number-roster-row' && /^\d+$/.test(entry.cells?.[0] || '') && titledDoctorPattern.test(entry.cells?.[3] || ''))) {
    throw new Error('Synthetic labels are missing numeric-room roster rows');
  }
  if (!labels.some(entry => entry.kind === 'title-header-row' && sheetTitlePattern.test(entry.text) && /patient name|pt name|assigned doctor|assigned dr/i.test(entry.text))) {
    throw new Error('Synthetic labels are missing title-header rows');
  }
  if (!labels.some(entry => entry.kind === 'doctor-status-row' && titledDoctorPattern.test(entry.text) && /new|active|chronic|discharge/i.test(entry.text))) {
    throw new Error('Synthetic labels are missing doctor-status rows');
  }
  if (!labels.some(entry => entry.kind === 'numeric-pipe-row' && /^\d+$/.test(entry.cells?.[0] || '') && /\|/.test(entry.text))) {
    throw new Error('Synthetic labels are missing numeric-pipe rows');
  }
  if (!labels.some(entry => entry.kind === 'ward-inline-roster-row' && wardPattern.test(entry.text) && statusPattern.test(entry.text))) {
    throw new Error('Synthetic labels are missing ward-inline roster rows');
  }
  if (!labels.some(entry => entry.kind === 'ward-pipe-row' && /\|/.test(entry.text) && wardPattern.test(entry.cells?.[0] || ''))) {
    throw new Error('Synthetic labels are missing ward-pipe rows');
  }
  if (!labels.some(entry => entry.kind === 'title-section-header-row' && sheetTitlePattern.test(entry.text) && sectionTitlePattern.test(entry.text))) {
    throw new Error('Synthetic labels are missing title-section-header rows');
  }
  if (!labels.some(entry => entry.kind === 'header-alias-row' && /room\s*\/\s*ward|ward\s*\/\s*room|room no|ward\s*\/\s*bed/i.test(entry.cells?.[0] || '') && /pt name|patient name/i.test(entry.cells?.[1] || '') && /assigned dr|assigned doctor|consultant name|assigned consultant|doctor|primary team|responsible doctor/i.test(entry.cells?.[3] || ''))) {
    throw new Error('Synthetic labels are missing header-alias rows');
  }
  if (!labels.some(entry => entry.kind === 'doctor-ward-status-row' && titledDoctorPattern.test(entry.text) && wardPattern.test(entry.text) && statusPattern.test(entry.text))) {
    throw new Error('Synthetic labels are missing doctor-ward-status rows');
  }
  if (!labels.some(entry => entry.kind === 'sheet-section-block' && entry.layout === 'sheet-block' && sheetTitlePattern.test(entry.rows?.[0]?.text || '') && sectionTitlePattern.test(entry.rows?.[1]?.text || '') && wardPattern.test(entry.text))) {
    throw new Error('Synthetic labels are missing sheet-section blocks');
  }
  if (!labels.some(entry => entry.kind === 'multi-section-census-block' && entry.layout === 'sheet-block' && entry.rows?.filter(row => sectionTitlePattern.test(row.text)).length >= 2 && entry.rows?.filter(row => Array.isArray(row.cells) && row.cells.length === 6).length >= 3)) {
    throw new Error('Synthetic labels are missing multi-section census blocks');
  }
  if (!labels.some(entry => entry.kind === 'medication-handover-block' && entry.layout === 'sheet-block' && entry.rows?.some(row => Array.isArray(row.cells) && row.cells.length === 6) && entry.rows?.some(row => (row.cells?.[0] || '') === '' && (row.cells?.[3] || '').length > 0))) {
    throw new Error('Synthetic labels are missing medication handover blocks');
  }
  if (!labels.some(entry => entry.kind === 'overnight-handover-block' && entry.layout === 'sheet-block' && entry.rows?.filter(row => sectionTitlePattern.test(row.text)).length >= 2 && entry.rows?.filter(row => /patient name|pt name|assigned doctor|assigned dr|consultant name|doctor/i.test(row.text)).length >= 2)) {
    throw new Error('Synthetic labels are missing overnight handover blocks');
  }
  if (!labels.some(entry => entry.kind === 'active-chronic-sheet-block' && entry.layout === 'sheet-block' && entry.rows?.filter(row => sectionTitlePattern.test(row.text)).length >= 2 && entry.rows?.some(row => /active/i.test(row.text)) && entry.rows?.some(row => /chronic/i.test(row.text)))) {
    throw new Error('Synthetic labels are missing active/chronic sheet blocks');
  }
  if (!labels.some(entry => entry.kind === 'roomless-status-mix-block' && entry.layout === 'sheet-block' && entry.rows?.some(row => (row.cells?.[0] || '') === '' && statusPattern.test(row.text)))) {
    throw new Error('Synthetic labels are missing roomless status-mix blocks');
  }
  if (!labels.some(entry => entry.kind === 'medication-continuation-block' && entry.layout === 'sheet-block' && entry.rows?.some(row => (row.cells?.[0] || '') === '' && (row.cells?.[3] || '').length > 0))) {
    throw new Error('Synthetic labels are missing medication continuation blocks');
  }
  if (!labels.some(entry => entry.kind === 'unassigned-transfer-block' && entry.layout === 'sheet-block' && entry.rows?.some(row => /ER\/Unassigned/i.test(row.text)) && entry.rows?.some(row => /review|awaiting bed|transferred/i.test(row.text)))) {
    throw new Error('Synthetic labels are missing unassigned transfer blocks');
  }
  if (!labels.some(entry => entry.kind === 'ward-round-block' && entry.layout === 'sheet-block' && entry.rows?.filter(row => Array.isArray(row.cells) && row.cells.length >= 4).length >= 3)) {
    throw new Error('Synthetic labels are missing ward-round blocks');
  }
  if (!labels.some(entry => entry.kind === 'mixed-language-block' && entry.layout === 'sheet-block' && /[\u0600-\u06FF]/.test(entry.text) && /[A-Za-z]/.test(entry.text))) {
    throw new Error('Synthetic labels are missing mixed-language sheet blocks');
  }
  if (!labels.some(entry => entry.kind === 'repeated-header-block' && entry.layout === 'sheet-block' && entry.rows?.filter(row => /patient name|pt name|assigned doctor|assigned dr|consultant name|doctor/i.test(row.text)).length >= 2)) {
    throw new Error('Synthetic labels are missing repeated-header blocks');
  }
  if (!labels.some(entry => entry.kind === 'wrapped-diagnosis-block' && entry.layout === 'sheet-block' && entry.rows?.some(row => (row.cells?.[0] || '') === '' && (row.cells?.[1] || '') === '' && (row.cells?.[2] || '').length > 0))) {
    throw new Error('Synthetic labels are missing wrapped-diagnosis blocks');
  }
  if (!labels.some(entry => entry.kind === 'stacked-ward-block' && entry.layout === 'sheet-block' && entry.rows?.filter(row => wardPattern.test(row.text)).length >= 2)) {
    throw new Error('Synthetic labels are missing stacked-ward blocks');
  }
  if (!labels.some(entry => entry.kind === 'split-name-block' && entry.layout === 'sheet-block' && entry.rows?.some(row => (row.cells?.[0] || '') === '' && (row.cells?.[1] || '').length > 0 && !(row.cells?.[2] || '') && !(row.cells?.[3] || '') && !(row.cells?.[4] || '')))) {
    throw new Error('Synthetic labels are missing split-name blocks');
  }
  if (!labels.some(entry => entry.kind === 'partial-header-block' && entry.layout === 'sheet-block' && entry.rows?.some(row => Array.isArray(row.cells) && row.cells.length === 4 && /patient name|pt name|room\s*\/\s*ward/i.test(row.text)))) {
    throw new Error('Synthetic labels are missing partial-header blocks');
  }
  if (!labels.some(entry => entry.renderStyle === 'washed-grid')) {
    throw new Error('Synthetic labels are missing washed-grid render styles');
  }
  if (!labels.some(entry => entry.renderStyle === 'clipped-grid')) {
    throw new Error('Synthetic labels are missing clipped-grid render styles');
  }
  if (!labels.some(entry => entry.renderStyle === 'dense-sheet')) {
    throw new Error('Synthetic labels are missing dense-sheet render styles');
  }
  if (!labels.some(entry => entry.renderStyle === 'dense-line')) {
    throw new Error('Synthetic labels are missing dense-line render styles');
  }
  if (!labels.some(entry => entry.renderStyle === 'merged-sheet')) {
    throw new Error('Synthetic labels are missing merged-sheet render styles');
  }
  if (!labels.some(entry => entry.renderStyle === 'phone-capture')) {
    throw new Error('Synthetic labels are missing phone-capture render styles');
  }
  if (!labels.some(entry => entry.renderStyle === 'faded-block')) {
    throw new Error('Synthetic labels are missing faded-block render styles');
  }
  if (!labels.some(entry => entry.renderStyle === 'dense-block')) {
    throw new Error('Synthetic labels are missing dense-block render styles');
  }
  if (!labels.some(entry => entry.renderStyle === 'left-clipped-block')) {
    throw new Error('Synthetic labels are missing left-clipped-block render styles');
  }
  if (!labels.some(entry => entry.renderStyle === 'right-clipped-block')) {
    throw new Error('Synthetic labels are missing right-clipped-block render styles');
  }
  if (!labels.some(entry => entry.renderStyle === 'top-clipped-block')) {
    throw new Error('Synthetic labels are missing top-clipped-block render styles');
  }
  if (!labels.some(entry => entry.renderStyle === 'bottom-clipped-block')) {
    throw new Error('Synthetic labels are missing bottom-clipped-block render styles');
  }
  if (!labels.some(entry => entry.renderStyle === 'glare-block')) {
    throw new Error('Synthetic labels are missing glare-block render styles');
  }
  if (!labels.some(entry => entry.renderStyle === 'shadow-block')) {
    throw new Error('Synthetic labels are missing shadow-block render styles');
  }
  if (!labels.some(entry => entry.renderStyle === 'title-clipped-block')) {
    throw new Error('Synthetic labels are missing title-clipped-block render styles');
  }
  if (!labels.some(entry => entry.difficulty === 'hard')) {
    throw new Error('Synthetic labels are missing hard render variants');
  }
}

if (existsSync(syntheticStatsPath)) {
  const stats = JSON.parse(requireFile(syntheticStatsPath));
  if ((stats.total || 0) < 24) throw new Error('Synthetic stats report too few samples');
  if ((stats.byKind?.['patient-name'] || 0) === 0) throw new Error('Synthetic stats are missing patient-name counts');
  if ((stats.byKind?.['pipe-row'] || 0) === 0) throw new Error('Synthetic stats are missing pipe-row counts');
  if ((stats.byKind?.['status-banner'] || 0) === 0) throw new Error('Synthetic stats are missing status-banner counts');
  if ((stats.byKind?.['sheet-title'] || 0) === 0) throw new Error('Synthetic stats are missing sheet-title counts');
  if ((stats.byKind?.['detail-diagnosis'] || 0) === 0) throw new Error('Synthetic stats are missing detail-diagnosis counts');
  if ((stats.byKind?.['sparse-spreadsheet-row'] || 0) === 0) throw new Error('Synthetic stats are missing sparse-spreadsheet-row counts');
  if ((stats.byKind?.['section-context-row'] || 0) === 0) throw new Error('Synthetic stats are missing section-context-row counts');
  if ((stats.byKind?.['room-number-roster-row'] || 0) === 0) throw new Error('Synthetic stats are missing room-number-roster-row counts');
  if ((stats.byKind?.['title-header-row'] || 0) === 0) throw new Error('Synthetic stats are missing title-header-row counts');
  if ((stats.byKind?.['doctor-status-row'] || 0) === 0) throw new Error('Synthetic stats are missing doctor-status-row counts');
  if ((stats.byKind?.['numeric-pipe-row'] || 0) === 0) throw new Error('Synthetic stats are missing numeric-pipe-row counts');
  if ((stats.byKind?.['ward-inline-roster-row'] || 0) === 0) throw new Error('Synthetic stats are missing ward-inline-roster-row counts');
  if ((stats.byKind?.['ward-pipe-row'] || 0) === 0) throw new Error('Synthetic stats are missing ward-pipe-row counts');
  if ((stats.byKind?.['title-section-header-row'] || 0) === 0) throw new Error('Synthetic stats are missing title-section-header-row counts');
  if ((stats.byKind?.['header-alias-row'] || 0) === 0) throw new Error('Synthetic stats are missing header-alias-row counts');
  if ((stats.byKind?.['doctor-ward-status-row'] || 0) === 0) throw new Error('Synthetic stats are missing doctor-ward-status-row counts');
  if ((stats.byKind?.['sheet-section-block'] || 0) === 0) throw new Error('Synthetic stats are missing sheet-section-block counts');
  if ((stats.byKind?.['multi-section-census-block'] || 0) === 0) throw new Error('Synthetic stats are missing multi-section-census-block counts');
  if ((stats.byKind?.['medication-handover-block'] || 0) === 0) throw new Error('Synthetic stats are missing medication-handover-block counts');
  if ((stats.byKind?.['overnight-handover-block'] || 0) === 0) throw new Error('Synthetic stats are missing overnight-handover-block counts');
  if ((stats.byKind?.['active-chronic-sheet-block'] || 0) === 0) throw new Error('Synthetic stats are missing active-chronic-sheet-block counts');
  if ((stats.byKind?.['roomless-status-mix-block'] || 0) === 0) throw new Error('Synthetic stats are missing roomless-status-mix-block counts');
  if ((stats.byKind?.['medication-continuation-block'] || 0) === 0) throw new Error('Synthetic stats are missing medication-continuation-block counts');
  if ((stats.byKind?.['unassigned-transfer-block'] || 0) === 0) throw new Error('Synthetic stats are missing unassigned-transfer-block counts');
  if ((stats.byKind?.['ward-round-block'] || 0) === 0) throw new Error('Synthetic stats are missing ward-round-block counts');
  if ((stats.byKind?.['mixed-language-block'] || 0) === 0) throw new Error('Synthetic stats are missing mixed-language-block counts');
  if ((stats.byKind?.['repeated-header-block'] || 0) === 0) throw new Error('Synthetic stats are missing repeated-header-block counts');
  if ((stats.byKind?.['wrapped-diagnosis-block'] || 0) === 0) throw new Error('Synthetic stats are missing wrapped-diagnosis-block counts');
  if ((stats.byKind?.['stacked-ward-block'] || 0) === 0) throw new Error('Synthetic stats are missing stacked-ward-block counts');
  if ((stats.byKind?.['split-name-block'] || 0) === 0) throw new Error('Synthetic stats are missing split-name-block counts');
  if ((stats.byKind?.['partial-header-block'] || 0) === 0) throw new Error('Synthetic stats are missing partial-header-block counts');
  if ((stats.byLayout?.spreadsheet || 0) === 0) throw new Error('Synthetic stats are missing spreadsheet-layout counts');
  if ((stats.byLayout?.['sheet-block'] || 0) === 0) throw new Error('Synthetic stats are missing sheet-block layout counts');
  if ((stats.byStyle?.['washed-grid'] || 0) === 0) throw new Error('Synthetic stats are missing washed-grid style counts');
  if ((stats.byStyle?.['clipped-grid'] || 0) === 0) throw new Error('Synthetic stats are missing clipped-grid style counts');
  if ((stats.byStyle?.['dense-sheet'] || 0) === 0) throw new Error('Synthetic stats are missing dense-sheet style counts');
  if ((stats.byStyle?.['dense-line'] || 0) === 0) throw new Error('Synthetic stats are missing dense-line style counts');
  if ((stats.byStyle?.['merged-sheet'] || 0) === 0) throw new Error('Synthetic stats are missing merged-sheet style counts');
  if ((stats.byStyle?.['phone-capture'] || 0) === 0) throw new Error('Synthetic stats are missing phone-capture style counts');
  if ((stats.byStyle?.['faded-block'] || 0) === 0) throw new Error('Synthetic stats are missing faded-block style counts');
  if ((stats.byStyle?.['dense-block'] || 0) === 0) throw new Error('Synthetic stats are missing dense-block style counts');
  if ((stats.byStyle?.['left-clipped-block'] || 0) === 0) throw new Error('Synthetic stats are missing left-clipped-block style counts');
  if ((stats.byStyle?.['right-clipped-block'] || 0) === 0) throw new Error('Synthetic stats are missing right-clipped-block style counts');
  if ((stats.byStyle?.['top-clipped-block'] || 0) === 0) throw new Error('Synthetic stats are missing top-clipped-block style counts');
  if ((stats.byStyle?.['bottom-clipped-block'] || 0) === 0) throw new Error('Synthetic stats are missing bottom-clipped-block style counts');
  if ((stats.byStyle?.['glare-block'] || 0) === 0) throw new Error('Synthetic stats are missing glare-block style counts');
  if ((stats.byStyle?.['shadow-block'] || 0) === 0) throw new Error('Synthetic stats are missing shadow-block style counts');
  if ((stats.byStyle?.['title-clipped-block'] || 0) === 0) throw new Error('Synthetic stats are missing title-clipped-block style counts');
  if ((stats.byStyle?.['soft-scan'] || 0) === 0) throw new Error('Synthetic stats are missing soft-scan style counts');
  if (((stats.byStyle?.['tight-crop'] || 0) + (stats.byStyle?.['tight-line'] || 0) + (stats.byStyle?.['tight-banner'] || 0)) === 0) {
    throw new Error('Synthetic stats are missing tight-crop style counts');
  }
  if ((stats.byDifficulty?.hard || 0) === 0) throw new Error('Synthetic stats are missing hard difficulty samples');
  if ((stats.byDifficulty?.medium || 0) === 0) throw new Error('Synthetic stats are missing medium difficulty samples');
  if ((stats.byLanguage?.latin || 0) === 0) throw new Error('Synthetic stats are missing Latin samples');
  if (((stats.byLanguage?.mixed || 0) + (stats.byLanguage?.arabic || 0)) === 0) throw new Error('Synthetic stats are missing mixed-script samples');
}

if (existsSync(trainPath)) {
  const lines = requireNonEmptyLines(trainPath);
  if (!lines.every(line => line.includes('\t'))) {
    throw new Error('Prepared train.txt contains lines without tab-separated labels');
  }
}

console.log('OCR training workspace verification passed');
console.log(`  Terms:    ${lexicon.medicalTerms.length}`);
console.log(`  Meds:     ${lexicon.medications.length}`);
console.log(`  Charset:  ${charset.length}`);
console.log(`  Corpus:   ${corpus.length}`);
