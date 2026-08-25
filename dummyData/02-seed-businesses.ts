import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';
import { BusinessProfile } from '../src/modules/businesses/entities/business-profile.entity';
import { BusinessCategory } from '../src/modules/businesses/entities/business-category.entity';
import { BusinessStatus } from '../src/common/enums';
import { SeededUsersResult } from './01-seed-users';
import { State } from '../src/modules/location/entities/state.entity';
import { District } from '../src/modules/location/entities/district.entity';
import { BUSINESS_CATEGORIES, seedBusinessCategories } from '../src/database/seeds/business-categories.seed';

export interface SeededBusinessesResult {
  business1: BusinessProfile;
  business2: BusinessProfile;
  business3: BusinessProfile;
  business4: BusinessProfile;
  allBusinesses: BusinessProfile[];
}

const SAMPLE_LOCATIONS = [
  'Plot 101, IT SEZ, Rushikonda, Visakhapatnam',
  'D.No 40-1-12, Benz Circle, Vijayawada',
  'D.No 12-5, VIP Road, Visakhapatnam',
  'Plot 45, Tech Park, Guntur',
  'D.No 89-2, Main Road, Tirupati',
  'D.No 14-1, Brodipet, Guntur',
  'D.No 5-2, MVP Colony, Visakhapatnam',
  'D.No 22-8, Ring Road, Vijayawada',
  'D.No 7-3, Governorpet, Vijayawada',
  'D.No 19-4, KT Road, Tirupati',
  'D.No 10-2, Dwaraka Nagar, Visakhapatnam',
  'D.No 33-1-5, M.G. Road, Vijayawada',
  'Lawsons Bay Colony, Beach Road, Visakhapatnam',
  'D.No 8-2, Cinema Road, Kakinada',
  'D.No 15-3, Trunk Road, Nellore',
];

export async function seedDummyBusinesses(
  dataSource: DataSource,
  users: SeededUsersResult,
): Promise<SeededBusinessesResult> {
  const logger = new Logger('SeedDummyBusinesses');
  logger.log('Ensuring all official 40+ Business Categories are seeded...');

  const bizRepo = dataSource.getRepository(BusinessProfile);
  const catRepo = dataSource.getRepository(BusinessCategory);
  const stateRepo = dataSource.getRepository(State);
  const districtRepo = dataSource.getRepository(District);

  // 1. Seed & activate all 40+ official categories from master seed
  await seedBusinessCategories(catRepo);

  const allCategories = await catRepo.find({ where: { is_active: true } });
  logger.log(`Active business categories found in DB: ${allCategories.length}`);

  const categoryMap = new Map<string, BusinessCategory>();
  for (const cat of allCategories) {
    categoryMap.set(cat.slug, cat);
  }

  const apState = await stateRepo.findOne({ where: { name: 'Andhra Pradesh' } });
  const visakhaDistrict =
    (await districtRepo.findOne({ where: { name: 'Visakhapatnam' } })) ||
    (await districtRepo.findOne({ where: {} }));

  const allOwners = users.allOwners || [];
  let ownerIndex = 0;

  const allSeededBusinesses: BusinessProfile[] = [];
  const resultMap: Record<string, BusinessProfile> = {};

  let globalBizCount = 0;

  for (const cDef of BUSINESS_CATEGORIES) {
    const cat = categoryMap.get(cDef.slug);
    if (!cat) continue;

    // Seed 3 businesses per category
    const businessesForCategory = [
      {
        name: `Apex ${cDef.name} Hub`,
        description: `Premier ${cDef.name.toLowerCase()} services and top-rated solutions in Andhra Pradesh. Official featured merchant on BizzDeal.`,
      },
      {
        name: `Vizag ${cDef.name} Center`,
        description: `Reliable and trusted ${cDef.name.toLowerCase()} provider with verified deals, discounts, and customer rewards.`,
      },
      {
        name: `Royal ${cDef.name} Enterprise`,
        description: `High-quality ${cDef.name.toLowerCase()} solutions tailored for retail and commercial clients across Visakhapatnam & Vijayawada.`,
      },
    ];

    let catBizIdx = 0;

    for (const bData of businessesForCategory) {
      if (ownerIndex >= allOwners.length) {
        ownerIndex = 0;
      }
      const owner = allOwners[ownerIndex];
      ownerIndex++;
      globalBizCount++;

      let status = BusinessStatus.ACTIVE;
      if (globalBizCount === 120) status = BusinessStatus.SUSPENDED;
      if (globalBizCount === 121) status = BusinessStatus.PENDING;
      if (globalBizCount === 122) status = BusinessStatus.REJECTED;

      // Exactly 1 featured store per category (the first store of each category)
      const isFeatured = catBizIdx === 0;

      const address = SAMPLE_LOCATIONS[(globalBizCount - 1) % SAMPLE_LOCATIONS.length];

      let biz = await bizRepo.findOne({ where: { owner_id: owner.id } });
      if (!biz) {
        biz = bizRepo.create({
          owner_id: owner.id,
          category_id: cat.id,
          name: bData.name,
          description: bData.description,
          website: `https://${bData.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
          gst_number: `37AAAAA${(1000 + globalBizCount).toString()}1Z5`,
          address,
          state_id: apState ? apState.id : null,
          district_id: visakhaDistrict ? visakhaDistrict.id : null,
          status,
          is_featured: isFeatured,
          video_url: 'https://www.youtube.com/embed/hOgVAYpHPCc',
        });
        biz = await bizRepo.save(biz);
      } else {
        biz.category_id = cat.id;
        biz.name = bData.name;
        biz.description = bData.description;
        biz.address = address;
        biz.status = status;
        biz.is_featured = isFeatured;
        biz.video_url = 'https://www.youtube.com/embed/hOgVAYpHPCc';
        if (apState) biz.state_id = apState.id;
        if (visakhaDistrict) biz.district_id = visakhaDistrict.id;
        biz = await bizRepo.save(biz);
      }

      allSeededBusinesses.push(biz);

      // Key legacy references
      if (allSeededBusinesses.length === 1) resultMap['business1'] = biz;
      if (allSeededBusinesses.length === 2) resultMap['business2'] = biz;
      if (allSeededBusinesses.length === 3) resultMap['business3'] = biz;
      if (allSeededBusinesses.length === 4) resultMap['business4'] = biz;

      catBizIdx++;
    }
  }

  logger.log(
    `Successfully seeded ${allSeededBusinesses.length} businesses across ${BUSINESS_CATEGORIES.length} official categories (1 featured store per category).`,
  );

  resultMap['allBusinesses'] = allSeededBusinesses as unknown as BusinessProfile;

  return resultMap as unknown as SeededBusinessesResult;
}
