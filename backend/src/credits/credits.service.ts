import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class CreditsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Returns the business's wallet, creating a zero-balance wallet on first
   * access. Safe under concurrency: relies on the DB unique constraint on
   * businessId — a duplicate-create race resolves to a P2002 error which we
   * swallow and re-read, rather than allowing two wallets for one business.
   */
  async getOrCreateWallet(businessId: string) {
    const existing = await this.prisma.businessWallet.findUnique({ where: { businessId } });
    if (existing) return existing;

    try {
      return await this.prisma.businessWallet.create({ data: { businessId, balance: 0 } });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        // Another concurrent request created it first — that's fine, read it.
        const wallet = await this.prisma.businessWallet.findUnique({ where: { businessId } });
        if (wallet) return wallet;
      }
      throw err;
    }
  }

  async getBalance(businessId: string) {
    const wallet = await this.getOrCreateWallet(businessId);
    return { businessId, balance: wallet.balance };
  }

  async getTransactionHistory(businessId: string, page = 1, limit = 20) {
    const wallet = await this.getOrCreateWallet(businessId);
    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      this.prisma.creditTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.creditTransaction.count({ where: { walletId: wallet.id } }),
    ]);
    return { transactions, total, page, limit };
  }

  /**
   * Atomically unlocks a marketplace lead for the given business:
   *  1. verify ownership
   *  2. no-op (idempotent success) if already unlocked
   *  3. conditional debit — fails as a unit if balance is insufficient
   *  4. append-only ledger row, guarded by a unique idempotencyKey
   *  5. flip Lead.isUnlocked/unlockedAt/unlockTransactionId in the same tx
   *
   * All five steps run inside a single Prisma interactive transaction, so a
   * failure at any step (insufficient funds, lost unlock race, DB error)
   * rolls back every write made so far — no partial deduction is possible.
   */
  async unlockLead({ leadId, businessId }: { leadId: string; businessId: string }) {
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({ where: { id: leadId } });
      if (!lead) throw new NotFoundException('Lead not found');
      if (lead.businessId !== businessId) {
        throw new ForbiddenException('This lead does not belong to your business');
      }

      // Legacy direct-to-business leads have nothing to unlock.
      if (lead.serviceRequestId === null) {
        return { lead, alreadyUnlocked: true, charged: false };
      }

      if (lead.isUnlocked) {
        return { lead, alreadyUnlocked: true, charged: false };
      }

      const creditCost = lead.creditCost ?? 0;
      if (creditCost <= 0) {
        throw new BadRequestException('Lead has no valid credit cost configured');
      }

      const wallet = await this.getOrCreateWalletTx(tx, businessId);

      // Atomic "decrement if sufficient" — the balance check and the write
      // happen in the same statement, so two concurrent unlock attempts
      // can't both succeed against the same balance snapshot.
      const debit = await tx.businessWallet.updateMany({
        where: { businessId, balance: { gte: creditCost } },
        data: { balance: { decrement: creditCost } },
      });
      if (debit.count === 0) {
        throw new ConflictException('Insufficient credits to unlock this lead');
      }

      const updatedWallet = await tx.businessWallet.findUniqueOrThrow({ where: { businessId } });

      const ledgerRow = await tx.creditTransaction.create({
        data: {
          walletId: updatedWallet.id,
          amount: -creditCost,
          balanceAfter: updatedWallet.balance,
          type: 'LEAD_UNLOCK',
          relatedLeadId: lead.id,
          idempotencyKey: `unlock:${lead.id}`,
        },
      });

      // Re-check isUnlocked inside the same transaction — closes the race
      // window between our earlier read and this write.
      const flip = await tx.lead.updateMany({
        where: { id: leadId, isUnlocked: false },
        data: {
          isUnlocked: true,
          unlockedAt: new Date(),
          unlockTransactionId: ledgerRow.id,
        },
      });
      if (flip.count === 0) {
        // Someone else unlocked it between our check and now — abort the
        // whole transaction (including the debit and ledger insert above).
        throw new ConflictException('Lead was already unlocked');
      }

      const finalLead = await tx.lead.findUniqueOrThrow({ where: { id: leadId } });
      return { lead: finalLead, alreadyUnlocked: false, charged: true, transaction: ledgerRow };
    });
  }

  /**
   * Grants credits to a business (promotional or admin adjustment).
   * `idempotencyKey`, if provided, prevents a retried request (or a
   * duplicate webhook delivery, for future PURCHASE grants) from granting
   * credits twice.
   */
  async grantCredits({
    businessId,
    amount,
    type,
    reason,
    performedByUserId,
    relatedPurchaseId,
    idempotencyKey,
  }: {
    businessId: string;
    amount: number;
    type: 'PROMOTIONAL' | 'ADMIN_ADJUSTMENT' | 'PURCHASE';
    reason?: string;
    performedByUserId?: string;
    relatedPurchaseId?: string;
    idempotencyKey?: string;
  }) {
    if (amount <= 0) throw new BadRequestException('Grant amount must be positive');

    return this.prisma.$transaction(async (tx) => {
      if (idempotencyKey) {
        const existing = await tx.creditTransaction.findUnique({ where: { idempotencyKey } });
        if (existing) {
          // Already processed (e.g. a retried request) — return the
          // existing result rather than granting a second time.
          const wallet = await tx.businessWallet.findUniqueOrThrow({ where: { id: existing.walletId } });
          return { transaction: existing, balance: wallet.balance, alreadyProcessed: true };
        }
      }

      const wallet = await this.getOrCreateWalletTx(tx, businessId);

      const updated = await tx.businessWallet.update({
        where: { businessId },
        data: { balance: { increment: amount } },
      });

      const ledgerRow = await tx.creditTransaction.create({
        data: {
          walletId: wallet.id,
          amount,
          balanceAfter: updated.balance,
          type,
          reason,
          performedByUserId,
          relatedPurchaseId,
          idempotencyKey,
        },
      });

      return { transaction: ledgerRow, balance: updated.balance, alreadyProcessed: false };
    });
  }

  /**
   * Refunds the credits spent unlocking a specific lead — used when
   * ServiConnect determines a lead was invalid. This is a ledger
   * correction only: it restores the business's balance but does NOT
   * re-lock the lead, since the customer's contact details have already
   * been shown and cannot meaningfully be "taken back".
   */
  async refundLeadCredits({
    leadId,
    reason,
    performedByUserId,
  }: {
    leadId: string;
    reason: string;
    performedByUserId?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({ where: { id: leadId } });
      if (!lead) throw new NotFoundException('Lead not found');
      if (!lead.unlockTransactionId || !lead.creditCost) {
        throw new BadRequestException('This lead was never unlocked via credits — nothing to refund');
      }

      const idempotencyKey = `refund:${lead.unlockTransactionId}`;
      const existing = await tx.creditTransaction.findUnique({ where: { idempotencyKey } });
      if (existing) {
        const wallet = await tx.businessWallet.findUniqueOrThrow({ where: { id: existing.walletId } });
        return { transaction: existing, balance: wallet.balance, alreadyProcessed: true };
      }

      const wallet = await this.getOrCreateWalletTx(tx, lead.businessId);

      const updated = await tx.businessWallet.update({
        where: { businessId: lead.businessId },
        data: { balance: { increment: lead.creditCost } },
      });

      const ledgerRow = await tx.creditTransaction.create({
        data: {
          walletId: wallet.id,
          amount: lead.creditCost,
          balanceAfter: updated.balance,
          type: 'REFUND',
          reason,
          performedByUserId,
          relatedLeadId: lead.id,
          idempotencyKey,
        },
      });

      // Deliberately NOT touching lead.isUnlocked/unlockedAt here — see
      // docstring above.
      return { transaction: ledgerRow, balance: updated.balance, alreadyProcessed: false };
    });
  }

  /**
   * Completes a previously-created CreditPurchase: grants the purchased
   * credits and flips the purchase to COMPLETED, atomically. Idempotent via
   * the purchase's own id as the idempotency key, so a duplicate Stripe
   * webhook delivery cannot grant credits twice. This method only handles
   * the credit-granting side of a purchase — creating the Stripe
   * PaymentIntent / Checkout Session and the webhook route itself are
   * deliberately out of scope for this phase.
   */
  async completeCreditPurchase(purchaseId: string) {
    return this.prisma.$transaction(async (tx) => {
      const purchase = await tx.creditPurchase.findUnique({ where: { id: purchaseId } });
      if (!purchase) throw new NotFoundException('Credit purchase not found');

      if (purchase.status === 'COMPLETED') {
        const wallet = await this.getOrCreateWalletTx(tx, purchase.businessId);
        return { purchase, balance: wallet.balance, alreadyProcessed: true };
      }
      if (purchase.status !== 'PENDING') {
        throw new BadRequestException(`Cannot complete a purchase with status ${purchase.status}`);
      }

      const idempotencyKey = `purchase:${purchase.id}`;
      const wallet = await this.getOrCreateWalletTx(tx, purchase.businessId);

      const updatedWallet = await tx.businessWallet.update({
        where: { businessId: purchase.businessId },
        data: { balance: { increment: purchase.credits } },
      });

      const ledgerRow = await tx.creditTransaction.create({
        data: {
          walletId: wallet.id,
          amount: purchase.credits,
          balanceAfter: updatedWallet.balance,
          type: 'PURCHASE',
          reason: `Credit purchase ${purchase.id}`,
          relatedPurchaseId: purchase.id,
          idempotencyKey,
        },
      });

      const completedPurchase = await tx.creditPurchase.update({
        where: { id: purchase.id },
        data: { status: 'COMPLETED' },
      });

      return { purchase: completedPurchase, transaction: ledgerRow, balance: updatedWallet.balance, alreadyProcessed: false };
    });
  }

  /** Same wallet-provisioning logic as getOrCreateWallet, but usable inside an existing transaction. */
  private async getOrCreateWalletTx(tx: any, businessId: string) {
    const existing = await tx.businessWallet.findUnique({ where: { businessId } });
    if (existing) return existing;
    try {
      return await tx.businessWallet.create({ data: { businessId, balance: 0 } });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        const wallet = await tx.businessWallet.findUnique({ where: { businessId } });
        if (wallet) return wallet;
      }
      throw err;
    }
  }
}
