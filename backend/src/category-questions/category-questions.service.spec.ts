import { CategoryQuestionsService } from './category-questions.service';
import { BadRequestException } from '@nestjs/common';

function makeFakePrisma() {
  const categories = [
    { id: 'cat-plumbing', name: 'Plumbing', slug: 'plumbing' },
    { id: 'cat-electrical', name: 'Electrical', slug: 'electrical' },
  ];
  const subCategories = [
    { id: 'sub-pipe-repair', categoryId: 'cat-plumbing', name: 'Pipe Repairs', slug: 'pipe-repairs' },
    { id: 'sub-wiring', categoryId: 'cat-electrical', name: 'Wiring', slug: 'wiring' },
  ];
  const questions = [
    { id: 'q-1', categoryId: 'cat-plumbing', subCategoryId: null, key: 'urgent', label: 'Is this urgent?', type: 'BOOLEAN', isRequired: true, sortOrder: 0 },
    { id: 'q-2', categoryId: 'cat-plumbing', subCategoryId: 'sub-pipe-repair', key: 'pipeMaterial', label: 'Pipe material?', type: 'SELECT', isRequired: true, sortOrder: 1 },
  ];

  return {
    category: { findUnique: async ({ where }: any) => categories.find((c) => c.id === where.id) ?? null },
    subCategory: { findUnique: async ({ where }: any) => subCategories.find((s) => s.id === where.id) ?? null },
    categoryQuestion: {
      findMany: async ({ where }: any) =>
        questions.filter(
          (q) =>
            q.categoryId === where.categoryId &&
            (where.OR ?? []).some((clause: any) => (clause.subCategoryId === null ? q.subCategoryId === null : q.subCategoryId === clause.subCategoryId)),
        ),
      findUnique: async ({ where }: any) => questions.find((q) => q.id === where.id) ?? null,
      create: async ({ data }: any) => ({ id: 'new-q', ...data }),
      update: async ({ where, data }: any) => ({ id: where.id, ...data }),
      delete: async () => ({}),
    },
  };
}

describe('CategoryQuestionsService', () => {
  it('accepts a valid category/subcategory pair when creating a question', async () => {
    const prisma = makeFakePrisma();
    const service = new CategoryQuestionsService(prisma as any);
    const result = await service.create({
      categoryId: 'cat-plumbing',
      subCategoryId: 'sub-pipe-repair',
      key: 'depth',
      label: 'How deep?',
      type: 'NUMBER',
    });
    expect(result).toBeDefined();
  });

  it('rejects a subcategory that belongs to a different category', async () => {
    const prisma = makeFakePrisma();
    const service = new CategoryQuestionsService(prisma as any);
    await expect(
      service.create({
        categoryId: 'cat-electrical', // wiring's real parent
        subCategoryId: 'sub-pipe-repair', // actually belongs to plumbing
        key: 'x',
        label: 'x',
        type: 'TEXT',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a nonexistent category', async () => {
    const prisma = makeFakePrisma();
    const service = new CategoryQuestionsService(prisma as any);
    await expect(
      service.create({ categoryId: 'cat-missing', key: 'x', label: 'x', type: 'TEXT' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  describe('validateAnswers', () => {
    it('passes when all required answers (category-wide + subcategory-specific) are present', async () => {
      const prisma = makeFakePrisma();
      const service = new CategoryQuestionsService(prisma as any);
      await expect(
        service.validateAnswers('cat-plumbing', 'sub-pipe-repair', { urgent: true, pipeMaterial: 'Copper' }),
      ).resolves.toBeUndefined();
    });

    it('rejects when a required answer is missing', async () => {
      const prisma = makeFakePrisma();
      const service = new CategoryQuestionsService(prisma as any);
      await expect(
        service.validateAnswers('cat-plumbing', 'sub-pipe-repair', { urgent: true }), // pipeMaterial missing
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when answers are omitted entirely and questions are required', async () => {
      const prisma = makeFakePrisma();
      const service = new CategoryQuestionsService(prisma as any);
      await expect(service.validateAnswers('cat-plumbing', 'sub-pipe-repair', undefined)).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
