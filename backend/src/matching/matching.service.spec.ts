import { MatchingService } from './matching.service';

/** In-memory fake covering the Prisma calls MatchingService makes. */
function fakePrisma() {
  const businesses: any[] = [];
  const requests: any[] = [];
  const leads: any[] = [];
  const matchesBiz = (b: any, w: any) =>
    b.categoryId === w.categoryId &&
    w.status.in.includes(b.status) &&
    b.userId !== w.userId.not &&
    b.subCategories.some((s: any) => s.subCategoryId === w.subCategories.some.subCategoryId) &&
    b.serviceAreas.some((a: any) => a.townId === w.serviceAreas.some.townId);
  const matchesReq = (r: any, w: any) =>
    w.status.in.includes(r.status) && r.createdAt >= w.createdAt.gte && r.categoryId === w.categoryId &&
    r.customerId !== w.customerId.not && w.subCategoryId.in.includes(r.subCategoryId) && w.townId.in.includes(r.townId);
  return {
    businesses, requests, leads,
    business: {
      findMany: async ({ where }: any) => businesses.filter(b => matchesBiz(b, where)),
      findUnique: async ({ where }: any) => businesses.find(b => b.id === where.id) ?? null,
      updateMany: async () => ({ count: 0 }),
    },
    serviceRequest: {
      findUnique: async ({ where }: any) => requests.find(r => r.id === where.id) ?? null,
      findMany: async ({ where }: any) => requests.filter(r => matchesReq(r, where)),
      updateMany: async ({ where, data }: any) => {
        const r = requests.find(x => x.id === where.id && x.status === where.status);
        if (r) Object.assign(r, data);
        return { count: r ? 1 : 0 };
      },
    },
    lead: {
      createMany: async ({ data, skipDuplicates }: any) => {
        let count = 0;
        for (const d of data) {
          if (leads.some(l => l.serviceRequestId === d.serviceRequestId && l.businessId === d.businessId)) {
            if (skipDuplicates) continue;
            throw new Error('Unique constraint failed');
          }
          leads.push({ ...d, id: `lead-${leads.length + 1}` });
          count++;
        }
        return { count };
      },
      findMany: async ({ where }: any) =>
        leads
          .filter(l => l.serviceRequestId === where.serviceRequestId && where.businessId.in.includes(l.businessId))
          .map(l => ({ ...l, business: { userId: businesses.find(b => b.id === l.businessId)?.userId } })),
    },
  };
}

const biz = (id: string, over: any = {}) => ({
  id, userId: `user-${id}`, categoryId: 'cat-plumb', status: 'ACTIVE',
  subCategories: [{ subCategoryId: 'sub-geyser' }], serviceAreas: [{ townId: 'town-kempton' }], ...over,
});
const request = (over: any = {}) => ({
  id: 'sr-1', customerId: 'cust-1', categoryId: 'cat-plumb', subCategoryId: 'sub-geyser', townId: 'town-kempton',
  suburbId: 'sub-aston', message: 'Geyser leaking', status: 'OPEN', createdAt: new Date(), ...over,
});

describe('MatchingService', () => {
  it('creates a locked lead only for businesses matching category, sub-category and town', async () => {
    const db = fakePrisma();
    db.businesses.push(
      biz('ok'),
      biz('wrong-category', { categoryId: 'cat-electric' }),
      biz('wrong-sub', { subCategories: [{ subCategoryId: 'sub-drain' }] }),
      biz('wrong-town', { serviceAreas: [{ townId: 'town-benoni' }] }),
      biz('no-areas', { serviceAreas: [] }),
      biz('suspended', { status: 'SUSPENDED' }),
      biz('own', { userId: 'cust-1' }),
      biz('pending', { status: 'PENDING' }),
    );
    db.requests.push(request());
    const svc = new MatchingService(db as any);

    expect(await svc.matchRequest('sr-1')).toBe(2);
    expect(db.leads.map(l => l.businessId).sort()).toEqual(['ok', 'pending']);
    expect(db.leads[0]).toMatchObject({ serviceRequestId: 'sr-1', customerId: 'cust-1', isUnlocked: false, creditCost: 10 });
    expect(db.requests[0].status).toBe('MATCHED');
  });

  it('is idempotent: re-running creates no duplicate leads', async () => {
    const db = fakePrisma();
    db.businesses.push(biz('ok'));
    db.requests.push(request());
    const svc = new MatchingService(db as any);
    await svc.matchRequest('sr-1');
    expect(await svc.matchRequest('sr-1')).toBe(0);
    expect(db.leads).toHaveLength(1);
  });

  it('leaves the request OPEN when no business qualifies', async () => {
    const db = fakePrisma();
    db.requests.push(request());
    expect(await new MatchingService(db as any).matchRequest('sr-1')).toBe(0);
    expect(db.requests[0].status).toBe('OPEN');
  });

  it('does not match cancelled requests', async () => {
    const db = fakePrisma();
    db.businesses.push(biz('ok'));
    db.requests.push(request({ status: 'CANCELLED' }));
    expect(await new MatchingService(db as any).matchRequest('sr-1')).toBe(0);
  });

  it('matchBusiness picks up recent open requests after a business sets its areas, but not old ones', async () => {
    const db = fakePrisma();
    db.businesses.push(biz('late'));
    db.requests.push(request({ id: 'sr-new' }), request({ id: 'sr-old', createdAt: new Date(Date.now() - 30 * 86_400_000) }));
    expect(await new MatchingService(db as any).matchBusiness('late')).toBe(1);
    expect(db.leads.map(l => l.serviceRequestId)).toEqual(['sr-new']);
  });

  it('notifies each business owner once per new lead, never on a re-run', async () => {
    const db = fakePrisma();
    db.businesses.push(biz('a'), biz('b'));
    db.requests.push(request());
    const sent: any[] = [];
    const notifications = { send: async (items: any[]) => { sent.push(...items); } };
    const svc = new MatchingService(db as any, notifications as any);

    await svc.matchRequest('sr-1');
    expect(sent.map(n => n.userId).sort()).toEqual(['user-a', 'user-b']);
    expect(sent.every(n => n.type === 'NEW_LEAD' && n.data.serviceRequestId === 'sr-1')).toBe(true);

    db.businesses.push(biz('c'));
    await svc.matchRequest('sr-1');
    expect(sent.map(n => n.userId).sort()).toEqual(['user-a', 'user-b', 'user-c']);
  });
});
