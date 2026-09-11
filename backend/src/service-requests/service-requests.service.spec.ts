import { ServiceRequestsService } from './service-requests.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

function makeFakePrisma() {
  const categories = [{ id: 'cat-plumbing', name: 'Plumbing', slug: 'plumbing' }];
  const subCategories = [
    { id: 'sub-pipe-repair', categoryId: 'cat-plumbing', name: 'Pipe Repairs', slug: 'pipe-repairs' },
    { id: 'sub-wiring', categoryId: 'cat-OTHER', name: 'Wiring', slug: 'wiring' },
  ];
  const requests: any[] = [];

  return {
    category: { findUnique: async ({ where }: any) => categories.find((c) => c.id === where.id) ?? null },
    subCategory: { findUnique: async ({ where }: any) => subCategories.find((s) => s.id === where.id) ?? null },
    serviceRequest: {
      create: async ({ data }: any) => {
        const row = { id: `sr-${requests.length + 1}`, createdAt: new Date(), ...data };
        requests.push(row);
        return row;
      },
      findUnique: async ({ where }: any) => requests.find((r) => r.id === where.id) ?? null,
      findMany: async ({ where }: any) => requests.filter((r) => r.customerId === where.customerId),
      update: async ({ where, data }: any) => {
        const row = requests.find((r) => r.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
    _requests: requests,
  };
}

function makeQuestionsServiceStub(shouldThrow = false) {
  return {
    validateAnswers: jest.fn(async () => {
      if (shouldThrow) throw new BadRequestException('Missing required answers: Is this urgent?');
    }),
  } as any;
}

describe('ServiceRequestsService', () => {
  it('creates a service request when category/subcategory are valid and answers pass validation', async () => {
    const prisma = makeFakePrisma();
    const questions = makeQuestionsServiceStub(false);
    const service = new ServiceRequestsService(prisma as any, questions);

    const result = await service.create('customer-1', {
      categoryId: 'cat-plumbing',
      subCategoryId: 'sub-pipe-repair',
      message: 'Leaking pipe under the sink',
    });

    expect(result.status).toBe('OPEN');
    expect(result.customerId).toBe('customer-1');
    expect(questions.validateAnswers).toHaveBeenCalledWith('cat-plumbing', 'sub-pipe-repair', undefined);
  });

  it('rejects a subcategory that does not belong to the given category', async () => {
    const prisma = makeFakePrisma();
    const questions = makeQuestionsServiceStub(false);
    const service = new ServiceRequestsService(prisma as any, questions);

    await expect(
      service.create('customer-1', {
        categoryId: 'cat-plumbing',
        subCategoryId: 'sub-wiring', // belongs to cat-OTHER
        message: 'x',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a nonexistent category', async () => {
    const prisma = makeFakePrisma();
    const questions = makeQuestionsServiceStub(false);
    const service = new ServiceRequestsService(prisma as any, questions);

    await expect(
      service.create('customer-1', { categoryId: 'cat-missing', subCategoryId: 'sub-pipe-repair', message: 'x' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('propagates a category-question validation failure (missing required answer)', async () => {
    const prisma = makeFakePrisma();
    const questions = makeQuestionsServiceStub(true);
    const service = new ServiceRequestsService(prisma as any, questions);

    await expect(
      service.create('customer-1', { categoryId: 'cat-plumbing', subCategoryId: 'sub-pipe-repair', message: 'x' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('subCategoryId is required at the DTO/type level (compile-time), and validated for existence at runtime', async () => {
    const prisma = makeFakePrisma();
    const questions = makeQuestionsServiceStub(false);
    const service = new ServiceRequestsService(prisma as any, questions);

    await expect(
      service.create('customer-1', { categoryId: 'cat-plumbing', subCategoryId: 'sub-does-not-exist', message: 'x' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('prevents a customer from reading another customer\'s service request', async () => {
    const prisma = makeFakePrisma();
    const questions = makeQuestionsServiceStub(false);
    const service = new ServiceRequestsService(prisma as any, questions);
    const created = await service.create('customer-1', { categoryId: 'cat-plumbing', subCategoryId: 'sub-pipe-repair', message: 'x' });

    await expect(service.getById(created.id, 'customer-2')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws NotFoundException for a nonexistent service request', async () => {
    const prisma = makeFakePrisma();
    const questions = makeQuestionsServiceStub(false);
    const service = new ServiceRequestsService(prisma as any, questions);
    await expect(service.getById('missing', 'customer-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
