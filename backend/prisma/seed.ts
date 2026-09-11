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

type QType = 'TEXT' | 'NUMBER' | 'SELECT' | 'MULTISELECT' | 'BOOLEAN' | 'DATE';

interface QuestionDef {
  key: string;
  label: string;
  type: QType;
  options?: string[];
  isRequired: boolean;
}

interface QuestionGroup {
  categorySlug: string;
  subCategoryName: string;
  questions: QuestionDef[];
}

// Subcategory-specific question sets. Mapped against the REAL categories/
// sub-categories already seeded above (see subCategoryMap) — several of the
// originally proposed category/subcategory names (e.g. "Gardening",
// "Security", "Pools", standalone "Air Conditioning", "Appliance Repair",
// "Flooring") don't exist in this database and were intentionally not
// force-fitted; see the implementation report for the full mapping.
const questionGroups: QuestionGroup[] = [
  // ── Paving ────────────────────────────────────────────────────────────
  {
    categorySlug: 'paving',
    subCategoryName: 'Driveway Paving',
    questions: [
      { key: 'workType', label: 'What do you need done?', type: 'SELECT', isRequired: true,
        options: ['New paving', 'Replace existing paving', 'Repair existing paving', 'Extend existing paved area', 'Not sure'] },
      { key: 'areaSqm', label: 'Approximately how large is the area? (m²)', type: 'NUMBER', isRequired: true },
      { key: 'currentSurface', label: 'What is the current surface?', type: 'SELECT', isRequired: true,
        options: ['Soil / grass', 'Concrete', 'Existing paving', 'Gravel', 'Asphalt / tar', 'Other'] },
      { key: 'pavingType', label: 'What type of paving are you looking for?', type: 'SELECT', isRequired: true,
        options: ['Concrete pavers', 'Clay brick', 'Cobblestone', 'Interlocking pavers', 'Not sure'] },
      { key: 'propertyType', label: 'What type of property is this?', type: 'SELECT', isRequired: true,
        options: ['House', 'Complex / townhouse', 'Apartment', 'Commercial property', 'Industrial property', 'Other'] },
      { key: 'needsExcavation', label: 'Do you need excavation/site preparation?', type: 'SELECT', isRequired: true,
        options: ['Yes', 'No', 'Not sure'] },
      { key: 'urgency', label: 'How soon do you need the work?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within 1–2 weeks', 'Within 1 month', 'Within 1–3 months', 'Just getting quotes'] },
      { key: 'budgetRange', label: 'Do you have a budget range?', type: 'SELECT', isRequired: false,
        options: ['Under R10,000', 'R10,000–R25,000', 'R25,000–R50,000', 'R50,000–R100,000', 'R100,000+', 'Not sure'] },
    ],
  },
  {
    categorySlug: 'paving',
    subCategoryName: 'Parking Lot Paving',
    questions: [
      { key: 'parkingType', label: 'What type of parking area is this?', type: 'SELECT', isRequired: true,
        options: ['Residential', 'Office', 'Retail', 'Industrial', 'Complex / estate', 'Other'] },
      { key: 'areaSqm', label: 'Approximate area (m²)', type: 'NUMBER', isRequired: true },
      { key: 'currentSurface', label: 'What is the current surface?', type: 'SELECT', isRequired: true,
        options: ['Soil', 'Gravel', 'Concrete', 'Existing paving', 'Asphalt / tar', 'Other'] },
      { key: 'vehicleCount', label: 'Approximately how many vehicles will it accommodate?', type: 'NUMBER', isRequired: false },
      { key: 'desiredSurface', label: 'What surface do you want?', type: 'SELECT', isRequired: true,
        options: ['Paving', 'Asphalt / tar', 'Concrete', 'Not sure'] },
      { key: 'needsDrainage', label: 'Is drainage required?', type: 'SELECT', isRequired: false,
        options: ['Yes', 'No', 'Not sure'] },
    ],
  },

  // ── Landscaping ───────────────────────────────────────────────────────
  {
    categorySlug: 'landscaping',
    subCategoryName: 'Lawn Maintenance',
    questions: [
      { key: 'propertyType', label: 'What type of property is this?', type: 'SELECT', isRequired: true,
        options: ['House', 'Complex / townhouse', 'Estate', 'Commercial property', 'Office', 'Other'] },
      { key: 'gardenSize', label: 'Approximate garden size?', type: 'SELECT', isRequired: true,
        options: ['Small', 'Medium', 'Large', 'Not sure'] },
      { key: 'servicesNeeded', label: 'What services do you need?', type: 'MULTISELECT', isRequired: true,
        options: ['Lawn maintenance', 'Weeding', 'Hedge trimming', 'Tree/shrub trimming', 'Planting', 'Garden cleanup', 'Irrigation maintenance', 'Other'] },
      { key: 'frequency', label: 'How often do you need the service?', type: 'SELECT', isRequired: true,
        options: ['Once-off', 'Weekly', 'Every 2 weeks', 'Monthly', 'Occasional'] },
      { key: 'materialsSupplier', label: 'Who will supply plants/materials?', type: 'SELECT', isRequired: false,
        options: ['Customer', 'Gardener', 'Either', 'Not sure'] },
    ],
  },
  {
    categorySlug: 'landscaping',
    subCategoryName: 'Garden Design',
    questions: [
      { key: 'projectGoal', label: 'What are you looking to create?', type: 'SELECT', isRequired: true,
        options: ['New garden', 'Redesign existing garden', 'Lawn installation', 'Planting', 'Hard landscaping', 'Full landscaping project', 'Other'] },
      { key: 'gardenSizeSqm', label: 'Approximate garden size (m²)', type: 'NUMBER', isRequired: false },
      { key: 'elementsRequired', label: 'What elements are required?', type: 'MULTISELECT', isRequired: true,
        options: ['Lawn', 'Plants', 'Flower beds', 'Paving', 'Retaining walls', 'Water features', 'Irrigation', 'Lighting', 'Other'] },
      { key: 'hasDesign', label: 'Do you already have a design/plan?', type: 'SELECT', isRequired: true,
        options: ['Yes', 'No', 'Need the landscaper to design it'] },
      { key: 'needsMaterials', label: 'Do you need materials supplied?', type: 'SELECT', isRequired: false,
        options: ['Yes', 'No', 'Not sure'] },
    ],
  },
  {
    categorySlug: 'landscaping',
    subCategoryName: 'Garden Clearing',
    questions: [
      { key: 'removalItems', label: 'What needs to be removed?', type: 'MULTISELECT', isRequired: true,
        options: ['Garden waste', 'Overgrown vegetation', 'Leaves', 'Branches', 'Grass/weeds', 'General garden waste', 'Other'] },
      { key: 'areaSize', label: 'Approximate size of the area?', type: 'SELECT', isRequired: true,
        options: ['Small', 'Medium', 'Large', 'Not sure'] },
      { key: 'wasteRemoval', label: 'Is waste removal required?', type: 'BOOLEAN', isRequired: true },
    ],
  },

  // ── Plumbing ──────────────────────────────────────────────────────────
  {
    categorySlug: 'plumbing',
    subCategoryName: 'Pipe Repairs',
    questions: [
      { key: 'problem', label: 'What plumbing problem are you experiencing?', type: 'SELECT', isRequired: true,
        options: ['Leaking pipe', 'Burst pipe', 'Blocked drain', 'Blocked toilet', 'Leaking tap', 'Low water pressure', 'No hot water', 'Other'] },
      { key: 'location', label: 'Where is the problem?', type: 'SELECT', isRequired: true,
        options: ['Kitchen', 'Bathroom', 'Outside', 'Garage', 'Ceiling/roof', 'Other'] },
      { key: 'currentlyLeaking', label: 'Is water currently leaking or causing damage?', type: 'BOOLEAN', isRequired: true },
      { key: 'urgency', label: 'How urgent is the problem?', type: 'SELECT', isRequired: true,
        options: ['Emergency', 'Today', 'Within a few days', 'Not urgent'] },
    ],
  },
  {
    categorySlug: 'plumbing',
    subCategoryName: 'Geyser Installation',
    questions: [
      { key: 'installType', label: 'Is this a new installation or replacement?', type: 'SELECT', isRequired: true,
        options: ['New installation', 'Replace existing geyser'] },
      { key: 'geyserType', label: 'What type of geyser do you need?', type: 'SELECT', isRequired: true,
        options: ['Standard electric geyser', 'Solar geyser', 'Heat pump system', 'Not sure'] },
      { key: 'geyserSize', label: 'Do you know the required geyser size?', type: 'SELECT', isRequired: false,
        options: ['50L', '100L', '150L', '200L', '250L+', 'Not sure'] },
      { key: 'hasExistingGeyser', label: 'Is there an existing geyser?', type: 'BOOLEAN', isRequired: true },
    ],
  },
  {
    categorySlug: 'plumbing',
    subCategoryName: 'Bathroom Renovations',
    questions: [
      { key: 'areaRenovated', label: 'What area is being renovated?', type: 'SELECT', isRequired: true,
        options: ['Bathroom', 'Kitchen', 'Laundry', 'Whole property', 'Other'] },
      { key: 'workRequired', label: 'What plumbing work is required?', type: 'MULTISELECT', isRequired: true,
        options: ['New water lines', 'Drainage', 'Fixtures', 'Geyser', 'Bathroom plumbing', 'Kitchen plumbing', 'Full plumbing renovation', 'Other'] },
      { key: 'propertyOccupied', label: 'Is the property currently occupied?', type: 'BOOLEAN', isRequired: true },
      { key: 'timeframe', label: 'Approximate project timeframe?', type: 'TEXT', isRequired: false },
    ],
  },

  // ── Electrical ────────────────────────────────────────────────────────
  {
    categorySlug: 'electrical',
    subCategoryName: 'Fault Finding',
    questions: [
      { key: 'problem', label: 'What is the problem?', type: 'SELECT', isRequired: true,
        options: ['Power outage in part of property', 'Tripping circuit', 'Faulty plug/socket', 'Faulty light', 'Wiring problem', 'Other'] },
      { key: 'location', label: 'Where is the problem?', type: 'SELECT', isRequired: true,
        options: ['House', 'Garage', 'Outside', 'Office', 'Commercial property', 'Other'] },
      { key: 'affectingPower', label: 'Is the problem currently affecting power?', type: 'BOOLEAN', isRequired: true },
      { key: 'isEmergency', label: 'Is this an emergency?', type: 'BOOLEAN', isRequired: true },
    ],
  },
  {
    categorySlug: 'electrical',
    subCategoryName: 'Outdoor Lighting',
    questions: [
      { key: 'lightingType', label: 'What lighting do you need?', type: 'SELECT', isRequired: true,
        options: ['Indoor', 'Outdoor', 'Security lighting', 'Garden lighting', 'Commercial lighting', 'Other'] },
      { key: 'lightCount', label: 'Approximately how many lights?', type: 'NUMBER', isRequired: false },
      { key: 'existingWiring', label: 'Is existing wiring available?', type: 'SELECT', isRequired: true,
        options: ['Yes', 'No', 'Not sure'] },
      { key: 'needsLightsSupplied', label: 'Do you need the lights supplied?', type: 'SELECT', isRequired: false,
        options: ['Yes', 'No', 'Not sure'] },
    ],
  },

  // ── Home Improvement ──────────────────────────────────────────────────
  {
    categorySlug: 'home-improvement',
    subCategoryName: 'Painting',
    questions: [
      { key: 'propertyType', label: 'What type of property?', type: 'SELECT', isRequired: true,
        options: ['House', 'Apartment', 'Office', 'Commercial property', 'Other'] },
      { key: 'areasToPaint', label: 'What areas need painting?', type: 'MULTISELECT', isRequired: true,
        options: ['Bedrooms', 'Living areas', 'Kitchen', 'Bathrooms', 'Entire interior', 'Exterior walls', 'Boundary wall', 'Roof', 'Other'] },
      { key: 'roomCount', label: 'Approximately how many rooms/areas?', type: 'NUMBER', isRequired: false },
      { key: 'surfacePrepNeeded', label: 'Do the walls/surfaces require preparation or repair?', type: 'SELECT', isRequired: true,
        options: ['Yes', 'No', 'Not sure'] },
      { key: 'paintSupplier', label: 'Will you supply the paint?', type: 'SELECT', isRequired: false,
        options: ['Yes', 'No', 'Either'] },
    ],
  },
  {
    categorySlug: 'home-improvement',
    subCategoryName: 'Carpentry',
    questions: [
      { key: 'itemNeeded', label: 'What do you need made?', type: 'SELECT', isRequired: true,
        options: ['Kitchen cupboards', 'Built-in cupboards', 'TV unit', 'Shelving', 'Desk', 'Other'] },
      { key: 'hasMeasurements', label: 'Do you have measurements?', type: 'BOOLEAN', isRequired: true },
      { key: 'hasDesignReference', label: 'Do you have a design/reference?', type: 'BOOLEAN', isRequired: true },
      { key: 'materialPreference', label: 'What material/finish do you prefer?', type: 'SELECT', isRequired: false,
        options: ['Melamine', 'MDF', 'Solid wood', 'Not sure', 'Other'] },
    ],
  },

  // ── Construction ──────────────────────────────────────────────────────
  {
    categorySlug: 'construction',
    subCategoryName: 'Renovations',
    questions: [
      { key: 'renovationType', label: 'What type of renovation?', type: 'SELECT', isRequired: true,
        options: ['Bathroom', 'Kitchen', 'Bedroom', 'Living area', 'Extension', 'Full renovation', 'Other'] },
      { key: 'structuralWork', label: 'Is structural work required?', type: 'SELECT', isRequired: true,
        options: ['Yes', 'No', 'Not sure'] },
      { key: 'hasPlans', label: 'Do you already have plans/drawings?', type: 'SELECT', isRequired: true,
        options: ['Yes', 'No', 'Need assistance'] },
      { key: 'propertyOccupied', label: 'Is the property occupied?', type: 'BOOLEAN', isRequired: true },
      { key: 'budgetRange', label: 'Approximate budget?', type: 'SELECT', isRequired: false,
        options: ['Under R50,000', 'R50,000-R100,000', 'R100,000-R250,000', 'R250,000-R500,000', 'R500,000+', 'Not sure'] },
    ],
  },

  // ── Roofing ───────────────────────────────────────────────────────────
  {
    categorySlug: 'roofing',
    subCategoryName: 'Roof Repairs',
    questions: [
      { key: 'problem', label: 'What is the problem?', type: 'SELECT', isRequired: true,
        options: ['Leak', 'Damaged tiles', 'Broken sheets', 'Waterproofing', 'Structural damage', 'Other'] },
      { key: 'roofType', label: 'What type of roof?', type: 'SELECT', isRequired: true,
        options: ['Tile', 'Corrugated metal', 'IBR', 'Flat roof', 'Other', 'Not sure'] },
      { key: 'currentlyLeaking', label: 'Is the roof currently leaking?', type: 'BOOLEAN', isRequired: true },
      { key: 'roofSizeSqm', label: 'Approximate roof size (m²)', type: 'NUMBER', isRequired: false },
    ],
  },

  // ── Cleaning ──────────────────────────────────────────────────────────
  {
    categorySlug: 'cleaning',
    subCategoryName: 'Residential Cleaning',
    questions: [
      { key: 'propertyType', label: 'What type of property?', type: 'SELECT', isRequired: true,
        options: ['House', 'Apartment', 'Townhouse', 'Other'] },
      { key: 'propertySize', label: 'Approximate size?', type: 'SELECT', isRequired: true,
        options: ['1-2 bedrooms', '3-4 bedrooms', '5+ bedrooms', 'Not sure'] },
      { key: 'cleaningType', label: 'What type of cleaning?', type: 'SELECT', isRequired: true,
        options: ['Regular cleaning', 'Deep cleaning', 'Move-in cleaning', 'Move-out cleaning', 'Post-renovation cleaning', 'Other'] },
      { key: 'frequency', label: 'How often?', type: 'SELECT', isRequired: true,
        options: ['Once-off', 'Weekly', 'Every 2 weeks', 'Monthly', 'Other'] },
    ],
  },

  // ── Auto Repair (same base question set applied to every subcategory,
  //    per the prompt's "at minimum collect..." instruction) ────────────
  ...['Panel Beating', 'Mechanical Repairs', 'Auto Electrical', 'Tyre Services', 'Air Conditioning', 'Diagnostics'].map(
    (subCategoryName): QuestionGroup => ({
      categorySlug: 'auto-repair',
      subCategoryName,
      questions: [
        { key: 'vehicleMake', label: 'Vehicle make', type: 'TEXT', isRequired: true },
        { key: 'vehicleModel', label: 'Vehicle model', type: 'TEXT', isRequired: true },
        { key: 'vehicleYear', label: 'Vehicle year', type: 'NUMBER', isRequired: true },
        { key: 'problem', label: 'What service or problem do you need addressed?', type: 'TEXT', isRequired: true },
        { key: 'isDriveable', label: 'Is the vehicle currently driveable?', type: 'BOOLEAN', isRequired: true },
        { key: 'urgency', label: 'How soon do you need this done?', type: 'SELECT', isRequired: true,
          options: ['ASAP', 'Within a few days', 'Within 1-2 weeks', 'Just getting quotes'] },
      ],
    }),
  ),
];

async function seedCategoryQuestions() {
  console.log('Seeding category questions...');
  let created = 0;
  let updated = 0;
  let skippedMissingCategory = 0;
  let skippedMissingSubCategory = 0;

  for (const group of questionGroups) {
    const category = await prisma.category.findUnique({ where: { slug: group.categorySlug } });
    if (!category) {
      console.warn(`  Skipping "${group.subCategoryName}" — category not found: ${group.categorySlug}`);
      skippedMissingCategory++;
      continue;
    }
    const subCategory = await prisma.subCategory.findFirst({
      where: { categoryId: category.id, name: group.subCategoryName },
    });
    if (!subCategory) {
      console.warn(`  Skipping — sub-category not found: "${group.subCategoryName}" under ${category.name}`);
      skippedMissingSubCategory++;
      continue;
    }

    for (let i = 0; i < group.questions.length; i++) {
      const q = group.questions[i];
      // No natural unique constraint exists on (categoryId, subCategoryId, key)
      // in the schema, so idempotency is handled here via find-then-create/
      // update rather than a Prisma-level upsert — avoids adding a new
      // constraint the existing implementation doesn't already require.
      const existing = await prisma.categoryQuestion.findFirst({
        where: { categoryId: category.id, subCategoryId: subCategory.id, key: q.key },
      });
      const data = {
        label: q.label,
        type: q.type,
        options: q.options ?? undefined,
        isRequired: q.isRequired,
        sortOrder: i,
      };
      if (existing) {
        await prisma.categoryQuestion.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        await prisma.categoryQuestion.create({
          data: { categoryId: category.id, subCategoryId: subCategory.id, key: q.key, ...data },
        });
        created++;
      }
    }
  }

  console.log(
    `  Category questions: ${created} created, ${updated} updated, ` +
    `${skippedMissingCategory} groups skipped (category not found), ` +
    `${skippedMissingSubCategory} groups skipped (sub-category not found).`,
  );
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

  await seedCategoryQuestions();

  console.log(`Seed complete — ${Object.values(subCategoryMap).flat().length} sub-categories seeded.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());