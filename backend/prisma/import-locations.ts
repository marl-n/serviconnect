/**
 * Imports South African locations (Province → Town → Suburb) from GeoNames.
 *
 * Repeatable and safe to re-run: rows are matched on geonameId (or on
 * province/name for towns, town/name for suburbs), unchanged rows are not
 * rewritten, and nothing is ever deleted — existing ServiceRequests and
 * business service areas keep pointing at valid rows.
 *
 * 1. Download the two GeoNames files (PowerShell, from the backend folder):
 *      mkdir prisma\data\geonames -Force
 *      Invoke-WebRequest https://download.geonames.org/export/dump/ZA.zip -OutFile prisma\data\geonames\ZA.zip
 *      Expand-Archive prisma\data\geonames\ZA.zip -DestinationPath prisma\data\geonames -Force
 *      Invoke-WebRequest https://download.geonames.org/export/dump/admin1CodesASCII.txt -OutFile prisma\data\geonames\admin1CodesASCII.txt
 *    Optional but recommended — explicit suburb→town links (global file, large):
 *      Invoke-WebRequest https://download.geonames.org/export/dump/hierarchy.zip -OutFile prisma\data\geonames\hierarchy.zip
 *      Expand-Archive prisma\data\geonames\hierarchy.zip -DestinationPath prisma\data\geonames -Force
 *    Expected folder: prisma/data/geonames/{ZA.txt, admin1CodesASCII.txt, hierarchy.txt}
 *
 * 2. Preview what would be imported (no database writes) and save the full review report:
 *      npm run import:locations -- --dry-run --report prisma/data/geonames/dry-run-report.json
 *
 * 3. Import (refused while the plan has blocking issues):
 *      npm run import:locations
 *
 * The dataset is curated, not exhaustive: municipal seats, places with population ≥ 5,000
 * (≥ 20,000 in the village-dominated municipalities listed in overrides.json), one selectable city
 * per metro (all eight metros except Ekurhuleni, which stays as separate towns), and the documented
 * decisions in <dir>/overrides.json — province corrections, towns, suburbs, exclusions and renames
 * (see the rules on buildImportPlan in src/locations/geonames.ts). Suburbs are optional descriptors
 * under a town; they are never required and play no part in lead matching.
 *
 * The report (--report) contains the totals, per-province counts, metro classifications, every
 * manual override, every province → town → suburb, excluded places and remaining warnings.
 *
 * Options:
 *   --dir <folder>             where ZA.txt + admin1CodesASCII.txt live (default prisma/data/geonames)
 *   --overrides <file>         curation overrides (default <dir>/overrides.json; required)
 *   --min-population <n>       PPL places at/above this population qualify as towns (default 5000)
 *   --max-suburb-km <n>        max distance from a suburb to an automatically chosen parent (default 15)
 *   --hierarchy <file>         hierarchy.txt to use (default <dir>/hierarchy.txt if present)
 *   --no-hierarchy             ignore hierarchy.txt even if present (nearest-town matching only)
 *   --report <file>            write the full review report (every town, suburb and flag) as JSON
 *   --dry-run                  parse + report only
 *
 * GeoNames data is licensed CC BY 4.0 — credit "GeoNames (geonames.org)" somewhere in the product.
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import {
  buildImportPlan,
  parseAdmin1,
  parsePlaceLine,
  parseHierarchyLine,
  parseCuration,
  normName,
  DEFAULT_OPTIONS,
  GeonamesPlace,
  ImportPlan,
  Curation,
} from '../src/locations/geonames';

const CHUNK = 1000;

function chunk<T>(arr: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export interface PersistSummary {
  provincesUpserted: number;
  townsCreated: number;
  townsUpdated: number;
  townsUnchanged: number;
  townsFailed: number;
  suburbsCreated: number;
  suburbsUpdated: number;
  suburbsUnchanged: number;
  suburbsFailed: number;
  errors: string[];
}

/**
 * Writes an import plan to the database. `prisma` is injected so this can be
 * exercised against any Prisma-compatible client.
 */
export async function persistPlan(prisma: any, plan: ImportPlan): Promise<PersistSummary> {
  const summary: PersistSummary = {
    provincesUpserted: 0,
    townsCreated: 0, townsUpdated: 0, townsUnchanged: 0, townsFailed: 0,
    suburbsCreated: 0, suburbsUpdated: 0, suburbsUnchanged: 0, suburbsFailed: 0,
    errors: [],
  };
  const noteError = (msg: string) => { if (summary.errors.length < 25) summary.errors.push(msg); };

  // ── Provinces ──
  for (const p of plan.provinces) {
    await prisma.province.upsert({
      where: { geonamesCode: p.geonamesCode },
      update: { name: p.name },
      create: { name: p.name, geonamesCode: p.geonamesCode },
    });
    summary.provincesUpserted++;
  }
  const provinceRows = await prisma.province.findMany({ select: { id: true, geonamesCode: true } });
  const provinceIdByCode = new Map<string, string>();
  for (const r of provinceRows) if (r.geonamesCode) provinceIdByCode.set(r.geonamesCode, r.id);

  // ── Towns ──
  const existingTowns = await prisma.town.findMany({
    select: { id: true, provinceId: true, name: true, geonameId: true, lat: true, lng: true, population: true },
  });
  const townByGeo = new Map<number, any>();
  const townByKey = new Map<string, any>();
  for (const t of existingTowns) {
    if (t.geonameId != null) townByGeo.set(t.geonameId, t);
    townByKey.set(`${t.provinceId}|${normName(t.name)}`, t);
  }

  const townsToCreate: any[] = [];
  for (const t of plan.towns) {
    const provinceId = provinceIdByCode.get(t.provinceCode);
    if (!provinceId) continue;
    const data = { provinceId, name: t.name, geonameId: t.geonameId, lat: t.lat, lng: t.lng, population: t.population };
    const row = townByGeo.get(t.geonameId) ?? townByKey.get(`${provinceId}|${normName(t.name)}`);
    if (!row) { townsToCreate.push(data); continue; }
    const same =
      row.provinceId === data.provinceId && row.name === data.name && row.geonameId === data.geonameId &&
      row.lat === data.lat && row.lng === data.lng && row.population === data.population;
    if (same) { summary.townsUnchanged++; continue; }
    try {
      await prisma.town.update({ where: { id: row.id }, data });
      summary.townsUpdated++;
    } catch (e: any) {
      summary.townsFailed++;
      noteError(`town update "${t.name}" (geonameId ${t.geonameId}): ${e?.message ?? e}`);
    }
  }
  for (const part of chunk(townsToCreate)) {
    const res = await prisma.town.createMany({ data: part, skipDuplicates: true });
    summary.townsCreated += res.count;
    summary.townsFailed += part.length - res.count;
  }

  // ── Suburbs ──
  const townRows = await prisma.town.findMany({ select: { id: true, geonameId: true } });
  const townIdByGeo = new Map<number, string>();
  for (const r of townRows) if (r.geonameId != null) townIdByGeo.set(r.geonameId, r.id);

  const existingSuburbs = await prisma.suburb.findMany({
    select: { id: true, townId: true, name: true, geonameId: true, lat: true, lng: true },
  });
  const subByGeo = new Map<number, any>();
  const subByKey = new Map<string, any>();
  for (const s of existingSuburbs) {
    if (s.geonameId != null) subByGeo.set(s.geonameId, s);
    subByKey.set(`${s.townId}|${normName(s.name)}`, s);
  }

  const suburbsToCreate: any[] = [];
  for (const s of plan.suburbs) {
    const townId = townIdByGeo.get(s.townGeonameId);
    if (!townId) continue;
    const data = { townId, name: s.name, geonameId: s.geonameId, lat: s.lat, lng: s.lng };
    const row = subByGeo.get(s.geonameId) ?? subByKey.get(`${townId}|${normName(s.name)}`);
    if (!row) { suburbsToCreate.push(data); continue; }
    const same =
      row.townId === data.townId && row.name === data.name && row.geonameId === data.geonameId &&
      row.lat === data.lat && row.lng === data.lng;
    if (same) { summary.suburbsUnchanged++; continue; }
    try {
      await prisma.suburb.update({ where: { id: row.id }, data });
      summary.suburbsUpdated++;
    } catch (e: any) {
      summary.suburbsFailed++;
      noteError(`suburb update "${s.name}" (geonameId ${s.geonameId}): ${e?.message ?? e}`);
    }
  }
  for (const part of chunk(suburbsToCreate)) {
    const res = await prisma.suburb.createMany({ data: part, skipDuplicates: true });
    summary.suburbsCreated += res.count;
    summary.suburbsFailed += part.length - res.count;
  }

  return summary;
}

// ───────────────────────── CLI ─────────────────────────

interface CliArgs {
  dir: string;
  country: string;
  dryRun: boolean;
  minTownPopulation: number;
  maxSuburbKm: number;
  overridesFile: string | null;
  hierarchyFile: string | null;
  useHierarchy: boolean;
  reportFile: string | null;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    dir: path.join(__dirname, 'data', 'geonames'),
    country: 'ZA',
    dryRun: false,
    minTownPopulation: DEFAULT_OPTIONS.minTownPopulation,
    maxSuburbKm: DEFAULT_OPTIONS.maxSuburbKm,
    overridesFile: null,
    hierarchyFile: null,
    useHierarchy: true,
    reportFile: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--dir') args.dir = path.resolve(next());
    else if (a === '--country') args.country = next().toUpperCase();
    else if (a === '--min-population') args.minTownPopulation = Number(next());
    else if (a === '--max-suburb-km') args.maxSuburbKm = Number(next());
    else if (a === '--overrides') args.overridesFile = path.resolve(next());
    else if (a === '--hierarchy') args.hierarchyFile = path.resolve(next());
    else if (a === '--no-hierarchy') args.useHierarchy = false;
    else if (a === '--report') args.reportFile = path.resolve(next());
    else throw new Error(`Unknown option: ${a}`);
  }
  for (const [k, v] of Object.entries({ minTownPopulation: args.minTownPopulation, maxSuburbKm: args.maxSuburbKm })) {
    if (!Number.isFinite(v) || v < 0) throw new Error(`Invalid value for ${k}`);
  }
  return args;
}

async function loadPlaces(file: string): Promise<GeonamesPlace[]> {
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  const places: GeonamesPlace[] = [];
  for await (const line of rl) {
    const p = parsePlaceLine(line);
    if (p && p.featureClass === 'P') places.push(p); // only populated places matter here
  }
  return places;
}

/**
 * Streams hierarchy.txt (global — hundreds of thousands of rows) keeping only non-ADM edges whose
 * child is one of the wanted ids. ADM rows describe the admin tree, not suburbs.
 */
async function loadHierarchy(file: string, wantedChildIds: Set<number>): Promise<Map<number, number[]>> {
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  const edges = new Map<number, number[]>();
  for await (const line of rl) {
    const e = parseHierarchyLine(line);
    if (!e || e.type.toUpperCase() === 'ADM' || !wantedChildIds.has(e.childId)) continue;
    const list = edges.get(e.childId);
    if (list) { if (!list.includes(e.parentId)) list.push(e.parentId); }
    else edges.set(e.childId, [e.parentId]);
  }
  return edges;
}

function printReport(plan: ImportPlan, curation: Curation, hierarchyNote: string) {
  const st = plan.stats;
  const n = (v: number) => v.toLocaleString('en-ZA');
  const kv = (o: Record<string, number>) => Object.entries(o).map(([k, v]) => `${k}=${n(v)}`).join(', ') || 'none';
  console.log('\nImport plan (curated)');
  console.log('═════════════════════');
  console.log(`Provinces: ${plan.provinces.length}`);
  const width = Math.max(...Object.keys(st.townsPerProvince).map(k => k.length), 8);
  console.log(`\n  ${'Province'.padEnd(width)}    Towns  Suburbs`);
  for (const name of Object.keys(st.townsPerProvince).sort()) {
    console.log(`  ${name.padEnd(width)}  ${n(st.townsPerProvince[name]).padStart(7)}  ${n(st.suburbsPerProvince[name]).padStart(7)}`);
  }
  console.log(`  ${'TOTAL'.padEnd(width)}  ${n(st.towns).padStart(7)}  ${n(st.suburbs).padStart(7)}`);
  console.log(`\nTowns by rule: ${kv(st.townsBySource)}; same-name rows merged: ${n(st.duplicateTownsMerged)}`);
  console.log(`Excluded places: ${kv(st.excludedByReason)}; no province match: ${n(st.skippedNoProvince)}`);
  console.log(`Ignored populated-place codes: ${kv(st.ignoredByFeatureCode)}`);

  console.log(`\nSuburbs: ${n(st.suburbs)} imported from ${n(st.suburbCandidates)} candidates (${hierarchyNote})`);
  console.log(`  parent source: ${kv(st.suburbsBySource)}`);
  console.log(`  not imported: no parent ${n(st.suburbsUnassigned)}, same name as parent ${n(st.suburbsSameNameAsTown)}, duplicates ${n(st.duplicateSuburbsDropped)}`);
  if (st.suburbDistanceKm) console.log(`  distance to parent: median ${st.suburbDistanceKm.median} km, p90 ${st.suburbDistanceKm.p90} km, max ${st.suburbDistanceKm.max} km`);
  console.log(`  towns with no suburbs: ${n(st.townsWithoutSuburbs)} of ${n(st.towns)} (suburbs are optional)`);

  console.log('\nMetros (one selectable city each; independent towns inside the metro listed after it)');
  for (const m of metroSummary(plan, curation)) {
    console.log(`  ${m.code.padEnd(4)} ${m.city} — ${n(m.suburbs)} suburbs, ${m.absorbed.length} town-sized places absorbed` +
      (m.independentTowns.length ? `; independent: ${m.independentTowns.map(t => t.name).join(', ')}` : ''));
  }
  const ek = plan.towns.filter(t => curation.urbanDistricts.includes(t.admin2));
  if (ek.length) console.log(`  Urban districts kept as separate towns (${curation.urbanDistricts.join(', ')}): ${ek.map(t => t.name).sort().join(', ')}`);

  console.log('\nFlagged for review (full list via --report)');
  const byKind = new Map<string, ImportPlan['suspicious']>();
  for (const r of plan.suspicious) byKind.set(r.kind, [...(byKind.get(r.kind) ?? []), r]);
  if (byKind.size === 0) console.log('  none');
  for (const [kind, list] of [...byKind.entries()].sort()) {
    console.log(`  ${kind}: ${n(list.length)}`);
    for (const r of list.slice(0, 5)) console.log(`      - ${r.name} [${r.geonameId}] ${r.detail}`);
  }

  console.log(plan.blocking.length ? `\nBLOCKING (${plan.blocking.length}) — fix in overrides.json before importing:` : '\nBlocking issues: none');
  for (const b of plan.blocking) console.log(`  x ${b}`);
}

/** Per metro: the selectable city, places absorbed into it, and the independent towns inside the metro. */
function metroSummary(plan: ImportPlan, curation: Curation) {
  const suburbCount = new Map<number, number>();
  for (const s of plan.suburbs) suburbCount.set(s.townGeonameId, (suburbCount.get(s.townGeonameId) ?? 0) + 1);
  return Object.entries(curation.metros)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, ref]) => {
      const city = plan.towns.find(t => t.geonameId === ref.geonameId);
      return {
        code,
        city: city?.name ?? ref.name,
        geonameId: ref.geonameId,
        suburbs: suburbCount.get(ref.geonameId) ?? 0,
        absorbed: plan.metroAbsorbed.filter(m => m.metro === code).map(m => ({ name: m.name, geonameId: m.geonameId, km: m.km, how: m.how })),
        independentTowns: plan.towns
          .filter(t => t.admin2 === code && t.geonameId !== ref.geonameId)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(t => ({ name: t.name, geonameId: t.geonameId, rule: t.source, suburbs: suburbCount.get(t.geonameId) ?? 0 })),
      };
    });
}

/**
 * Full review report: totals, per-province counts, metro classifications, every manual override,
 * every province → town (with the rule that admitted it) → suburbs, excluded places and remaining warnings.
 */
function writeReport(file: string, plan: ImportPlan, curation: Curation, meta: Record<string, unknown>) {
  const suburbsByTown = new Map<number, string[]>();
  for (const s of plan.suburbs) {
    const list = suburbsByTown.get(s.townGeonameId) ?? [];
    list.push(s.name);
    suburbsByTown.set(s.townGeonameId, list);
  }
  const provinceName = new Map(plan.provinces.map(p => [p.geonamesCode, p.name]));
  const provinces = plan.provinces.map(p => ({
    name: p.name,
    geonamesCode: p.geonamesCode,
    towns: plan.towns
      .filter(t => t.provinceCode === p.geonamesCode)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(t => ({
        name: t.name,
        geonameId: t.geonameId,
        rule: t.source,
        featureCode: t.featureCode,
        population: t.population,
        district: t.admin2,
        municipality: t.admin3 ?? '',
        lat: t.lat,
        lng: t.lng,
        suburbs: (suburbsByTown.get(t.geonameId) ?? []).sort((a, b) => a.localeCompare(b)),
      })),
  }));

  // Unpopulated farm/locality points below the threshold are only counted — there are ~10,000 of them.
  const listed = plan.excluded.filter(e => !(e.reason === 'below-threshold' && e.population === 0));
  const excluded = {
    countsByReason: plan.stats.excludedByReason,
    note: 'Every excluded populated place is listed except unpopulated (population 0) places below the town threshold, which are only counted.',
    places: listed.map(e => ({ ...e, province: provinceName.get(e.provinceCode) ?? e.provinceCode })),
  };

  const warnings: Record<string, ImportPlan['suspicious']> = {};
  for (const r of plan.suspicious) (warnings[r.kind] ??= []).push(r);

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        ...meta,
        summary: {
          provinces: plan.provinces.length,
          towns: plan.stats.towns,
          suburbs: plan.stats.suburbs,
          perProvince: plan.provinces.map(p => ({ province: p.name, towns: plan.stats.townsPerProvince[p.name], suburbs: plan.stats.suburbsPerProvince[p.name] })),
          townsByRule: plan.stats.townsBySource,
          suburbsBySource: plan.stats.suburbsBySource,
          excludedByReason: plan.stats.excludedByReason,
        },
        blocking: plan.blocking,
        metros: metroSummary(plan, curation),
        urbanDistrictTowns: plan.towns.filter(t => curation.urbanDistricts.includes(t.admin2)).map(t => t.name).sort(),
        manualOverrides: {
          ruralMunicipalities: curation.ruralMunicipalities,
          reassign: curation.reassign,
          towns: curation.towns,
          suburbs: curation.suburbs,
          exclude: curation.exclude,
          rename: curation.rename,
        },
        warnings: { counts: Object.fromEntries(Object.entries(warnings).map(([k, v]) => [k, v.length])), ...warnings },
        stats: plan.stats,
        provinces,
        excluded,
      },
      null,
      2,
    ),
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const placesFile = path.join(args.dir, `${args.country}.txt`);
  const adminFile = path.join(args.dir, 'admin1CodesASCII.txt');
  const overridesFile = args.overridesFile ?? path.join(args.dir, 'overrides.json');

  const missing = [placesFile, adminFile, overridesFile].filter(f => !fs.existsSync(f));
  if (missing.length) {
    console.error(`Missing file(s):\n  ${missing.join('\n  ')}\nSee the download steps at the top of prisma/import-locations.ts.`);
    process.exit(1);
  }

  const admin1 = parseAdmin1(fs.readFileSync(adminFile, 'utf8'), args.country);
  if (admin1.size === 0) {
    console.error(`No ${args.country}.* entries found in admin1CodesASCII.txt`);
    process.exit(1);
  }
  if (args.country === 'ZA' && admin1.size !== 9) {
    console.error(`South Africa has 9 provinces but admin1CodesASCII.txt lists ${admin1.size} for ZA — check the file.`);
    process.exit(1);
  }
  const curation = parseCuration(fs.readFileSync(overridesFile, 'utf8'));

  console.log(`Reading ${placesFile} ...`);
  const places = await loadPlaces(placesFile);

  let hierarchy = new Map<number, number[]>();
  let hierarchyNote = 'hierarchy.txt not used';
  const hierarchyFile = args.hierarchyFile ?? path.join(args.dir, 'hierarchy.txt');
  if (!args.useHierarchy) {
    hierarchyNote = 'hierarchy.txt disabled (--no-hierarchy)';
  } else if (fs.existsSync(hierarchyFile)) {
    console.log(`Reading ${hierarchyFile} (streaming) ...`);
    hierarchy = await loadHierarchy(hierarchyFile, new Set(places.map(p => p.geonameId)));
    hierarchyNote = 'hierarchy.txt used, nearest-town fallback';
  } else if (args.hierarchyFile) {
    console.error(`Hierarchy file not found: ${hierarchyFile}`);
    process.exit(1);
  } else {
    hierarchyNote = 'hierarchy.txt not found, nearest-town matching only';
  }

  const options = { minTownPopulation: args.minTownPopulation, maxSuburbKm: args.maxSuburbKm };
  const plan = buildImportPlan(places, admin1, options, hierarchy, curation);

  printReport(plan, curation, hierarchyNote);

  if (args.reportFile) {
    writeReport(args.reportFile, plan, curation, {
      options: { ...DEFAULT_OPTIONS, ...options },
      hierarchy: hierarchyNote,
      overrides: path.basename(overridesFile),
    });
    console.log(`\nFull review report written to ${args.reportFile}`);
  }

  if (args.dryRun) {
    console.log('\nDry run — nothing written.');
    return;
  }
  if (plan.blocking.length) {
    console.error(`\nRefusing to import: ${plan.blocking.length} blocking issue(s) listed above.`);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const s = await persistPlan(prisma, plan);
    console.log('\nWritten to database');
    console.log('───────────────────');
    console.log(`Provinces upserted: ${s.provincesUpserted}`);
    console.log(`Towns:    ${s.townsCreated} created, ${s.townsUpdated} updated, ${s.townsUnchanged} unchanged, ${s.townsFailed} failed`);
    console.log(`Suburbs:  ${s.suburbsCreated} created, ${s.suburbsUpdated} updated, ${s.suburbsUnchanged} unchanged, ${s.suburbsFailed} failed`);
    if (s.errors.length) console.log(`First errors:\n  ${s.errors.join('\n  ')}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
