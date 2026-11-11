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
  OverrideRef,
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
  it('ignores apostrophes, full stops and hyphens so spelling variants are caught as duplicates', () => {
    expect(normName("Gordon's Bay")).toBe(normName('Gordons Bay'));
    expect(normName('Botha’s Hill')).toBe(normName('Bothas Hill'));
    expect(normName('Graaff-Reinet')).toBe(normName('Graaff Reinet'));
    expect(normName('St. Lucia')).toBe(normName('St Lucia'));
  });

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
    const base = ['993800', 'Johannesburg', 'Johannesburg', '', '-26.20227', '28.04363', 'P', 'PPLA', 'ZA', '', '03', 'JHB', 'JHB', '', '957441', '', '1753', 'Africa/Johannesburg', '2023-01-01'];
    Object.entries(over).forEach(([i, v]) => (base[Number(i)] = v));
    return base.join('\t');
  };

  it('parses a full 19-column GeoNames row, including the local municipality (admin3)', () => {
    expect(parsePlaceLine(cols())).toEqual({
      geonameId: 993800, name: 'Johannesburg', lat: -26.20227, lng: 28.04363,
      featureClass: 'P', featureCode: 'PPLA', countryCode: 'ZA', admin1: '03', admin2: 'JHB', admin3: 'JHB', population: 957441,
    });
    expect(parsePlaceLine(cols({ 12: '' }))?.admin3).toBe('');
  });

  it("straightens typographic apostrophes in display names", () => {
    expect(parsePlaceLine(cols({ 1: 'Pilgrim’s Rest' }))?.name).toBe("Pilgrim's Rest");
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

  it('reads rural municipalities, reassignments and town catchments, validating their values', () => {
    const c = parseCuration(JSON.stringify({
      ruralMunicipalities: { minPopulation: 20000, codes: ['MP325'] },
      reassign: [{ geonameId: 1, name: 'X', province: '07', district: 'DC32' }],
      towns: [{ geonameId: 2, name: 'Y', catchmentKm: 25 }],
    }));
    expect(c.ruralMunicipalities).toEqual({ minPopulation: 20000, codes: ['MP325'] });
    expect(c.reassign[0].province).toBe('07');
    expect(c.towns[0].catchmentKm).toBe(25);
    expect(parseCuration('{}').ruralMunicipalities).toEqual({ minPopulation: 0, codes: [] });
    expect(() => parseCuration('{"ruralMunicipalities":{"codes":["X"]}}')).toThrow(/minPopulation/);
    expect(() => parseCuration('{"reassign":[{"geonameId":1,"name":"X"}]}')).toThrow(/changes nothing/);
    expect(() => parseCuration('{"reassign":[{"geonameId":1,"name":"X","province":7}]}')).toThrow(/province must be a string/);
    expect(() => parseCuration('{"reassign":[{"geonameId":1,"name":"X","lat":"a"}]}')).toThrow(/lat must be a number/);
    expect(() => parseCuration('{"towns":[{"geonameId":1,"name":"X","catchmentKm":-1}]}')).toThrow(/catchmentKm/);
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
    towns: [{ geonameId: 23, name: 'Springs', reason: 'r' }, { geonameId: 41, name: 'Rawsonville', reason: 'r' }],
    suburbs: [
      { geonameId: 4, name: 'Randburg', parentGeonameId: 1, parentName: 'Johannesburg', reason: 'r' },
      { geonameId: 5, name: 'Farside', parentGeonameId: 4, parentName: 'Randburg', reason: 'r' }, // parent is itself absorbed
    ],
    exclude: [{ geonameId: 42, name: 'Touws River', reason: 'r' }],
    rename: [{ geonameId: 40, name: 'Worcester', to: 'Worcester Central', reason: 'r' }],
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

  it('blocks any manual decision that has no documented reason', () => {
    const bad = buildImportPlan(baseData(), ADMIN1, {}, new Map(), curation({ exclude: [{ geonameId: 43, name: 'Pampoenkraal' }] }));
    expect(bad.blocking.join()).toMatch(/overrides\.exclude: "Pampoenkraal" \(43\) has no reason/);
  });
});

describe('buildImportPlan — admin-code corrections (overrides.reassign)', () => {
  // A seat still coded with its pre-2006 province: Western Cape code, Gauteng coordinates.
  const STALE = place({ geonameId: 70, name: 'Hammanskraal', lat: -25.41, lng: 28.29, admin1: '09', admin2: '', featureCode: 'PPLA3', population: 100_000 });
  const data = [...baseData(), STALE];

  it('blocks a town without a district code whose nearest towns are all in another province', () => {
    const plan = buildImportPlan(data, ADMIN1, {}, new Map(), curation());
    expect(flagged(plan, 'province-code-suspect')).toEqual(['Hammanskraal']);
    expect(plan.blocking.join()).toMatch(/"Hammanskraal" \(70\) is coded Western Cape but sits among Gauteng towns/);
  });

  it('moves the place to the corrected province and district before classifying it', () => {
    const plan = buildImportPlan(data, ADMIN1, {}, new Map(), curation({
      reassign: [{ geonameId: 70, name: 'Hammanskraal', province: '03', district: 'JHB', reason: 'r' }],
    }));
    const t = plan.towns.find(x => x.name === 'Hammanskraal')!;
    expect(t.provinceCode).toBe('ZA.03');
    expect(t.admin2).toBe('JHB');
    expect(plan.blocking).toEqual([]);
  });

  it('can correct coordinates', () => {
    const plan = buildImportPlan(data, ADMIN1, {}, new Map(), curation({
      reassign: [{ geonameId: 70, name: 'Hammanskraal', province: '03', district: 'JHB', lat: -25.5, lng: 28.3, reason: 'r' }],
    }));
    expect(plan.towns.find(x => x.name === 'Hammanskraal')).toMatchObject({ lat: -25.5, lng: 28.3 });
  });

  it('blocks an unknown province code', () => {
    const plan = buildImportPlan(data, ADMIN1, {}, new Map(), curation({
      reassign: [{ geonameId: 70, name: 'Hammanskraal', province: '42', reason: 'r' }],
    }));
    expect(plan.blocking.join()).toMatch(/unknown province code 42/);
  });
});

describe('buildImportPlan — rural municipalities', () => {
  const rural = (over: Partial<GeonamesPlace>) => place({ admin1: '09', admin2: 'DC2', admin3: 'WC099', lat: -33.0, lng: 19.0, geonameId: 0, name: '', ...over });
  const data = [
    ...baseData(),
    rural({ geonameId: 80, name: 'Big Village', population: 19_999, lat: -33.0 }),
    rural({ geonameId: 81, name: 'Market Town', population: 20_000, lat: -33.1 }),
    rural({ geonameId: 82, name: 'Rural Seat', population: 900, featureCode: 'PPLA3', lat: -33.2 }),
    rural({ geonameId: 83, name: 'Kept Town', population: 7_000, lat: -32.9 }),
    rural({ geonameId: 84, name: 'Tiny Hamlet', population: 50, lat: -33.201 }), // 0.1 km from the seat, but rural
  ];
  const c = curation({
    ruralMunicipalities: { minPopulation: 20_000, codes: ['WC099'] },
    towns: [{ geonameId: 83, name: 'Kept Town', reason: 'commercial town' }],
  });
  const plan = buildImportPlan(data, ADMIN1, {}, new Map(), c);

  it('needs the rural threshold for non-seat places, keeps seats and explicit towns', () => {
    expect(townNames(plan)).toEqual(expect.arrayContaining(['Market Town', 'Rural Seat', 'Kept Town']));
    expect(townNames(plan)).not.toContain('Big Village');
    expect(plan.excluded.find(e => e.name === 'Big Village')?.reason).toBe('below-rural-threshold');
  });

  it('does not turn rural villages into nearby suburbs', () => {
    expect(parentOf(plan, 'Tiny Hamlet')).toBeUndefined();
    expect(plan.excluded.find(e => e.name === 'Tiny Hamlet')?.reason).toBe('below-threshold');
  });

  it('leaves the normal threshold alone elsewhere', () => {
    expect(townNames(plan)).toContain('Worcester'); // 6,000 in a non-rural municipality
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
    const fixed = buildImportPlan(data, ADMIN1, {}, new Map(), { ...EMPTY_CURATION, rename: [{ geonameId: 601, name: 'Mogwase', to: 'Mogwase East', reason: 'r' }] });
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

  it('never makes an institution a suburb', () => {
    const p = buildImportPlan([...baseData(), place({ geonameId: 48, name: 'Brewelskloof Hospital', lat: -33.63, lng: 19.45, featureCode: 'PPLX', admin1: '09', admin2: 'DC2' })], ADMIN1, {}, new Map(), curation());
    expect(parentOf(p, 'Brewelskloof Hospital')).toBeUndefined();
    expect(p.excluded.find(e => e.geonameId === 48)?.reason).toBe('institution');
  });
});

describe('buildImportPlan — small places beside a town (nearby suburbs)', () => {
  const wc = (over: Partial<GeonamesPlace> & Pick<GeonamesPlace, 'geonameId' | 'name' | 'lat' | 'lng'>) =>
    place({ admin1: '09', admin2: 'DC3', admin3: 'WC032', ...over });
  const data = [
    ...baseData(),
    wc({ geonameId: 90, name: 'Hermanus', lat: -34.4187, lng: 19.2345, featureCode: 'PPLA3', population: 56_000 }),
    wc({ geonameId: 91, name: 'Sandbaai', lat: -34.4187, lng: 19.2000 }),                 // 3.2 km, same municipality
    wc({ geonameId: 92, name: 'Onrus', lat: -34.4187, lng: 19.1650, admin3: 'WC031' }),  // 6.4 km, other municipality
    wc({ geonameId: 93, name: 'Vermont', lat: -34.4187, lng: 19.1650 }),                 // 6.4 km — too far
    wc({ geonameId: 94, name: 'Hemel Farm', lat: -34.4100, lng: 19.2345 }),              // 1 km, but a farm
    wc({ geonameId: 95, name: 'Zwelihle', lat: -34.4000, lng: 19.2345, population: 4_000 }),
  ];
  const plan = buildImportPlan(data, ADMIN1, {}, new Map(), curation());

  it('attaches a small place within 4 km of a town in the same local municipality', () => {
    expect(parentOf(plan, 'Sandbaai')).toBe('Hermanus');
    expect(parentOf(plan, 'Zwelihle')).toBe('Hermanus');
    expect(plan.suburbs.find(s => s.name === 'Sandbaai')?.source).toBe('nearby-place');
  });

  it('excludes places that are too far, in another municipality, or named after farms', () => {
    for (const n of ['Onrus', 'Vermont', 'Hemel Farm']) {
      expect(parentOf(plan, n)).toBeUndefined();
      expect(plan.excluded.find(e => e.name === n)?.reason).toBe('below-threshold');
    }
  });

  it('can be disabled', () => {
    const off = buildImportPlan(data, ADMIN1, { nearbySuburbKm: 0 }, new Map(), curation());
    expect(parentOf(off, 'Sandbaai')).toBeUndefined();
  });
});

describe('buildImportPlan — suburbs inside a metro with independent towns', () => {
  // Farside (40 km north of Johannesburg, kept as an independent town) plays Cullinan / Qonce.
  const pt = (geonameId: number, name: string, lat: number, lng: number) => place({ geonameId, name, lat, lng, admin2: 'JHB' });
  const data = [
    ...baseData(),
    pt(100, 'Farside Ext', -25.869, 28.0436),   // 3 km from Farside, 37 km from the city
    pt(101, 'Halfway', -25.95, 28.0436),        // 12 km from Farside, 28 km from the city
    pt(102, 'Northgate', -25.95, 28.25),        // absorbed into Johannesburg by override
    pt(103, 'Northgate Park', -25.95, 28.27),   // 36 km from the city but 2 km from Northgate
    pt(104, 'Farmland', -26.2023, 27.59),       // 45 km west of the city, 63 km from Farside
  ];
  const c = (catchmentKm?: number) => curation({
    towns: [{ geonameId: 5, name: 'Farside', reason: 'r', catchmentKm }],
    suburbs: [{ geonameId: 102, name: 'Northgate', parentGeonameId: 1, parentName: 'Johannesburg', reason: 'r' }],
  });
  const plan = buildImportPlan(data, ADMIN1, {}, new Map(), c());

  it("gives the independent town only the places within its catchment", () => {
    expect(parentOf(plan, 'Farside Ext')).toBe('Farside');
    expect(parentOf(plan, 'Halfway')).toBe('Johannesburg');
    expect(plan.suburbs.find(s => s.name === 'Halfway')?.source).toBe('metro');
  });

  it("measures distance to the city from its whole footprint, including places absorbed into it", () => {
    expect(parentOf(plan, 'Northgate Park')).toBe('Johannesburg');
  });

  it('honours a per-town catchment from overrides', () => {
    expect(parentOf(buildImportPlan(data, ADMIN1, {}, new Map(), c(15)), 'Halfway')).toBe('Farside');
  });

  it('excludes metro farmland far from the city footprint and from every independent town', () => {
    expect(parentOf(plan, 'Farmland')).toBeUndefined();
    expect(plan.excluded.find(e => e.name === 'Farmland')?.reason).toBe('metro-hinterland');
  });
});

describe('buildImportPlan — ambiguous display names', () => {
  it('blocks a suburb named like another town in its province until renamed or excluded', () => {
    const data = [...baseData(), place({ geonameId: 49, name: 'Touws River', lat: -33.63, lng: 19.45, featureCode: 'PPLX', admin1: '09', admin2: 'DC2' })];
    const plan = buildImportPlan(data, ADMIN1, {}, new Map(), curation());
    expect(flagged(plan, 'suburb-also-a-town')).toEqual(['Touws River']);
    expect(plan.blocking.join()).toMatch(/suburb "Touws River" \(49, Worcester\) has the same name as the town Touws River/);
    const fixed = buildImportPlan(data, ADMIN1, {}, new Map(), curation({ rename: [{ geonameId: 49, name: 'Touws River', to: 'Touws Rivier Oos', reason: 'r' }] }));
    expect(fixed.blocking).toEqual([]);
  });

  it('blocks a town named like a province and census-style town names', () => {
    const data = [
      ...baseData(),
      place({ geonameId: 50, name: 'Gauteng', lat: -26.6, lng: 28.4, population: 9000 }),
      place({ geonameId: 51, name: 'Edinburgh A', lat: -26.7, lng: 28.5, population: 9000 }),
    ];
    const text = buildImportPlan(data, ADMIN1, {}, new Map(), curation()).blocking.join('\n');
    expect(text).toMatch(/town "Gauteng" \(50\) has the same name as a province/);
    expect(text).toMatch(/town "Edinburgh A" \(51\) has a census-style or malformed name/);
  });
});

describe('buildImportPlan — explicit hierarchy parents', () => {
  it('uses an explicit parent that is an imported town nearby', () => {
    const plan = buildImportPlan(baseData(), ADMIN1, {}, new Map([[46, [40]]]), curation());
    expect(plan.suburbs.find(s => s.name === 'Riverside')?.source).toBe('hierarchy');
  });

  it('resolves an edge to a place that was absorbed into a metro to the metro city', () => {
    // Outside a metro district: the edge points at Rosebank, which was absorbed into Johannesburg.
    const data = [...baseData(), place({ geonameId: 60, name: 'Parkhurst', lat: -26.14, lng: 28.02, featureCode: 'PPLX', admin2: '' })];
    const plan = buildImportPlan(data, ADMIN1, {}, new Map([[60, [2]]]), curation()); // 2 = Rosebank, absorbed
    expect(parentOf(plan, 'Parkhurst')).toBe('Johannesburg');
    expect(plan.suburbs.find(s => s.name === 'Parkhurst')?.source).toBe('hierarchy');
  });

  it('lets the metro rule, not a hierarchy edge, decide inside a metro district', () => {
    const data = [...baseData(), place({ geonameId: 60, name: 'Parkhurst', lat: -26.14, lng: 28.02, featureCode: 'PPLX', admin2: 'JHB' })];
    const plan = buildImportPlan(data, ADMIN1, {}, new Map([[60, [3]]]), curation()); // edge to Old Seat
    expect(parentOf(plan, 'Parkhurst')).toBe('Johannesburg');
    expect(plan.suburbs.find(s => s.name === 'Parkhurst')?.source).toBe('metro');
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


(haveData ? describe : describe.skip)('the curated dataset (overrides.json against the real GeoNames data)', () => {
  let plan: ImportPlan;
  let cur: Curation;
  let raw: Map<number, GeonamesPlace>;
  let admin1: Map<string, string>;
  beforeAll(() => {
    admin1 = parseAdmin1(fs.readFileSync(path.join(DATA_DIR, 'admin1CodesASCII.txt'), 'utf8'));
    const places = fs.readFileSync(path.join(DATA_DIR, 'ZA.txt'), 'utf8').split(/\r?\n/).map(parsePlaceLine).filter((p): p is GeonamesPlace => !!p && p.featureClass === 'P');
    raw = new Map(places.map(p => [p.geonameId, p]));
    // Same hierarchy filtering as the importer, so this is exactly the plan an import would write.
    const hierarchy = new Map<number, number[]>();
    const hFile = path.join(DATA_DIR, 'hierarchy.txt');
    if (fs.existsSync(hFile)) {
      for (const line of fs.readFileSync(hFile, 'utf8').split(/\r?\n/)) {
        const e = parseHierarchyLine(line);
        if (!e || e.type.toUpperCase() === 'ADM' || !raw.has(e.childId)) continue;
        const l = hierarchy.get(e.childId);
        if (l) { if (!l.includes(e.parentId)) l.push(e.parentId); } else hierarchy.set(e.childId, [e.parentId]);
      }
    }
    cur = parseCuration(fs.readFileSync(path.join(DATA_DIR, 'overrides.json'), 'utf8'));
    plan = buildImportPlan(places, admin1, {}, hierarchy, cur);
  }, 120_000);

  const town = (name: string) => plan.towns.find(t => t.name === name);
  const provinceOf = (name: string) => admin1.get(town(name)!.provinceCode);
  const townById = () => new Map(plan.towns.map(t => [t.geonameId, t]));
  const kinds = (kind: string) => plan.suspicious.filter(r => r.kind === kind);

  // ── integrity ──
  it('has no blocking issues', () => {
    expect(plan.blocking).toEqual([]);
  });

  it('covers all nine provinces, each with a credible number of towns', () => {
    expect(plan.provinces.map(p => p.name).sort()).toEqual([
      'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape',
    ]);
    for (const [name, n] of Object.entries(plan.stats.townsPerProvince)) {
      expect([name, n >= 25 && n <= 120]).toEqual([name, true]);
    }
  });

  it('has no orphaned or cross-province suburbs', () => {
    const towns = townById();
    expect(plan.suburbs.filter(s => !towns.has(s.townGeonameId))).toEqual([]);
    // A suburb's own (corrected) province must be its parent's province unless an override placed it there.
    const forced = new Set(cur.suburbs.map(s => s.geonameId));
    const reassigned = new Map(cur.reassign.map(r => [r.geonameId, r]));
    const wrong = plan.suburbs.filter(s => {
      if (forced.has(s.geonameId)) return false;
      const a1 = reassigned.get(s.geonameId)?.province ?? raw.get(s.geonameId)!.admin1;
      return `ZA.${a1}` !== towns.get(s.townGeonameId)!.provinceCode;
    });
    expect(wrong).toEqual([]);
  });

  it('keeps every automatically placed suburb near its parent (coordinate sanity)', () => {
    // Metro cities sprawl (Gordon's Bay is ~50 km from central Cape Town but inside the city); towns do not.
    const towns = townById();
    const forced = new Set(cur.suburbs.map(s => s.geonameId));
    const far = plan.suburbs
      .filter(s => !forced.has(s.geonameId))
      .map(s => {
        const t = towns.get(s.townGeonameId)!;
        return { name: s.name, parent: t.name, km: Math.round(haversineKm(s.lat, s.lng, t.lat, t.lng)), limit: t.source === 'metro-city' ? 60 : 35 };
      })
      .filter(x => x.km > x.limit);
    expect(far).toEqual([]);
  });

  it('places every town and suburb inside South Africa', () => {
    const outside = [...plan.towns, ...plan.suburbs].filter(p => p.lat < -35.2 || p.lat > -21.9 || p.lng < 16.2 || p.lng > 33.1);
    expect(outside).toEqual([]);
  });

  it('has no town whose province code looks stale', () => {
    expect(kinds('province-code-suspect')).toEqual([]);
  });

  it('applies every admin-code correction', () => {
    expect(provinceOf('Hammanskraal')).toBe('Gauteng');
    expect(provinceOf('Fochville')).toBe('Gauteng');
    expect(provinceOf('Jan Kempdorp')).toBe('Northern Cape');
    expect(provinceOf('Matatiele')).toBe('Eastern Cape');
    expect(provinceOf('Umzimkhulu')).toBe('KwaZulu-Natal');
    for (const lp of ['Burgersfort', 'Groblersdal', 'Marble Hall']) expect(provinceOf(lp)).toBe('Limpopo');
    for (const mp of ['Acornhoek', 'Dwarsloop', 'Bushbuckridge', 'Kwamhlanga']) expect(provinceOf(mp)).toBe('Mpumalanga');
  });

  // ── duplicates and names ──
  it('has no duplicate towns in a province and no duplicate suburbs in a town (punctuation-insensitive)', () => {
    const dupes = (keys: string[]) => keys.filter((k, i) => keys.indexOf(k) !== i);
    expect(dupes(plan.towns.map(t => `${t.provinceCode}|${normName(t.name)}`))).toEqual([]);
    expect(dupes(plan.suburbs.map(s => `${s.townGeonameId}|${normName(s.name)}`))).toEqual([]);
    expect(dupes([...plan.towns, ...plan.suburbs].map(x => String(x.geonameId)))).toEqual([]);
  });

  it('has no ambiguous or malformed display names', () => {
    const provinces = new Set(plan.provinces.map(p => normName(p.name)));
    expect(plan.towns.filter(t => provinces.has(normName(t.name)))).toEqual([]);
    expect(kinds('suburb-also-a-town')).toEqual([]);
    expect(kinds('towns-very-close')).toEqual([]);
    expect(kinds('same-coordinates')).toEqual([]);
    const bad = [...plan.towns, ...plan.suburbs].map(x => x.name).filter(n => /[‘’“”`]|\s(NC|EC|WC|KZN|GP|FS|NW|MP|LP)$|\(\d+\)/.test(n));
    expect(bad).toEqual([]);
    expect(plan.towns.map(t => t.name).filter(n => /\s[A-Z]$/.test(n))).toEqual([]);
  });

  it('uses current official names, keeping a widely used former name in brackets', () => {
    for (const n of ['Komani (Queenstown)', 'Cacadu (Lady Frere)', 'KwaBhaca (Mount Frere)', 'Maxesibeni (Mount Ayliff)', 'Khowa (Elliot)',
      'Nqanqarhu (Maclear)', 'Mbombela (Nelspruit)', 'eMalahleni (Witbank)', 'Mashishing (Lydenburg)', 'Winnie Mandela (Brandfort)',
      'Gqeberha', 'Kariega', 'Qonce', 'Makhanda', 'Mahikeng', 'Modjadjiskloof', 'Port St Johns', 'Bushbuckridge', 'Clocolan', 'Petrus Steyn']) {
      expect([n, !!town(n)]).toEqual([n, true]);
    }
    for (const old of ['Queenstown', 'Grahamstown', 'Mafikeng', 'Port Elizabeth', 'Duiwelskloof', 'Bosbokrand', 'Hlohlolwane']) expect(town(old)).toBeUndefined();
  });

  // ── classification rules ──
  it('keeps every municipal seat unless a documented override decides otherwise', () => {
    const decided = new Set([...cur.exclude, ...cur.suburbs].map(r => r.geonameId));
    const imported = new Set(plan.towns.map(t => t.geonameId));
    const merged = new Set(kinds('duplicate-town-name').map(r => r.geonameId));
    const missing = [...raw.values()].filter(p =>
      ['PPLC', 'PPLA', 'PPLA2', 'PPLA3', 'PPLA4'].includes(p.featureCode) &&
      admin1.has(`ZA.${p.admin1}`) && !/\(\d+\)/.test(p.name) &&
      !imported.has(p.geonameId) && !decided.has(p.geonameId) && !merged.has(p.geonameId));
    expect(missing.map(p => p.name)).toEqual([]);
  });

  it('admits non-seat places only on population, with the rural threshold in rural municipalities', () => {
    const rural = new Set(cur.ruralMunicipalities.codes);
    for (const t of plan.towns.filter(x => x.source === 'population')) {
      const min = t.admin3 && rural.has(t.admin3) ? cur.ruralMunicipalities.minPopulation : 5000;
      expect([t.name, t.population >= min]).toEqual([t.name, true]);
    }
    expect(plan.excluded.filter(e => e.reason === 'below-rural-threshold').length).toBeGreaterThan(50);
    for (const v of ['Bolla-Tau', 'Maviljan A', 'Edinburgh A', 'Shatale', 'Thabakgolo', 'Glenmore', 'Tshitereke']) {
      expect([v, town(v)]).toEqual([v, undefined]);
    }
    expect(plan.excluded.find(e => e.name === 'Redhill')?.reason).toBe('override');
  });

  it('keeps commercially relevant towns that the thresholds alone would drop', () => {
    for (const n of ['Hazyview', 'Malelane', 'Bushbuckridge', 'Thulamahashe', 'Acornhoek', 'Lusikisiki', 'Port St Johns', 'Dutywa', 'St Lucia',
      'Graskop', 'Clarens', 'Dullstroom', "Pilgrim's Rest", 'Paternoster', 'Greyton', 'Keimoes', 'Sutherland', 'Haenertsburg']) {
      expect([n, !!town(n)]).toEqual([n, true]);
    }
  });

  it('applies the metro decisions: one selectable city per metro, Ekurhuleni as separate towns', () => {
    const metros: Record<string, string> = { JHB: 'Johannesburg', TSH: 'Pretoria', CPT: 'Cape Town', ETH: 'Durban', NMA: 'Gqeberha', MAN: 'Bloemfontein', BUF: 'East London' };
    for (const [code, city] of Object.entries(metros)) {
      expect(town(city)).toMatchObject({ source: 'metro-city', admin2: code });
    }
    for (const s of ['Sandton', 'Randburg', 'Soweto', 'Midrand', 'Roodepoort']) expect([s, parentOf(plan, s)]).toEqual([s, 'Johannesburg']);
    for (const s of ['Centurion', 'Soshanguve', 'Mabopane', 'Ga-Rankuwa', 'Mamelodi', 'Winterveldt', 'Eldoraigne']) expect([s, parentOf(plan, s)]).toEqual([s, 'Pretoria']);
    for (const s of ['Somerset West', 'Durbanville', 'Bellville', 'Strand', "Gordon's Bay"]) expect([s, parentOf(plan, s)]).toEqual([s, 'Cape Town']);
    for (const s of ['Pinetown', 'Westville', 'Hillcrest', 'Verulam', 'Kloof']) expect([s, parentOf(plan, s)]).toEqual([s, 'Durban']);
    for (const s of ['Motherwell', 'Bethelsdorp']) expect([s, parentOf(plan, s)]).toEqual([s, 'Gqeberha']);
    for (const s of ['Mdantsane', 'Gonubie']) expect([s, parentOf(plan, s)]).toEqual([s, 'East London']);
    for (const t of ['Benoni', 'Boksburg', 'Germiston', 'Kempton Park', 'Springs', 'Alberton', 'Edenvale', 'Brakpan', 'Tembisa', 'Nigel', 'Bedfordview']) {
      expect(town(t)).toMatchObject({ admin2: 'EKU' });
    }
  });

  it('keeps established towns inside metros independent, with only their own suburbs', () => {
    for (const t of ['Kariega', 'Despatch', 'Botshabelo', 'Thaba Nchu', 'Tongaat', 'eMkhomazi', 'Cato Ridge', 'Atlantis', 'Bronkhorstspruit', 'Cullinan', 'Hammanskraal', 'Qonce', 'Bhisho']) {
      expect([t, !!town(t)]).toEqual([t, true]);
    }
    expect(parentOf(plan, 'KwaNobuhle')).toBe('Kariega');
    expect(parentOf(plan, 'Zwelitsha')).toBe('Qonce');
    expect(parentOf(plan, 'Rethabiseng')).toBe('Bronkhorstspruit');
  });

  it('leaves no qualifying metro place undecided', () => {
    expect(kinds('metro-review')).toEqual([]);
  });

  it('turns townships of country towns into their suburbs', () => {
    expect(parentOf(plan, 'eMbalenhle')).toBe('Secunda');
    expect(parentOf(plan, 'Kutloanong')).toBe('Odendaalsrus');
    expect(parentOf(plan, 'Mpophomeni')).toBe('Howick');
    expect(parentOf(plan, 'Thokoza')).toBe('Alberton');
  });

  it('resolves the reviewed ambiguities', () => {
    expect(plan.towns.filter(t => t.name === 'Richmond').map(t => admin1.get(t.provinceCode))).toEqual(['KwaZulu-Natal']);
    const kzn = new Set(plan.towns.filter(t => t.provinceCode === 'ZA.02').map(t => t.geonameId));
    expect(plan.suburbs.filter(s => s.name === 'Richmond' && kzn.has(s.townGeonameId))).toEqual([]);
    expect(plan.towns.filter(t => t.name === 'Mogwase')).toEqual([expect.objectContaining({ source: 'seat' })]);
  });

  it('excludes villages, farms and numbered duplicates, and accounts for every excluded place', () => {
    expect(plan.stats.towns).toBeLessThan(600);
    expect(plan.towns.some(t => /\(\d+\)/.test(t.name))).toBe(false);
    const reasons = new Set<string>(plan.excluded.map(e => e.reason));
    for (const r of ['below-threshold', 'below-rural-threshold', 'numbered-duplicate-name', 'override', 'metro-hinterland']) expect(reasons.has(r)).toBe(true);
    const total = Object.values(plan.stats.excludedByReason).reduce((a, b) => a + b, 0);
    expect(plan.excluded).toHaveLength(total);
  });

  it('documents every manual decision', () => {
    for (const list of [cur.towns, cur.suburbs, cur.exclude, cur.rename, cur.reassign] as OverrideRef[][]) {
      for (const r of list) expect([r.name, !!r.reason?.trim()]).toEqual([r.name, true]);
    }
  });
});
