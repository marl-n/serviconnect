// Pure GeoNames → Province/Town/Suburb transformation logic.
//
// No database, network or Prisma access in this file — everything here is a
// deterministic function of its inputs so it can be unit-tested and reused by
// the import script (prisma/import-locations.ts).
//
// GeoNames facts this relies on (https://download.geonames.org/export/dump/):
//  • <CC>.txt is tab-separated with 19 columns:
//      0 geonameid, 1 name, 2 asciiname, 3 alternatenames, 4 latitude,
//      5 longitude, 6 feature class, 7 feature code, 8 country code, 9 cc2,
//      10 admin1 code, 11 admin2 code, 12 admin3 code, 13 admin4 code,
//      14 population, 15 elevation, 16 dem, 17 timezone, 18 modification date
//  • admin1CodesASCII.txt is global; lines look like "ZA.xx<TAB>Name<TAB>Ascii<TAB>geonameId".
//  • admin2 is the district / metropolitan municipality (e.g. "JHB", "EKU", "DC32").
//  • Feature class 'P' = populated place. Within it:
//      PPLC / PPLA..PPLA4 = capital / seats of admin divisions (municipal seats)
//      PPL  = generic populated place
//      PPLX = "section of populated place" — GeoNames' closest equivalent to a suburb
//      PPLH/PPLQ/PPLW/PPLL/PPLF/... = historical, abandoned, localities, farms (never imported)
//
// Curated dataset rules (see buildImportPlan): the goal is a commercially useful
// list of cities and towns, not every populated place.

export interface GeonamesPlace {
  geonameId: number;
  name: string;
  lat: number;
  lng: number;
  featureClass: string;
  featureCode: string;
  countryCode: string;
  admin1: string;
  admin2: string;
  population: number;
}

export interface ProvinceOut {
  geonamesCode: string; // e.g. "ZA.06"
  name: string;
}

export type TownSource = 'metro-city' | 'seat' | 'population' | 'override';

export interface TownOut {
  geonameId: number;
  name: string;
  provinceCode: string;
  lat: number;
  lng: number;
  population: number;
  featureCode: string;
  admin2: string;
  source: TownSource;
}

export type SuburbSource =
  | 'override'        // overrides.json "suburbs" entry
  | 'metro-auto'      // qualifying non-seat place ≤ metroAutoAbsorbKm from its metro city
  | 'hierarchy'       // explicit hierarchy.txt parent (an imported town)
  | 'nearest-district'
  | 'nearest-province';

export interface SuburbOut {
  geonameId: number;
  name: string;
  townGeonameId: number;
  lat: number;
  lng: number;
  source: SuburbSource;
}

export interface ImportOptions {
  /** PPL places at/above this population qualify as towns. Municipal seats always qualify. */
  minTownPopulation: number;
  /** Max distance from a suburb to an automatically chosen parent town (hierarchy or nearest). */
  maxSuburbKm: number;
  /** Inside a metro district, a qualifying non-seat place this close to the metro city becomes its suburb. */
  metroAutoAbsorbKm: number;
  /** Inside a metro district, qualifying places up to this distance that no override decides are flagged for review. */
  metroReviewKm: number;
  /** Same-named towns in one province are merged only when they are this close (otherwise they are different places). */
  mergeKm: number;
}

export const DEFAULT_OPTIONS: ImportOptions = {
  minTownPopulation: 5000,
  maxSuburbKm: 15,
  metroAutoAbsorbKm: 10,
  metroReviewKm: 30,
  mergeKm: 10,
};

// ─── Curation overrides (prisma/data/geonames/overrides.json) ────────────
// Every entry names a GeoNames row by geonameId AND its GeoNames name; the
// name is checked so a typo'd id cannot silently apply to the wrong place.

export interface OverrideRef {
  geonameId: number;
  name: string;
  reason?: string;
}

export interface Curation {
  /** admin2 code → the one selectable city of that metro (e.g. "JHB" → Johannesburg). */
  metros: Record<string, OverrideRef>;
  /** Districts whose places below the town threshold become suburbs instead of being excluded (metros incl. Ekurhuleni). */
  urbanDistricts: string[];
  /** Force an independent town (overrides thresholds and metro absorption). */
  towns: OverrideRef[];
  /** Force a suburb of the given parent town (metro absorption, demotions). */
  suburbs: Array<OverrideRef & { parentGeonameId: number; parentName: string }>;
  /** Never import. */
  exclude: OverrideRef[];
  /** Display name to use instead of the GeoNames name. */
  rename: Array<OverrideRef & { to: string }>;
}

export const EMPTY_CURATION: Curation = { metros: {}, urbanDistricts: [], towns: [], suburbs: [], exclude: [], rename: [] };

export type SuspiciousKind =
  | 'duplicate-town-name'         // merged into a nearby same-named town
  | 'same-name-towns-kept'        // same name in one province, far apart → both kept
  | 'duplicate-suburb-name'
  | 'suburb-same-name-as-town'
  | 'suburb-also-a-town'          // suburb name equals another imported town in the province
  | 'metro-review'                // qualifying place inside a metro, undecided by overrides
  | 'hierarchy-parent-rejected'
  | 'weak-parent-assignment'
  | 'unassigned-suburb'
  | 'zero-population-town'
  | 'towns-very-close'            // two differently named towns < 2 km apart — possibly one place under two names
  | 'outside-bounds'
  | 'same-coordinates';

export interface SuspiciousRecord {
  kind: SuspiciousKind;
  name: string;
  geonameId: number;
  detail: string;
}

export interface MetroAbsorption {
  geonameId: number;
  name: string;
  metro: string;
  city: string;
  km: number;
  how: 'override' | 'auto';
}

export interface ImportStats {
  placesRead: number;
  populatedPlaces: number;
  skippedNoProvince: number;
  ignoredByFeatureCode: Record<string, number>;
  excludedByReason: Record<string, number>;
  townsBySource: Record<TownSource, number>;
  duplicateTownsMerged: number;
  towns: number;
  townsPerProvince: Record<string, number>;
  suburbCandidates: number;
  suburbsBySource: Record<SuburbSource, number>;
  suburbsUnassigned: number;
  suburbsSameNameAsTown: number;
  duplicateSuburbsDropped: number;
  suburbs: number;
  suburbsPerProvince: Record<string, number>;
  provinces: number;
  townsWithoutSuburbs: number;
  suburbDistanceKm: { median: number; p90: number; max: number } | null;
}

export interface ImportPlan {
  provinces: ProvinceOut[];
  towns: TownOut[];
  suburbs: SuburbOut[];
  stats: ImportStats;
  suspicious: SuspiciousRecord[];
  metroAbsorbed: MetroAbsorption[];
  /** Problems that must be fixed (in overrides.json) before the plan may be written to a database. */
  blocking: string[];
}

// ───────────────────────── parsing ─────────────────────────

/** Collapse whitespace; keep the original casing/diacritics for display. */
export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/** Key used for duplicate detection: case-, accent- and whitespace-insensitive. */
export function normName(name: string): string {
  return cleanName(name)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Parses admin1CodesASCII.txt, keeping only lines for the given country.
 * Province names come from this file — nothing is hardcoded here.
 */
export function parseAdmin1(text: string, countryCode = 'ZA'): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cols = line.split('\t');
    if (cols.length < 2) continue;
    const code = cols[0].trim();
    if (!code.startsWith(countryCode + '.')) continue;
    const name = cleanName(cols[1] || cols[2] || '');
    if (name) out.set(code, name);
  }
  return out;
}

/** Parses one line of <CC>.txt. Returns null for malformed lines. */
export function parsePlaceLine(line: string): GeonamesPlace | null {
  if (!line || line.startsWith('#')) return null;
  const c = line.split('\t');
  if (c.length < 15) return null;
  const geonameId = Number.parseInt(c[0], 10);
  const lat = Number.parseFloat(c[4]);
  const lng = Number.parseFloat(c[5]);
  const name = cleanName(c[1] ?? '');
  if (!Number.isFinite(geonameId) || !Number.isFinite(lat) || !Number.isFinite(lng) || !name) return null;
  const population = Number.parseInt(c[14], 10);
  return {
    geonameId,
    name,
    lat,
    lng,
    featureClass: c[6] ?? '',
    featureCode: c[7] ?? '',
    countryCode: c[8] ?? '',
    admin1: (c[10] ?? '').trim(),
    admin2: (c[11] ?? '').trim(),
    population: Number.isFinite(population) ? population : 0,
  };
}

/**
 * Parses one line of hierarchy.txt (parentId, childId, type — tab separated).
 * `type` 'ADM' marks the admin tree (province/district/municipality), which never
 * links a suburb to a town; every other row is user-entered and may.
 */
export function parseHierarchyLine(line: string): { parentId: number; childId: number; type: string } | null {
  if (!line) return null;
  const c = line.split('\t');
  if (c.length < 2) return null;
  const parentId = Number.parseInt(c[0], 10);
  const childId = Number.parseInt(c[1], 10);
  if (!Number.isFinite(parentId) || !Number.isFinite(childId)) return null;
  return { parentId, childId, type: (c[2] ?? '').trim() };
}

/**
 * Parses overrides.json. Throws on structural problems; content problems
 * (unknown ids, name mismatches, conflicts) are reported by buildImportPlan as blocking.
 */
export function parseCuration(text: string): Curation {
  const raw = JSON.parse(text);
  const list = (k: string) => {
    const v = raw[k] ?? [];
    if (!Array.isArray(v)) throw new Error(`overrides.${k} must be an array`);
    for (const e of v) {
      if (!Number.isInteger(e?.geonameId) || typeof e?.name !== 'string') {
        throw new Error(`overrides.${k}: every entry needs an integer geonameId and a name (got ${JSON.stringify(e)})`);
      }
    }
    return v;
  };
  const metros = raw.metros ?? {};
  for (const [k, e] of Object.entries<any>(metros)) {
    if (!Number.isInteger(e?.geonameId) || typeof e?.name !== 'string') throw new Error(`overrides.metros.${k} needs geonameId and name`);
  }
  const suburbs = list('suburbs');
  for (const e of suburbs) {
    if (!Number.isInteger(e.parentGeonameId) || typeof e.parentName !== 'string') {
      throw new Error(`overrides.suburbs: "${e.name}" needs parentGeonameId and parentName`);
    }
  }
  const rename = list('rename');
  for (const e of rename) if (typeof e.to !== 'string' || !cleanName(e.to)) throw new Error(`overrides.rename: "${e.name}" needs "to"`);
  return {
    metros,
    urbanDistricts: Array.isArray(raw.urbanDistricts) ? raw.urbanDistricts : [],
    towns: list('towns'),
    suburbs,
    exclude: list('exclude'),
    rename,
  };
}

// Sanity box around South Africa (incl. Lesotho/eSwatini enclaves).
export const SA_BOUNDS = { minLat: -35.2, maxLat: -21.9, minLng: 16.2, maxLng: 33.1 };

// ───────────────────────── geometry ─────────────────────────

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ───────────────────────── planning ─────────────────────────

// Populated-place codes that can become towns, best rank first.
export const TOWN_FEATURE_CODES = ['PPLC', 'PPLA', 'PPLA2', 'PPLA3', 'PPLA4', 'PPLG', 'PPL'] as const;
export const SUBURB_FEATURE_CODES = ['PPLX'] as const;
/** Capitals and seats of admin divisions — established towns regardless of population. */
export const SEAT_FEATURE_CODES = ['PPLC', 'PPLA', 'PPLA2', 'PPLA3', 'PPLA4'] as const;

const TOWN_RANK: Record<string, number> = Object.fromEntries(TOWN_FEATURE_CODES.map((c, i) => [c, i]));
const isSeat = (code: string) => (SEAT_FEATURE_CODES as readonly string[]).includes(code);
const NUMBERED_NAME = /\(\d+\)/; // "Alpha (1)", "Badsfontein (2)" — GeoNames farm-name duplicates

const round1 = (n: number) => Math.round(n * 10) / 10;
const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => haversineKm(a.lat, a.lng, b.lat, b.lng);

function outOfBounds(lat: number, lng: number): boolean {
  return lat < SA_BOUNDS.minLat || lat > SA_BOUNDS.maxLat || lng < SA_BOUNDS.minLng || lng > SA_BOUNDS.maxLng;
}

// Prefer: metro city / override, then better feature rank, then population, then lowest id.
const SOURCE_RANK: Record<TownSource, number> = { 'metro-city': 0, override: 1, seat: 2, population: 3 };
function betterTown(a: TownOut, b: TownOut): boolean {
  if (SOURCE_RANK[a.source] !== SOURCE_RANK[b.source]) return SOURCE_RANK[a.source] < SOURCE_RANK[b.source];
  const ra = TOWN_RANK[a.featureCode] ?? 99;
  const rb = TOWN_RANK[b.featureCode] ?? 99;
  if (ra !== rb) return ra < rb;
  if (a.population !== b.population) return a.population > b.population;
  return a.geonameId < b.geonameId;
}

function nearestTown(p: { lat: number; lng: number }, towns: TownOut[]): { town: TownOut; km: number } | null {
  let best: { town: TownOut; km: number } | null = null;
  for (const t of towns) {
    const d = km(p, t);
    if (!best || d < best.km || (d === best.km && t.geonameId < best.town.geonameId)) best = { town: t, km: d };
  }
  return best;
}

interface SuburbCandidate {
  place: GeonamesPlace;
  name: string;
  provinceCode: string;
  forcedParent?: number; // geonameId
  forcedHow?: 'override' | 'auto';
}

/**
 * Turns raw GeoNames places into the curated Province → Town → (optional) Suburb plan.
 *
 * Towns — a place becomes a town when (in order):
 *   1. overrides.exclude          → never imported
 *   2. overrides.suburbs          → suburb of the named parent instead
 *   3. overrides.towns / metro city → town
 *   4. it is a municipal seat (PPLC/PPLA..PPLA4), or a PPL with population ≥ minTownPopulation
 *      — except numbered duplicates "(n)" and places outside South Africa.
 *      Inside a metro district (curation.metros), a qualifying place that is not a seat and
 *      lies ≤ metroAutoAbsorbKm from the metro city becomes its suburb; one ≤ metroReviewKm
 *      stays a town but is flagged 'metro-review' for a decision in overrides.json.
 *      Seats are never absorbed automatically — established towns are not merged for being close.
 *   Everything else is excluded, except inside curation.urbanDistricts, where it becomes a suburb candidate.
 *   Same-named towns in a province merge only within mergeKm; same-named towns further apart are
 *   both kept and flagged — an identical name is blocking (DB unique) until renamed.
 *
 * Suburb parent, in order of preference:
 *   1. forced (override / metro auto-absorption)
 *   2. hierarchy.txt edge to an imported town in the same province within maxSuburbKm
 *   3. nearest town in the same district within maxSuburbKm
 *   4. nearest town in the province within maxSuburbKm (places without a district code; flagged)
 *   5. none → not imported
 *
 * `hierarchy` maps childId → parentIds, already restricted to non-ADM rows.
 */
export function buildImportPlan(
  places: Iterable<GeonamesPlace>,
  admin1: Map<string, string>,
  options: Partial<ImportOptions> = {},
  hierarchy: Map<number, number[]> = new Map(),
  curation: Curation = EMPTY_CURATION,
): ImportPlan {
  const opts: ImportOptions = { ...DEFAULT_OPTIONS, ...options };
  const stats: ImportStats = {
    placesRead: 0,
    populatedPlaces: 0,
    skippedNoProvince: 0,
    ignoredByFeatureCode: {},
    excludedByReason: {},
    townsBySource: { 'metro-city': 0, seat: 0, population: 0, override: 0 },
    duplicateTownsMerged: 0,
    towns: 0,
    townsPerProvince: {},
    suburbCandidates: 0,
    suburbsBySource: { override: 0, 'metro-auto': 0, hierarchy: 0, 'nearest-district': 0, 'nearest-province': 0 },
    suburbsUnassigned: 0,
    suburbsSameNameAsTown: 0,
    duplicateSuburbsDropped: 0,
    suburbs: 0,
    suburbsPerProvince: {},
    provinces: admin1.size,
    townsWithoutSuburbs: 0,
    suburbDistanceKm: null,
  };
  const suspicious: SuspiciousRecord[] = [];
  const blocking: string[] = [];
  const metroAbsorbed: MetroAbsorption[] = [];
  const exclude = (reason: string) => { stats.excludedByReason[reason] = (stats.excludedByReason[reason] ?? 0) + 1; };

  // ── Index places and validate overrides against them ──
  const all: GeonamesPlace[] = [];
  const byId = new Map<number, GeonamesPlace>();
  for (const p of places) {
    stats.placesRead++;
    if (p.featureClass !== 'P') continue;
    stats.populatedPlaces++;
    all.push(p);
    byId.set(p.geonameId, p);
  }
  all.sort((a, b) => a.geonameId - b.geonameId);

  const seenIn = new Map<number, string>();
  const checkRef = (list: string, r: OverrideRef, exclusive = true) => {
    const p = byId.get(r.geonameId);
    if (!p) { blocking.push(`overrides.${list}: geonameId ${r.geonameId} ("${r.name}") is not a populated place in the data`); return; }
    if (normName(p.name) !== normName(r.name)) {
      blocking.push(`overrides.${list}: geonameId ${r.geonameId} is "${p.name}" in GeoNames, not "${r.name}"`);
    }
    if (exclusive) {
      const prev = seenIn.get(r.geonameId);
      if (prev) blocking.push(`overrides: geonameId ${r.geonameId} ("${r.name}") appears in both ${prev} and ${list}`);
      else seenIn.set(r.geonameId, list);
    }
  };
  for (const [code, r] of Object.entries(curation.metros)) checkRef(`metros.${code}`, r);
  for (const r of curation.towns) checkRef('towns', r);
  for (const r of curation.suburbs) { checkRef('suburbs', r); checkRef('suburbs(parent)', { geonameId: r.parentGeonameId, name: r.parentName }, false); }
  for (const r of curation.exclude) checkRef('exclude', r);
  for (const r of curation.rename) checkRef('rename', r, false);

  const metroCityIds = new Map<number, string>(Object.entries(curation.metros).map(([code, r]) => [r.geonameId, code]));
  const townOverride = new Set(curation.towns.map(r => r.geonameId));
  const suburbOverride = new Map(curation.suburbs.map(r => [r.geonameId, r.parentGeonameId]));
  const excludeOverride = new Set(curation.exclude.map(r => r.geonameId));
  const renameTo = new Map(curation.rename.map(r => [r.geonameId, cleanName(r.to)]));
  const urban = new Set(curation.urbanDistricts);
  for (const code of Object.keys(curation.metros)) urban.add(code);

  // ── Classify ──
  const townCandidates: TownOut[] = [];
  const subCands: SuburbCandidate[] = [];

  for (const p of all) {
    const provinceCode = `${p.countryCode}.${p.admin1}`;
    if (!admin1.has(provinceCode)) { stats.skippedNoProvince++; continue; }
    const name = renameTo.get(p.geonameId) ?? p.name;
    const asTown = (source: TownSource) => townCandidates.push({
      geonameId: p.geonameId, name, provinceCode, lat: p.lat, lng: p.lng,
      population: p.population, featureCode: p.featureCode, admin2: p.admin2, source,
    });
    const asSuburb = (forcedParent?: number, forcedHow?: 'override' | 'auto') =>
      subCands.push({ place: p, name, provinceCode, forcedParent, forcedHow });

    if (excludeOverride.has(p.geonameId)) { exclude('override'); continue; }
    if (suburbOverride.has(p.geonameId)) { asSuburb(suburbOverride.get(p.geonameId), 'override'); continue; }
    if (metroCityIds.has(p.geonameId)) { asTown('metro-city'); continue; }
    if (townOverride.has(p.geonameId)) { asTown('override'); continue; }

    if ((SUBURB_FEATURE_CODES as readonly string[]).includes(p.featureCode)) { asSuburb(); continue; }
    if (!(TOWN_FEATURE_CODES as readonly string[]).includes(p.featureCode)) {
      stats.ignoredByFeatureCode[p.featureCode] = (stats.ignoredByFeatureCode[p.featureCode] ?? 0) + 1;
      continue;
    }
    if (NUMBERED_NAME.test(name)) { exclude('numbered-duplicate-name'); continue; }
    if (outOfBounds(p.lat, p.lng)) {
      exclude('outside-south-africa');
      suspicious.push({ kind: 'outside-bounds', name, geonameId: p.geonameId, detail: `at ${p.lat}, ${p.lng} — excluded` });
      continue;
    }

    const seat = isSeat(p.featureCode);
    const qualifies = seat || p.population >= opts.minTownPopulation;
    if (!qualifies) {
      if (urban.has(p.admin2)) asSuburb();
      else exclude('below-threshold');
      continue;
    }

    const metroRef = curation.metros[p.admin2];
    const metroCity = metroRef ? byId.get(metroRef.geonameId) : undefined;
    if (metroCity) {
      const d = km(p, metroCity);
      if (!seat && d <= opts.metroAutoAbsorbKm) { asSuburb(metroCity.geonameId, 'auto'); continue; }
      if (d <= opts.metroReviewKm) {
        suspicious.push({
          kind: 'metro-review', name, geonameId: p.geonameId,
          detail: `${round1(d)} km from ${metroCity.name}${seat ? ' (municipal seat)' : ''}, pop ${p.population} — kept as a town; decide in overrides.json (towns or suburbs)`,
        });
      }
    }
    asTown(seat ? 'seat' : 'population');
  }

  // ── Towns: merge same-named rows in a province only when they are close ──
  const groups = new Map<string, TownOut[]>();
  for (const t of townCandidates) {
    const key = `${t.provinceCode}|${normName(t.name)}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(t);
  }
  const towns: TownOut[] = [];
  const townById = new Map<number, TownOut>();
  const aliasToTown = new Map<number, TownOut>(); // merged-away id → surviving town
  for (const g of groups.values()) {
    const sorted = [...g].sort((a, b) => (betterTown(a, b) ? -1 : betterTown(b, a) ? 1 : 0));
    const kept: TownOut[] = [];
    for (const t of sorted) {
      const near = kept.find(k => km(k, t) <= opts.mergeKm);
      if (near) {
        stats.duplicateTownsMerged++;
        aliasToTown.set(t.geonameId, near);
        suspicious.push({ kind: 'duplicate-town-name', name: t.name, geonameId: t.geonameId, detail: `merged into ${near.geonameId} (${round1(km(near, t))} km away)` });
      } else {
        kept.push(t);
      }
    }
    if (kept.length > 1) {
      const ids = kept.map(k => k.geonameId).join(', ');
      suspicious.push({ kind: 'same-name-towns-kept', name: kept[0].name, geonameId: kept[0].geonameId, detail: `${kept.length} different towns share this name in ${admin1.get(kept[0].provinceCode)} (ids ${ids})` });
      blocking.push(`towns: "${kept[0].name}" (${admin1.get(kept[0].provinceCode)}) is used by ${kept.length} different towns (ids ${ids}) — rename or exclude all but one in overrides.json`);
    }
    for (const t of kept) { towns.push(t); townById.set(t.geonameId, t); }
  }
  towns.sort((a, b) => a.geonameId - b.geonameId);
  stats.towns = towns.length;
  for (const t of towns) stats.townsBySource[t.source]++;
  for (const name of admin1.values()) { stats.townsPerProvince[name] = 0; stats.suburbsPerProvince[name] = 0; }
  for (const t of towns) stats.townsPerProvince[admin1.get(t.provinceCode)!]++;
  for (const [name, n] of Object.entries(stats.townsPerProvince)) {
    if (n === 0) blocking.push(`province ${name} has no towns`);
  }

  // Resolve any id (town, merged duplicate, or forced suburb) to the town it belongs to.
  const forcedOf = new Map(subCands.filter(c => c.forcedParent != null).map(c => [c.place.geonameId, c.forcedParent!]));
  const resolveTown = (id: number, depth = 0): TownOut | undefined => {
    if (depth > 5) return undefined;
    const t = townById.get(id) ?? aliasToTown.get(id);
    if (t) return t;
    const f = forcedOf.get(id);
    return f != null ? resolveTown(f, depth + 1) : undefined;
  };

  const townsByDistrict = new Map<string, TownOut[]>();
  const townsByProvince = new Map<string, TownOut[]>();
  for (const t of towns) {
    const pk = t.provinceCode;
    (townsByProvince.get(pk) ?? townsByProvince.set(pk, []).get(pk)!).push(t);
    if (t.admin2) {
      const dk = `${pk}|${t.admin2}`;
      (townsByDistrict.get(dk) ?? townsByDistrict.set(dk, []).get(dk)!).push(t);
    }
  }

  // ── Suburbs: pick a parent ──
  stats.suburbCandidates = subCands.length;
  // Forced entries claim their names first, then everything else, each by ascending id.
  subCands.sort((a, b) => Number(b.forcedParent != null) - Number(a.forcedParent != null) || a.place.geonameId - b.place.geonameId);
  const suburbByKey = new Map<string, SuburbOut>();
  const distances: number[] = [];

  // Inside an urban district (metro / Ekurhuleni) the municipal boundary is the limit, not a radius:
  // Bryanston is ~17 km from central Johannesburg but is unambiguously part of it.
  const withinCap = (s: GeonamesPlace, t: TownOut) =>
    (urban.has(s.admin2) && t.admin2 === s.admin2) || km(s, t) <= opts.maxSuburbKm;

  for (const c of subCands) {
    const s = c.place;
    let parent: TownOut | undefined;
    let source: SuburbSource | undefined;

    if (c.forcedParent != null) {
      parent = resolveTown(c.forcedParent);
      if (!parent) {
        blocking.push(`overrides: parent ${c.forcedParent} of "${c.name}" (${s.geonameId}) is not an imported town`);
        continue;
      }
      source = c.forcedHow === 'auto' ? 'metro-auto' : 'override';
      if (c.forcedHow === 'auto' || metroCityIds.has(parent.geonameId)) {
        const code = metroCityIds.get(parent.geonameId);
        if (code) metroAbsorbed.push({ geonameId: s.geonameId, name: c.name, metro: code, city: parent.name, km: round1(km(s, parent)), how: c.forcedHow === 'auto' ? 'auto' : 'override' });
      }
    }

    if (!parent) {
      const edges = hierarchy.get(s.geonameId) ?? [];
      const resolved = [...new Map(edges.map(id => resolveTown(id)).filter((t): t is TownOut => !!t).map(t => [t.geonameId, t])).values()];
      const usable = resolved.filter(t => t.provinceCode === c.provinceCode && withinCap(s, t));
      if (usable.length) {
        parent = nearestTown(s, usable)!.town;
        source = 'hierarchy';
      } else if (resolved.length) {
        suspicious.push({
          kind: 'hierarchy-parent-rejected', name: c.name, geonameId: s.geonameId,
          detail: `hierarchy parent ${resolved.map(t => `${t.name} (${round1(km(s, t))} km, ${admin1.get(t.provinceCode)})`).join(', ')} is in another province or beyond ${opts.maxSuburbKm} km`,
        });
      }
    }

    if (!parent && s.admin2) {
      const hit = nearestTown(s, townsByDistrict.get(`${c.provinceCode}|${s.admin2}`) ?? []);
      if (hit && withinCap(s, hit.town)) { parent = hit.town; source = 'nearest-district'; }
    }
    if (!parent && !s.admin2) {
      const hit = nearestTown(s, townsByProvince.get(c.provinceCode) ?? []);
      if (hit && hit.km <= opts.maxSuburbKm) {
        parent = hit.town;
        source = 'nearest-province';
        suspicious.push({ kind: 'weak-parent-assignment', name: c.name, geonameId: s.geonameId, detail: `no district code; nearest town ${parent.name} (${round1(hit.km)} km)` });
      }
    }

    if (!parent || !source) {
      stats.suburbsUnassigned++;
      if (s.featureCode === 'PPLX') {
        suspicious.push({ kind: 'unassigned-suburb', name: c.name, geonameId: s.geonameId, detail: `no imported town within ${opts.maxSuburbKm} km in its district — not imported` });
      }
      continue;
    }

    if (normName(c.name) === normName(parent.name)) {
      stats.suburbsSameNameAsTown++;
      continue;
    }
    const key = `${parent.geonameId}|${normName(c.name)}`;
    const existing = suburbByKey.get(key);
    if (existing) {
      stats.duplicateSuburbsDropped++;
      suspicious.push({ kind: 'duplicate-suburb-name', name: c.name, geonameId: s.geonameId, detail: `merged into ${existing.geonameId} under ${parent.name}` });
      continue;
    }
    distances.push(km(s, parent));
    stats.suburbsBySource[source]++;
    suburbByKey.set(key, { geonameId: s.geonameId, name: c.name, townGeonameId: parent.geonameId, lat: s.lat, lng: s.lng, source });
  }

  const suburbs = [...suburbByKey.values()].sort((a, b) => a.geonameId - b.geonameId);
  stats.suburbs = suburbs.length;
  for (const sb of suburbs) stats.suburbsPerProvince[admin1.get(townById.get(sb.townGeonameId)!.provinceCode)!]++;
  const townsWithSuburbs = new Set(suburbs.map(s => s.townGeonameId));
  stats.townsWithoutSuburbs = towns.filter(t => !townsWithSuburbs.has(t.geonameId)).length;
  if (distances.length) {
    distances.sort((a, b) => a - b);
    const at = (q: number) => distances[Math.min(distances.length - 1, Math.max(0, Math.ceil(q * distances.length) - 1))];
    stats.suburbDistanceKm = { median: round1(at(0.5)), p90: round1(at(0.9)), max: round1(distances[distances.length - 1]) };
  }

  // ── Review flags on what will be imported ──
  const townKeys = new Map(towns.map(t => [`${t.provinceCode}|${normName(t.name)}`, t]));
  for (const sb of suburbs) {
    const parent = townById.get(sb.townGeonameId)!;
    const other = townKeys.get(`${parent.provinceCode}|${normName(sb.name)}`);
    if (other) suspicious.push({ kind: 'suburb-also-a-town', name: sb.name, geonameId: sb.geonameId, detail: `suburb of ${parent.name}, and also the town ${other.name} (${other.geonameId})` });
  }
  const coordGroups = new Map<string, TownOut[]>();
  for (const t of towns) {
    if (t.population === 0) suspicious.push({ kind: 'zero-population-town', name: t.name, geonameId: t.geonameId, detail: `${t.source} (${t.featureCode}) with no GeoNames population — check it is still relevant` });
    const ck = `${t.lat.toFixed(4)}|${t.lng.toFixed(4)}`;
    (coordGroups.get(ck) ?? coordGroups.set(ck, []).get(ck)!).push(t);
  }
  for (let i = 0; i < towns.length; i++) {
    for (let j = i + 1; j < towns.length; j++) {
      const a = towns[i], b = towns[j];
      if (Math.abs(a.lat - b.lat) > 0.05 || Math.abs(a.lng - b.lng) > 0.05) continue; // cheap pre-filter
      const d = km(a, b);
      if (d < 2 && normName(a.name) !== normName(b.name)) {
        suspicious.push({ kind: 'towns-very-close', name: `${a.name} / ${b.name}`, geonameId: a.geonameId, detail: `${round1(d)} km apart (ids ${a.geonameId}, ${b.geonameId}) — possibly one place under two names` });
      }
    }
  }
  for (const cg of coordGroups.values()) {
    if (cg.length < 2) continue;
    cg.sort((a, b) => a.geonameId - b.geonameId);
    suspicious.push({ kind: 'same-coordinates', name: cg.map(t => t.name).join(' / '), geonameId: cg[0].geonameId, detail: `${cg.length} towns share coordinates ${cg[0].lat}, ${cg[0].lng}` });
  }

  suspicious.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name) || a.geonameId - b.geonameId);
  metroAbsorbed.sort((a, b) => a.metro.localeCompare(b.metro) || a.km - b.km || a.geonameId - b.geonameId);

  const provinces: ProvinceOut[] = [...admin1.entries()]
    .map(([geonamesCode, name]) => ({ geonamesCode, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { provinces, towns, suburbs, stats, suspicious, metroAbsorbed, blocking };
}
