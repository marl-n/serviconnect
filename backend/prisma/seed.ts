import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const categories = [
  { name: 'Tar Surfacing & Paving', slug: 'paving', icon: '🛣️', sortOrder: 1 },
  { name: 'Plumbing', slug: 'plumbing', icon: '🔧', sortOrder: 2 },
  { name: 'Electrical', slug: 'electrical', icon: '⚡', sortOrder: 3 },
  { name: 'Roofing', slug: 'roofing', icon: '🏠', sortOrder: 4 },
  { name: 'Cleaning Services', slug: 'cleaning', icon: '🧹', sortOrder: 5 },
  { name: 'Landscaping', slug: 'landscaping', icon: '🌿', sortOrder: 6 },
  { name: 'Construction', slug: 'construction', icon: '🏗️', sortOrder: 7 },
  { name: 'Auto Repair', slug: 'auto-repair', icon: '🚗', sortOrder: 8 },
  { name: 'Beauty Services', slug: 'beauty', icon: '💅', sortOrder: 9 },
  { name: 'Tutoring', slug: 'tutoring', icon: '📚', sortOrder: 10 },
  { name: 'Fitness Training', slug: 'fitness', icon: '💪', sortOrder: 11 },
  { name: 'Home Improvement', slug: 'home-improvement', icon: '🔨', sortOrder: 12 },
  { name: 'Legal Services', slug: 'legal', icon: '⚖️', sortOrder: 13 },
  { name: 'Real Estate', slug: 'real-estate', icon: '🏘️', sortOrder: 14 },
  { name: 'Freelancers', slug: 'freelancers', icon: '💻', sortOrder: 15 },
];

async function main() {
  console.log('Seeding categories...');
  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }

  // Seed a test admin user
  await prisma.user.upsert({
    where: { phone: '+27000000000' },
    update: {},
    create: {
      phone: '+27000000000',
      name: 'Admin User',
      role: 'ADMIN',
    },
  });

  console.log('Seed complete.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
