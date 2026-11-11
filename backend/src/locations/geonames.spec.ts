import * as fs from 'fs';
import * as path from 'path';
import {
  buildImportPlan,
  parseAdmin1,
  parsePlaceLine,
  parseCuration,
  normName,
  haversineKm,
  parseHierarchyLine,
  Curation,
  EMPTY_CURATION,
  GeonamesPlace,
  ImportPlan,
} from './geonames';

// ── Fixture ─────────────────────────────────────────────────────────────
// Real South African place names with approximate coordinates, but SYNTHETIC
// geonameIds and admin codes — this exercises the logic, it is not a copy of
// GeoNames data. Distances in comments are from Johannesburg (id 1).
const ADMIN1_TXT = [
  'ZA.03\tGauteng\tGauteng\t1000001',
  'ZA.09\tWestern Cape\tWestern Cape\t1000002',
  'NA.01\tKhomas\tKhomas\t2000001', // another country — must be ignored
].join('\n');
const ADMIN1 = parseAdmin1(ADMIN1_TXT);

function place(p: Partial<GeonamesPlace> & Pick<GeonamesPlace, 'geonameId' | 'name' | 'lat' | 'lng'>): GeonamesPlace {
  return { featureClass: 'P', featureCode: 'PPL', countryCode: 'ZA', admin1: '03', admin2: '', population: 0, ...p };
}

const JHB = place({ geonameId: 1, name: 'Johannesburg', lat: -26.2023, lng: 28.0436, featureCode: 'PPLA', admin2: 'JHB', population: 9_000_000 });
const ROSEBANK = place({ geonameId: 2, name: 'Rosebank', lat: -26.1483, lng: 28.0436, admin2: 'JHB', population: 20_000 }); // 6 km, not a seat
const SEAT_NEAR = place({ geonameId: 3, name: 'Old Seat', lat: -26.1303, lng: 28.0436, featureCode: 'PPLA3', admin2: 'JHB', population: 50_000 }); // 8 km, a seat
const RANDBURG = place({ geonameId: 4, name: 'Randburg', lat: -26.0852, lng: 28.0436, admin2: 'JHB', population: 337_000 }); // 13 km
const FAR_TOWN = place({ geonameId: 5, name: 'Farside', lat: -25.8420, lng: 28.0436, admin2: 'JHB', population: 50_000 }); // 40 km
const NEIGHBOURHOOD = place({ geonameId: 6, name: 'Southdale', lat: -26.3555, lng: 28.0436, admin2: 'JHB' }); // 17 km, pop 0
const BENONI = place({ geonameId: 20, name: 'Benoni', lat: -26.1885, lng: 28.3208, admin2: 'EKU', population: 600_000 });
const BOKSBURG = place({ geonameId: 21, name: 'Boksburg', lat: -26.2120, lng: 28.2596, admin2: 'EKU', population: 445_000 });
const DAVEYTON = place({ geonameId: 22, name: 'Daveyton', lat: -26.1382, lng: 28.4249, admin2: 'EKU' }); // pop 0, nearest Benoni
const SPRINGS = place({ geonameId: 23, name: 'Springs', lat: -26.25, lng: 28.40, featureCode: 'PPLX', admin2: 'EKU', population: 186_000 });
const WORCESTER = place({ geonameId: 40, name: 'Worcester', lat: -33.64, lng: 19.44, admin1: '09', admin2: 'DC2', population: 6000 });
const JUST_UNDER = place({ geonameId: 41, name: 'Rawsonville', lat: -33.69, lng: 19.31, admin1: '09', admin2: 'DC2', population: 4999 });
const SEAT_ZERO = place({ geonameId: 42, name: 'Touws River', lat: -33.34, lng: 20.03, featureCode: 'PPLA3', admin1: '09', admin2: 'DC2' });
const VILLAGE = place({ geonameId: 43, name: 'Pampoenkraal', lat: -33.50, lng: 19.60, admin1: '09', admin2: 'DC2', population: 100 });
const NUMBERED = place({ geonameId: 44, name: 'Alpha (1)', lat: -33.30, lng: 19.20, admin1: '09', admin2: 'DC2', population: 9000 });
const OFFSHORE = place({ geonameId: 45, name: 'Marion Base', lat: -46.9, lng: 37.7, admin1: '09', admin2: 'DC2', population: 9000 });
const RIVERSIDE = place({ geonameId: 46, name: 'Riverside', lat: -33.595, lng: 19.44, featureCode: 'PPLX', admin1: '09', admin2: 'DC2' }); // 5 km from Worcester
const FAR_SUBURB = place({ geonameId: 47, name: 'Far Away', lat: -33.46, lng: 19.44, featureCode: 'PPLX', admin1: '09', admin2: 'DC2' }); // 20 km

function baseData(): GeonamesPlace[] {
  return [
    JHB, ROSEBANK, SEAT_NEAR, RANDBURG, FAR_TOWN, NEIGHBOURHOOD,
    BENONI, BOKSBURG, DAVEYTON, SPRINGS,
    WORCESTER, JUST_UNDER, SEAT_ZERO, VILLAGE, NUMBERED, OFFSHORE, RIVERSIDE, FAR_SUBURB,
  ];
}

function curation(over: Partial<Curation> = {}): Curation {
  return {
    ...EMPTY_CURATION,
    metros: { JHB: { geonameId: 1, name: 'Johannesburg' } },
    urbanDistricts: ['EKU'],
    ...over,
  };
}

const townNames = (plan: ImportPlan) => plan.towns.map(t => t.name).sort();
const parentOf = (plan: ImportPlan, suburb: string) => {
  const s = plan.suburbs.find(x => x.name === suburb);
  return s ? plan.towns.find(t => t.geonameId === s.townGeonameId)?.name : undefined;
};
const flagged = (plan: ImportPlan, kind: string) => plan.suspicious.filter(r => r.kind === kind).map(r => r.name);

// ── Parsing ─────────────────────────────────────────────────────────────

describe('normName', () => {
  it('ignores case, accents and repeated whitespace', () => {
    expect(normName('  Sébastopol ')).toBe(normName('sebastopol'));
    expect(normName('Port   Elizabeth')).toBe('port elizabeth');
  });
});

describe('parseAdmin1', () => {
  it('keeps only the requested country and takes names from the file', () => {
    expect([...ADMIN1.entries()]).toEqual([
      ['ZA.03', 'Gauteng'],
      ['ZA.09', 'Western Cape'],
    ]);
  });

  it('tolerates CRLF line endings and blank lines', () => {
    const m = parseAdmin1('ZA.03\tGauteng\tGauteng\t1\r\n\r\n', 'ZA');
    expect(m.get('ZA.03')).toBe('Gauteng');
  });
});

describe('parsePlaceLine', () => {
  const cols = (over: Record<number, string> = {}) => {
    const base = ['993800', 'Johannesburg', 'Johannesburg', '', '-26.20227', '28.04363', 'P', 'PPLA', 'ZA', '', '03', 'JHB', '', '', '957441', '', '1753', 'Africa/Johannesburg', '2023-01-01'];
    Object.entries(over).forEach(([i, v]) => (base[Number(i)] = v));
    return base.join('\t');
  };

  it('parses a full 19-column GeoNames row', () => {
    expect(parsePlaceLine(cols())).toEqual({
      geonameId: 993800, name: 'Johannesburg', lat: -26.20227, lng: 28.04363,
      featureClass: 'P', featureCode: 'PPLA', countryCode: 'ZA', admin1: '03', admin2: 'JHB', population: 957441,
    });
  });

  it('treats a blank population as 0', () => {
    expect(parsePlaceLine(cols({ 14: '' }))?.population).toBe(0);
  });

  it('rejects malformed, short, comment and non-numeric rows', () => {
    expect(parsePlaceLine('')).toBeNull();
    expect(parsePlaceLine('# comment')).toBeNull();
    expect(parsePlaceLine('1\tonly\tthree')).toBeNull();
    expect(parsePlaceLine(cols({ 4: 'abc' }))).toBeNull();
    expect(parsePlaceLine(cols({ 0: 'xyz' }))).toBeNull();
    expect(parsePlaceLine(cols({ 1: '   ' }))).toBeNull();
  });
});

describe('parseHierarchyLine', () => {
  it('parses parentId, childId and type', () => {
    expect(parseHierarchyLine('1\t2\tADM')).toEqual({ parentId: 1, childId: 2, type: 'ADM' });
  });

  it('accepts rows with no type column and rejects malformed rows', () => {
    expect(parseHierarchyLine('1\t2')).toEqual({ parentId: 1, childId: 2, type: '' });
    expect(parseHierarchyLine('')).toBeNull();
    expect(parseHierarchyLine('x\t2')).toBeNull();
  });
});

describe('haversineKm', () => {
  it('is ~0 for identical points and ~1,260 km Johannesburg–Cape Town', () => {
    expect(haversineKm(-26.2, 28.0, -26.2, 28.0)).toBeCloseTo(0, 5);
    const km = haversineKm(JHB.lat, JHB.lng, -33.9258, 18.4232);
    expect(km).toBeGreaterThan(1200);
    expect(km).toBeLessThan(1320);
  });
});

describe('parseCuration', () => {
  it('reads every list and defaults missing ones to empty', () => {
    const c = parseCuration(JSON.stringify({ metros: { JHB: { geonameId: 1, name: 'Johannesburg' } }, towns: [{ geonameId: 2, name: 'X' }] }));
    expect(c.metros.JHB.geonameId).toBe(1);
    expect(c.towns).toHaveLength(1);
    expect(c.suburbs).toEqual([]);
    expect(c.exclude).toEqual([]);
    expect(c.rename).toEqual([]);
    expect(c.urbanDistricts).toEqual([]);
  });

  it('rejects entries without an integer geonameId and name, suburbs without a parent, renames without a target', () => {
    expect(() => parseCuration('{"towns":[{"name":"X"}]}')).toThrow(/geonameId/);
    expect(() => parseCuration('{"towns":[{"geonameId":"1","name":"X"}]}')).toThrow(/geonameId/);
    expect(() => parseCuration('{"suburbs":[{"geonameId":1,"name":"X"}]}')).toThrow(/parentGeonameId/);
    expect(() => parseCuration('{"rename":[{"geonameId":1,"name":"X"}]}')).toThrow(/"to"/);
    expect(() => parseCuration('{"metros":{"JHB":{"name":"X"}}}')).toThrow(/metros\.JHB/);
  });
});

// ── Towns ───────────────────────────────────────────────────────────────

describe('buildImportPlan — which places become towns', () => {
  const plan = buildImportPlan(baseData(), ADMIN1, {}, new Map(), curation());

  it('keeps municipal seats regardless of population', () => {
    expect(plan.towns.find(t => t.name === 'Touws River')?.source).toBe('seat');
    expect(flagged(plan, 'zero-population-town')).toContain('Touws River');
  });

  it('keeps generic places at or above 5,000 people and excludes those below', () => {
    expect(plan.towns.find(t => t.name === 'Worcester')?.source).toBe('population');
    expect(townNames(plan)).not.toContain('Rawsonville'); // 4,999
    expect(townNames(plan)).not.toContain('Pampoenkraal');
    expect(plan.stats.excludedByReason['below-threshold']).toBe(2);
  });

  it('excludes numbered farm duplicates and places outside South Africa even above the threshold', () => {
    expect(townNames(plan)).not.toContain('Alpha (1)');
    expect(townNames(plan)).not.toContain('Marion Base');
    expect(plan.stats.excludedByReason['numbered-duplicate-name']).toBe(1);
    expect(plan.stats.excludedByReason['outside-south-africa']).toBe(1);
  });

  it('honours a custom population threshold', () => {
    const low = buildImportPlan(baseData(), ADMIN1, { minTownPopulation: 4000 }, new Map(), curation());
    expect(townNames(low)).toContain('Rawsonville');
  });

  it('never imports a suburb point (PPLX) as a town unless overridden', () => {
    expect(townNames(plan)).not.toContain('Springs');
    expect(townNames(plan)).not.toContain('Riverside');
  });

  it('counts towns per province, with every province present', () => {
    // Gauteng: Johannesburg, Old Seat, Randburg, Farside, Benoni, Boksburg. Western Cape: Worcester, Touws River.
    expect(plan.stats.townsPerProvince).toEqual({ Gauteng: 6, 'Western Cape': 2 });
    expect(Object.values(plan.stats.townsPerProvince).reduce((a, b) => a + b, 0)).toBe(plan.stats.towns);
  });
});

describe('buildImportPlan — metros', () => {
  const plan = buildImportPlan(baseData(), ADMIN1, {}, new Map(), curation());

  it('makes the metro city a selectable town', () => {
    expect(plan.towns.find(t => t.name === 'Johannesburg')?.source).toBe('metro-city');
  });

  it('absorbs a qualifying non-seat place within 10 km into the metro city as a suburb', () => {
    expect(townNames(plan)).not.toContain('Rosebank');
    expect(parentOf(plan, 'Rosebank')).toBe('Johannesburg');
    expect(plan.metroAbsorbed).toEqual([expect.objectContaining({ name: 'Rosebank', city: 'Johannesburg', how: 'auto' })]);
  });

  it('never absorbs a municipal seat for being close — it stays a town and is flagged for review', () => {
    expect(townNames(plan)).toContain('Old Seat');
    expect(flagged(plan, 'metro-review')).toContain('Old Seat');
  });

  it('keeps qualifying places 10–30 km from the city as towns, flagged for a manual decision', () => {
    expect(townNames(plan)).toContain('Randburg');
    expect(flagged(plan, 'metro-review')).toContain('Randburg');
  });

  it('keeps qualifying places beyond 30 km as towns without a review flag', () => {
    expect(townNames(plan)).toContain('Farside');
    expect(flagged(plan, 'metro-review')).not.toContain('Farside');
  });

  it('turns small metro places into suburbs of the nearest town in the metro, with no radius cap', () => {
    expect(parentOf(plan, 'Southdale')).toBe('Johannesburg'); // 17 km — beyond the 15 km cap used elsewhere
  });

  it('keeps Ekurhuleni-style urban districts as several towns, attaching small places to the nearest one', () => {
    expect(townNames(plan)).toEqual(expect.arrayContaining(['Benoni', 'Boksburg']));
    expect(parentOf(plan, 'Daveyton')).toBe('Benoni');
  });

  it('honours custom auto-absorb and review distances', () => {
    const wide = buildImportPlan(baseData(), ADMIN1, { metroAutoAbsorbKm: 15, metroReviewKm: 45 }, new Map(), curation());
    expect(parentOf(wide, 'Randburg')).toBe('Johannesburg');
    expect(flagged(wide, 'metro-review')).toContain('Farside');
  });
});

describe('buildImportPlan — overrides are the final authority', () => {
  const c = curation({
    towns: [{ geonameId: 23, name: 'Springs' }, { geonameId: 41, name: 'Rawsonville' }],
    suburbs: [
      { geonameId: 4, name: 'Randburg', parentGeonameId: 1, parentName: 'Johannesburg' },
      { geonameId: 5, name: 'Farside', parentGeonameId: 4, parentName: 'Randburg' }, // parent is itself absorbed
    ],
    exclude: [{ geonameId: 42, name: 'Touws River' }],
    rename: [{ geonameId: 40, name: 'Worcester', to: 'Worcester Central' }],
  });
  const plan = buildImportPlan(baseData(), ADMIN1, {}, new Map(), c);

  it('promotes a place to a town (even a PPLX or one below the threshold)', () => {
    expect(plan.towns.find(t => t.name === 'Springs')?.source).toBe('override');
    expect(plan.towns.find(t => t.name === 'Rawsonville')?.source).toBe('override');
  });

  it('makes a place a suburb of the named town, following a parent that was itself absorbed', () => {
    expect(townNames(plan)).not.toContain('Randburg');
    expect(parentOf(plan, 'Randburg')).toBe('Johannesburg');
    expect(parentOf(plan, 'Farside')).toBe('Johannesburg');
    expect(plan.suburbs.find(s => s.name === 'Randburg')?.source).toBe('override');
    expect(plan.metroAbsorbed.map(m => m.name)).toEqual(expect.arrayContaining(['Randburg', 'Farside']));
    expect(flagged(plan, 'metro-review')).not.toContain('Randburg'); // decided, so no longer flagged
  });

  it('excludes and renames', () => {
    expect(townNames(plan)).not.toContain('Touws River');
    expect(plan.stats.excludedByReason.override).toBe(1);
    expect(townNames(plan)).toContain('Worcester Central');
    expect(parentOf(plan, 'Riverside')).toBe('Worcester Central');
  });

  it('has no blocking issues when every override is valid', () => {
    expect(plan.blocking).toEqual([]);
  });

  it('blocks an unknown id, a name that does not match GeoNames, an id in two lists, and a parent that is not a town', () => {
    const bad = buildImportPlan(baseData(), ADMIN1, {}, new Map(), curation({
      towns: [{ geonameId: 999, name: 'Nowhere' }, { geonameId: 40, name: 'Wooster' }, { geonameId: 43, name: 'Pampoenkraal' }],
      exclude: [{ geonameId: 43, name: 'Pampoenkraal' }],
      suburbs: [{ geonameId: 46, name: 'Riverside', parentGeonameId: 41, parentName: 'Rawsonville' }], // Rawsonville is excluded (below threshold)
    }));
    const text = bad.blocking.join('\n');
    expect(text).toMatch(/999 \("Nowhere"\) is not a populated place/);
    expect(text).toMatch(/40 is "Worcester" in GeoNames, not "Wooster"/);
    expect(text).toMatch(/43 \("Pampoenkraal"\) appears in both towns and exclude/);
    expect(text).toMatch(/parent 41 of "Riverside" .* is not an imported town/);
  });
});

describe('buildImportPlan — same-named towns', () => {
  it('merges same-named towns in one province only when they are within 10 km', () => {
    const plan = buildImportPlan(
      [
        place({ geonameId: 500, name: 'Heidelberg', lat: -26.50, lng: 28.35, population: 9000, admin2: 'DC42' }),
        place({ geonameId: 501, name: 'Heidelberg', lat: -26.52, lng: 28.36, featureCode: 'PPLA3', population: 8000, admin2: 'DC42' }), // 2.4 km
        WORCESTER,
      ],
      ADMIN1,
    );
    expect(plan.towns.filter(t => t.name === 'Heidelberg').map(t => t.geonameId)).toEqual([501]); // the seat wins
    expect(plan.stats.duplicateTownsMerged).toBe(1);
    expect(plan.blocking).toEqual([]);
  });

  it('keeps same-named towns that are far apart and blocks until one is renamed', () => {
    const data = [
      place({ geonameId: 600, name: 'Mogwase', lat: -25.18, lng: 27.27, population: 12000 }),
      place({ geonameId: 601, name: 'Mogwase', lat: -26.50, lng: 28.80, population: 6000 }), // ~190 km
      WORCESTER,
    ];
    const plan = buildImportPlan(data, ADMIN1);
    expect(plan.towns.filter(t => t.name === 'Mogwase')).toHaveLength(2);
    expect(plan.blocking.join()).toMatch(/"Mogwase" \(Gauteng\) is used by 2 different towns/);
    const fixed = buildImportPlan(data, ADMIN1, {}, new Map(), { ...EMPTY_CURATION, rename: [{ geonameId: 601, name: 'Mogwase', to: 'Mogwase East' }] });
    expect(fixed.blocking).toEqual([]);
  });

  it('keeps same-named towns that are in different provinces', () => {
    const plan = buildImportPlan(
      [
        place({ geonameId: 700, name: 'Wellington', lat: -26.0, lng: 28.0, population: 9000 }),
        place({ geonameId: 701, name: 'Wellington', lat: -33.64, lng: 19.01, admin1: '09', population: 55000 }),
      ],
      ADMIN1,
    );
    expect(plan.towns.filter(t => t.name === 'Wellington')).toHaveLength(2);
    expect(plan.blocking).toEqual([]);
  });

  it('flags differently named towns under 2 km apart as a possible single place', () => {
    const plan = buildImportPlan(
      [
        place({ geonameId: 800, name: 'Lady Frere', lat: -31.70, lng: 27.23, featureCode: 'PPLA3', population: 25000 }),
        place({ geonameId: 801, name: 'Cacadu', lat: -31.701, lng: 27.231, featureCode: 'PPLA3' }),
        WORCESTER,
      ],
      ADMIN1,
    );
    expect(flagged(plan, 'towns-very-close')).toEqual(['Lady Frere / Cacadu']);
  });
});

// ── Suburbs ─────────────────────────────────────────────────────────────

describe('buildImportPlan — suburbs', () => {
  const plan = buildImportPlan(baseData(), ADMIN1, {}, new Map(), curation());

  it('attaches a suburb to the nearest town in its district within 15 km', () => {
    expect(parentOf(plan, 'Riverside')).toBe('Worcester');
    expect(plan.suburbs.find(s => s.name === 'Riverside')?.source).toBe('nearest-district');
  });

  it('leaves a suburb out when no town is within 15 km outside an urban district', () => {
    expect(parentOf(plan, 'Far Away')).toBeUndefined();
    expect(flagged(plan, 'unassigned-suburb')).toContain('Far Away');
  });

  it('honours a custom suburb distance cap', () => {
    const wide = buildImportPlan(baseData(), ADMIN1, { maxSuburbKm: 25 }, new Map(), curation());
    expect(parentOf(wide, 'Far Away')).toBe('Worcester');
  });

  it('drops suburbs named like their parent and merges duplicate names under one town', () => {
    const p = buildImportPlan(
      [
        WORCESTER,
        place({ geonameId: 900, name: 'Worcester', lat: -33.641, lng: 19.441, featureCode: 'PPLX', admin1: '09', admin2: 'DC2' }),
        place({ geonameId: 901, name: 'Avian Park', lat: -33.62, lng: 19.45, featureCode: 'PPLX', admin1: '09', admin2: 'DC2' }),
        place({ geonameId: 902, name: 'Avian Park', lat: -33.621, lng: 19.451, featureCode: 'PPLX', admin1: '09', admin2: 'DC2' }),
      ],
      ADMIN1,
    );
    expect(p.suburbs.map(s => [s.name, s.geonameId])).toEqual([['Avian Park', 901]]);
    expect(p.stats.suburbsSameNameAsTown).toBe(1);
    expect(p.stats.duplicateSuburbsDropped).toBe(1);
  });

  it('counts suburbs per province and towns without suburbs', () => {
    expect(Object.values(plan.stats.suburbsPerProvince).reduce((a, b) => a + b, 0)).toBe(plan.stats.suburbs);
    const withSuburbs = new Set(plan.suburbs.map(s => s.townGeonameId));
    expect(plan.stats.townsWithoutSuburbs).toBe(plan.towns.filter(t => !withSuburbs.has(t.geonameId)).length);
  });
});

describe('buildImportPlan — explicit hierarchy parents', () => {
  it('uses an explicit parent that is an imported town nearby', () => {
    const plan = buildImportPlan(baseData(), ADMIN1, {}, new Map([[46, [40]]]), curation());
    expect(plan.suburbs.find(s => s.name === 'Riverside')?.source).toBe('hierarchy');
  });

  it('resolves an edge to a place that was absorbed into a metro to the metro city', () => {
    const data = [...baseData(), place({ geonameId: 60, name: 'Parkhurst', lat: -26.14, lng: 28.02, featureCode: 'PPLX', admin2: 'JHB' })];
    const plan = buildImportPlan(data, ADMIN1, {}, new Map([[60, [2]]]), curation()); // 2 = Rosebank, absorbed
    expect(parentOf(plan, 'Parkhurst')).toBe('Johannesburg');
    expect(plan.suburbs.find(s => s.name === 'Parkhurst')?.source).toBe('hierarchy');
  });

  it('ignores an edge to something that is not an imported town and falls back to nearest', () => {
    const plan = buildImportPlan(baseData(), ADMIN1, {}, new Map([[46, [999999]]]), curation());
    expect(plan.suburbs.find(s => s.name === 'Riverside')?.source).toBe('nearest-district');
  });

  it('rejects an explicit parent in another province or too far away, and flags it', () => {
    const plan = buildImportPlan(baseData(), ADMIN1, {}, new Map([[46, [1]], [47, [40]]]), curation()); // Riverside→Johannesburg; Far Away→Worcester (20 km)
    expect(parentOf(plan, 'Riverside')).toBe('Worcester');
    expect(parentOf(plan, 'Far Away')).toBeUndefined();
    expect(flagged(plan, 'hierarchy-parent-rejected').sort()).toEqual(['Far Away', 'Riverside']);
  });
});

describe('buildImportPlan — safety checks', () => {
  it('blocks when a province ends up with no towns', () => {
    const plan = buildImportPlan([WORCESTER], ADMIN1);
    expect(plan.blocking).toContain('province Gauteng has no towns');
  });

  it('produces identical output regardless of input order', () => {
    const h = () => new Map([[46, [40]], [60, [2]]]);
    const a = buildImportPlan(baseData(), ADMIN1, {}, h(), curation());
    const b = buildImportPlan([...baseData()].reverse(), ADMIN1, {}, h(), curation());
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
});

// ── The real, reviewed dataset ──────────────────────────────────────────
// Runs only when the GeoNames files are present (they are committed under prisma/data/geonames).

const DATA_DIR = path.join(__dirname, '..', '..', 'prisma', 'data', 'geonames');
const haveData = ['ZA.txt', 'admin1CodesASCII.txt', 'overrides.json'].every(f => fs.existsSync(path.join(DATA_DIR, f)));

(haveData ? describe : describe.skip)('overrides.json against the real GeoNames data', () => {
  let plan: ImportPlan;
  beforeAll(() => {
    const admin1 = parseAdmin1(fs.readFileSync(path.join(DATA_DIR, 'admin1CodesASCII.txt'), 'utf8'));
    const places = fs.readFileSync(path.join(DATA_DIR, 'ZA.txt'), 'utf8').split(/\r?\n/).map(parsePlaceLine).filter((p): p is GeonamesPlace => !!p && p.featureClass === 'P');
    const cur = parseCuration(fs.readFileSync(path.join(DATA_DIR, 'overrides.json'), 'utf8'));
    plan = buildImportPlan(places, admin1, {}, new Map(), cur);
  }, 60_000);

  const town = (name: string) => plan.towns.find(t => t.name === name);

  it('has no blocking issues', () => {
    expect(plan.blocking).toEqual([]);
  });

  it('covers all nine provinces, each with towns', () => {
    expect(plan.provinces.map(p => p.name).sort()).toEqual([
      'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape',
    ]);
    for (const n of Object.values(plan.stats.townsPerProvince)) expect(n).toBeGreaterThan(0);
  });

  it('applies the approved metro decisions', () => {
    for (const city of ['Johannesburg', 'Pretoria', 'Cape Town', 'Durban', 'Gqeberha', 'Bloemfontein']) {
      expect(town(city)?.source).toBe('metro-city');
    }
    expect(parentOf(plan, 'Soshanguve')).toBe('Pretoria');
    expect(parentOf(plan, 'Somerset West')).toBe('Cape Town');
    for (const independent of ['Kariega', 'Botshabelo', 'Thaba Nchu']) expect(town(independent)).toBeDefined();
    for (const ekurhuleni of ['Benoni', 'Boksburg', 'Germiston', 'Kempton Park', 'Springs', 'Alberton', 'Edenvale', 'Brakpan', 'Tembisa']) {
      expect(town(ekurhuleni)).toBeDefined();
    }
    for (const s of ['Sandton', 'Randburg', 'Soweto', 'Midrand']) expect(parentOf(plan, s)).toBe('Johannesburg');
    expect(parentOf(plan, 'Centurion')).toBe('Pretoria');
    expect(parentOf(plan, 'Pinetown')).toBe('Durban');
  });

  it('leaves no qualifying metro place undecided', () => {
    expect(plan.suspicious.filter(r => r.kind === 'metro-review')).toEqual([]);
  });

  it('excludes villages and small settlements', () => {
    expect(plan.stats.towns).toBeLessThan(700);
    expect(town('Pampoenkraal')).toBeUndefined();
    expect(plan.towns.some(t => /\(\d+\)/.test(t.name))).toBe(false);
  });
});
