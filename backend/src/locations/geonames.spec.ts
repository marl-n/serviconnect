import {
  buildImportPlan,
  parseAdmin1,
  parsePlaceLine,
  normName,
  haversineKm,
  parseHierarchyLine,
  GeonamesPlace,
} from './geonames';

// ── Fixture ─────────────────────────────────────────────────────────────
// Real South African place names with approximate coordinates, but SYNTHETIC
// geonameIds and admin codes — this exercises the logic, it is not a copy of
// GeoNames data.
const ADMIN1_TXT = [
  'ZA.03\tGauteng\tGauteng\t1000001',
  'ZA.09\tWestern Cape\tWestern Cape\t1000002',
  'ZA.04\tKwaZulu-Natal\tKwaZulu-Natal\t1000003',
  'NA.01\tKhomas\tKhomas\t2000001', // another country — must be ignored
].join('\n');

function place(p: Partial<GeonamesPlace> & Pick<GeonamesPlace, 'geonameId' | 'name' | 'lat' | 'lng'>): GeonamesPlace {
  return {
    featureClass: 'P',
    featureCode: 'PPL',
    countryCode: 'ZA',
    admin1: '03',
    admin2: '',
    population: 0,
    ...p,
  };
}

const JHB = place({ geonameId: 1, name: 'Johannesburg', lat: -26.2023, lng: 28.0436, featureCode: 'PPLA', admin2: 'JHB', population: 957441 });
const PTA = place({ geonameId: 2, name: 'Pretoria', lat: -25.7449, lng: 28.1878, featureCode: 'PPLC', admin2: 'TSH', population: 741651 });
const SOWETO = place({ geonameId: 3, name: 'Soweto', lat: -26.2678, lng: 27.8585, featureCode: 'PPL', admin2: 'JHB', population: 1271628 });
const SUNNINGHILL = place({ geonameId: 4, name: 'Sunninghill', lat: -26.0300, lng: 28.0700, featureCode: 'PPL', admin2: 'JHB', population: 1000 }); // small, not a seat
const CPT = place({ geonameId: 10, name: 'Cape Town', lat: -33.9258, lng: 18.4232, featureCode: 'PPLA', admin1: '09', admin2: 'CPT', population: 433688 });

function baseData(): GeonamesPlace[] {
  return [
    JHB, PTA, SOWETO, SUNNINGHILL, CPT,
    // suburbs (PPLX)
    place({ geonameId: 100, name: 'Sandton', lat: -26.1076, lng: 28.0567, featureCode: 'PPLX', admin2: 'JHB' }),
    place({ geonameId: 101, name: 'Bryanston', lat: -26.0603, lng: 28.0197, featureCode: 'PPLX', admin2: 'JHB' }),
    place({ geonameId: 102, name: 'Hatfield', lat: -25.7487, lng: 28.2380, featureCode: 'PPLX', admin2: 'TSH' }),
    place({ geonameId: 103, name: 'Orlando', lat: -26.2392, lng: 27.9100, featureCode: 'PPLX', admin2: 'JHB' }),
    place({ geonameId: 104, name: 'Camps Bay', lat: -33.9500, lng: 18.3780, featureCode: 'PPLX', admin1: '09', admin2: 'CPT' }),
    // suburb whose district code matches no town, but is near Johannesburg
    place({ geonameId: 105, name: 'Rosebank', lat: -26.1450, lng: 28.0440, featureCode: 'PPLX', admin2: 'UNKNOWN' }),
    // same name as its parent town → pointless in a picker
    place({ geonameId: 106, name: 'Johannesburg', lat: -26.2041, lng: 28.0473, featureCode: 'PPLX', admin2: 'JHB' }),
    // duplicate suburb name under the same town → lowest geonameId wins
    place({ geonameId: 108, name: 'Sandton', lat: -26.1100, lng: 28.0600, featureCode: 'PPLX', admin2: 'JHB' }),
    // far from every town → unassigned
    place({ geonameId: 107, name: 'Remote Place', lat: -30.0000, lng: 20.0000, featureCode: 'PPLX', admin1: '09', admin2: 'ZZZ' }),
  ];
}

describe('normName', () => {
  it('ignores case, accents and repeated whitespace', () => {
    expect(normName('  Sébastopol ')).toBe(normName('sebastopol'));
    expect(normName('Port   Elizabeth')).toBe('port elizabeth');
  });
});

describe('parseAdmin1', () => {
  it('keeps only the requested country and takes names from the file', () => {
    const m = parseAdmin1(ADMIN1_TXT, 'ZA');
    expect([...m.entries()]).toEqual([
      ['ZA.03', 'Gauteng'],
      ['ZA.09', 'Western Cape'],
      ['ZA.04', 'KwaZulu-Natal'],
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

describe('haversineKm', () => {
  it('is ~0 for identical points and ~1,260 km Johannesburg–Cape Town', () => {
    expect(haversineKm(-26.2, 28.0, -26.2, 28.0)).toBeCloseTo(0, 5);
    const km = haversineKm(JHB.lat, JHB.lng, CPT.lat, CPT.lng);
    expect(km).toBeGreaterThan(1200);
    expect(km).toBeLessThan(1320);
  });
});

describe('buildImportPlan — provinces', () => {
  it('takes every province from admin1 data, even ones with no towns', () => {
    const plan = buildImportPlan(baseData(), parseAdmin1(ADMIN1_TXT));
    expect(plan.provinces.map(p => p.name)).toEqual(['Gauteng', 'KwaZulu-Natal', 'Western Cape']);
    expect(plan.provinces.find(p => p.name === 'Gauteng')?.geonamesCode).toBe('ZA.03');
  });

  it('skips places whose admin1 code is unknown, and counts them', () => {
    const plan = buildImportPlan(
      [...baseData(), place({ geonameId: 900, name: 'Nowhere', lat: -28, lng: 25, admin1: '99' })],
      parseAdmin1(ADMIN1_TXT),
    );
    expect(plan.towns.find(t => t.name === 'Nowhere')).toBeUndefined();
    expect(plan.stats.skippedNoProvince).toBe(1);
  });
});

describe('buildImportPlan — towns', () => {
  it('imports standalone populated places and never PPLX, historical, abandoned or non-P features', () => {
    const plan = buildImportPlan(
      [
        ...baseData(),
        place({ geonameId: 300, name: 'Old Mission', lat: -27, lng: 26, featureCode: 'PPLH' }),
        place({ geonameId: 301, name: 'Ghost Town', lat: -27.1, lng: 26.1, featureCode: 'PPLQ' }),
        place({ geonameId: 302, name: 'Farm Hamlet', lat: -27.2, lng: 26.2, featureCode: 'PPLL' }),
        place({ geonameId: 303, name: 'Some River', lat: -27.3, lng: 26.3, featureClass: 'H', featureCode: 'STM' }),
      ],
      parseAdmin1(ADMIN1_TXT),
    );
    const names = plan.towns.map(t => t.name);
    expect(names).toEqual(expect.arrayContaining(['Johannesburg', 'Pretoria', 'Soweto', 'Cape Town']));
    expect(names).not.toContain('Sandton'); // PPLX is a suburb, not a town
    for (const n of ['Old Mission', 'Ghost Town', 'Farm Hamlet', 'Some River']) expect(names).not.toContain(n);
    expect(plan.stats.ignoredByFeatureCode).toMatchObject({ PPLH: 1, PPLQ: 1, PPLL: 1 });
  });

  it('merges same-named towns in one province, preferring higher feature rank, then population, then lowest id', () => {
    const plan = buildImportPlan(
      [
        place({ geonameId: 500, name: 'Rietfontein', lat: -27, lng: 25, population: 0 }),
        place({ geonameId: 501, name: 'Rietfontein', lat: -27.5, lng: 25.5, population: 120 }),
        place({ geonameId: 600, name: 'Springs', lat: -26.25, lng: 28.4, featureCode: 'PPL', population: 100 }),
        place({ geonameId: 601, name: 'springs', lat: -26.26, lng: 28.41, featureCode: 'PPLA3', population: 50 }),
        place({ geonameId: 700, name: 'Vlakfontein', lat: -26, lng: 28 }),
        place({ geonameId: 699, name: 'Vlakfontein', lat: -26.1, lng: 28.1 }),
      ],
      parseAdmin1(ADMIN1_TXT),
    );
    const byName = (n: string) => plan.towns.filter(t => t.name.toLowerCase() === n.toLowerCase());
    expect(byName('Rietfontein').map(t => t.geonameId)).toEqual([501]); // higher population
    expect(byName('Springs').map(t => t.geonameId)).toEqual([601]);     // better feature rank beats population
    expect(byName('Vlakfontein').map(t => t.geonameId)).toEqual([699]); // tie → lowest geonameId
    expect(plan.stats.duplicateTownsDropped).toBe(3);
  });

  it('keeps same-named towns that are in different provinces', () => {
    const plan = buildImportPlan(
      [
        place({ geonameId: 800, name: 'Rietvlei', lat: -26, lng: 28, admin1: '03' }),
        place({ geonameId: 801, name: 'Rietvlei', lat: -34, lng: 19, admin1: '09' }),
      ],
      parseAdmin1(ADMIN1_TXT),
    );
    expect(plan.towns.filter(t => t.name === 'Rietvlei')).toHaveLength(2);
  });

  it('applies the optional minimum-population filter', () => {
    const data = [place({ geonameId: 1, name: 'Big', lat: -26, lng: 28, population: 5000 }), place({ geonameId: 2, name: 'Tiny', lat: -26.5, lng: 28.5, population: 10 })];
    const all = buildImportPlan(data, parseAdmin1(ADMIN1_TXT));
    const filtered = buildImportPlan(data, parseAdmin1(ADMIN1_TXT), { minTownPopulation: 100 });
    expect(all.towns.map(t => t.name).sort()).toEqual(['Big', 'Tiny']);
    expect(filtered.towns.map(t => t.name)).toEqual(['Big']);
    expect(filtered.stats.townsBelowMinPopulation).toBe(1);
  });
});

describe('buildImportPlan — suburbs', () => {
  const plan = buildImportPlan(baseData(), parseAdmin1(ADMIN1_TXT));
  const parentOf = (suburb: string) => {
    const s = plan.suburbs.find(x => x.name === suburb);
    return s ? plan.towns.find(t => t.geonameId === s.townGeonameId)?.name : undefined;
  };

  it('attaches suburbs to the nearest seat/large town in the same district', () => {
    expect(parentOf('Sandton')).toBe('Johannesburg');
    expect(parentOf('Bryanston')).toBe('Johannesburg');
    expect(parentOf('Hatfield')).toBe('Pretoria');
    expect(parentOf('Camps Bay')).toBe('Cape Town');
  });

  it('does not attach suburbs to a tiny nearby hamlet even when it is closer than the seat', () => {
    // Sunninghill (pop 1,000, not a seat) is much closer to Bryanston than Johannesburg is.
    expect(parentOf('Bryanston')).not.toBe('Sunninghill');
    expect(plan.towns.map(t => t.name)).toContain('Sunninghill'); // still a selectable town
  });

  it('attaches to a large non-seat town when it is the nearest eligible parent', () => {
    expect(parentOf('Orlando')).toBe('Soweto');
  });

  it('falls back to the nearest eligible town in the province when the district code matches nothing', () => {
    expect(parentOf('Rosebank')).toBe('Johannesburg');
    expect(plan.stats.suburbsAssignedProvinceWide).toBe(1);
  });

  it('leaves suburbs unassigned (not imported) when no parent is within the distance cap', () => {
    expect(plan.suburbs.find(s => s.name === 'Remote Place')).toBeUndefined();
    expect(plan.stats.suburbsUnassigned).toBe(1);
    expect(plan.stats.unassignedSuburbSamples).toContain('Remote Place');
  });

  it('honours a custom distance cap', () => {
    const hatfieldKm = haversineKm(PTA.lat, PTA.lng, -25.7487, 28.2380);
    expect(hatfieldKm).toBeGreaterThan(4.5); // ~5 km — comfortably above a 3 km cap, below the 40 km default
    const tight = buildImportPlan(baseData(), parseAdmin1(ADMIN1_TXT), { maxSuburbKm: 3 });
    expect(tight.suburbs.find(s => s.name === 'Hatfield')).toBeUndefined();
    expect(plan.suburbs.find(s => s.name === 'Hatfield')).toBeDefined(); // default cap keeps it
  });

  it('drops suburbs named identically to their parent town', () => {
    expect(plan.suburbs.filter(s => s.name === 'Johannesburg')).toHaveLength(0);
    expect(plan.stats.suburbsSameNameAsTown).toBe(1);
  });

  it('merges duplicate suburb names under one town, keeping the lowest geonameId', () => {
    const sandtons = plan.suburbs.filter(s => s.name === 'Sandton');
    expect(sandtons.map(s => s.geonameId)).toEqual([100]);
    expect(plan.stats.duplicateSuburbsDropped).toBe(1);
  });

  it('reports towns that have no suburb data (expected — GeoNames suburb coverage is incomplete)', () => {
    expect(plan.stats.townsWithoutSuburbs).toBeGreaterThan(0);
    const withSuburbs = new Set(plan.suburbs.map(s => s.townGeonameId));
    expect(plan.stats.townsWithoutSuburbs).toBe(plan.towns.filter(t => !withSuburbs.has(t.geonameId)).length);
  });
});

describe('buildImportPlan — determinism', () => {
  it('produces identical output regardless of input row order', () => {
    const admin1 = parseAdmin1(ADMIN1_TXT);
    const forward = buildImportPlan(baseData(), admin1);
    const reversed = buildImportPlan([...baseData()].reverse(), admin1);
    expect(JSON.stringify(reversed.towns)).toBe(JSON.stringify(forward.towns));
    expect(JSON.stringify(reversed.suburbs)).toBe(JSON.stringify(forward.suburbs));
    expect(JSON.stringify(reversed.provinces)).toBe(JSON.stringify(forward.provinces));
  });
});

// ─────────────────────── hierarchy.txt support ───────────────────────

describe('parseHierarchyLine', () => {
  it('parses parentId, childId and type', () => {
    expect(parseHierarchyLine('6255146\t6255147\tADM')).toEqual({ parentId: 6255146, childId: 6255147, type: 'ADM' });
    expect(parseHierarchyLine('100\t200\t')).toEqual({ parentId: 100, childId: 200, type: '' });
  });
  it('accepts rows with no type column and rejects malformed rows', () => {
    expect(parseHierarchyLine('100\t200')).toEqual({ parentId: 100, childId: 200, type: '' });
    expect(parseHierarchyLine('')).toBeNull();
    expect(parseHierarchyLine('only-one-column')).toBeNull();
    expect(parseHierarchyLine('abc\tdef\tADM')).toBeNull();
  });
});

describe('buildImportPlan — explicit hierarchy parents', () => {
  const admin1 = parseAdmin1(ADMIN1_TXT);
  const parentOf = (plan: ReturnType<typeof buildImportPlan>, suburb: string) => {
    const sb = plan.suburbs.find(x => x.name === suburb);
    return sb ? plan.towns.find(t => t.geonameId === sb.townGeonameId)?.name : undefined;
  };

  it('prefers an explicit parent over a nearer town, and counts it', () => {
    // Orlando (103) is nearest Soweto, but the hierarchy says Johannesburg.
    const plan = buildImportPlan(baseData(), admin1, {}, new Map([[103, [1]]]));
    expect(parentOf(plan, 'Orlando')).toBe('Johannesburg');
    expect(plan.stats.suburbsAssignedExplicit).toBe(1);
    expect(plan.stats.suburbsWithHierarchyEdge).toBe(1);
  });

  it('is identical to nearest-town matching for suburbs that have no hierarchy edge', () => {
    const without = buildImportPlan(baseData(), admin1);
    const withUnrelated = buildImportPlan(baseData(), admin1, {}, new Map([[103, [1]]]));
    for (const name of ['Sandton', 'Bryanston', 'Hatfield', 'Camps Bay', 'Rosebank']) {
      expect(parentOf(withUnrelated, name)).toBe(parentOf(without, name));
    }
    expect(parentOf(without, 'Orlando')).toBe('Soweto'); // and the unaided result differs only where an edge exists
  });

  it('ignores an edge whose parent is not an imported town (e.g. an admin division) and falls back', () => {
    const plan = buildImportPlan(baseData(), admin1, {}, new Map([[100, [999999]]]));
    expect(parentOf(plan, 'Sandton')).toBe('Johannesburg'); // nearest same-district
    expect(plan.stats.suburbsAssignedExplicit).toBe(0);
    expect(plan.stats.suburbsWithHierarchyEdge).toBe(1);
  });

  it('rejects an explicit parent in a different province, falls back, and flags it', () => {
    const plan = buildImportPlan(baseData(), admin1, {}, new Map([[104, [1]]])); // Camps Bay → Johannesburg (wrong province)
    expect(parentOf(plan, 'Camps Bay')).toBe('Cape Town');
    expect(plan.stats.suburbsExplicitRejected).toBe(1);
    expect(plan.suspicious.some(r => r.kind === 'explicit-parent-wrong-province' && r.name === 'Camps Bay')).toBe(true);
  });

  it('resolves an edge that points at a merged-away duplicate town to the surviving town', () => {
    const data = [
      place({ geonameId: 600, name: 'Springs', lat: -26.25, lng: 28.4, featureCode: 'PPL', population: 100, admin2: 'EKU' }),
      place({ geonameId: 601, name: 'Springs', lat: -26.26, lng: 28.41, featureCode: 'PPLA3', population: 50, admin2: 'EKU' }),
      place({ geonameId: 610, name: 'Selcourt', lat: -26.26, lng: 28.42, featureCode: 'PPLX', admin2: 'EKU' }),
    ];
    const plan = buildImportPlan(data, admin1, {}, new Map([[610, [600]]]));
    const sb = plan.suburbs.find(x => x.name === 'Selcourt')!;
    expect(sb.townGeonameId).toBe(601);
    expect(plan.stats.suburbsAssignedExplicit).toBe(1);
  });

  it('uses the nearest of several explicit parents and counts it as ambiguous', () => {
    const plan = buildImportPlan(baseData(), admin1, {}, new Map([[100, [2, 1]]])); // Pretoria, Johannesburg
    expect(parentOf(plan, 'Sandton')).toBe('Johannesburg');
    expect(plan.stats.suburbsExplicitAmbiguous).toBe(1);
  });

  it('keeps an explicit parent that is farther than the cap, but flags it', () => {
    const plan = buildImportPlan(baseData(), admin1, { maxSuburbKm: 30 }, new Map([[100, [2]]])); // Sandton → Pretoria (~42 km)
    expect(parentOf(plan, 'Sandton')).toBe('Pretoria');
    expect(plan.suspicious.some(r => r.kind === 'explicit-parent-far' && r.name === 'Sandton')).toBe(true);
  });

  it('produces identical output for reversed input when a hierarchy is supplied', () => {
    const h = () => new Map([[103, [1]], [104, [1]], [100, [999999]]]);
    const a = buildImportPlan(baseData(), admin1, {}, h());
    const b = buildImportPlan([...baseData()].reverse(), admin1, {}, h());
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
});

describe('buildImportPlan — dry-run report data', () => {
  const admin1 = parseAdmin1(ADMIN1_TXT);

  it('reports towns per province, including provinces with none', () => {
    const plan = buildImportPlan(baseData(), admin1);
    expect(plan.stats.townsPerProvince).toEqual({ Gauteng: 4, 'Western Cape': 1, 'KwaZulu-Natal': 0 });
    expect(Object.values(plan.stats.townsPerProvince).reduce((a, b) => a + b, 0)).toBe(plan.stats.towns);
  });

  it('counts suburbs without a reliable parent as weak (province-wide) plus unassigned', () => {
    const plan = buildImportPlan(baseData(), admin1);
    expect(plan.stats.suburbsWithoutReliableParent).toBe(2); // Rosebank (weak) + Remote Place (none)
    expect(plan.suspicious.filter(r => r.kind === 'weak-parent-assignment').map(r => r.name)).toEqual(['Rosebank']);
    expect(plan.suspicious.filter(r => r.kind === 'unassigned-suburb').map(r => r.name)).toEqual(['Remote Place']);
  });

  it('summarises how far suburbs sit from their parents', () => {
    const d = buildImportPlan(baseData(), admin1).stats.suburbDistanceKm!;
    expect(d.median).toBeGreaterThan(0);
    expect(d.max).toBeGreaterThanOrEqual(d.p90);
    expect(d.p90).toBeGreaterThanOrEqual(d.median);
  });

  it('records merged duplicates with the id that survived', () => {
    const plan = buildImportPlan(
      [
        place({ geonameId: 500, name: 'Rietfontein', lat: -27, lng: 25 }),
        place({ geonameId: 501, name: 'Rietfontein', lat: -27.5, lng: 25.5, population: 120 }),
      ],
      admin1,
    );
    const rec = plan.suspicious.find(r => r.kind === 'duplicate-town-name')!;
    expect(rec.geonameId).toBe(500);
    expect(rec.detail).toContain('501');
  });

  it('flags — but still imports — towns outside South Africa, with odd names, or sharing coordinates', () => {
    const plan = buildImportPlan(
      [
        place({ geonameId: 1, name: 'Marion Island', lat: -46.9, lng: 37.7 }), // far outside the SA box
        place({ geonameId: 2, name: 'Farm 12', lat: -27, lng: 25 }),
        place({ geonameId: 3, name: 'Alpha', lat: -28, lng: 26 }),
        place({ geonameId: 4, name: 'Beta', lat: -28, lng: 26 }), // same coordinates as Alpha
      ],
      admin1,
    );
    const kinds = new Set(plan.suspicious.map(r => r.kind));
    expect(kinds).toEqual(new Set(['outside-bounds', 'odd-name', 'same-coordinates']));
    expect(plan.towns).toHaveLength(4); // nothing dropped because of a flag
    expect(plan.suspicious.find(r => r.kind === 'same-coordinates')!.name).toBe('Alpha / Beta');
  });
});
