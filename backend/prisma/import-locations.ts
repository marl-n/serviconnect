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
 * 3. Import:
 *      npm run import:locations
 *
 * Options:
 *   --dir <folder>             where ZA.txt + admin1CodesASCII.txt live (default prisma/data/geonames)
 *   --min-population <n>       skip towns below this population (default 0 = keep all)
 *   --max-suburb-km <n>        max distance from a suburb to its parent town (default 40)
 *   --parent-min-population <n> non-seat towns at/above this population can parent suburbs (default 5000)
 *   --hierarchy <file>         hierarchy.txt to use (default <dir>/hierarchy.txt if present)
 *   --no-hierarchy             ignore hierarchy.txt even if present (nearest-town matching only)
 *   --report <file>            write the full review report (stats + every flagged record) as JSON
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
  normName,
  DEFAULT_OPTIONS,
  GeonamesPlace,
  ImportPlan,
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
  parentMinPopulation: number;
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
    parentMinPopulation: DEFAULT_OPTIONS.parentMinPopulation,
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
    else if (a === '--parent-min-population') args.parentMinPopulation = Number(next());
    else if (a === '--hierarchy') args.hierarchyFile = path.resolve(next());
    else if (a === '--no-hierarchy') args.useHierarchy = false;
    else if (a === '--report') args.reportFile = path.resolve(next());
    else throw new Error(`Unknown option: ${a}`);
  }
  for (const [k, v] of Object.entries({
    minTownPopulation: args.minTownPopulation,
    maxSuburbKm: args.maxSuburbKm,
    parentMinPopulation: args.parentMinPopulation,
  })) {
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
 * Streams hierarchy.txt (global — millions of rows) keeping only non-ADM edges whose
 * child is one of the wanted suburb ids. ADM rows describe the admin tree, not suburbs.
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

function printReport(plan: ImportPlan, hierarchyNote: string) {
  const st = plan.stats;
  const n = (v: number) => v.toLocaleString('en-ZA');
  const pct = (v: number, of: number) => (of ? ` (${((v / of) * 100).toFixed(1)}%)` : '');
  console.log('\nImport plan');
  console.log('═══════════');
  console.log(`Provinces: ${plan.provinces.length}`);
  console.log('\nTowns per province');
  const width = Math.max(...Object.keys(st.townsPerProvince).map(k => k.length), 8);
  for (const [name, count] of Object.entries(st.townsPerProvince).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${name.padEnd(width)}  ${n(count).padStart(7)}`);
  }
  console.log(`  ${'TOTAL'.padEnd(width)}  ${n(st.towns).padStart(7)}`);
  console.log(`  candidates ${n(st.townCandidates)} → merged duplicates ${n(st.duplicateTownsDropped)}, below min population ${n(st.townsBelowMinPopulation)}, no province match ${n(st.skippedNoProvince)}`);
  const ignored = Object.entries(st.ignoredByFeatureCode).sort((a, b) => b[1] - a[1]);
  if (ignored.length) console.log(`  ignored populated-place codes: ${ignored.map(([c, k]) => `${c}=${n(k)}`).join(', ')}`);

  console.log(`\nSuburbs: ${n(st.suburbs)} imported (from ${n(st.suburbCandidates)} PPLX candidates)`);
  console.log(`  ${hierarchyNote}`);
  console.log('  parent source:');
  console.log(`    explicit hierarchy edge       ${n(st.suburbsAssignedExplicit).padStart(7)}${pct(st.suburbsAssignedExplicit, st.suburbCandidates)}`);
  console.log(`    nearest, same district        ${n(st.suburbsAssignedSameDistrict).padStart(7)}${pct(st.suburbsAssignedSameDistrict, st.suburbCandidates)}`);
  console.log(`    nearest, province-wide (weak) ${n(st.suburbsAssignedProvinceWide).padStart(7)}${pct(st.suburbsAssignedProvinceWide, st.suburbCandidates)}`);
  console.log(`    unassigned (not imported)     ${n(st.suburbsUnassigned).padStart(7)}${pct(st.suburbsUnassigned, st.suburbCandidates)}`);
  console.log(`  suburbs with a non-ADM hierarchy edge: ${n(st.suburbsWithHierarchyEdge)}; ambiguous (several parents): ${n(st.suburbsExplicitAmbiguous)}; rejected (wrong province): ${n(st.suburbsExplicitRejected)}`);
  console.log(`  WITHOUT a reliable parent (weak + unassigned): ${n(st.suburbsWithoutReliableParent)}${pct(st.suburbsWithoutReliableParent, st.suburbCandidates)}`);
  if (st.suburbDistanceKm) {
    console.log(`  distance to parent: median ${st.suburbDistanceKm.median} km, p90 ${st.suburbDistanceKm.p90} km, max ${st.suburbDistanceKm.max} km`);
  }
  console.log(`  dropped: same name as parent town ${n(st.suburbsSameNameAsTown)}, duplicate names ${n(st.duplicateSuburbsDropped)}`);
  console.log(`\nTowns with no suburbs: ${n(st.townsWithoutSuburbs)} of ${n(st.towns)}${pct(st.townsWithoutSuburbs, st.towns)}`);

  console.log('\nFlagged for review (full list via --report)');
  const byKind = new Map<string, ImportPlan['suspicious']>();
  for (const r of plan.suspicious) byKind.set(r.kind, [...(byKind.get(r.kind) ?? []), r]);
  if (byKind.size === 0) console.log('  none');
  for (const [kind, list] of [...byKind.entries()].sort()) {
    console.log(`  ${kind}: ${n(list.length)}`);
    for (const r of list.slice(0, 5)) console.log(`      - ${r.name} [${r.geonameId}] ${r.detail}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const placesFile = path.join(args.dir, `${args.country}.txt`);
  const adminFile = path.join(args.dir, 'admin1CodesASCII.txt');

  const missing = [placesFile, adminFile].filter(f => !fs.existsSync(f));
  if (missing.length) {
    console.error(`Missing GeoNames file(s):\n  ${missing.join('\n  ')}\nSee the download steps at the top of prisma/import-locations.ts.`);
    process.exit(1);
  }

  const admin1 = parseAdmin1(fs.readFileSync(adminFile, 'utf8'), args.country);
  if (admin1.size === 0) {
    console.error(`No ${args.country}.* entries found in admin1CodesASCII.txt`);
    process.exit(1);
  }
  if (args.country === 'ZA' && admin1.size !== 9) {
    console.warn(`WARNING: South Africa has 9 provinces but admin1CodesASCII.txt lists ${admin1.size} for ZA — check the file.`);
  }

  console.log(`Reading ${placesFile} ...`);
  const places = await loadPlaces(placesFile);

  let hierarchy = new Map<number, number[]>();
  let hierarchyNote = 'hierarchy.txt: not used — nearest-town matching only';
  const hierarchyFile = args.hierarchyFile ?? path.join(args.dir, 'hierarchy.txt');
  if (!args.useHierarchy) {
    hierarchyNote = 'hierarchy.txt: disabled (--no-hierarchy) — nearest-town matching only';
  } else if (fs.existsSync(hierarchyFile)) {
    console.log(`Reading ${hierarchyFile} (streaming) ...`);
    const wanted = new Set(places.filter(p => p.featureCode === 'PPLX').map(p => p.geonameId));
    hierarchy = await loadHierarchy(hierarchyFile, wanted);
    hierarchyNote = `hierarchy.txt: used (${hierarchyFile}) — nearest-town matching is the fallback`;
  } else if (args.hierarchyFile) {
    console.error(`Hierarchy file not found: ${hierarchyFile}`);
    process.exit(1);
  } else {
    hierarchyNote = 'hierarchy.txt: not found in the data folder — nearest-town matching only';
  }

  const plan = buildImportPlan(
    places,
    admin1,
    {
      minTownPopulation: args.minTownPopulation,
      maxSuburbKm: args.maxSuburbKm,
      parentMinPopulation: args.parentMinPopulation,
    },
    hierarchy,
  );

  printReport(plan, hierarchyNote);

  if (args.reportFile) {
    const provinceName = new Map(plan.provinces.map(p => [p.geonamesCode, p.name]));
    const withSuburbs = new Set(plan.suburbs.map(x => x.townGeonameId));
    fs.mkdirSync(path.dirname(args.reportFile), { recursive: true });
    fs.writeFileSync(
      args.reportFile,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          options: { minTownPopulation: args.minTownPopulation, maxSuburbKm: args.maxSuburbKm, parentMinPopulation: args.parentMinPopulation, hierarchy: hierarchyNote },
          stats: plan.stats,
          townsWithoutSuburbs: plan.towns
            .filter(t => !withSuburbs.has(t.geonameId))
            .map(t => `${t.name} (${provinceName.get(t.provinceCode)})`)
            .sort(),
          flagged: plan.suspicious,
        },
        null,
        2,
      ),
    );
    console.log(`\nFull review report written to ${args.reportFile}`);
  }

  if (args.dryRun) {
    console.log('\nDry run — nothing written.');
    return;
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
