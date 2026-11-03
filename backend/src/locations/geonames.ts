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
//  • Feature class 'P' = populated place. Within it:
//      PPLC / PPLA..PPLA4 / PPLG = capital / seats of admin divisions
//      PPL  = generic populated place
//      PPLX = "section of populated place" — GeoNames' closest equivalent to a suburb
//      PPLH/PPLQ/PPLW = historical / abandoned / destroyed (never imported)
//      PPLL/PPLF/PPLR/PPLS = small localities, farm villages, religious, clusters
//        (not imported by default — see TOWN_FEATURE_CODES)

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

export interface TownOut {
  geonameId: number;
  name: string;
  provinceCode: string;
  lat: number;
  lng: number;
  population: number;
  featureCode: string;
  admin2: string;
}

export interface SuburbOut {
  geonameId: number;
  name: string;
  townGeonameId: number;
  lat: number;
  lng: number;
}

export interface ImportOptions {
  /** Towns below this population are skipped. 0 keeps everything (SA data often records 0 for real places). */
  minTownPopulation: number;
  /** A suburb further than this from its nearest eligible parent town is left unassigned (and not imported). */
  maxSuburbKm: number;
  /** Towns with at least this population are eligible suburb parents even if they are not admin seats. */
  parentMinPopulation: number;
}

export const DEFAULT_OPTIONS: ImportOptions = {
  minTownPopulation: 0,
  maxSuburbKm: 40,
  parentMinPopulation: 5000,
};

// Feature codes imported as Town, best rank first (used to pick a winner when
// several rows share one name inside a province).
export const TOWN_FEATURE_CODES = ['PPLC', 'PPLA', 'PPLA2', 'PPLA3', 'PPLA4', 'PPLG', 'PPL'] as const;
export const SUBURB_FEATURE_CODES = ['PPLX'] as const;

const TOWN_RANK: Record<string, number> = Object.fromEntries(
  TOWN_FEATURE_CODES.map((c, i) => [c, i]),
);
// Rank <= this (PPLC, PPLA, PPLA2, PPLA3, PPLA4) = capital or seat of an admin division.
const MAX_SEAT_RANK = TOWN_RANK['PPLA4'];

export type SuspiciousKind =
  | 'duplicate-town-name'
  | 'duplicate-suburb-name'
  | 'suburb-same-name-as-town'
  | 'outside-bounds'
  | 'odd-name'
  | 'same-coordinates'
  | 'explicit-parent-wrong-province'
  | 'explicit-parent-far'
  | 'weak-parent-assignment'
  | 'unassigned-suburb';

export interface SuspiciousRecord {
  kind: SuspiciousKind;
  name: string;
  geonameId: number;
  detail: string;
}

export interface ImportStats {
  placesRead: number;
  populatedPlaces: number;
  skippedNoProvince: number;
  ignoredByFeatureCode: Record<string, number>;
  townCandidates: number;
  townsBelowMinPopulation: number;
  duplicateTownsDropped: number;
  towns: number;
  /** Province name → number of towns that will be imported (provinces with none show 0). */
  townsPerProvince: Record<string, number>;
  suburbCandidates: number;
  /** Suburbs that have at least one non-ADM row in hierarchy.txt (whether or not its parent is usable). */
  suburbsWithHierarchyEdge: number;
  suburbsAssignedExplicit: number;
  /** Explicit parents were several towns; the nearest one was used. */
  suburbsExplicitAmbiguous: number;
  /** Explicit parent was an imported town in a different province — ignored, fell back to nearest. */
  suburbsExplicitRejected: number;
  suburbsAssignedSameDistrict: number;
  suburbsAssignedProvinceWide: number;
  suburbsUnassigned: number;
  /** Province-wide fallback + unassigned: parent is a weak guess or missing. */
  suburbsWithoutReliableParent: number;
  suburbsSameNameAsTown: number;
  duplicateSuburbsDropped: number;
  suburbs: number;
  provinces: number;
  townsWithoutSuburbs: number;
  /** Distance from each assigned suburb to its parent (all sources). */
  suburbDistanceKm: { median: number; p90: number; max: number } | null;
  unassignedSuburbSamples: string[];
}

export interface ImportPlan {
  provinces: ProvinceOut[];
  towns: TownOut[];
  suburbs: SuburbOut[];
  stats: ImportStats;
  suspicious: SuspiciousRecord[];
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
    .replace(/[\u0300-\u036f]/g, '')
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

// Sanity box around South Africa (incl. Lesotho/eSwatini enclaves). Used only to FLAG
// records for review — nothing is dropped because of it.
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

// Prefer: better feature rank, then larger population, then lowest geonameId (stable).
function betterTown(a: TownOut, b: TownOut): boolean {
  const ra = TOWN_RANK[a.featureCode] ?? 99;
  const rb = TOWN_RANK[b.featureCode] ?? 99;
  if (ra !== rb) return ra < rb;
  if (a.population !== b.population) return a.population > b.population;
  return a.geonameId < b.geonameId;
}

function nearest(
  lat: number,
  lng: number,
  towns: TownOut[],
): { town: TownOut; km: number } | null {
  let best: { town: TownOut; km: number } | null = null;
  for (const t of towns) {
    const km = haversineKm(lat, lng, t.lat, t.lng);
    if (!best || km < best.km || (km === best.km && t.geonameId < best.town.geonameId)) best = { town: t, km };
  }
  return best;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function oddName(name: string): boolean {
  return name.length < 2 || /\d/.test(name) || !/\p{L}/u.test(name);
}

function outOfBounds(lat: number, lng: number): boolean {
  return lat < SA_BOUNDS.minLat || lat > SA_BOUNDS.maxLat || lng < SA_BOUNDS.minLng || lng > SA_BOUNDS.maxLng;
}

/**
 * Turns raw GeoNames places into the Province → Town → Suburb import plan.
 *
 * Suburb parent, in order of preference:
 *   1. explicit  — a non-ADM hierarchy.txt edge to an imported town in the same province
 *   2. district  — nearest eligible town sharing the suburb's admin2 code (within maxSuburbKm)
 *   3. province  — nearest eligible town anywhere in the province (within maxSuburbKm); flagged as weak
 *   4. none      — left unassigned and not imported
 *
 * `hierarchy` maps childId → parentIds, already restricted to non-ADM rows.
 */
export function buildImportPlan(
  places: Iterable<GeonamesPlace>,
  admin1: Map<string, string>,
  options: Partial<ImportOptions> = {},
  hierarchy: Map<number, number[]> = new Map(),
): ImportPlan {
  const opts: ImportOptions = { ...DEFAULT_OPTIONS, ...options };
  const stats: ImportStats = {
    placesRead: 0,
    populatedPlaces: 0,
    skippedNoProvince: 0,
    ignoredByFeatureCode: {},
    townCandidates: 0,
    townsBelowMinPopulation: 0,
    duplicateTownsDropped: 0,
    towns: 0,
    townsPerProvince: {},
    suburbCandidates: 0,
    suburbsWithHierarchyEdge: 0,
    suburbsAssignedExplicit: 0,
    suburbsExplicitAmbiguous: 0,
    suburbsExplicitRejected: 0,
    suburbsAssignedSameDistrict: 0,
    suburbsAssignedProvinceWide: 0,
    suburbsUnassigned: 0,
    suburbsWithoutReliableParent: 0,
    suburbsSameNameAsTown: 0,
    duplicateSuburbsDropped: 0,
    suburbs: 0,
    provinces: admin1.size,
    townsWithoutSuburbs: 0,
    suburbDistanceKm: null,
    unassignedSuburbSamples: [],
  };
  const suspicious: SuspiciousRecord[] = [];

  const townCandidates: TownOut[] = [];
  const suburbCandidates: Array<GeonamesPlace & { provinceCode: string }> = [];

  for (const p of places) {
    stats.placesRead++;
    if (p.featureClass !== 'P') continue;
    stats.populatedPlaces++;

    const provinceCode = `${p.countryCode}.${p.admin1}`;
    if (!admin1.has(provinceCode)) {
      stats.skippedNoProvince++;
      continue;
    }

    if ((TOWN_FEATURE_CODES as readonly string[]).includes(p.featureCode)) {
      stats.townCandidates++;
      if (p.population < opts.minTownPopulation) {
        stats.townsBelowMinPopulation++;
        continue;
      }
      townCandidates.push({
        geonameId: p.geonameId,
        name: p.name,
        provinceCode,
        lat: p.lat,
        lng: p.lng,
        population: p.population,
        featureCode: p.featureCode,
        admin2: p.admin2,
      });
    } else if ((SUBURB_FEATURE_CODES as readonly string[]).includes(p.featureCode)) {
      stats.suburbCandidates++;
      suburbCandidates.push({ ...p, provinceCode });
    } else {
      stats.ignoredByFeatureCode[p.featureCode] = (stats.ignoredByFeatureCode[p.featureCode] ?? 0) + 1;
    }
  }

  // ── Towns: one per (province, normalised name); the best-ranked row wins ──
  const groups = new Map<string, TownOut[]>();
  for (const t of townCandidates) {
    const key = `${t.provinceCode}|${normName(t.name)}`;
    const g = groups.get(key);
    if (g) g.push(t);
    else groups.set(key, [t]);
  }
  const towns: TownOut[] = [];
  const townById = new Map<number, TownOut>();
  const aliasToWinner = new Map<number, TownOut>(); // merged-away duplicate id → surviving town
  for (const g of groups.values()) {
    const winner = g.reduce((best, t) => (betterTown(t, best) ? t : best));
    towns.push(winner);
    townById.set(winner.geonameId, winner);
    for (const t of g) {
      if (t === winner) continue;
      stats.duplicateTownsDropped++;
      aliasToWinner.set(t.geonameId, winner);
      suspicious.push({
        kind: 'duplicate-town-name',
        name: t.name,
        geonameId: t.geonameId,
        detail: `merged into ${winner.geonameId} (${winner.featureCode}, pop ${winner.population})`,
      });
    }
  }
  towns.sort((a, b) => a.geonameId - b.geonameId);
  stats.towns = towns.length;

  for (const name of admin1.values()) stats.townsPerProvince[name] = 0;
  for (const t of towns) {
    const pn = admin1.get(t.provinceCode)!;
    stats.townsPerProvince[pn] = (stats.townsPerProvince[pn] ?? 0) + 1;
  }

  // ── Suburbs: pick a parent town ──
  const townsByProvince = new Map<string, TownOut[]>();
  for (const t of towns) {
    const list = townsByProvince.get(t.provinceCode) ?? [];
    list.push(t);
    townsByProvince.set(t.provinceCode, list);
  }
  const isEligibleParent = (t: TownOut) =>
    (TOWN_RANK[t.featureCode] ?? 99) <= MAX_SEAT_RANK || t.population >= opts.parentMinPopulation;

  const eligibleByProvince = new Map<string, TownOut[]>();
  const eligibleByDistrict = new Map<string, TownOut[]>();
  for (const [prov, list] of townsByProvince) {
    let eligible = list.filter(isEligibleParent);
    if (eligible.length === 0) eligible = list; // tiny province data: fall back to every town
    eligibleByProvince.set(prov, eligible);
    for (const t of eligible) {
      if (!t.admin2) continue;
      const k = `${prov}|${t.admin2}`;
      const l = eligibleByDistrict.get(k) ?? [];
      l.push(t);
      eligibleByDistrict.set(k, l);
    }
  }

  const suburbByKey = new Map<string, SuburbOut>();
  const distances: number[] = [];

  for (const s of suburbCandidates.sort((a, b) => a.geonameId - b.geonameId)) {
    let parent: TownOut | null = null;
    let km = 0;

    // 1. explicit parent from hierarchy.txt
    const edgeParents = hierarchy.get(s.geonameId);
    if (edgeParents && edgeParents.length) {
      stats.suburbsWithHierarchyEdge++;
      const resolved = new Map<number, TownOut>();
      for (const pid of edgeParents) {
        const t = townById.get(pid) ?? aliasToWinner.get(pid);
        if (t) resolved.set(t.geonameId, t);
      }
      if (resolved.size > 0) {
        const sameProvince = [...resolved.values()].filter(t => t.provinceCode === s.provinceCode);
        if (sameProvince.length === 0) {
          stats.suburbsExplicitRejected++;
          suspicious.push({
            kind: 'explicit-parent-wrong-province',
            name: s.name,
            geonameId: s.geonameId,
            detail: `hierarchy parent ${[...resolved.values()].map(t => t.name).join(', ')} is in another province; used nearest-town matching instead`,
          });
        } else {
          let hit: { town: TownOut; km: number };
          if (sameProvince.length === 1) {
            hit = { town: sameProvince[0], km: haversineKm(s.lat, s.lng, sameProvince[0].lat, sameProvince[0].lng) };
          } else {
            stats.suburbsExplicitAmbiguous++;
            hit = nearest(s.lat, s.lng, sameProvince)!;
          }
          parent = hit.town;
          km = hit.km;
          stats.suburbsAssignedExplicit++;
          if (km > opts.maxSuburbKm) {
            suspicious.push({
              kind: 'explicit-parent-far',
              name: s.name,
              geonameId: s.geonameId,
              detail: `explicit parent ${parent.name} is ${round1(km)} km away (cap ${opts.maxSuburbKm} km) — kept`,
            });
          }
        }
      }
    }

    // 2. nearest eligible town in the same district
    if (!parent && s.admin2) {
      const sameDistrict = eligibleByDistrict.get(`${s.provinceCode}|${s.admin2}`);
      const hit = sameDistrict ? nearest(s.lat, s.lng, sameDistrict) : null;
      if (hit && hit.km <= opts.maxSuburbKm) {
        parent = hit.town;
        km = hit.km;
        stats.suburbsAssignedSameDistrict++;
      }
    }
    // 3. nearest eligible town in the province (weak)
    if (!parent) {
      const hit = nearest(s.lat, s.lng, eligibleByProvince.get(s.provinceCode) ?? []);
      if (hit && hit.km <= opts.maxSuburbKm) {
        parent = hit.town;
        km = hit.km;
        stats.suburbsAssignedProvinceWide++;
        suspicious.push({
          kind: 'weak-parent-assignment',
          name: s.name,
          geonameId: s.geonameId,
          detail: `no explicit parent and no same-district match; nearest town ${parent.name} (${round1(km)} km)`,
        });
      }
    }
    // 4. none
    if (!parent) {
      stats.suburbsUnassigned++;
      suspicious.push({
        kind: 'unassigned-suburb',
        name: s.name,
        geonameId: s.geonameId,
        detail: `no town within ${opts.maxSuburbKm} km — not imported`,
      });
      if (stats.unassignedSuburbSamples.length < 20) stats.unassignedSuburbSamples.push(s.name);
      continue;
    }
    distances.push(km);

    // A suburb literally named like its town adds nothing to the picker.
    if (normName(s.name) === normName(parent.name)) {
      stats.suburbsSameNameAsTown++;
      suspicious.push({ kind: 'suburb-same-name-as-town', name: s.name, geonameId: s.geonameId, detail: `parent ${parent.name} — dropped` });
      continue;
    }

    const key = `${parent.geonameId}|${normName(s.name)}`;
    const existing = suburbByKey.get(key);
    if (existing) {
      stats.duplicateSuburbsDropped++; // lowest geonameId wins (sorted ascending above)
      suspicious.push({
        kind: 'duplicate-suburb-name',
        name: s.name,
        geonameId: s.geonameId,
        detail: `merged into ${existing.geonameId} under ${parent.name}`,
      });
      continue;
    }
    suburbByKey.set(key, { geonameId: s.geonameId, name: s.name, townGeonameId: parent.geonameId, lat: s.lat, lng: s.lng });
  }

  const suburbs = [...suburbByKey.values()];
  stats.suburbs = suburbs.length;
  const townsWithSuburbs = new Set(suburbs.map(s => s.townGeonameId));
  stats.townsWithoutSuburbs = towns.filter(t => !townsWithSuburbs.has(t.geonameId)).length;
  stats.suburbsWithoutReliableParent = stats.suburbsAssignedProvinceWide + stats.suburbsUnassigned;

  if (distances.length) {
    distances.sort((a, b) => a - b);
    const at = (q: number) => distances[Math.min(distances.length - 1, Math.max(0, Math.ceil(q * distances.length) - 1))];
    stats.suburbDistanceKm = { median: round1(at(0.5)), p90: round1(at(0.9)), max: round1(distances[distances.length - 1]) };
  }

  // ── Generic review flags on what will actually be imported ──
  const coordGroups = new Map<string, TownOut[]>();
  for (const t of towns) {
    if (outOfBounds(t.lat, t.lng)) suspicious.push({ kind: 'outside-bounds', name: t.name, geonameId: t.geonameId, detail: `town at ${t.lat}, ${t.lng}` });
    if (oddName(t.name)) suspicious.push({ kind: 'odd-name', name: t.name, geonameId: t.geonameId, detail: 'town name is very short or contains digits/no letters' });
    const ck = `${t.lat.toFixed(4)}|${t.lng.toFixed(4)}`;
    const cg = coordGroups.get(ck);
    if (cg) cg.push(t);
    else coordGroups.set(ck, [t]);
  }
  for (const cg of coordGroups.values()) {
    if (cg.length < 2) continue;
    cg.sort((a, b) => a.geonameId - b.geonameId);
    suspicious.push({
      kind: 'same-coordinates',
      name: cg.map(t => t.name).join(' / '),
      geonameId: cg[0].geonameId,
      detail: `${cg.length} different towns share coordinates ${cg[0].lat}, ${cg[0].lng} (ids ${cg.map(t => t.geonameId).join(', ')})`,
    });
  }
  for (const sb of suburbs) {
    if (outOfBounds(sb.lat, sb.lng)) suspicious.push({ kind: 'outside-bounds', name: sb.name, geonameId: sb.geonameId, detail: `suburb at ${sb.lat}, ${sb.lng}` });
    if (oddName(sb.name)) suspicious.push({ kind: 'odd-name', name: sb.name, geonameId: sb.geonameId, detail: 'suburb name is very short or contains digits/no letters' });
  }

  suspicious.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name) || a.geonameId - b.geonameId);

  const provinces: ProvinceOut[] = [...admin1.entries()]
    .map(([geonamesCode, name]) => ({ geonamesCode, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { provinces, towns, suburbs, stats, suspicious };
}
