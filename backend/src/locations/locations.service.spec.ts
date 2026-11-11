import { NotFoundException } from '@nestjs/common';
import { LocationsService } from './locations.service';

function fakePrisma() {
  const provinces = [{ id: 'p-gp', name: 'Gauteng' }];
  const towns = [
    { id: 't-jhb', name: 'Johannesburg', provinceId: 'p-gp' },
    { id: 't-nig', name: 'Nigel', provinceId: 'p-gp' },
  ];
  const suburbs = [{ id: 's-san', name: 'Sandton', townId: 't-jhb' }];
  const byId = (rows: any[]) => async ({ where }: any) => rows.find(r => r.id === where.id) ?? null;
  return {
    province: { findUnique: byId(provinces) },
    town: { findUnique: byId(towns), findMany: async ({ where }: any) => towns.filter(t => t.provinceId === where.provinceId) },
    suburb: { findMany: async ({ where }: any) => suburbs.filter(s => s.townId === where.townId) },
  };
}

describe('LocationsService reference data', () => {
  const svc = new LocationsService(fakePrisma() as any);

  it('lists towns of a known province', async () => {
    expect((await svc.getTowns('p-gp')).map(t => t.name)).toEqual(['Johannesburg', 'Nigel']);
  });

  it('returns 404 for an unknown province instead of an empty list', async () => {
    await expect(svc.getTowns('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists suburbs of a known town', async () => {
    expect((await svc.getSuburbs('t-jhb')).map(s => s.name)).toEqual(['Sandton']);
  });

  it('returns an empty list for a known town without suburbs (suburbs are optional)', async () => {
    expect(await svc.getSuburbs('t-nig')).toEqual([]);
  });

  it('returns 404 for an unknown town', async () => {
    await expect(svc.getSuburbs('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});
