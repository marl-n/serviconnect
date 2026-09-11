import { CreditsService } from './credits.service';
import { ConflictException, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

/**
 * A minimal in-memory fake of the slice of PrismaClient this service uses.
 *
 * `$transaction` gives its callback a client bound to a fresh per-call undo
 * log. Every mutation pushes its own inverse onto that log; if the callback
 * throws, only THAT call's mutations are reverted (in reverse order) by
 * running the closures — other transactions' already-committed writes are
 * never touched. This matters: a naive "snapshot the whole store, restore
 * on failure" fake would incorrectly wipe out a concurrently-succeeded
 * transaction when a losing racer rolls back, which would make the
 * concurrency test below meaningless (or flaky) rather than actually
 * exercising the double-spend guard.
 */
function makeFakePrisma() {
  const wallets: any[] = [];
  const transactions: any[] = [];
  const leads: any[] = [];
  const purchases: any[] = [];
  let idCounter = 0;
  const nextId = (prefix: string) => `${prefix}_${++idCounter}`;

  function bind(undoLog: Array<() => void>) {
    const bound = {
      businessWallet: {
        findUnique: async ({ where }: any) => {
          if (where.businessId !== undefined) return wallets.find((w) => w.businessId === where.businessId) ?? null;
          if (where.id !== undefined) return wallets.find((w) => w.id === where.id) ?? null;
          return null;
        },
        findUniqueOrThrow: async (args: any) => {
          const r = await bound.businessWallet.findUnique(args);
          if (!r) throw new Error('NotFound');
          return r;
        },
        create: async ({ data }: any) => {
          if (wallets.some((w) => w.businessId === data.businessId)) {
            const e: any = new Error('Unique constraint failed');
            e.code = 'P2002';
            throw e;
          }
          const row = { id: nextId('wallet'), balance: 0, ...data };
          wallets.push(row);
          undoLog.push(() => {
            const i = wallets.indexOf(row);
            if (i >= 0) wallets.splice(i, 1);
          });
          return row;
        },
        update: async ({ where, data }: any) => {
          const row = wallets.find((w) => w.businessId === where.businessId);
          if (!row) throw new Error('NotFound');
          const prevBalance = row.balance;
          if (data.balance?.increment !== undefined) row.balance += data.balance.increment;
          if (data.balance?.decrement !== undefined) row.balance -= data.balance.decrement;
          undoLog.push(() => (row.balance = prevBalance));
          return { ...row };
        },
        updateMany: async ({ where, data }: any) => {
          const row = wallets.find(
            (w) => w.businessId === where.businessId && (where.balance?.gte === undefined || w.balance >= where.balance.gte),
          );
          if (!row) return { count: 0 };
          const prevBalance = row.balance;
          if (data.balance?.decrement !== undefined) row.balance -= data.balance.decrement;
          if (data.balance?.increment !== undefined) row.balance += data.balance.increment;
          undoLog.push(() => (row.balance = prevBalance));
          return { count: 1 };
        },
      },
      creditTransaction: {
        create: async ({ data }: any) => {
          if (data.idempotencyKey && transactions.some((t) => t.idempotencyKey === data.idempotencyKey)) {
            const e: any = new Error('Unique constraint failed on idempotencyKey');
            e.code = 'P2002';
            throw e;
          }
          const row = { id: nextId('tx'), createdAt: new Date(), ...data };
          transactions.push(row);
          undoLog.push(() => {
            const i = transactions.indexOf(row);
            if (i >= 0) transactions.splice(i, 1);
          });
          return row;
        },
        findUnique: async ({ where }: any) => transactions.find((t) => t.idempotencyKey === where.idempotencyKey) ?? null,
        findMany: async () => transactions,
        count: async () => transactions.length,
      },
      lead: {
        findUnique: async ({ where }: any) => leads.find((l) => l.id === where.id) ?? null,
        findUniqueOrThrow: async (args: any) => {
          const r = await bound.lead.findUnique(args);
          if (!r) throw new Error('NotFound');
          return r;
        },
        updateMany: async ({ where, data }: any) => {
          const row = leads.find((l) => l.id === where.id && (where.isUnlocked === undefined || l.isUnlocked === where.isUnlocked));
          if (!row) return { count: 0 };
          const prev = { ...row };
          Object.assign(row, data);
          undoLog.push(() => Object.assign(row, prev));
          return { count: 1 };
        },
        update: async ({ where, data }: any) => {
          const row = leads.find((l) => l.id === where.id);
          const prev = { ...row };
          Object.assign(row, data);
          undoLog.push(() => Object.assign(row, prev));
          return { ...row };
        },
      },
      creditPurchase: {
        findUnique: async ({ where }: any) => purchases.find((p) => p.id === where.id) ?? null,
        update: async ({ where, data }: any) => {
          const row = purchases.find((p) => p.id === where.id);
          const prev = { ...row };
          Object.assign(row, data);
          undoLog.push(() => Object.assign(row, prev));
          return { ...row };
        },
      },
      $transaction: async (fn: any) => {
        const localUndo: Array<() => void> = [];
        const txClient = bind(localUndo);
        try {
          return await fn(txClient);
        } catch (err) {
          for (let i = localUndo.length - 1; i >= 0; i--) localUndo[i]();
          throw err;
        }
      },
    };
    return bound;
  }

  const topLevel = bind([]); // non-transactional access (getBalance etc.)

  return {
    client: topLevel,
    seedWallet: (businessId: string, balance: number) => {
      const row = { id: nextId('wallet'), businessId, balance };
      wallets.push(row);
      return row;
    },
    seedLead: (lead: any) => {
      const row = { unlockTransactionId: null, isUnlocked: false, creditCost: 100, ...lead };
      leads.push(row);
      return row;
    },
    getWallets: () => wallets,
    getTransactions: () => transactions,
    getLeads: () => leads,
  };
}

describe('CreditsService', () => {
  let fake: ReturnType<typeof makeFakePrisma>;
  let service: CreditsService;

  beforeEach(() => {
    fake = makeFakePrisma();
    service = new CreditsService(fake.client as any);
  });

  describe('wallet creation', () => {
    it('creates a zero-balance wallet on first access', async () => {
      const wallet = await service.getOrCreateWallet('biz-1');
      expect(wallet.balance).toBe(0);
      expect(fake.getWallets()).toHaveLength(1);
    });

    it('returns the existing wallet on subsequent access rather than creating a second one', async () => {
      await service.getOrCreateWallet('biz-1');
      await service.getOrCreateWallet('biz-1');
      expect(fake.getWallets()).toHaveLength(1);
    });
  });

  describe('grantCredits', () => {
    it('increments the wallet balance and writes a ledger row', async () => {
      fake.seedWallet('biz-1', 50);
      const result = await service.grantCredits({ businessId: 'biz-1', amount: 100, type: 'PROMOTIONAL', reason: 'Welcome bonus' });
      expect(result.balance).toBe(150);
      expect(fake.getTransactions()).toHaveLength(1);
      expect(fake.getTransactions()[0].type).toBe('PROMOTIONAL');
      expect(fake.getTransactions()[0].amount).toBe(100);
    });

    it('rejects a non-positive amount', async () => {
      fake.seedWallet('biz-1', 50);
      await expect(
        service.grantCredits({ businessId: 'biz-1', amount: 0, type: 'PROMOTIONAL' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('does not double-grant when the same idempotencyKey is reused', async () => {
      fake.seedWallet('biz-1', 0);
      await service.grantCredits({ businessId: 'biz-1', amount: 100, type: 'PURCHASE', idempotencyKey: 'purchase:abc' });
      const second = await service.grantCredits({ businessId: 'biz-1', amount: 100, type: 'PURCHASE', idempotencyKey: 'purchase:abc' });
      expect(second.alreadyProcessed).toBe(true);
      expect(fake.getWallets()[0].balance).toBe(100); // not 200
      expect(fake.getTransactions()).toHaveLength(1);
    });
  });

  describe('unlockLead — atomic unlock', () => {
    it('unlocks successfully: debits the wallet, writes one ledger row, flips the lead', async () => {
      fake.seedWallet('biz-1', 200);
      fake.seedLead({ id: 'lead-1', businessId: 'biz-1', serviceRequestId: 'sr-1', creditCost: 75, isUnlocked: false });

      const result = await service.unlockLead({ leadId: 'lead-1', businessId: 'biz-1' });

      expect(result.charged).toBe(true);
      expect(result.lead.isUnlocked).toBe(true);
      expect(result.lead.unlockedAt).toBeTruthy();
      expect(result.lead.unlockTransactionId).toBeTruthy();
      expect(fake.getWallets()[0].balance).toBe(125);
      expect(fake.getTransactions()).toHaveLength(1);
      expect(fake.getTransactions()[0].type).toBe('LEAD_UNLOCK');
      expect(fake.getTransactions()[0].amount).toBe(-75);
    });

    it('rejects unlocking a lead belonging to a different business', async () => {
      fake.seedWallet('biz-1', 200);
      fake.seedLead({ id: 'lead-1', businessId: 'biz-OTHER', serviceRequestId: 'sr-1', creditCost: 75, isUnlocked: false });

      await expect(service.unlockLead({ leadId: 'lead-1', businessId: 'biz-1' })).rejects.toBeInstanceOf(ForbiddenException);
      expect(fake.getWallets()[0].balance).toBe(200);
      expect(fake.getTransactions()).toHaveLength(0);
    });

    it('rejects unlock with insufficient credits and leaves the balance untouched', async () => {
      fake.seedWallet('biz-1', 10);
      fake.seedLead({ id: 'lead-1', businessId: 'biz-1', serviceRequestId: 'sr-1', creditCost: 75, isUnlocked: false });

      await expect(service.unlockLead({ leadId: 'lead-1', businessId: 'biz-1' })).rejects.toBeInstanceOf(ConflictException);
      expect(fake.getWallets()[0].balance).toBe(10);
      expect(fake.getTransactions()).toHaveLength(0);
      expect(fake.getLeads()[0].isUnlocked).toBe(false);
    });

    it('is idempotent: unlocking an already-unlocked lead does not charge again', async () => {
      fake.seedWallet('biz-1', 200);
      fake.seedLead({
        id: 'lead-1',
        businessId: 'biz-1',
        serviceRequestId: 'sr-1',
        creditCost: 75,
        isUnlocked: true,
        unlockedAt: new Date(),
        unlockTransactionId: 'tx_existing',
      });

      const result = await service.unlockLead({ leadId: 'lead-1', businessId: 'biz-1' });

      expect(result.alreadyUnlocked).toBe(true);
      expect(result.charged).toBe(false);
      expect(fake.getWallets()[0].balance).toBe(200);
      expect(fake.getTransactions()).toHaveLength(0);
    });

    it('does not charge for a legacy direct-to-business lead (serviceRequestId null)', async () => {
      fake.seedWallet('biz-1', 200);
      fake.seedLead({ id: 'lead-1', businessId: 'biz-1', serviceRequestId: null, creditCost: null, isUnlocked: true });

      const result = await service.unlockLead({ leadId: 'lead-1', businessId: 'biz-1' });

      expect(result.alreadyUnlocked).toBe(true);
      expect(fake.getWallets()[0].balance).toBe(200);
      expect(fake.getTransactions()).toHaveLength(0);
    });

    it('duplicate/concurrent unlock requests never result in two ledger rows or a double charge', async () => {
      fake.seedWallet('biz-1', 100);
      fake.seedLead({ id: 'lead-1', businessId: 'biz-1', serviceRequestId: 'sr-1', creditCost: 100, isUnlocked: false });

      const [a, b] = await Promise.allSettled([
        service.unlockLead({ leadId: 'lead-1', businessId: 'biz-1' }),
        service.unlockLead({ leadId: 'lead-1', businessId: 'biz-1' }),
      ]);

      const succeeded = [a, b].filter((r) => r.status === 'fulfilled');
      const failed = [a, b].filter((r) => r.status === 'rejected');
      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);
      expect((failed[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);

      // Exactly one charge, wallet fully (not partially) debited, never negative.
      expect(fake.getTransactions().filter((t) => t.type === 'LEAD_UNLOCK')).toHaveLength(1);
      expect(fake.getWallets()[0].balance).toBe(0);
      expect(fake.getWallets()[0].balance).toBeGreaterThanOrEqual(0);
    });
  });

  describe('refundLeadCredits', () => {
    it('restores the wallet balance and records a REFUND transaction, without re-locking the lead', async () => {
      fake.seedWallet('biz-1', 25);
      fake.seedLead({
        id: 'lead-1',
        businessId: 'biz-1',
        serviceRequestId: 'sr-1',
        creditCost: 75,
        isUnlocked: true,
        unlockedAt: new Date(),
        unlockTransactionId: 'tx_original',
      });

      const result = await service.refundLeadCredits({ leadId: 'lead-1', reason: 'Duplicate lead', performedByUserId: 'admin-1' });

      expect(result.balance).toBe(100);
      expect(fake.getTransactions()).toHaveLength(1);
      expect(fake.getTransactions()[0].type).toBe('REFUND');
      expect(fake.getTransactions()[0].amount).toBe(75);
      expect(fake.getLeads()[0].isUnlocked).toBe(true);
    });

    it('rejects refunding a lead that was never unlocked via credits', async () => {
      fake.seedLead({ id: 'lead-1', businessId: 'biz-1', serviceRequestId: null, creditCost: null, unlockTransactionId: null });
      await expect(service.refundLeadCredits({ leadId: 'lead-1', reason: 'n/a' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException for a nonexistent lead', async () => {
      await expect(service.refundLeadCredits({ leadId: 'missing', reason: 'n/a' })).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
