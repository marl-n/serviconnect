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
      { key: 'areaSqm', label: 'Approximately how large is the area? (m²)', type: 'SELECT', isRequired: true,
        options: ['Under 100 m²', '100–200 m²', '200–500 m²', '500–1,000 m²', '1,000+ m²', 'Not sure'] },
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
      { key: 'areaSqm', label: 'Approximate area (m²)', type: 'SELECT', isRequired: true,
        options: ['Under 100 m²', '100–200 m²', '200–500 m²', '500–1,000 m²', '1,000+ m²', 'Not sure'] },
      { key: 'currentSurface', label: 'What is the current surface?', type: 'SELECT', isRequired: true,
        options: ['Soil', 'Gravel', 'Concrete', 'Existing paving', 'Asphalt / tar', 'Other'] },
      { key: 'vehicleCount', label: 'Approximately how many vehicles will it accommodate?', type: 'NUMBER', isRequired: false },
      { key: 'desiredSurface', label: 'What surface do you want?', type: 'SELECT', isRequired: true,
        options: ['Paving', 'Asphalt / tar', 'Concrete', 'Not sure'] },
      { key: 'needsDrainage', label: 'Is drainage required?', type: 'SELECT', isRequired: false,
        options: ['Yes', 'No', 'Not sure'] },
    ],
  },
  {
    categorySlug: 'paving',
    subCategoryName: 'Tar Surfacing',
    questions: [
      { key: 'workType', label: 'What do you need done?', type: 'SELECT', isRequired: true,
        options: ['New tar surfacing', 'Resurfacing / resealing', 'Pothole repair', 'Full reconstruction', 'Not sure'] },
      { key: 'areaSqm', label: 'Approximately how large is the area? (m²)', type: 'SELECT', isRequired: true,
        options: ['Under 100 m²', '100–200 m²', '200–500 m²', '500–1,000 m²', '1,000+ m²', 'Not sure'] },
      { key: 'currentSurface', label: 'What is the current surface?', type: 'SELECT', isRequired: true,
        options: ['Gravel', 'Soil', 'Old / cracked tar', 'Concrete', 'Other'] },
      { key: 'projectType', label: 'What type of project is this?', type: 'SELECT', isRequired: true,
        options: ['Residential driveway', 'Commercial parking area', 'Road / access road', 'Sports court base', 'Industrial yard', 'Other'] },
      { key: 'needsLineMarking', label: 'Do you need line marking / road markings?', type: 'BOOLEAN', isRequired: false },
      { key: 'urgency', label: 'How soon do you need the work?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within 1–2 weeks', 'Within 1 month', 'Within 1–3 months', 'Just getting quotes'] },
    ],
  },
  {
    categorySlug: 'paving',
    subCategoryName: 'Asphalt Paving',
    questions: [
      { key: 'workType', label: 'What do you need done?', type: 'SELECT', isRequired: true,
        options: ['New asphalt layer', 'Resurfacing existing asphalt', 'Pothole / patch repair', 'Full reconstruction', 'Not sure'] },
      { key: 'areaSqm', label: 'Approximately how large is the area? (m²)', type: 'SELECT', isRequired: true,
        options: ['Under 100 m²', '100–200 m²', '200–500 m²', '500–1,000 m²', '1,000+ m²', 'Not sure'] },
      { key: 'asphaltThickness', label: 'Do you know the required thickness?', type: 'SELECT', isRequired: false,
        options: ['25mm', '40mm', '50mm', '75mm+', 'Not sure'] },
      { key: 'projectType', label: 'What type of project is this?', type: 'SELECT', isRequired: true,
        options: ['Residential driveway', 'Commercial parking area', 'Road', 'Industrial yard', 'Sports / recreation surface', 'Other'] },
      { key: 'currentSurface', label: 'What is the current surface?', type: 'SELECT', isRequired: true,
        options: ['Gravel', 'Soil', 'Old asphalt', 'Concrete', 'Other'] },
      { key: 'urgency', label: 'How soon do you need the work?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within 1–2 weeks', 'Within 1 month', 'Within 1–3 months', 'Just getting quotes'] },
    ],
  },
  {
    categorySlug: 'paving',
    subCategoryName: 'Brick Paving',
    questions: [
      { key: 'workType', label: 'What do you need done?', type: 'SELECT', isRequired: true,
        options: ['New brick paving', 'Replace existing paving', 'Repair / re-lay existing bricks', 'Extend existing area', 'Not sure'] },
      { key: 'areaSqm', label: 'Approximately how large is the area? (m²)', type: 'SELECT', isRequired: true,
        options: ['Under 100 m²', '100–200 m²', '200–500 m²', '500–1,000 m²', '1,000+ m²', 'Not sure'] },
      { key: 'brickType', label: 'What type of brick paver?', type: 'SELECT', isRequired: true,
        options: ['Clay brick', 'Concrete brick', 'Cobble / cobblestone-style brick', 'Not sure'] },
      { key: 'layoutPattern', label: 'Preferred laying pattern?', type: 'SELECT', isRequired: false,
        options: ['Herringbone', 'Stretcher bond', 'Basket weave', 'Not sure — recommend one'] },
      { key: 'needsEdging', label: 'Do you need edge restraints / border installed?', type: 'BOOLEAN', isRequired: true },
      { key: 'currentSurface', label: 'What is the current surface?', type: 'SELECT', isRequired: true,
        options: ['Soil / grass', 'Concrete', 'Existing paving', 'Gravel', 'Other'] },
    ],
  },
  {
    categorySlug: 'paving',
    subCategoryName: 'Concrete Paving',
    questions: [
      { key: 'workType', label: 'What do you need done?', type: 'SELECT', isRequired: true,
        options: ['New concrete surface', 'Replace existing concrete', 'Repair cracked / damaged concrete', 'Extend existing area', 'Not sure'] },
      { key: 'areaSqm', label: 'Approximately how large is the area? (m²)', type: 'SELECT', isRequired: true,
        options: ['Under 100 m²', '100–200 m²', '200–500 m²', '500–1,000 m²', '1,000+ m²', 'Not sure'] },
      { key: 'finishType', label: 'What finish do you want?', type: 'SELECT', isRequired: true,
        options: ['Plain / smooth', 'Broom finish', 'Exposed aggregate', 'Stamped / decorative', 'Not sure'] },
      { key: 'slabThickness', label: 'Do you know the required slab thickness?', type: 'SELECT', isRequired: false,
        options: ['100mm', '125mm', '150mm', '200mm+', 'Not sure'] },
      { key: 'needsReinforcing', label: 'Does it need reinforcing (mesh/rebar)?', type: 'SELECT', isRequired: true,
        options: ['Yes', 'No', 'Not sure'] },
      { key: 'currentSurface', label: 'What is the current surface?', type: 'SELECT', isRequired: true,
        options: ['Soil / grass', 'Gravel', 'Old concrete', 'Existing paving', 'Other'] },
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
      { key: 'gardenSizeSqm', label: 'Approximate garden size (m²)', type: 'SELECT', isRequired: false,
        options: ['Under 100 m²', '100–200 m²', '200–500 m²', '500–1,000 m²', '1,000+ m²', 'Not sure'] },
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
        options: ['Under 100 m²', '100–200 m²', '200–500 m²', '500–1,000 m²', '1,000+ m²', 'Not sure'] },
      { key: 'wasteRemoval', label: 'Is waste removal required?', type: 'BOOLEAN', isRequired: true },
    ],
  },
  {
    categorySlug: 'landscaping',
    subCategoryName: 'Tree Felling',
    questions: [
      { key: 'treeCount', label: 'How many trees need attention?', type: 'SELECT', isRequired: true,
        options: ['1 tree', '2–3 trees', '4–10 trees', '10+ trees'] },
      { key: 'treeSize', label: 'Approximate size of the largest tree?', type: 'SELECT', isRequired: true,
        options: ['Small (under 5m)', 'Medium (5–10m)', 'Large (10–20m)', 'Very large (20m+)', 'Not sure'] },
      { key: 'workType', label: 'What do you need done?', type: 'SELECT', isRequired: true,
        options: ['Full tree removal', 'Trimming / pruning only', 'Stump removal', 'Storm-damaged branch removal', 'Not sure'] },
      { key: 'nearStructures', label: 'Is the tree near buildings, walls, or power lines?', type: 'SELECT', isRequired: true,
        options: ['Yes — close to structures', 'No — open space', 'Not sure'] },
      { key: 'wasteRemoval', label: 'Do you need the wood/waste removed?', type: 'BOOLEAN', isRequired: false },
    ],
  },
  {
    categorySlug: 'landscaping',
    subCategoryName: 'Irrigation Systems',
    questions: [
      { key: 'workType', label: 'What do you need done?', type: 'SELECT', isRequired: true,
        options: ['New irrigation system', 'Repair existing system', 'Expand existing system', 'Convert to drip irrigation', 'Not sure'] },
      { key: 'areaSqm', label: 'Approximately how large is the area to be watered? (m²)', type: 'SELECT', isRequired: true,
        options: ['Under 100 m²', '100–200 m²', '200–500 m²', '500–1,000 m²', '1,000+ m²', 'Not sure'] },
      { key: 'waterSource', label: "What's your water source?", type: 'SELECT', isRequired: true,
        options: ['Municipal supply', 'Borehole', 'Rainwater tank', 'Not sure'] },
      { key: 'wantsAutomation', label: 'Do you want an automated / smart controller?', type: 'BOOLEAN', isRequired: false },
      { key: 'urgency', label: 'How soon do you need the work?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within 1–2 weeks', 'Within 1 month', 'Just getting quotes'] },
    ],
  },
  {
    categorySlug: 'landscaping',
    subCategoryName: 'Paving & Pathways',
    questions: [
      { key: 'pathType', label: 'What do you need built?', type: 'SELECT', isRequired: true,
        options: ['Garden path', 'Stepping stones', 'Pool surround', 'Small patio area', 'Other'] },
      { key: 'pathAreaSqm', label: 'Approximate area? (m²)', type: 'SELECT', isRequired: true,
        options: ['Under 10 m²', '10–30 m²', '30–60 m²', '60–100 m²', '100+ m²', 'Not sure'] },
      { key: 'material', label: 'Preferred material?', type: 'SELECT', isRequired: true,
        options: ['Natural stone', 'Concrete pavers', 'Gravel', 'Wood / decking', 'Not sure'] },
      { key: 'currentSurface', label: 'What is the current surface?', type: 'SELECT', isRequired: false,
        options: ['Soil / grass', 'Existing path', 'Gravel', 'Other'] },
      { key: 'urgency', label: 'How soon do you need the work?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within 1–2 weeks', 'Within 1 month', 'Just getting quotes'] },
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
  {
    categorySlug: 'plumbing',
    subCategoryName: 'New Installations',
    questions: [
      { key: 'installationType', label: 'What needs to be installed?', type: 'SELECT', isRequired: true,
        options: ['New bathroom plumbing', 'New kitchen plumbing', 'New water line', 'New drainage line', 'Full property plumbing', 'Other'] },
      { key: 'propertyType', label: 'What type of property is this?', type: 'SELECT', isRequired: true,
        options: ['House', 'Apartment', 'Complex / townhouse', 'Commercial property', 'New build', 'Other'] },
      { key: 'isNewBuild', label: 'Is this a new build or an existing property?', type: 'SELECT', isRequired: true,
        options: ['New build', 'Existing property renovation'] },
      { key: 'fixtureCount', label: 'Approximately how many fixtures/points?', type: 'SELECT', isRequired: false,
        options: ['1–2', '3–5', '6–10', '10+', 'Not sure'] },
      { key: 'timeframe', label: 'How soon do you need this done?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within 1–2 weeks', 'Within 1 month', 'Just getting quotes'] },
    ],
  },
  {
    categorySlug: 'plumbing',
    subCategoryName: 'Drain Cleaning',
    questions: [
      { key: 'problem', label: "What's the issue?", type: 'SELECT', isRequired: true,
        options: ['Slow draining', 'Fully blocked drain', 'Recurring blockages', 'Bad odour from drain', 'Not sure'] },
      { key: 'location', label: 'Where is the blocked drain?', type: 'SELECT', isRequired: true,
        options: ['Kitchen sink', 'Bathroom', 'Toilet', 'Outside drain / manhole', 'Main sewer line', 'Other'] },
      { key: 'triedBefore', label: 'Have you already tried to clear it yourself?', type: 'BOOLEAN', isRequired: true },
      { key: 'urgency', label: 'How urgent is this?', type: 'SELECT', isRequired: true,
        options: ['Emergency', 'Today', 'Within a few days', 'Not urgent'] },
      { key: 'accessIssues', label: 'Is the drain easily accessible?', type: 'SELECT', isRequired: false,
        options: ['Yes', 'No', 'Not sure'] },
    ],
  },
  {
    categorySlug: 'plumbing',
    subCategoryName: 'Leak Detection',
    questions: [
      { key: 'leakType', label: 'What are you experiencing?', type: 'SELECT', isRequired: true,
        options: ['Visible water leak', 'Unexplained high water bill', 'Damp patches / wall staining', 'Sound of running water', 'Not sure — need it diagnosed'] },
      { key: 'location', label: 'Where do you suspect the leak is?', type: 'SELECT', isRequired: true,
        options: ['Under the slab', 'In a wall', 'Underground / outside pipe', 'Roof / ceiling', 'Not sure'] },
      { key: 'currentlyVisible', label: 'Is water currently visible or causing damage?', type: 'BOOLEAN', isRequired: true },
      { key: 'urgency', label: 'How urgent is this?', type: 'SELECT', isRequired: true,
        options: ['Emergency', 'Today', 'Within a few days', 'Not urgent'] },
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
  {
    categorySlug: 'electrical',
    subCategoryName: 'Residential Wiring',
    questions: [
      { key: 'workType', label: 'What do you need done?', type: 'SELECT', isRequired: true,
        options: ['New wiring for a renovation/extension', 'Rewire entire house', 'Add extra plugs/points', 'Fix faulty wiring', 'Not sure'] },
      { key: 'propertyType', label: 'What type of property is this?', type: 'SELECT', isRequired: true,
        options: ['House', 'Apartment', 'Townhouse', 'New build', 'Other'] },
      { key: 'propertyAge', label: 'Roughly how old is the electrical wiring?', type: 'SELECT', isRequired: false,
        options: ['New / recently rewired', 'Under 10 years', '10–20 years', '20+ years', 'Not sure'] },
      { key: 'pointsNeeded', label: 'Approximately how many new points/plugs needed?', type: 'SELECT', isRequired: false,
        options: ['1–3', '4–8', '9–15', '15+', 'Not sure'] },
      { key: 'urgency', label: 'How soon do you need this done?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within 1–2 weeks', 'Within 1 month', 'Just getting quotes'] },
    ],
  },
  {
    categorySlug: 'electrical',
    subCategoryName: 'Commercial Wiring',
    questions: [
      { key: 'workType', label: 'What do you need done?', type: 'SELECT', isRequired: true,
        options: ['New office/shop wiring', 'Rewire existing space', 'Add points/circuits', 'Compliance / COC inspection', 'Not sure'] },
      { key: 'premisesType', label: 'What type of premises?', type: 'SELECT', isRequired: true,
        options: ['Office', 'Retail shop', 'Warehouse / industrial', 'Restaurant / food premises', 'Other'] },
      { key: 'areaSqm', label: 'Approximately how large is the space? (m²)', type: 'SELECT', isRequired: true,
        options: ['Under 100 m²', '100–200 m²', '200–500 m²', '500–1,000 m²', '1,000+ m²', 'Not sure'] },
      { key: 'needsComplianceCert', label: 'Do you need a Certificate of Compliance (COC)?', type: 'BOOLEAN', isRequired: true },
      { key: 'urgency', label: 'How soon do you need this done?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within 1–2 weeks', 'Within 1 month', 'Just getting quotes'] },
    ],
  },
  {
    categorySlug: 'electrical',
    subCategoryName: 'Solar Installation',
    questions: [
      { key: 'systemType', label: 'What are you looking for?', type: 'SELECT', isRequired: true,
        options: ['Grid-tied solar (no battery)', 'Solar + battery backup', 'Battery backup only (no panels)', 'Not sure — need advice'] },
      { key: 'propertyType', label: 'What type of property is this?', type: 'SELECT', isRequired: true,
        options: ['House', 'Complex / townhouse', 'Commercial property', 'Other'] },
      { key: 'monthlyUsage', label: 'Approximate monthly electricity bill?', type: 'SELECT', isRequired: false,
        options: ['Under R1,500', 'R1,500–R3,000', 'R3,000–R6,000', 'R6,000+', 'Not sure'] },
      { key: 'hasExistingSolar', label: 'Do you already have any solar/inverter equipment installed?', type: 'BOOLEAN', isRequired: true },
      { key: 'roofType', label: 'What is your roof type?', type: 'SELECT', isRequired: false,
        options: ['Tile', 'Corrugated metal / IBR', 'Flat roof', 'Not sure'] },
      { key: 'urgency', label: 'How soon do you need this done?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within 1 month', 'Within 1–3 months', 'Just getting quotes'] },
    ],
  },
  {
    categorySlug: 'electrical',
    subCategoryName: 'DB Board Upgrades',
    questions: [
      { key: 'problem', label: "What's the issue?", type: 'SELECT', isRequired: true,
        options: ['Frequently tripping breakers', 'Old / outdated board', 'Insufficient capacity for new appliances', 'Board fails compliance inspection', 'Not sure'] },
      { key: 'boardAge', label: 'Roughly how old is the current DB board?', type: 'SELECT', isRequired: false,
        options: ['Under 5 years', '5–15 years', '15+ years', 'Not sure'] },
      { key: 'propertyType', label: 'What type of property is this?', type: 'SELECT', isRequired: true,
        options: ['House', 'Apartment', 'Commercial property', 'Other'] },
      { key: 'needsComplianceCert', label: 'Do you need a Certificate of Compliance (COC)?', type: 'BOOLEAN', isRequired: true },
      { key: 'urgency', label: 'How soon do you need this done?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within 1–2 weeks', 'Within 1 month', 'Just getting quotes'] },
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
  {
    categorySlug: 'home-improvement',
    subCategoryName: 'Tiling',
    questions: [
      { key: 'areaToTile', label: 'What needs tiling?', type: 'SELECT', isRequired: true,
        options: ['Bathroom', 'Kitchen', 'Living area floors', 'Outdoor / patio', 'Whole property', 'Other'] },
      { key: 'tilingAreaSqm', label: 'Approximate area to tile? (m²)', type: 'SELECT', isRequired: true,
        options: ['Under 10 m²', '10–30 m²', '30–60 m²', '60–100 m²', '100+ m²', 'Not sure'] },
      { key: 'currentSurface', label: 'What is the current surface?', type: 'SELECT', isRequired: true,
        options: ['Existing tiles (need removal)', 'Concrete / screed', 'Wood', 'Other'] },
      { key: 'tilesSupplied', label: 'Will you supply the tiles?', type: 'SELECT', isRequired: true,
        options: ['Yes', 'No — need supplier advice', 'Either'] },
      { key: 'urgency', label: 'How soon do you need the work?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within 1–2 weeks', 'Within 1 month', 'Just getting quotes'] },
    ],
  },
  {
    categorySlug: 'home-improvement',
    subCategoryName: 'Plastering',
    questions: [
      { key: 'workType', label: 'What plastering work do you need?', type: 'SELECT', isRequired: true,
        options: ['New plastering', 'Re-plastering damaged walls', 'Skimming / finishing coat', 'Ceiling plastering', 'Other'] },
      { key: 'plasterAreaSqm', label: 'Approximate area to plaster? (m²)', type: 'SELECT', isRequired: true,
        options: ['Under 10 m²', '10–30 m²', '30–60 m²', '60–100 m²', '100+ m²', 'Not sure'] },
      { key: 'wallCondition', label: "What's the current wall condition?", type: 'SELECT', isRequired: true,
        options: ['New brickwork — first coat', 'Cracked / damaged plaster', 'Uneven surface', 'Other'] },
      { key: 'propertyType', label: 'What type of property is this?', type: 'SELECT', isRequired: false,
        options: ['House', 'Apartment', 'Commercial property', 'Other'] },
      { key: 'timeframe', label: 'How soon do you need this done?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within 1–2 weeks', 'Within 1 month', 'Just getting quotes'] },
    ],
  },
  {
    categorySlug: 'home-improvement',
    subCategoryName: 'Waterproofing',
    questions: [
      { key: 'areaToWaterproof', label: 'What needs waterproofing?', type: 'SELECT', isRequired: true,
        options: ['Bathroom / wet areas', 'Basement / foundation', 'External walls', 'Balcony / terrace', 'Other'] },
      { key: 'problem', label: "What's the issue?", type: 'SELECT', isRequired: true,
        options: ['Active leak / damp', 'Preventative waterproofing', 'Visible mould / staining', 'Not sure'] },
      { key: 'waterproofAreaSqm', label: 'Approximate area? (m²)', type: 'SELECT', isRequired: false,
        options: ['Under 10 m²', '10–30 m²', '30–60 m²', '60–100 m²', '100+ m²', 'Not sure'] },
      { key: 'currentlyLeaking', label: 'Is water currently leaking through?', type: 'BOOLEAN', isRequired: true },
      { key: 'urgency', label: 'How urgent is this?', type: 'SELECT', isRequired: true,
        options: ['Emergency', 'Within a few days', 'Within 1–2 weeks', 'Not urgent'] },
    ],
  },
  {
    categorySlug: 'home-improvement',
    subCategoryName: 'Kitchen Renovations',
    questions: [
      { key: 'scopeOfWork', label: "What's the scope of the renovation?", type: 'SELECT', isRequired: true,
        options: ['Full kitchen renovation', 'Cupboards / cabinetry only', 'Countertops only', 'Plumbing / electrical updates', 'Other'] },
      { key: 'kitchenSize', label: 'Approximate kitchen size?', type: 'SELECT', isRequired: true,
        options: ['Small (under 10 m²)', 'Medium (10–20 m²)', 'Large (20 m²+)', 'Not sure'] },
      { key: 'hasDesign', label: 'Do you already have a design/layout?', type: 'SELECT', isRequired: true,
        options: ['Yes', 'No', 'Need help designing'] },
      { key: 'propertyOccupied', label: 'Is the property currently occupied?', type: 'BOOLEAN', isRequired: true },
      { key: 'budgetRange', label: 'Approximate budget?', type: 'SELECT', isRequired: false,
        options: ['Under R50,000', 'R50,000–R100,000', 'R100,000–R250,000', 'R250,000–R500,000', 'R500,000+', 'Not sure'] },
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
        options: ['Under R50,000', 'R50,000–R100,000', 'R100,000–R250,000', 'R250,000–R500,000', 'R500,000+', 'Not sure'] },
    ],
  },
  {
    categorySlug: 'construction',
    subCategoryName: 'Road Construction',
    questions: [
      { key: 'projectType', label: 'What type of road project?', type: 'SELECT', isRequired: true,
        options: ['New road construction', 'Road resurfacing', 'Pothole / road repairs', 'Access road for property', 'Other'] },
      { key: 'roadLength', label: 'Approximate road length?', type: 'SELECT', isRequired: true,
        options: ['Under 100m', '100–500m', '500m–1km', '1km+', 'Not sure'] },
      { key: 'surfaceType', label: 'What surface type?', type: 'SELECT', isRequired: true,
        options: ['Tar / asphalt', 'Gravel', 'Concrete', 'Not sure'] },
      { key: 'sector', label: 'Is this residential, commercial, or municipal?', type: 'SELECT', isRequired: false,
        options: ['Residential', 'Commercial', 'Municipal / government', 'Other'] },
      { key: 'timeframe', label: 'How soon do you need this done?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within 1 month', 'Within 1–3 months', 'Just getting quotes'] },
    ],
  },
  {
    categorySlug: 'construction',
    subCategoryName: 'Building Construction',
    questions: [
      { key: 'buildType', label: 'What are you building?', type: 'SELECT', isRequired: true,
        options: ['New house', 'Extension / addition', 'Commercial building', 'Outbuilding / cottage', 'Other'] },
      { key: 'areaSqm', label: 'Approximate building size? (m²)', type: 'SELECT', isRequired: true,
        options: ['Under 100 m²', '100–200 m²', '200–500 m²', '500–1,000 m²', '1,000+ m²', 'Not sure'] },
      { key: 'projectStage', label: 'What stage is the project at?', type: 'SELECT', isRequired: true,
        options: ['Just planning', 'Plans approved', 'Ready to start', 'In progress — need a new contractor'] },
      { key: 'hasPlans', label: 'Do you have approved building plans?', type: 'SELECT', isRequired: true,
        options: ['Yes', 'No', 'In progress'] },
      { key: 'budgetRange', label: 'Approximate budget?', type: 'SELECT', isRequired: false,
        options: ['Under R50,000', 'R50,000–R100,000', 'R100,000–R250,000', 'R250,000–R500,000', 'R500,000+', 'Not sure'] },
    ],
  },
  {
    categorySlug: 'construction',
    subCategoryName: 'Demolition',
    questions: [
      { key: 'structureType', label: 'What needs to be demolished?', type: 'SELECT', isRequired: true,
        options: ['Full house / building', 'Single room / extension', 'Wall(s)', 'Outbuilding', 'Other'] },
      { key: 'areaSqm', label: 'Approximate size of the structure? (m²)', type: 'SELECT', isRequired: true,
        options: ['Under 100 m²', '100–200 m²', '200–500 m²', '500–1,000 m²', '1,000+ m²', 'Not sure'] },
      { key: 'demolitionType', label: 'What type of demolition?', type: 'SELECT', isRequired: true,
        options: ['Full demolition', 'Partial demolition', 'Interior strip-out only'] },
      { key: 'rubbleRemoval', label: 'Do you need rubble removal included?', type: 'BOOLEAN', isRequired: true },
      { key: 'asbestos', label: 'Do you know if the structure contains asbestos?', type: 'SELECT', isRequired: false,
        options: ['Yes', 'No', 'Not sure'] },
      { key: 'timeframe', label: 'How soon do you need this done?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within 1–2 weeks', 'Within 1 month', 'Just getting quotes'] },
    ],
  },
  {
    categorySlug: 'construction',
    subCategoryName: 'Concrete Work',
    questions: [
      { key: 'workType', label: 'What concrete work do you need?', type: 'SELECT', isRequired: true,
        options: ['Foundation / slab', 'Retaining wall', 'Driveway / floor slab', 'Columns / beams', 'Other'] },
      { key: 'areaSqm', label: 'Approximate area? (m²)', type: 'SELECT', isRequired: true,
        options: ['Under 100 m²', '100–200 m²', '200–500 m²', '500–1,000 m²', '1,000+ m²', 'Not sure'] },
      { key: 'needsReinforcing', label: 'Does it need reinforcing (mesh/rebar)?', type: 'SELECT', isRequired: true,
        options: ['Yes', 'No', 'Not sure'] },
      { key: 'finishType', label: 'What finish do you want?', type: 'SELECT', isRequired: false,
        options: ['Plain / smooth', 'Broom finish', 'Exposed aggregate', 'Not sure'] },
      { key: 'timeframe', label: 'How soon do you need this done?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within 1–2 weeks', 'Within 1 month', 'Just getting quotes'] },
    ],
  },
  {
    categorySlug: 'construction',
    subCategoryName: 'Steel Structures',
    questions: [
      { key: 'structureType', label: 'What type of steel structure?', type: 'SELECT', isRequired: true,
        options: ['Warehouse / industrial shed', 'Carport', 'Steel-framed building', 'Steel roof structure', 'Other'] },
      { key: 'areaSqm', label: 'Approximate footprint? (m²)', type: 'SELECT', isRequired: true,
        options: ['Under 100 m²', '100–200 m²', '200–500 m²', '500–1,000 m²', '1,000+ m²', 'Not sure'] },
      { key: 'projectStage', label: 'What stage is the project at?', type: 'SELECT', isRequired: true,
        options: ['Just planning / quoting', 'Design ready', 'Ready to start'] },
      { key: 'hasDrawings', label: 'Do you have engineering drawings?', type: 'BOOLEAN', isRequired: false },
      { key: 'timeframe', label: 'How soon do you need this done?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within 1 month', 'Within 1–3 months', 'Just getting quotes'] },
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
      { key: 'roofSizeSqm', label: 'What best describes the roof/project size?', type: 'SELECT', isRequired: false,
        options: ['Small — e.g. porch or outbuilding', 'Medium — e.g. garage', 'Large — e.g. house', 'Extra large — e.g. warehouse', 'Conservatory', 'Other', 'Not sure'] },
    ],
  },
  {
    categorySlug: 'roofing',
    subCategoryName: 'Roof Installation',
    questions: [
      { key: 'installType', label: 'Is this a new roof or a full replacement?', type: 'SELECT', isRequired: true,
        options: ['New roof (new build / extension)', 'Full replacement of existing roof', 'Not sure'] },
      { key: 'roofType', label: 'What type of roof do you want?', type: 'SELECT', isRequired: true,
        options: ['Tile', 'Corrugated metal / IBR', 'Thatch', 'Flat roof', 'Not sure'] },
      { key: 'roofSizeSqm', label: 'What best describes the roof/project size?', type: 'SELECT', isRequired: true,
        options: ['Small — e.g. porch or outbuilding', 'Medium — e.g. garage', 'Large — e.g. house', 'Extra large — e.g. warehouse', 'Conservatory', 'Other', 'Not sure'] },
      { key: 'needsInsulation', label: 'Do you need roof insulation included?', type: 'BOOLEAN', isRequired: false },
      { key: 'timeframe', label: 'How soon do you need this done?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within 1 month', 'Within 1–3 months', 'Just getting quotes'] },
    ],
  },
  {
    categorySlug: 'roofing',
    subCategoryName: 'Waterproofing',
    questions: [
      { key: 'problem', label: "What's the issue?", type: 'SELECT', isRequired: true,
        options: ['Active leak', 'Damp patches / staining', 'Preventative waterproofing', 'Cracked / damaged membrane', 'Not sure'] },
      { key: 'areaToWaterproof', label: 'What needs waterproofing?', type: 'SELECT', isRequired: true,
        options: ['Flat roof', 'Pitched roof', 'Balcony / terrace', 'Bathroom', 'Foundation / basement', 'Other'] },
      { key: 'roofSizeSqm', label: 'What best describes the roof/project size?', type: 'SELECT', isRequired: false,
        options: ['Small — e.g. porch or outbuilding', 'Medium — e.g. garage', 'Large — e.g. house', 'Extra large — e.g. warehouse', 'Conservatory', 'Other', 'Not sure'] },
      { key: 'currentlyLeaking', label: 'Is it currently leaking?', type: 'BOOLEAN', isRequired: true },
      { key: 'urgency', label: 'How urgent is this?', type: 'SELECT', isRequired: true,
        options: ['Emergency', 'Within a few days', 'Within 1–2 weeks', 'Not urgent'] },
    ],
  },
  {
    categorySlug: 'roofing',
    subCategoryName: 'Roof Painting',
    questions: [
      { key: 'roofType', label: 'What type of roof?', type: 'SELECT', isRequired: true,
        options: ['Tile', 'Corrugated metal / IBR', 'Concrete / cement tile', 'Not sure'] },
      { key: 'roofSizeSqm', label: 'What best describes the roof/project size?', type: 'SELECT', isRequired: true,
        options: ['Small — e.g. porch or outbuilding', 'Medium — e.g. garage', 'Large — e.g. house', 'Extra large — e.g. warehouse', 'Conservatory', 'Other', 'Not sure'] },
      { key: 'currentCondition', label: 'What condition is the roof in?', type: 'SELECT', isRequired: true,
        options: ['Good — just needs a fresh coat', 'Faded / weathered', 'Rust spots', 'Some damaged / cracked tiles', 'Not sure'] },
      { key: 'needsRepairsFirst', label: 'Does it need any repairs before painting?', type: 'SELECT', isRequired: false,
        options: ['Yes', 'No', 'Not sure'] },
      { key: 'colourPreference', label: 'Any colour preference?', type: 'TEXT', isRequired: false },
    ],
  },
  {
    categorySlug: 'roofing',
    subCategoryName: 'Gutters & Fascia',
    questions: [
      { key: 'workType', label: 'What do you need done?', type: 'SELECT', isRequired: true,
        options: ['New gutter installation', 'Replace damaged gutters', 'Repair leaking gutters', 'Fascia board replacement/repair', 'Gutter cleaning', 'Not sure'] },
      { key: 'material', label: 'What gutter material do you prefer?', type: 'SELECT', isRequired: false,
        options: ['Aluminium', 'PVC', 'Seamless aluminium', 'Not sure'] },
      { key: 'approxLength', label: 'Approximate length of guttering needed?', type: 'SELECT', isRequired: false,
        options: ['Under 10m', '10–20m', '20–40m', '40m+', 'Not sure'] },
      { key: 'currentCondition', label: "What's the current condition?", type: 'SELECT', isRequired: true,
        options: ['No gutters yet', 'Old / rusted / damaged', 'Blocked / overflowing', 'Fine — just want an upgrade'] },
      { key: 'urgency', label: 'How soon do you need this done?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within a few weeks', 'Just getting quotes'] },
    ],
  },
  {
    categorySlug: 'roofing',
    subCategoryName: 'Flat Roofs',
    questions: [
      { key: 'problem', label: 'What do you need done?', type: 'SELECT', isRequired: true,
        options: ['New flat roof installation', 'Waterproofing / resealing', 'Leak repair', 'Full replacement', 'Not sure'] },
      { key: 'roofSizeSqm', label: 'What best describes the roof/project size?', type: 'SELECT', isRequired: true,
        options: ['Small — e.g. porch or outbuilding', 'Medium — e.g. garage', 'Large — e.g. house', 'Extra large — e.g. warehouse', 'Conservatory', 'Other', 'Not sure'] },
      { key: 'materialType', label: 'Preferred flat roof material?', type: 'SELECT', isRequired: false,
        options: ['Torch-on waterproofing', 'Membrane (e.g. APP/SBS)', 'Concrete slab', 'Not sure'] },
      { key: 'currentlyLeaking', label: 'Is the roof currently leaking?', type: 'BOOLEAN', isRequired: true },
      { key: 'urgency', label: 'How urgent is this?', type: 'SELECT', isRequired: true,
        options: ['Emergency', 'Within a few days', 'Within 1–2 weeks', 'Not urgent'] },
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
        options: ['1–2 bedrooms', '3–4 bedrooms', '5+ bedrooms', 'Not sure'] },
      { key: 'cleaningType', label: 'What type of cleaning?', type: 'SELECT', isRequired: true,
        options: ['Regular cleaning', 'Deep cleaning', 'Move-in cleaning', 'Move-out cleaning', 'Post-renovation cleaning', 'Other'] },
      { key: 'frequency', label: 'How often?', type: 'SELECT', isRequired: true,
        options: ['Once-off', 'Weekly', 'Every 2 weeks', 'Monthly', 'Other'] },
    ],
  },
  {
    categorySlug: 'cleaning',
    subCategoryName: 'Office Cleaning',
    questions: [
      { key: 'officeSize', label: 'Approximate office size?', type: 'SELECT', isRequired: true,
        options: ['Under 100 m²', '100–300 m²', '300–600 m²', '600+ m²', 'Not sure'] },
      { key: 'cleaningType', label: 'What type of cleaning?', type: 'SELECT', isRequired: true,
        options: ['Regular office cleaning', 'Deep clean', 'Move-in / move-out clean', 'Post-renovation clean', 'Other'] },
      { key: 'frequency', label: 'How often?', type: 'SELECT', isRequired: true,
        options: ['Once-off', 'Daily', '2–3 times a week', 'Weekly', 'Monthly'] },
      { key: 'afterHours', label: 'Does cleaning need to happen after hours?', type: 'BOOLEAN', isRequired: false },
      { key: 'staffCount', label: 'Approximate number of staff/desks?', type: 'SELECT', isRequired: false,
        options: ['Under 10', '10–25', '25–50', '50+', 'Not sure'] },
    ],
  },
  {
    categorySlug: 'cleaning',
    subCategoryName: 'Carpet Cleaning',
    questions: [
      { key: 'propertyType', label: 'What type of property?', type: 'SELECT', isRequired: true,
        options: ['House', 'Apartment', 'Office', 'Other'] },
      { key: 'carpetArea', label: 'Approximate carpeted area?', type: 'SELECT', isRequired: true,
        options: ['1–2 rooms', '3–5 rooms', 'Whole house / office', 'Not sure'] },
      { key: 'carpetCondition', label: "What's the current condition?", type: 'SELECT', isRequired: true,
        options: ['Regular maintenance clean', 'Heavily stained', 'Odour issues (e.g. pets)', 'Water damaged', 'Not sure'] },
      { key: 'carpetType', label: 'Do you know the carpet type?', type: 'SELECT', isRequired: false,
        options: ['Synthetic', 'Wool', 'Rug (not fitted)', 'Not sure'] },
      { key: 'frequency', label: 'How often?', type: 'SELECT', isRequired: false,
        options: ['Once-off', 'Every 6 months', 'Annually', 'Not sure'] },
    ],
  },
  {
    categorySlug: 'cleaning',
    subCategoryName: 'After-builders Cleaning',
    questions: [
      { key: 'propertyType', label: 'What type of property?', type: 'SELECT', isRequired: true,
        options: ['House', 'Apartment', 'Office', 'Commercial property', 'Other'] },
      { key: 'propertySize', label: 'Approximate size?', type: 'SELECT', isRequired: true,
        options: ['1–2 bedrooms', '3–4 bedrooms', '5+ bedrooms', 'Commercial space', 'Not sure'] },
      { key: 'buildStage', label: 'What stage is the build/renovation at?', type: 'SELECT', isRequired: true,
        options: ['Fully complete — ready for final clean', 'Mostly complete — some finishing still happening', 'Not sure'] },
      { key: 'dustLevel', label: 'How much dust/debris is there?', type: 'SELECT', isRequired: false,
        options: ['Light', 'Moderate', "Heavy — full builders' rubble/dust"] },
      { key: 'timeframe', label: 'How soon do you need this done?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within a few days', 'Within 1–2 weeks', 'Just getting quotes'] },
    ],
  },
  {
    categorySlug: 'cleaning',
    subCategoryName: 'Window Cleaning',
    questions: [
      { key: 'propertyType', label: 'What type of property?', type: 'SELECT', isRequired: true,
        options: ['House', 'Apartment', 'Office', 'Commercial property', 'Other'] },
      { key: 'windowCount', label: 'Approximately how many windows?', type: 'SELECT', isRequired: true,
        options: ['Under 10', '10–20', '20–40', '40+', 'Not sure'] },
      { key: 'storeys', label: 'How many storeys/floors?', type: 'SELECT', isRequired: false,
        options: ['Single storey', 'Double storey', '3+ storeys / high-rise'] },
      { key: 'interiorAndExterior', label: 'Do you need inside, outside, or both?', type: 'SELECT', isRequired: true,
        options: ['Outside only', 'Inside only', 'Both'] },
      { key: 'frequency', label: 'How often?', type: 'SELECT', isRequired: false,
        options: ['Once-off', 'Monthly', 'Quarterly', 'Not sure'] },
    ],
  },
  {
    categorySlug: 'cleaning',
    subCategoryName: 'Deep Cleaning',
    questions: [
      { key: 'propertyType', label: 'What type of property?', type: 'SELECT', isRequired: true,
        options: ['House', 'Apartment', 'Office', 'Other'] },
      { key: 'propertySize', label: 'Approximate size?', type: 'SELECT', isRequired: true,
        options: ['1–2 bedrooms', '3–4 bedrooms', '5+ bedrooms', 'Not sure'] },
      { key: 'reason', label: "What's the reason for the deep clean?", type: 'SELECT', isRequired: true,
        options: ['General deep clean / spring clean', 'Move-in / move-out', 'After illness', 'Before an event', 'Other'] },
      { key: 'focusAreas', label: 'Any specific areas that need extra attention?', type: 'MULTISELECT', isRequired: false,
        options: ['Kitchen', 'Bathrooms', 'Oven', 'Windows', 'Carpets', 'Whole property'] },
      { key: 'frequency', label: 'How often?', type: 'SELECT', isRequired: false,
        options: ['Once-off', 'Every 3 months', 'Every 6 months', 'Not sure'] },
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
          options: ['ASAP', 'Within a few days', 'Within 1–2 weeks', 'Just getting quotes'] },
      ],
    }),
  ),

  // ── Beauty Services ───────────────────────────────────────────────────
  {
    categorySlug: 'beauty',
    subCategoryName: 'Hair Styling',
    questions: [
      { key: 'serviceType', label: 'What service do you need?', type: 'SELECT', isRequired: true,
        options: ['Haircut', 'Colour / highlights', 'Braids / weaves', 'Blow-out / styling', 'Treatment (e.g. keratin)', 'Other'] },
      { key: 'hairLength', label: 'Hair length?', type: 'SELECT', isRequired: false,
        options: ['Short', 'Medium', 'Long', 'Not sure'] },
      { key: 'location', label: 'Where would you like this done?', type: 'SELECT', isRequired: true,
        options: ['At the salon', 'Mobile — at my home', 'Either'] },
      { key: 'occasion', label: 'Is this for a special occasion?', type: 'SELECT', isRequired: false,
        options: ['Everyday', 'Event / special occasion', 'Not sure'] },
      { key: 'preferredDate', label: 'When would you like this done?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within a week', 'Within a month', 'Just browsing'] },
    ],
  },
  {
    categorySlug: 'beauty',
    subCategoryName: 'Nail Care',
    questions: [
      { key: 'serviceType', label: 'What service(s) do you need?', type: 'MULTISELECT', isRequired: true,
        options: ['Manicure', 'Pedicure', 'Gel / acrylic nails', 'Nail art', 'Nail repair', 'Other'] },
      { key: 'needsRemoval', label: 'Do you need existing gel/acrylics removed first?', type: 'BOOLEAN', isRequired: false },
      { key: 'location', label: 'Where would you like this done?', type: 'SELECT', isRequired: true,
        options: ['At the salon', 'Mobile — at my home', 'Either'] },
      { key: 'preferredDate', label: 'When would you like this done?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within a week', 'Within a month', 'Just browsing'] },
    ],
  },
  {
    categorySlug: 'beauty',
    subCategoryName: 'Makeup',
    questions: [
      { key: 'occasion', label: "What's the occasion?", type: 'SELECT', isRequired: true,
        options: ['Wedding', 'Special event / party', 'Photoshoot', 'Makeup lesson', 'Other'] },
      { key: 'groupSize', label: 'How many people need makeup done?', type: 'SELECT', isRequired: false,
        options: ['Just me', '2–4 people', '5+ people'] },
      { key: 'location', label: 'Where would you like this done?', type: 'SELECT', isRequired: true,
        options: ['At the studio', 'Mobile — at my venue', 'Either'] },
      { key: 'eventDate', label: 'When is the event?', type: 'SELECT', isRequired: true,
        options: ['Within a week', 'Within a month', '1–3 months away', 'Just getting quotes'] },
    ],
  },
  {
    categorySlug: 'beauty',
    subCategoryName: 'Eyebrows & Lashes',
    questions: [
      { key: 'serviceType', label: 'What service(s) do you need?', type: 'MULTISELECT', isRequired: true,
        options: ['Eyebrow shaping / threading', 'Eyebrow tinting', 'Lash extensions', 'Lash lift / tint', 'Other'] },
      { key: 'firstTime', label: 'Have you had this service before?', type: 'SELECT', isRequired: false,
        options: ['Yes', 'No — first time'] },
      { key: 'location', label: 'Where would you like this done?', type: 'SELECT', isRequired: true,
        options: ['At the salon', 'Mobile — at my home', 'Either'] },
      { key: 'preferredDate', label: 'When would you like this done?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within a week', 'Within a month', 'Just browsing'] },
    ],
  },
  {
    categorySlug: 'beauty',
    subCategoryName: 'Massages',
    questions: [
      { key: 'massageType', label: 'What type of massage?', type: 'SELECT', isRequired: true,
        options: ['Relaxation / Swedish', 'Deep tissue', 'Sports massage', 'Prenatal massage', 'Not sure'] },
      { key: 'location', label: 'Where would you like this done?', type: 'SELECT', isRequired: true,
        options: ['At the spa', 'Mobile — at my home', 'Either'] },
      { key: 'frequency', label: 'How often?', type: 'SELECT', isRequired: false,
        options: ['Once-off', 'Weekly', 'Monthly', 'Not sure'] },
      { key: 'preferredDate', label: 'When would you like this done?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within a week', 'Within a month', 'Just browsing'] },
    ],
  },
  {
    categorySlug: 'beauty',
    subCategoryName: 'Waxing',
    questions: [
      { key: 'areasNeeded', label: 'Which areas need waxing?', type: 'MULTISELECT', isRequired: true,
        options: ['Legs', 'Arms', 'Underarms', 'Facial', 'Bikini / intimate', 'Full body', 'Other'] },
      { key: 'waxType', label: 'Do you have a wax preference?', type: 'SELECT', isRequired: false,
        options: ['Hot wax', 'Strip wax', 'No preference'] },
      { key: 'location', label: 'Where would you like this done?', type: 'SELECT', isRequired: true,
        options: ['At the salon', 'Mobile — at my home', 'Either'] },
      { key: 'preferredDate', label: 'When would you like this done?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within a week', 'Within a month', 'Just browsing'] },
    ],
  },

  // ── Tutoring ──────────────────────────────────────────────────────────
  {
    categorySlug: 'tutoring',
    subCategoryName: 'Mathematics',
    questions: [
      { key: 'studentLevel', label: 'What level is the student?', type: 'SELECT', isRequired: true,
        options: ['Primary school', 'High school (Grades 8–9)', 'High school (Grades 10–12)', 'University / tertiary', 'Adult learner'] },
      { key: 'focus', label: 'What is the main focus?', type: 'SELECT', isRequired: false,
        options: ['General curriculum support', 'Exam preparation', 'A specific topic', 'Not sure'] },
      { key: 'lessonFormat', label: 'Preferred lesson format?', type: 'SELECT', isRequired: true,
        options: ['In-person — at my home', "In-person — tutor's location", 'Online', 'Either'] },
      { key: 'frequency', label: 'How often?', type: 'SELECT', isRequired: true,
        options: ['Once-off', 'Weekly', '2–3 times a week', 'Not sure'] },
      { key: 'startDate', label: 'When would you like to start?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within a week', 'Within a month', 'Just browsing'] },
    ],
  },
  {
    categorySlug: 'tutoring',
    subCategoryName: 'Science',
    questions: [
      { key: 'studentLevel', label: 'What level is the student?', type: 'SELECT', isRequired: true,
        options: ['Primary school', 'High school (Grades 8–9)', 'High school (Grades 10–12)', 'University / tertiary', 'Adult learner'] },
      { key: 'subject', label: 'Which science subject?', type: 'SELECT', isRequired: true,
        options: ['Physical Sciences', 'Life Sciences / Biology', 'Chemistry', 'Physics', 'Not sure'] },
      { key: 'lessonFormat', label: 'Preferred lesson format?', type: 'SELECT', isRequired: true,
        options: ['In-person — at my home', "In-person — tutor's location", 'Online', 'Either'] },
      { key: 'frequency', label: 'How often?', type: 'SELECT', isRequired: true,
        options: ['Once-off', 'Weekly', '2–3 times a week', 'Not sure'] },
      { key: 'startDate', label: 'When would you like to start?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within a week', 'Within a month', 'Just browsing'] },
    ],
  },
  {
    categorySlug: 'tutoring',
    subCategoryName: 'English',
    questions: [
      { key: 'studentLevel', label: 'What level is the student?', type: 'SELECT', isRequired: true,
        options: ['Primary school', 'High school', 'University / tertiary', 'Adult learner', 'English as a second language'] },
      { key: 'focus', label: 'What is the main focus?', type: 'SELECT', isRequired: false,
        options: ['General literacy', 'Exam preparation', 'Essay writing', 'Conversational English', 'Not sure'] },
      { key: 'lessonFormat', label: 'Preferred lesson format?', type: 'SELECT', isRequired: true,
        options: ['In-person — at my home', "In-person — tutor's location", 'Online', 'Either'] },
      { key: 'frequency', label: 'How often?', type: 'SELECT', isRequired: true,
        options: ['Once-off', 'Weekly', '2–3 times a week', 'Not sure'] },
      { key: 'startDate', label: 'When would you like to start?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within a week', 'Within a month', 'Just browsing'] },
    ],
  },
  {
    categorySlug: 'tutoring',
    subCategoryName: 'Accounting',
    questions: [
      { key: 'studentLevel', label: 'What level is the student?', type: 'SELECT', isRequired: true,
        options: ['High school', 'University / tertiary', 'Professional exams (e.g. SAICA, CIMA)', 'Adult learner'] },
      { key: 'focus', label: 'What is the main focus?', type: 'SELECT', isRequired: false,
        options: ['General curriculum support', 'Exam preparation', 'A specific module / topic', 'Not sure'] },
      { key: 'lessonFormat', label: 'Preferred lesson format?', type: 'SELECT', isRequired: true,
        options: ['In-person — at my home', "In-person — tutor's location", 'Online', 'Either'] },
      { key: 'frequency', label: 'How often?', type: 'SELECT', isRequired: true,
        options: ['Once-off', 'Weekly', '2–3 times a week', 'Not sure'] },
      { key: 'startDate', label: 'When would you like to start?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within a week', 'Within a month', 'Just browsing'] },
    ],
  },
  {
    categorySlug: 'tutoring',
    subCategoryName: 'Test Preparation',
    questions: [
      { key: 'examType', label: 'Which exam are you preparing for?', type: 'SELECT', isRequired: true,
        options: ['Matric finals', 'University entrance', 'NBT', 'Professional exam', 'Other'] },
      { key: 'timeUntilExam', label: 'How much time until the exam?', type: 'SELECT', isRequired: true,
        options: ['Under 1 month', '1–3 months', '3–6 months', '6+ months'] },
      { key: 'lessonFormat', label: 'Preferred lesson format?', type: 'SELECT', isRequired: true,
        options: ['In-person — at my home', "In-person — tutor's location", 'Online', 'Either'] },
      { key: 'frequency', label: 'How often?', type: 'SELECT', isRequired: true,
        options: ['Once-off', 'Weekly', '2–3 times a week', 'Not sure'] },
    ],
  },
  {
    categorySlug: 'tutoring',
    subCategoryName: 'University Level',
    questions: [
      { key: 'subject', label: 'Which subject/module do you need help with?', type: 'TEXT', isRequired: true },
      { key: 'degreeLevel', label: 'What level of study?', type: 'SELECT', isRequired: false,
        options: ['Undergraduate', 'Honours', 'Postgraduate / Masters', 'Other'] },
      { key: 'lessonFormat', label: 'Preferred lesson format?', type: 'SELECT', isRequired: true,
        options: ['In-person — at my home', "In-person — tutor's location", 'Online', 'Either'] },
      { key: 'frequency', label: 'How often?', type: 'SELECT', isRequired: true,
        options: ['Once-off', 'Weekly', '2–3 times a week', 'Not sure'] },
      { key: 'startDate', label: 'When would you like to start?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within a week', 'Within a month', 'Just browsing'] },
    ],
  },

  // ── Fitness Training ──────────────────────────────────────────────────
  {
    categorySlug: 'fitness',
    subCategoryName: 'Personal Training',
    questions: [
      { key: 'goal', label: "What's your main fitness goal?", type: 'SELECT', isRequired: true,
        options: ['Weight loss', 'Muscle building', 'General fitness', 'Sports-specific training', 'Injury rehabilitation', 'Other'] },
      { key: 'experienceLevel', label: "What's your current fitness level?", type: 'SELECT', isRequired: false,
        options: ['Beginner', 'Intermediate', 'Advanced'] },
      { key: 'location', label: 'Where would you like to train?', type: 'SELECT', isRequired: true,
        options: ['At my home', 'At a gym', "At the trainer's studio", 'Outdoors', 'Either'] },
      { key: 'frequency', label: 'How often?', type: 'SELECT', isRequired: true,
        options: ['Once-off session', '1x per week', '2–3x per week', '4x+ per week'] },
      { key: 'startDate', label: 'When would you like to start?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within a week', 'Within a month', 'Just browsing'] },
    ],
  },
  {
    categorySlug: 'fitness',
    subCategoryName: 'Group Classes',
    questions: [
      { key: 'classType', label: 'What type of class?', type: 'SELECT', isRequired: true,
        options: ['HIIT', 'Bootcamp', 'Circuit training', 'Dance fitness', 'Not sure'] },
      { key: 'groupSize', label: 'Approximate group size?', type: 'SELECT', isRequired: false,
        options: ['Just me and a friend', 'Small group (3–8)', 'Large group (8+)'] },
      { key: 'location', label: 'Where would you like to train?', type: 'SELECT', isRequired: true,
        options: ['At a venue / gym', 'Outdoors', 'At my location', 'Either'] },
      { key: 'frequency', label: 'How often?', type: 'SELECT', isRequired: true,
        options: ['Once-off', 'Weekly', '2–3x per week'] },
    ],
  },
  {
    categorySlug: 'fitness',
    subCategoryName: 'Online Coaching',
    questions: [
      { key: 'goal', label: "What's your main goal?", type: 'SELECT', isRequired: true,
        options: ['Weight loss', 'Muscle building', 'General fitness', 'Nutrition guidance', 'Other'] },
      { key: 'coachingType', label: 'What type of online coaching?', type: 'SELECT', isRequired: true,
        options: ['Workout programming only', 'Nutrition + workout plan', 'Live virtual sessions', 'Not sure'] },
      { key: 'experienceLevel', label: "What's your current fitness level?", type: 'SELECT', isRequired: false,
        options: ['Beginner', 'Intermediate', 'Advanced'] },
      { key: 'startDate', label: 'When would you like to start?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within a week', 'Within a month', 'Just browsing'] },
    ],
  },
  {
    categorySlug: 'fitness',
    subCategoryName: 'Nutrition Advice',
    questions: [
      { key: 'goal', label: "What's your main goal?", type: 'SELECT', isRequired: true,
        options: ['Weight loss', 'Muscle gain', 'General healthy eating', 'Medical / dietary condition', 'Sports nutrition', 'Other'] },
      { key: 'dietaryRestrictions', label: 'Any dietary restrictions?', type: 'MULTISELECT', isRequired: false,
        options: ['None', 'Vegetarian', 'Vegan', 'Gluten-free', 'Other'] },
      { key: 'consultFormat', label: 'Preferred consultation format?', type: 'SELECT', isRequired: true,
        options: ['In-person', 'Online / video call', 'Either'] },
      { key: 'startDate', label: 'When would you like to start?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within a week', 'Within a month', 'Just browsing'] },
    ],
  },
  {
    categorySlug: 'fitness',
    subCategoryName: 'Boxing & Martial Arts',
    questions: [
      { key: 'discipline', label: 'Which discipline?', type: 'SELECT', isRequired: true,
        options: ['Boxing', 'Kickboxing', 'MMA', 'Karate', 'Taekwondo', 'Other'] },
      { key: 'experienceLevel', label: 'What is your experience level?', type: 'SELECT', isRequired: true,
        options: ['Complete beginner', 'Some experience', 'Experienced / competitive'] },
      { key: 'trainingType', label: 'One-on-one or group?', type: 'SELECT', isRequired: true,
        options: ['One-on-one', 'Group classes', 'Either'] },
      { key: 'location', label: 'Where would you like to train?', type: 'SELECT', isRequired: false,
        options: ['Gym / dojo', 'At my home', 'Either'] },
      { key: 'frequency', label: 'How often?', type: 'SELECT', isRequired: true,
        options: ['Once-off', 'Weekly', '2–3x per week'] },
    ],
  },
  {
    categorySlug: 'fitness',
    subCategoryName: 'Yoga & Pilates',
    questions: [
      { key: 'discipline', label: 'Which do you prefer?', type: 'SELECT', isRequired: true,
        options: ['Yoga', 'Pilates', 'Both / not sure'] },
      { key: 'experienceLevel', label: "What's your current experience level?", type: 'SELECT', isRequired: false,
        options: ['Beginner', 'Intermediate', 'Advanced'] },
      { key: 'classFormat', label: 'One-on-one or group class?', type: 'SELECT', isRequired: true,
        options: ['One-on-one', 'Group class', 'Either'] },
      { key: 'location', label: 'Where would you like to practise?', type: 'SELECT', isRequired: true,
        options: ['Studio', 'At my home', 'Outdoors', 'Either'] },
      { key: 'frequency', label: 'How often?', type: 'SELECT', isRequired: true,
        options: ['Once-off', 'Weekly', '2–3x per week'] },
    ],
  },

  // ── Legal Services ────────────────────────────────────────────────────
  {
    categorySlug: 'legal',
    subCategoryName: 'Property Law',
    questions: [
      { key: 'matterType', label: 'What do you need assistance with?', type: 'SELECT', isRequired: true,
        options: ['Property purchase / sale', 'Bond registration', 'Transfer / conveyancing', 'Property dispute', 'Other'] },
      { key: 'propertyValue', label: 'Approximate property value?', type: 'SELECT', isRequired: false,
        options: ['Under R1m', 'R1m–R3m', 'R3m–R5m', 'R5m+', 'Not sure / prefer not to say'] },
      { key: 'urgency', label: 'How urgent is this?', type: 'SELECT', isRequired: true,
        options: ['Urgent — deadline approaching', 'Within a month', 'Just getting advice'] },
      { key: 'hasDocuments', label: 'Do you already have relevant documents or contracts?', type: 'BOOLEAN', isRequired: false },
    ],
  },
  {
    categorySlug: 'legal',
    subCategoryName: 'Family Law',
    questions: [
      { key: 'matterType', label: 'What do you need assistance with?', type: 'SELECT', isRequired: true,
        options: ['Divorce', 'Child custody / maintenance', 'Marriage contract (ANC)', 'Domestic dispute', 'Other'] },
      { key: 'hasChildren', label: 'Are children involved?', type: 'SELECT', isRequired: false,
        options: ['Yes', 'No'] },
      { key: 'isContested', label: 'Is the matter contested by the other party?', type: 'SELECT', isRequired: false,
        options: ['Yes', 'No', 'Not sure'] },
      { key: 'urgency', label: 'How urgent is this?', type: 'SELECT', isRequired: true,
        options: ['Urgent — deadline approaching', 'Within a month', 'Just getting advice'] },
    ],
  },
  {
    categorySlug: 'legal',
    subCategoryName: 'Labour Law',
    questions: [
      { key: 'matterType', label: 'What do you need assistance with?', type: 'SELECT', isRequired: true,
        options: ['Unfair dismissal', 'CCMA case', 'Employment contract review', 'Retrenchment', 'Workplace dispute', 'Other'] },
      { key: 'role', label: 'Are you the employer or the employee?', type: 'SELECT', isRequired: true,
        options: ['Employee', 'Employer'] },
      { key: 'caseOpened', label: 'Has a case already been opened (e.g. CCMA referral)?', type: 'SELECT', isRequired: false,
        options: ['Yes', 'No', 'Not sure'] },
      { key: 'urgency', label: 'How urgent is this?', type: 'SELECT', isRequired: true,
        options: ['Urgent — hearing or deadline approaching', 'Within a month', 'Just getting advice'] },
    ],
  },
  {
    categorySlug: 'legal',
    subCategoryName: 'Contract Drafting',
    questions: [
      { key: 'contractType', label: 'What type of contract do you need?', type: 'SELECT', isRequired: true,
        options: ['Service agreement', 'Employment contract', 'Lease agreement', 'NDA', 'Partnership / shareholder agreement', 'Other'] },
      { key: 'draftOrReview', label: 'Do you need a new contract or a review?', type: 'SELECT', isRequired: true,
        options: ['Draft a new contract', 'Review an existing contract', 'Both'] },
      { key: 'partiesCount', label: 'How many parties are involved?', type: 'SELECT', isRequired: false,
        options: ['2 parties', '3+ parties', 'Not sure'] },
      { key: 'urgency', label: 'How urgent is this?', type: 'SELECT', isRequired: true,
        options: ['Urgent — deadline approaching', 'Within a month', 'Just getting advice'] },
    ],
  },
  {
    categorySlug: 'legal',
    subCategoryName: 'Criminal Defence',
    questions: [
      { key: 'matterType', label: 'What do you need assistance with?', type: 'SELECT', isRequired: true,
        options: ['Criminal charge / arrest', 'Bail application', 'Court representation', 'Legal advice only', 'Other'] },
      { key: 'hasCourtDate', label: 'Is a court date already set?', type: 'BOOLEAN', isRequired: false },
      { key: 'hasLawyer', label: 'Do you already have a lawyer?', type: 'SELECT', isRequired: false,
        options: ['No', 'Yes — want a second opinion'] },
      { key: 'urgency', label: 'How urgent is this?', type: 'SELECT', isRequired: true,
        options: ['Urgent — court date set', 'Within a few weeks', 'Just getting advice'] },
    ],
  },
  {
    categorySlug: 'legal',
    subCategoryName: 'Estate Planning',
    questions: [
      { key: 'matterType', label: 'What do you need assistance with?', type: 'SELECT', isRequired: true,
        options: ['Will drafting', 'Estate administration', 'Trust setup', 'Deceased estate', 'Other'] },
      { key: 'hasWill', label: 'Do you already have a will?', type: 'SELECT', isRequired: false,
        options: ['Yes — needs updating', 'No', 'Not sure'] },
      { key: 'estateSize', label: 'Approximate estate value?', type: 'SELECT', isRequired: false,
        options: ['Under R500k', 'R500k–R2m', 'R2m–R5m', 'R5m+', 'Prefer not to say'] },
      { key: 'urgency', label: 'How urgent is this?', type: 'SELECT', isRequired: true,
        options: ['Urgent — deadline approaching', 'Within a month', 'Just getting advice'] },
    ],
  },

  // ── Real Estate ───────────────────────────────────────────────────────
  {
    categorySlug: 'real-estate',
    subCategoryName: 'Property Sales',
    questions: [
      { key: 'role', label: 'Are you buying or selling?', type: 'SELECT', isRequired: true,
        options: ['Selling', 'Buying', 'Both'] },
      { key: 'propertyType', label: 'What type of property?', type: 'SELECT', isRequired: true,
        options: ['House', 'Apartment / flat', 'Townhouse', 'Vacant land', 'Commercial property', 'Other'] },
      { key: 'priceRange', label: 'Approximate price range?', type: 'SELECT', isRequired: false,
        options: ['Under R1m', 'R1m–R2.5m', 'R2.5m–R5m', 'R5m+', 'Not sure'] },
      { key: 'timeframe', label: 'What is your timeframe?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within 3 months', 'Within 6 months', 'Just exploring'] },
    ],
  },
  {
    categorySlug: 'real-estate',
    subCategoryName: 'Rentals',
    questions: [
      { key: 'role', label: 'What are you looking for?', type: 'SELECT', isRequired: true,
        options: ['I want to rent out my property', "I'm looking for a rental"] },
      { key: 'propertyType', label: 'What type of property?', type: 'SELECT', isRequired: true,
        options: ['House', 'Apartment / flat', 'Townhouse', 'Commercial space', 'Other'] },
      { key: 'priceRange', label: 'Approximate monthly rent range?', type: 'SELECT', isRequired: false,
        options: ['Under R8,000', 'R8,000–R15,000', 'R15,000–R25,000', 'R25,000+', 'Not sure'] },
      { key: 'moveInDate', label: 'When do you need this?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within a month', 'Within 3 months', 'Just exploring'] },
    ],
  },
  {
    categorySlug: 'real-estate',
    subCategoryName: 'Property Management',
    questions: [
      { key: 'propertyCount', label: 'How many properties need management?', type: 'SELECT', isRequired: true,
        options: ['1 property', '2–5 properties', '6–10 properties', '10+ properties'] },
      { key: 'propertyType', label: 'What type of properties?', type: 'SELECT', isRequired: true,
        options: ['Residential', 'Commercial', 'Mixed'] },
      { key: 'servicesNeeded', label: 'What services do you need?', type: 'MULTISELECT', isRequired: true,
        options: ['Tenant sourcing', 'Rent collection', 'Maintenance coordination', 'Full management', 'Other'] },
      { key: 'currentlyManaged', label: 'How is the property currently managed?', type: 'SELECT', isRequired: false,
        options: ['Self-managed', 'With another agent', 'Vacant / new'] },
    ],
  },
  {
    categorySlug: 'real-estate',
    subCategoryName: 'Property Valuations',
    questions: [
      { key: 'propertyType', label: 'What type of property?', type: 'SELECT', isRequired: true,
        options: ['House', 'Apartment / flat', 'Townhouse', 'Vacant land', 'Commercial property', 'Other'] },
      { key: 'reason', label: "What's the valuation for?", type: 'SELECT', isRequired: true,
        options: ['Selling', 'Bond / refinancing', 'Insurance', 'Deceased estate', 'Other'] },
      { key: 'needsFormalReport', label: 'Do you need a formal written valuation report?', type: 'BOOLEAN', isRequired: false },
      { key: 'timeframe', label: 'How soon do you need it?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within a month', 'Just getting quotes'] },
    ],
  },
  {
    categorySlug: 'real-estate',
    subCategoryName: 'Commercial Property',
    questions: [
      { key: 'role', label: 'Are you buying, selling, or leasing?', type: 'SELECT', isRequired: true,
        options: ['Buying', 'Selling', 'Leasing — as tenant', 'Leasing — as landlord'] },
      { key: 'propertyType', label: 'What type of commercial property?', type: 'SELECT', isRequired: true,
        options: ['Office', 'Retail', 'Warehouse / industrial', 'Mixed-use', 'Other'] },
      { key: 'sizeSqm', label: 'Approximate size needed/available?', type: 'SELECT', isRequired: false,
        options: ['Under 100 m²', '100–500 m²', '500–1,000 m²', '1,000+ m²', 'Not sure'] },
      { key: 'timeframe', label: 'What is your timeframe?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within 3 months', 'Just exploring'] },
    ],
  },

  // ── Freelancers ───────────────────────────────────────────────────────
  {
    categorySlug: 'freelancers',
    subCategoryName: 'Graphic Design',
    questions: [
      { key: 'projectType', label: 'What design work do you need?', type: 'SELECT', isRequired: true,
        options: ['Logo / branding', 'Marketing materials (flyers, brochures)', 'Social media graphics', 'Packaging design', 'Full brand identity', 'Other'] },
      { key: 'hasExistingBrand', label: 'Do you already have brand guidelines or assets?', type: 'SELECT', isRequired: false,
        options: ['Yes', 'No', 'Starting from scratch'] },
      { key: 'needsPrintReady', label: 'Do you need print-ready files?', type: 'BOOLEAN', isRequired: false },
      { key: 'timeframe', label: 'How soon do you need this?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within 2 weeks', 'Within a month', 'Just getting quotes'] },
    ],
  },
  {
    categorySlug: 'freelancers',
    subCategoryName: 'Web Development',
    questions: [
      { key: 'projectType', label: 'What do you need built?', type: 'SELECT', isRequired: true,
        options: ['New website', 'Redesign existing website', 'E-commerce store', 'Web application', 'Fixes / maintenance', 'Other'] },
      { key: 'pageCount', label: 'Approximate number of pages?', type: 'SELECT', isRequired: false,
        options: ['1–5 pages', '5–10 pages', '10+ pages', 'Not sure'] },
      { key: 'hasDesign', label: 'Do you have a design ready?', type: 'SELECT', isRequired: true,
        options: ['Yes', 'No — need design too', 'Not sure'] },
      { key: 'timeframe', label: 'How soon do you need this?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within 1 month', 'Within 1–3 months', 'Just getting quotes'] },
    ],
  },
  {
    categorySlug: 'freelancers',
    subCategoryName: 'Copywriting',
    questions: [
      { key: 'contentType', label: 'What type of content do you need?', type: 'MULTISELECT', isRequired: true,
        options: ['Website copy', 'Blog / articles', 'Social media content', 'Product descriptions', 'Email marketing', 'Other'] },
      { key: 'volume', label: 'Approximate volume of content?', type: 'SELECT', isRequired: false,
        options: ['Short (under 500 words)', 'Medium (500–2,000 words)', 'Large (2,000+ words)', 'Ongoing / recurring'] },
      { key: 'hasStyleGuide', label: 'Do you have a brand voice or style guide?', type: 'SELECT', isRequired: false,
        options: ['Yes', 'No', 'Not sure'] },
      { key: 'timeframe', label: 'How soon do you need this?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within 2 weeks', 'Within a month', 'Just getting quotes'] },
    ],
  },
  {
    categorySlug: 'freelancers',
    subCategoryName: 'Photography',
    questions: [
      { key: 'shootType', label: 'What type of shoot do you need?', type: 'SELECT', isRequired: true,
        options: ['Product photography', 'Event photography', 'Portrait / headshots', 'Real estate photography', 'Corporate / branding', 'Other'] },
      { key: 'location', label: 'Where will the shoot take place?', type: 'SELECT', isRequired: true,
        options: ['At my location', "At the photographer's studio", 'Outdoor location', 'Not sure'] },
      { key: 'hoursNeeded', label: 'How long do you need the photographer?', type: 'SELECT', isRequired: false,
        options: ['Under 1 hour', '1–3 hours', 'Half day', 'Full day', 'Not sure'] },
      { key: 'shootDate', label: 'When do you need this done?', type: 'SELECT', isRequired: true,
        options: ['Within a week', 'Within a month', '1–3 months away', 'Just getting quotes'] },
    ],
  },
  {
    categorySlug: 'freelancers',
    subCategoryName: 'Video Editing',
    questions: [
      { key: 'projectType', label: 'What do you need edited?', type: 'SELECT', isRequired: true,
        options: ['Social media content', 'Corporate / promotional video', 'Wedding / event video', 'YouTube content', 'Other'] },
      { key: 'footageStatus', label: 'Do you already have the raw footage?', type: 'SELECT', isRequired: true,
        options: ['Yes', 'No — need filming too', 'Not sure'] },
      { key: 'videoLength', label: 'Approximate final video length?', type: 'SELECT', isRequired: false,
        options: ['Under 1 minute', '1–5 minutes', '5–15 minutes', '15+ minutes'] },
      { key: 'timeframe', label: 'How soon do you need this?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within 2 weeks', 'Within a month', 'Just getting quotes'] },
    ],
  },
  {
    categorySlug: 'freelancers',
    subCategoryName: 'Social Media Management',
    questions: [
      { key: 'platforms', label: 'Which platforms do you need managed?', type: 'MULTISELECT', isRequired: true,
        options: ['Instagram', 'Facebook', 'TikTok', 'LinkedIn', 'X / Twitter', 'Other'] },
      { key: 'servicesNeeded', label: 'What services do you need?', type: 'MULTISELECT', isRequired: true,
        options: ['Content creation', 'Posting / scheduling', 'Community management', 'Paid ads management', 'Strategy / planning', 'Other'] },
      { key: 'postingFrequency', label: 'How often do you want to post?', type: 'SELECT', isRequired: false,
        options: ['A few times a week', 'Daily', 'Not sure — need advice'] },
      { key: 'startDate', label: 'When would you like to start?', type: 'SELECT', isRequired: true,
        options: ['ASAP', 'Within a month', 'Just getting quotes'] },
    ],
  },
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