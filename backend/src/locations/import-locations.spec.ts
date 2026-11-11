import * as fs from 'fs';
import * as path from 'path';
import { persistPlan } from '../../prisma/import-locations';
import { buildImportPlan, parseAdmin1, parseCuration, parsePlaceLine, parseHierarchyLine, GeonamesPlace, ImportPlan, EMPTY_CURATION } from './geonames';

// ── In-memory stand-in for the three Prisma models persistPlan touches ──
// Enforces the same unique constraints as prisma/schema.prisma:
//   Province.name, Province.geonamesCode; Town.geonameId, Town(provinceId, name); Suburb.geonameId, Suburb(townId, name)
type Row = Record<string, any> & { id: string };

function fakePrisma() {
  let seq = 0;
  const newId = (p: string) => `${p}${++seq}`;
  const tables = { province: [] as Row[], town: [] as Row[], suburb: [] as Row[] };
  const uniques: Record<keyof typeof tables, string[][]> = {
    province: [['name'], ['geonamesCode']],
    town: [['geonameId'], ['provinceId', 'name']],
    suburb: [['geonameId'], ['townId', 'name']],
  };
  const clash = (table: keyof typeof tables, data: Row, ignoreId?: string) =>
    uniques[table].some(cols => tables[table].some(r => r.id !== ignoreId && cols.every(c => data[c] != null && r[c] === data[c])));
  const pick = (r: Row, select?: Record<string, boolean>) =>
    select ? Object.fromEntries(Object.keys(select).map(k => [k, r[k]])) : { ...r };

  const model = (table: keyof typeof tables, prefix: string) => ({
    findMany: async ({ select }: any = {}) => tables[table].map(r => pick(r, select)),
    update: async ({ where, data }: any) => {
      const row = tables[table].find(r => r.id === where.id);
      if (!row) throw new Error(`${table} ${where.id} not found`);
      const next = { ...row, ...data };
      if (clash(table, next, row.id)) throw new Error(`Unique constraint failed on ${table}`);
      Object.assign(row, data);
      return { ...row };
    },
    createMany: async ({ data, skipDuplicates }: any) => {
      let count = 0;
      for (const d of data) {
        const row = { id: newId(prefix), ...d };
        if (clash(table, row)) {
          if (skipDuplicates) continue;
          throw new Error(`Unique constraint failed on ${table}`);
        }
        tables[table].push(row);
        count++;
      }
      return { count };
    },
  });

  return {
    tables,
    province: {
      ...model('province', 'p'),
      upsert: async ({ where, update, create }: any) => {
        const row = tables.province.find(r => r.geonamesCode === where.geonamesCode);
        if (row) { Object.assign(row, update); return { ...row }; }
        const created = { id: newId('p'), ...create };
        tables.province.push(created);
        return { ...created };
      },
    },
    town: model('town', 't'),
    suburb: model('suburb', 's'),
  };
}

// ── Small fixture plan ──
const ADMIN1 = parseAdmin1('ZA.03\tGauteng\tGauteng\t1\nZA.09\tWestern Cape\tWestern Cape\t2');
const P = (p: Partial<GeonamesPlace> & Pick<GeonamesPlace, 'geonameId' | 'name' | 'lat' | 'lng'>): GeonamesPlace =>
  ({ featureClass: 'P', featureCode: 'PPL', countryCode: 'ZA', admin1: '03', admin2: 'DC42', population: 0, ...p });
const places = [
  P({ geonameId: 1, name: 'Vereeniging', lat: -26.67, lng: 27.93, featureCode: 'PPLA3', population: 475_000 }),
  P({ geonameId: 2, name: 'Three Rivers', lat: -26.66, lng: 27.97, featureCode: 'PPLX' }),
  P({ geonameId: 3, name: 'Worcester', lat: -33.64, lng: 19.44, admin1: '09', admin2: 'DC2', population: 128_000 }),
  P({ geonameId: 4, name: 'Avian Park', lat: -33.62, lng: 19.45, admin1: '09', admin2: 'DC2', featureCode: 'PPLX' }),
];

const summaryCounts = (s: Awaited<ReturnType<typeof persistPlan>>) => ({
  townsCreated: s.townsCreated, townsUpdated: s.townsUpdated, townsUnchanged: s.townsUnchanged, townsFailed: s.townsFailed,
  suburbsCreated: s.suburbsCreated, suburbsUpdated: s.suburbsUpdated, suburbsUnchanged: s.suburbsUnchanged, suburbsFailed: s.suburbsFailed,
});

describe('persistPlan — idempotent import', () => {
  const plan = buildImportPlan(places, ADMIN1);

  it('creates provinces, towns and suburbs on the first run', async () => {
    const db = fakePrisma();
    const s = await persistPlan(db, plan);
    expect(s.provincesUpserted).toBe(2);
    expect(summaryCounts(s)).toMatchObject({ townsCreated: 2, suburbsCreated: 2, townsFailed: 0, suburbsFailed: 0 });
    expect(s.errors).toEqual([]);
  });

  it('changes nothing when re-run with the same plan', async () => {
    const db = fakePrisma();
    await persistPlan(db, plan);
    const before = JSON.stringify(db.tables);
    const again = await persistPlan(db, plan);
    expect(summaryCounts(again)).toEqual({
      townsCreated: 0, townsUpdated: 0, townsUnchanged: 2, townsFailed: 0,
      suburbsCreated: 0, suburbsUpdated: 0, suburbsUnchanged: 2, suburbsFailed: 0,
    });
    expect(JSON.stringify(db.tables)).toBe(before);
  });

  it('updates a renamed town in place, keeping its id so existing references stay valid', async () => {
    const db = fakePrisma();
    await persistPlan(db, plan);
    const id = db.tables.town.find(t => t.geonameId === 1)!.id;
    const renamed = buildImportPlan(places, ADMIN1, {}, new Map(), {
      ...EMPTY_CURATION, rename: [{ geonameId: 1, name: 'Vereeniging', to: 'Vereeniging Central', reason: 'r' }],
    });
    const s = await persistPlan(db, renamed);
    expect(s.townsUpdated).toBe(1);
    expect(s.townsCreated).toBe(0);
    expect(db.tables.town.find(t => t.geonameId === 1)).toMatchObject({ id, name: 'Vereeniging Central' });
  });

  it('never deletes rows that a later plan no longer contains', async () => {
    const db = fakePrisma();
    await persistPlan(db, plan);
    const smaller = buildImportPlan(places.filter(p => p.geonameId !== 2), ADMIN1);
    await persistPlan(db, smaller);
    expect(db.tables.suburb.map(s => s.name).sort()).toEqual(['Avian Park', 'Three Rivers']);
  });
});

// ── The real curated dataset satisfies the database's unique constraints and re-imports as a no-op ──
const DATA_DIR = path.join(__dirname, '..', '..', 'prisma', 'data', 'geonames');
const haveData = ['ZA.txt', 'admin1CodesASCII.txt', 'overrides.json'].every(f => fs.existsSync(path.join(DATA_DIR, f)));

(haveData ? describe : describe.skip)('persistPlan — the real curated dataset', () => {
  let real: ImportPlan;
  beforeAll(() => {
    const admin1 = parseAdmin1(fs.readFileSync(path.join(DATA_DIR, 'admin1CodesASCII.txt'), 'utf8'));
    const all = fs.readFileSync(path.join(DATA_DIR, 'ZA.txt'), 'utf8').split(/\r?\n/).map(parsePlaceLine).filter((p): p is GeonamesPlace => !!p && p.featureClass === 'P');
    const ids = new Set(all.map(p => p.geonameId));
    const hierarchy = new Map<number, number[]>();
    const hFile = path.join(DATA_DIR, 'hierarchy.txt');
    if (fs.existsSync(hFile)) {
      for (const line of fs.readFileSync(hFile, 'utf8').split(/\r?\n/)) {
        const e = parseHierarchyLine(line);
        if (!e || e.type.toUpperCase() === 'ADM' || !ids.has(e.childId)) continue;
        const l = hierarchy.get(e.childId);
        if (l) { if (!l.includes(e.parentId)) l.push(e.parentId); } else hierarchy.set(e.childId, [e.parentId]);
      }
    }
    real = buildImportPlan(all, admin1, {}, hierarchy, parseCuration(fs.readFileSync(path.join(DATA_DIR, 'overrides.json'), 'utf8')));
  }, 120_000);

  it('imports every planned row without a unique-constraint failure, then re-imports as a no-op', async () => {
    const db = fakePrisma();
    const first = await persistPlan(db, real);
    expect(first.errors).toEqual([]);
    expect(first.provincesUpserted).toBe(9);
    expect(summaryCounts(first)).toMatchObject({ townsCreated: real.towns.length, townsFailed: 0, suburbsCreated: real.suburbs.length, suburbsFailed: 0 });

    const second = await persistPlan(db, real);
    expect(summaryCounts(second)).toEqual({
      townsCreated: 0, townsUpdated: 0, townsUnchanged: real.towns.length, townsFailed: 0,
      suburbsCreated: 0, suburbsUpdated: 0, suburbsUnchanged: real.suburbs.length, suburbsFailed: 0,
    });
    expect(db.tables.province).toHaveLength(9);
  }, 60_000);
});
