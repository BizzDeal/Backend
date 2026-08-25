import { Repository } from 'typeorm';
import { Logger } from '@nestjs/common';
import { BusinessCategory } from '../../modules/businesses/entities/business-category.entity';

export interface BusinessCategorySeedItem {
  name: string;
  slug: string;
  icon: string;
  description: string;
}

export const BUSINESS_CATEGORIES: BusinessCategorySeedItem[] = [
  {
    name: 'Computer & IT Solutions',
    slug: 'computer-it-solutions',
    icon: '💻',
    description: 'Computers, Laptops, IT Hardware, Network Infrastructure & IT Solutions',
  },
  {
    name: 'Mobiles & Electronics',
    slug: 'mobiles-electronics',
    icon: '📱',
    description: 'Smartphones, Tablets, Electronic Gadgets, Home Appliances & Accessories',
  },
  {
    name: 'Construction & Civil',
    slug: 'construction-civil',
    icon: '🏗️',
    description: 'Civil Engineering, Construction Contracting, Building Materials & Infrastructure',
  },
  {
    name: 'Real Estate',
    slug: 'real-estate',
    icon: '🏠',
    description: 'Property Sales, Rentals, Gated Communities, Commercial Spaces & Land Plots',
  },
  {
    name: 'Furniture & Interiors',
    slug: 'furniture-interiors',
    icon: '🪑',
    description: 'Home & Office Furniture, Interior Design, Modular Kitchens & Home Decor',
  },
  {
    name: 'Automobiles',
    slug: 'automobiles',
    icon: '🚗',
    description: 'Car & Bike Dealerships, Auto Servicing, Spare Parts & Detailing',
  },
  {
    name: 'Hospitals & Healthcare',
    slug: 'hospitals-healthcare',
    icon: '🏥',
    description: 'Multi-Specialty Hospitals, Clinics, Diagnostic Labs & Healthcare Centers',
  },
  {
    name: 'Eye Care',
    slug: 'eye-care',
    icon: '👁️',
    description: 'Optometry, Eye Hospitals, LASIK, Optical Showrooms & Eyewear',
  },
  {
    name: 'Pharmacy',
    slug: 'pharmacy',
    icon: '💊',
    description: 'Retail Pharmacies, Medical Stores, Generic Medicines & Wellness Products',
  },
  {
    name: 'Legal Services',
    slug: 'legal-services',
    icon: '⚖️',
    description: 'Advocates, Legal Counsel, Corporate Law, Documentation & Notary Services',
  },
  {
    name: 'Accounting & Taxation',
    slug: 'accounting-taxation',
    icon: '📊',
    description: 'Chartered Accountants, GST Filing, Income Tax Audits & Bookkeeping',
  },
  {
    name: 'Insurance',
    slug: 'insurance',
    icon: '🛡️',
    description: 'Life, Health, Motor, General & Commercial Insurance Advisory',
  },
  {
    name: 'Banking & Finance',
    slug: 'banking-finance',
    icon: '🏦',
    description: 'Banking, Loans, MSME Financing, Wealth Management & Mutual Funds',
  },
  {
    name: 'Digital Marketing & Advertising',
    slug: 'digital-marketing-advertising',
    icon: '📣',
    description: 'SEO, Social Media Marketing, PPC Ads, Branding & Lead Generation',
  },
  {
    name: 'Photography & Videography',
    slug: 'photography-videography',
    icon: '📸',
    description: 'Weddings, Corporate Events, Studio Photography & Video Production',
  },
  {
    name: 'Graphic & Creative Design',
    slug: 'graphic-creative-design',
    icon: '🎨',
    description: 'Logo Design, UI/UX, Graphic Design, Brand Identity & Illustrations',
  },
  {
    name: 'Printing & Stationery',
    slug: 'printing-stationery',
    icon: '🖨️',
    description: 'Digital Printing, Offset Printing, Office Stationery & Custom Packaging',
  },
  {
    name: 'Clothing & Fashion',
    slug: 'clothing-fashion',
    icon: '👗',
    description: 'Men, Women & Kids Apparel, Designer Wear, Ethnic Fashion & Accessories',
  },
  {
    name: 'Jewellery',
    slug: 'jewellery',
    icon: '💎',
    description: 'Gold, Diamond, Silver Jewellery, Gemstones & Antique Ornaments',
  },
  {
    name: 'Beauty & Salon',
    slug: 'beauty-salon',
    icon: '💇',
    description: 'Hair Salons, Spas, Bridal Makeup, Skin Treatments & Personal Grooming',
  },
  {
    name: 'Restaurants & Catering',
    slug: 'restaurants-catering',
    icon: '🍽️',
    description: 'Fine Dining, Cafes, Multi-Cuisine Restaurants & Event Catering Services',
  },
  {
    name: 'Bakery & Sweets',
    slug: 'bakery-sweets',
    icon: '🧁',
    description: 'Artisan Cakes, Pastries, Fresh Bakery, Traditional Sweets & Confectionery',
  },
  {
    name: 'Agriculture & Farming',
    slug: 'agriculture-farming',
    icon: '🌾',
    description: 'Organic Farming, Agricultural Supplies, Seeds, Fertilizers & Equipment',
  },
  {
    name: 'Transport & Logistics',
    slug: 'transport-logistics',
    icon: '🚚',
    description: 'Freight Forwarding, Logistics Fleet, Supply Chain & Cargo Transport',
  },
  {
    name: 'Travel & Tourism',
    slug: 'travel-tourism',
    icon: '✈️',
    description: 'Holiday Packages, Flight Bookings, Tour Guides & Sightseeing Tours',
  },
  {
    name: 'Hotels & Resorts',
    slug: 'hotels-resorts',
    icon: '🏨',
    description: 'Luxury Resorts, Boutique Hotels, Serviced Stays & Banquet Facilities',
  },
  {
    name: 'Education & Training',
    slug: 'education-training',
    icon: '🎓',
    description: 'Schools, Colleges, Skill Development Centers & Professional Training Institutes',
  },
  {
    name: 'Coaching & Tuition',
    slug: 'coaching-tuition',
    icon: '📚',
    description: 'IIT-JEE, NEET, Competitive Exams, School Tuitions & Academic Coaching',
  },
  {
    name: 'Electrical & Plumbing',
    slug: 'electrical-plumbing',
    icon: '🔧',
    description: 'Electricians, Plumbers, Sanitary Fittings & Emergency Repairs',
  },
  {
    name: 'AC & Refrigeration',
    slug: 'ac-refrigeration',
    icon: '❄️',
    description: 'HVAC, Air Conditioner Sales, Cooling Units, Repair & Maintenance Services',
  },
  {
    name: 'CCTV & Security Systems',
    slug: 'cctv-security-systems',
    icon: '🔐',
    description: 'CCTV Surveillance, Access Control, Smart Security & Biometrics',
  },
  {
    name: 'Solar Energy',
    slug: 'solar-energy',
    icon: '☀️',
    description: 'Rooftop Solar Plants, Solar Inverters, Panels & Clean Energy Solutions',
  },
  {
    name: 'Machinery & Engineering',
    slug: 'machinery-engineering',
    icon: '⚙️',
    description: 'Industrial Machinery, Heavy Engineering, Tools & Automation Equipment',
  },
  {
    name: 'Manufacturing',
    slug: 'manufacturing',
    icon: '🏭',
    description: 'Industrial Production, Fabrication, Raw Materials & Processing Plants',
  },
  {
    name: 'Wholesale & Distribution',
    slug: 'wholesale-distribution',
    icon: '📦',
    description: 'B2B Wholesale Traders, Bulk Supply & Commercial Distribution Networks',
  },
  {
    name: 'Retail & Supermarket',
    slug: 'retail-supermarket',
    icon: '🛒',
    description: 'Supermarkets, Grocery Stores, Department Stores & Everyday Essentials',
  },
  {
    name: 'Cleaning Services',
    slug: 'cleaning-services',
    icon: '🧹',
    description: 'Deep Cleaning, Housekeeping, Pest Control & Facility Sanitization',
  },
  {
    name: 'HR & Recruitment',
    slug: 'hr-recruitment',
    icon: '🧑💼',
    description: 'Staffing Solutions, Executive Search, Talent Acquisition & Payroll Services',
  },
  {
    name: 'Business Consultancy',
    slug: 'business-consultancy',
    icon: '💼',
    description: 'Strategic Management, Business Licensing, Company Registration & Advisory',
  },
  {
    name: 'Packers & Movers',
    slug: 'packers-movers',
    icon: '🚛',
    description: 'Home & Office Relocation, Packing Services & Vehicle Transportation',
  },
  {
    name: 'Software & Web Development',
    slug: 'software-web-development',
    icon: '🌐',
    description: 'Custom Web Applications, Mobile Apps, Cloud Engineering & SaaS Development',
  },
];

export async function seedBusinessCategories(
  categoryRepository: Repository<BusinessCategory>,
): Promise<void> {
  const logger = new Logger('SeedBusinessCategories');
  logger.log('Checking and seeding Business Categories...');

  for (const item of BUSINESS_CATEGORIES) {
    const existing = await categoryRepository.findOne({
      where: [{ slug: item.slug }, { name: item.name }],
    });
    if (!existing) {
      const category = categoryRepository.create({
        name: item.name,
        slug: item.slug,
        icon: item.icon,
        description: item.description,
        is_active: true,
      });
      await categoryRepository.save(category);
      logger.log(`Inserted business category: "${item.name}" (${item.slug}) with icon ${item.icon}`);
    } else {
      let needsUpdate = false;
      if (existing.name !== item.name) {
        existing.name = item.name;
        needsUpdate = true;
      }
      if (existing.slug !== item.slug) {
        existing.slug = item.slug;
        needsUpdate = true;
      }
      if (existing.icon !== item.icon) {
        existing.icon = item.icon;
        needsUpdate = true;
      }
      if (existing.description !== item.description) {
        existing.description = item.description;
        needsUpdate = true;
      }
      if (!existing.is_active) {
        existing.is_active = true;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await categoryRepository.save(existing);
        logger.log(`Updated business category: "${item.name}" (${item.slug}) with icon ${item.icon}`);
      } else {
        logger.log(`Business category "${item.name}" already up-to-date. Skipping.`);
      }
    }
  }

  const officialSlugs = BUSINESS_CATEGORIES.map((c) => c.slug);
  await categoryRepository
    .createQueryBuilder()
    .update(BusinessCategory)
    .set({ is_active: false })
    .where('slug NOT IN (:...slugs)', { slugs: officialSlugs })
    .execute();
  logger.log('Deactivated non-official / test business categories.');
}
