import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const geoPath = path.join(rootDir, 'public', 'data', 'bangladesh-districts.geojson');
const mockDataPath = path.join(rootDir, 'src', 'data', 'mockData.ts');

const geo = JSON.parse(fs.readFileSync(geoPath, 'utf8'));
const existingCode = fs.readFileSync(mockDataPath, 'utf8');

const existingList = [
  { districtCode: 'dhaka', nameEn: 'Dhaka', nameBn: 'ঢাকা', division: 'Dhaka', divisionBn: 'ঢাকা', lat: 23.8103, lng: 90.4125, population: 8906039, area: 1463 },
  { districtCode: 'chattogram', nameEn: 'Chattogram', nameBn: 'চট্টগ্রাম', division: 'Chattogram', divisionBn: 'চট্টগ্রাম', lat: 22.3569, lng: 91.7832, population: 8440042, area: 5283 },
  { districtCode: 'sylhet', nameEn: 'Sylhet', nameBn: 'সিলেট', division: 'Sylhet', divisionBn: 'সিলেট', lat: 24.8949, lng: 91.8687, population: 3434188, area: 3490 },
  { districtCode: 'rajshahi', nameEn: 'Rajshahi', nameBn: 'রাজশাহী', division: 'Rajshahi', divisionBn: 'রাজশাহী', lat: 24.3745, lng: 88.6042, population: 2595197, area: 2407 },
  { districtCode: 'khulna', nameEn: 'Khulna', nameBn: 'খুলনা', division: 'Khulna', divisionBn: 'খুলনা', lat: 22.8456, lng: 89.5403, population: 2318527, area: 4395 },
  { districtCode: 'rangpur', nameEn: 'Rangpur', nameBn: 'রংপুর', division: 'Rangpur', divisionBn: 'রংপুর', lat: 25.7439, lng: 89.2752, population: 2881086, area: 2368 },
  { districtCode: 'barishal', nameEn: 'Barishal', nameBn: 'বরিশাল', division: 'Barishal', divisionBn: 'বরিশাল', lat: 22.701, lng: 90.3535, population: 2324310, area: 2791 },
  { districtCode: 'mymensingh', nameEn: 'Mymensingh', nameBn: 'ময়মনসিংহ', division: 'Mymensingh', divisionBn: 'ময়মনসিংহ', lat: 24.7471, lng: 90.4203, population: 5110272, area: 4363 },
  { districtCode: 'coxs_bazar', nameEn: "Cox's Bazar", nameBn: 'কক্সবাজার', division: 'Chattogram', divisionBn: 'চট্টগ্রাম', lat: 21.4272, lng: 92.0058, population: 2289990, area: 2492 },
  { districtCode: 'tangail', nameEn: 'Tangail', nameBn: 'টাঙ্গাইল', division: 'Dhaka', divisionBn: 'ঢাকা', lat: 24.2513, lng: 89.9164, population: 3605083, area: 3414 },
  { districtCode: 'sunamganj', nameEn: 'Sunamganj', nameBn: 'সুনামগঞ্জ', division: 'Sylhet', divisionBn: 'সিলেট', lat: 25.0658, lng: 91.3950, population: 2467968, area: 3670 },
  { districtCode: 'cumilla', nameEn: 'Cumilla', nameBn: 'কুমিল্লা', division: 'Chattogram', divisionBn: 'চট্টগ্রাম', lat: 23.4607, lng: 91.1809, population: 5387288, area: 3085 },
  { districtCode: 'gazipur', nameEn: 'Gazipur', nameBn: 'গাজীপুর', division: 'Dhaka', divisionBn: 'ঢাকা', lat: 24.0023, lng: 90.4264, population: 3403912, area: 1741 },
  { districtCode: 'narayanganj', nameEn: 'Narayanganj', nameBn: 'নারায়ণগঞ্জ', division: 'Dhaka', divisionBn: 'ঢাকা', lat: 23.6238, lng: 90.5000, population: 2948217, area: 684 },
  { districtCode: 'bogra', nameEn: 'Bogra', nameBn: 'বগুড়া', division: 'Rajshahi', divisionBn: 'রাজশাহী', lat: 24.8465, lng: 89.3773, population: 3400874, area: 2919 },
];

const existingMap = new Map(existingList.map(d => [d.districtCode, d]));

const all64 = geo.features.map(f => {
  const p = f.properties;
  if (existingMap.has(p.district_code)) {
    return existingMap.get(p.district_code);
  }
  return {
    districtCode: p.district_code,
    nameEn: p.district_name,
    nameBn: p.district_name_bn || p.district_name,
    division: p.division,
    divisionBn: p.division_bn || p.division,
    lat: p.lat || 23.685,
    lng: p.lon || 90.356
  };
});

const formattedDistricts = 'export const districts: District[] = ' + JSON.stringify(all64, null, 2) + ';\n';
const startMarker = 'export const districts: District[] =';
const endMarker = 'export const priorityIssues: PriorityIssue[]';

const startIndex = existingCode.indexOf(startMarker);
const endIndex = existingCode.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  throw new Error('Could not find markers in mockData.ts');
}

const newContent = existingCode.substring(0, startIndex) + formattedDistricts + '\n// ─── Priority Issues ──────────────────────────────────────────\n' + existingCode.substring(endIndex);

fs.writeFileSync(mockDataPath, newContent, 'utf8');
console.log(`[update-mock] Successfully updated mockData.ts with ${all64.length} districts!`);
