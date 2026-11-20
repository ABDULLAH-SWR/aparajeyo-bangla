import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const DISTRICTS_GEOJSON_URL = 'https://raw.githubusercontent.com/nuhil/bangladesh-geocode/master/geojson/districts.geojson';
const DISTRICTS_DATA_URL = 'https://raw.githubusercontent.com/nuhil/bangladesh-geocode/master/districts/districts.json';
const DIVISIONS_DATA_URL = 'https://raw.githubusercontent.com/nuhil/bangladesh-geocode/master/divisions/divisions.json';

async function buildGeojson() {
  console.log('[build-geojson] Fetching authentic boundaries and geocode data...');
  const [geoRes, distRes, divRes] = await Promise.all([
    fetch(DISTRICTS_GEOJSON_URL).then(r => r.json()),
    fetch(DISTRICTS_DATA_URL).then(r => r.json()),
    fetch(DIVISIONS_DATA_URL).then(r => r.json())
  ]);

  const rawDistricts = distRes[2].data;
  const rawDivisions = divRes[2].data;

  const divMap = new Map();
  for (const d of rawDivisions) {
    divMap.set(d.id, {
      name: d.name,
      nameBn: d.bn_name
    });
  }

  // Canonical code overrides to guarantee exact match with mockData.ts
  const CODE_OVERRIDES = {
    'chittagong': 'chattogram',
    'chattogram': 'chattogram',
    'comilla': 'cumilla',
    'cumilla': 'cumilla',
    'barisal': 'barishal',
    'barishal': 'barishal',
    'bogra': 'bogra',
    'bogura': 'bogra',
    "cox's bazar": 'coxs_bazar',
    'coxsbazar': 'coxs_bazar',
    'brahamanbaria': 'brahmanbaria',
    'brahmanbaria': 'brahmanbaria',
    'jhalokati': 'jhalokathi',
    'jhalokathi': 'jhalokathi',
    'maulvibazar': 'moulvibazar',
    'moulvibazar': 'moulvibazar',
    'netrakona': 'netrokona',
    'netrokona': 'netrokona',
    'nawabganj': 'chapainawabganj',
    'chapainawabganj': 'chapainawabganj',
    'chapainababganj': 'chapainawabganj',
    'jessore': 'jessore',
    'jashore': 'jessore'
  };

  const NAME_OVERRIDES = {
    'Chittagong': 'Chattogram',
    'Comilla': 'Cumilla',
    'Barisal': 'Barishal',
    'Bogra': 'Bogra',
    'Brahamanbaria': 'Brahmanbaria',
    'Jhalokati': 'Jhalokathi',
    'Maulvibazar': 'Moulvibazar',
    'Netrakona': 'Netrokona',
    'Nawabganj': 'Chapainawabganj',
    'Chapainababganj': 'Chapainawabganj',
    'Jessore': 'Jessore',
    'Jashore': 'Jessore'
  };

  function toSlug(name) {
    const key = name.toLowerCase().trim();
    if (CODE_OVERRIDES[key]) return CODE_OVERRIDES[key];
    return key.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  function norm(str) {
    return str.toLowerCase().replace(/[^a-z]/g, '');
  }

  function findDistrictData(name) {
    const n = norm(name);
    // Direct or override match
    for (const d of rawDistricts) {
      if (norm(d.name) === n) return d;
    }
    // Specific variant mapping
    if (n === 'chittagong') return rawDistricts.find(d => norm(d.name) === 'chattogram');
    if (n === 'barisal') return rawDistricts.find(d => norm(d.name) === 'barishal');
    if (n === 'comilla') return rawDistricts.find(d => norm(d.name) === 'cumilla');
    if (n === 'bogra') return rawDistricts.find(d => norm(d.name) === 'bogura');
    if (n === 'brahamanbaria') return rawDistricts.find(d => norm(d.name) === 'brahmanbaria');
    if (n === 'maulvibazar') return rawDistricts.find(d => norm(d.name) === 'moulvibazar');
    if (n === 'netrakona') return rawDistricts.find(d => norm(d.name) === 'netrokona');
    if (n === 'jhalokati') return rawDistricts.find(d => norm(d.name) === 'jhalokathi');
    if (n === 'nawabganj') return rawDistricts.find(d => norm(d.name) === 'chapainababganj');
    if (n === 'jessore') return rawDistricts.find(d => norm(d.name) === 'jashore');
    return null;
  }

  function cleanRing(ring) {
    const cleaned = [];
    let prev = null;
    for (const pt of ring) {
      const rx = Math.round(pt[0] * 10000) / 10000;
      const ry = Math.round(pt[1] * 10000) / 10000;
      if (!prev || prev[0] !== rx || prev[1] !== ry) {
        cleaned.push([rx, ry]);
        prev = [rx, ry];
      }
    }
    // Polygon ring must have at least 4 coordinates and be closed
    if (cleaned.length < 3) return ring;
    const first = cleaned[0];
    const last = cleaned[cleaned.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      cleaned.push([first[0], first[1]]);
    }
    return cleaned;
  }

  function cleanCoords(coords, geomType) {
    if (geomType === 'Polygon') {
      return coords.map(cleanRing);
    }
    if (geomType === 'MultiPolygon') {
      return coords.map(poly => poly.map(cleanRing));
    }
    return coords;
  }

  const features = [];
  const districtCodesFound = new Set();

  for (const feat of geoRes.features) {
    const origName = feat.properties.ADM2_EN;
    const meta = findDistrictData(origName);

    const displayName = NAME_OVERRIDES[origName] || (meta ? meta.name : origName);
    const code = toSlug(origName);
    const divInfo = meta ? divMap.get(meta.division_id) : null;
    const divisionName = divInfo ? divInfo.name : feat.properties.ADM1_EN;
    const divisionBn = divInfo ? divInfo.nameBn : '';
    const nameBn = meta ? meta.bn_name : '';
    const bbsCode = meta ? meta.bbs_code : '';

    districtCodesFound.add(code);

    const cleanedGeom = {
      type: feat.geometry.type,
      coordinates: cleanCoords(feat.geometry.coordinates, feat.geometry.type)
    };

    features.push({
      type: 'Feature',
      properties: {
        district_code: code,
        district_name: displayName,
        district_name_bn: nameBn,
        division: divisionName,
        division_bn: divisionBn,
        bbs_code: bbsCode,
        lat: meta?.lat ? parseFloat(meta.lat) : undefined,
        lon: meta?.lon ? parseFloat(meta.lon) : undefined
      },
      geometry: cleanedGeom
    });
  }

  // Sort alphabetically by district_name for clean diffing
  features.sort((a, b) => a.properties.district_name.localeCompare(b.properties.district_name));

  const outputCollection = {
    type: 'FeatureCollection',
    name: 'bangladesh_districts_64',
    features
  };

  const outputPath = path.join(rootDir, 'public', 'data', 'bangladesh-districts.geojson');
  const jsonStr = JSON.stringify(outputCollection);
  fs.writeFileSync(outputPath, jsonStr, 'utf8');

  const stats = fs.statSync(outputPath);
  console.log(`[build-geojson] Successfully built 64-district GeoJSON!`);
  console.log(`[build-geojson] Features count: ${features.length}`);
  console.log(`[build-geojson] Unique district codes: ${districtCodesFound.size}`);
  console.log(`[build-geojson] Output file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB (${stats.size} bytes)`);
  console.log(`[build-geojson] Location: ${outputPath}`);
}

buildGeojson().catch(err => {
  console.error('[build-geojson] Error:', err);
  process.exit(1);
});
