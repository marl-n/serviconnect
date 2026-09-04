import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const categories = [
  { name: 'Tar Surfacing & Paving', slug: 'paving',           icon: '🛣️', sortOrder: 1  },
  { name: 'Plumbing',               slug: 'plumbing',         icon: '🔧', sortOrder: 2  },
  { name: 'Electrical',             slug: 'electrical',       icon: '⚡', sortOrder: 3  },
  { name: 'Roofing',                slug: 'roofing',          icon: '🏠', sortOrder: 4  },
  { name: 'Cleaning Services',      slug: 'cleaning',         icon: '🧹', sortOrder: 5  },
  { name: 'Landscaping',            slug: 'landscaping',      icon: '🌿', sortOrder: 6  },
  { name: 'Construction',           slug: 'construction',     icon: '🏗️', sortOrder: 7  },
  { name: 'Auto Repair',            slug: 'auto-repair',      icon: '🚗', sortOrder: 8  },
  { name: 'Beauty Services',        slug: 'beauty',           icon: '💅', sortOrder: 9  },
  { name: 'Tutoring',               slug: 'tutoring',         icon: '📚', sortOrder: 10 },
  { name: 'Fitness Training',       slug: 'fitness',          icon: '💪', sortOrder: 11 },
  { name: 'Home Improvement',       slug: 'home-improvement', icon: '🔨', sortOrder: 12 },
  { name: 'Legal Services',         slug: 'legal',            icon: '⚖️', sortOrder: 13 },
  { name: 'Real Estate',            slug: 'real-estate',      icon: '🏘️', sortOrder: 14 },
  { name: 'Freelancers',            slug: 'freelancers',      icon: '💻', sortOrder: 15 },
];

const subCategoryMap: Record<string, string[]> = {
  'paving':           ['Tar Surfacing', 'Asphalt Paving', 'Brick Paving', 'Concrete Paving', 'Driveway Paving', 'Parking Lot Paving'],
  'plumbing':         ['New Installations', 'Pipe Repairs', 'Drain Cleaning', 'Geyser Installation', 'Leak Detection', 'Bathroom Renovations'],
  'electrical':       ['Residential Wiring', 'Commercial Wiring', 'Solar Installation', 'DB Board Upgrades', 'Fault Finding', 'Outdoor Lighting'],
  'roofing':          ['Roof Installation', 'Roof Repairs', 'Waterproofing', 'Roof Painting', 'Gutters & Fascia', 'Flat Roofs'],
  'cleaning':         ['Residential Cleaning', 'Office Cleaning', 'Carpet Cleaning', 'After-builders Cleaning', 'Window Cleaning', 'Deep Cleaning'],
  'landscaping':      ['Garden Design', 'Lawn Maintenance', 'Tree Felling', 'Irrigation Systems', 'Paving & Pathways', 'Garden Clearing'],
  'construction':     ['Road Construction', 'Building Construction', 'Renovations', 'Demolition', 'Concrete Work', 'Steel Structures'],
  'auto-repair':      ['Panel Beating', 'Mechanical Repairs', 'Auto Electrical', 'Tyre Services', 'Air Conditioning', 'Diagnostics'],
  'beauty':           ['Hair Styling', 'Nail Care', 'Makeup', 'Eyebrows & Lashes', 'Massages', 'Waxing'],
  'tutoring':         ['Mathematics', 'Science', 'English', 'Accounting', 'Test Preparation', 'University Level'],
  'fitness':          ['Personal Training', 'Group Classes', 'Online Coaching', 'Nutrition Advice', 'Boxing & Martial Arts', 'Yoga & Pilates'],
  'home-improvement': ['Painting', 'Tiling', 'Carpentry', 'Plastering', 'Waterproofing', 'Kitchen Renovations'],
  'legal':            ['Property Law', 'Family Law', 'Labour Law', 'Contract Drafting', 'Criminal Defence', 'Estate Planning'],
  'real-estate':      ['Property Sales', 'Rentals', 'Property Management', 'Property Valuations', 'Commercial Property'],
  'freelancers':      ['Graphic Design', 'Web Development', 'Copywriting', 'Photography', 'Video Editing', 'Social Media Management'],
};

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function main() {
  console.log('Seeding categories...');
  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }

  console.log('Seeding sub-categories...');
  for (const [catSlug, subNames] of Object.entries(subCategoryMap)) {
    const category = await prisma.category.findUnique({ where: { slug: catSlug } });
    if (!category) { console.warn(`Category not found: ${catSlug}`); continue; }
    for (const name of subNames) {
      const slug = toSlug(name);
      await prisma.subCategory.upsert({
        where: { categoryId_slug: { categoryId: category.id, slug } },
        update: {},
        create: { categoryId: category.id, name, slug },
      });
    }
  }

  console.log('Seeding admin user...');
  await prisma.user.upsert({
    where: { phone: '+27000000000' },
    update: {},
    create: { phone: '+27000000000', name: 'Admin User', role: 'ADMIN' },
  });

  console.log(`Seed complete — ${Object.values(subCategoryMap).flat().length} sub-categories seeded.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
