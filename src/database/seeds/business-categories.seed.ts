import { Repository } from 'typeorm';
import { Logger } from '@nestjs/common';
import { BusinessCategory } from '../../modules/businesses/entities/business-category.entity';

export const BUSINESS_CATEGORIES = [
  {
    name: 'IT Services',
    slug: 'it-services',
    description: 'Information Technology and Software Services',
  },
  {
    name: 'Restaurant',
    slug: 'restaurant',
    description: 'Food, Dining, and Restaurants',
  },
  {
    name: 'Hotels',
    slug: 'hotels',
    description: 'Hotels, Resorts, and Hospitality',
  },
  {
    name: 'Healthcare',
    slug: 'healthcare',
    description: 'Hospitals, Clinics, and Healthcare Providers',
  },
  {
    name: 'Real Estate',
    slug: 'real-estate',
    description: 'Real Estate Agencies, Brokers, and Properties',
  },
  {
    name: 'Education',
    slug: 'education',
    description: 'Schools, Colleges, and Educational Institutes',
  },
  {
    name: 'Retail',
    slug: 'retail',
    description: 'Retail Stores, Shopping, and E-commerce',
  },
  {
    name: 'Automotive',
    slug: 'automotive',
    description: 'Automotive, Auto Repair, and Dealerships',
  },
  {
    name: 'Beauty & Spa',
    slug: 'beauty-and-spa',
    description: 'Salons, Spas, and Personal Care',
  },
  {
    name: 'Fitness & Gyms',
    slug: 'fitness-and-gyms',
    description: 'Gyms, Yoga, and Fitness Centers',
  },
  {
    name: 'Home Services',
    slug: 'home-services',
    description: 'Plumbing, Cleaning, and Repairs',
  },
  {
    name: 'Professional Services',
    slug: 'professional-services',
    description: 'Legal, Accounting, and Consulting',
  },
  {
    name: 'Travel & Tourism',
    slug: 'travel-and-tourism',
    description: 'Travel Agencies, and Tour Operators',
  },
  {
    name: 'Entertainment',
    slug: 'entertainment',
    description: 'Theaters, Amusements, and Events',
  },
];

export async function seedBusinessCategories(
  categoryRepository: Repository<BusinessCategory>,
): Promise<void> {
  const logger = new Logger('SeedBusinessCategories');
  logger.log('Checking and seeding Business Categories...');

  for (const item of BUSINESS_CATEGORIES) {
    const existing = await categoryRepository.findOne({
      where: { slug: item.slug },
    });
    if (!existing) {
      const category = categoryRepository.create({
        name: item.name,
        slug: item.slug,
        description: item.description,
        is_active: true,
      });
      await categoryRepository.save(category);
      logger.log(`Inserted business category: "${item.name}" (${item.slug})`);
    } else {
      if (
        existing.name !== item.name ||
        existing.description !== item.description ||
        !existing.is_active
      ) {
        existing.name = item.name;
        existing.description = item.description;
        existing.is_active = true;
        await categoryRepository.save(existing);
        logger.log(`Updated business category: "${item.name}" (${item.slug})`);
      } else {
        logger.log(`Business category "${item.name}" already exists and matches. Skipping.`);
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
