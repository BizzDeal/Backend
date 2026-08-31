import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { AppModule } from '../src/app.module';
import { User } from '../src/modules/users/entities/user.entity';
import { Profile } from '../src/modules/users/entities/profile.entity';
import { BusinessProfile } from '../src/modules/businesses/entities/business-profile.entity';
import { BusinessCategory } from '../src/modules/businesses/entities/business-category.entity';
import { State } from '../src/modules/location/entities/state.entity';
import { District } from '../src/modules/location/entities/district.entity';
import { BusinessStatus, UserRole, UserStatus } from '../src/common/enums';
import { seedBusinessCategories } from '../src/database/seeds/business-categories.seed';

dotenv.config();

const REAL_NAMES = [
  { first: 'Rajesh', last: 'Sharma' },
  { first: 'Priya', last: 'Nair' },
  { first: 'Vikram', last: 'Patel' },
  { first: 'Anand', last: 'Rao' },
  { first: 'Kavita', last: 'Reddy' },
  { first: 'Suresh', last: 'Kumar' },
  { first: 'Deepak', last: 'Gupta' },
  { first: 'Sunita', last: 'Verma' },
  { first: 'Karthik', last: 'Iyer' },
  { first: 'Pooja', last: 'Mehta' },
  { first: 'Manoj', last: 'Sundaram' },
  { first: 'Divya', last: 'Joshi' },
  { first: 'Sanjay', last: 'Kulkarni' },
  { first: 'Lakshmi', last: 'Menon' },
  { first: 'Arjun', last: 'Deshmukh' },
  { first: 'Meera', last: 'Bhat' },
  { first: 'Naveen', last: 'Hegde' },
  { first: 'Shweta', last: 'Pillai' },
  { first: 'Rohit', last: 'Choudhury' },
  { first: 'Ananya', last: 'Mishra' },
  { first: 'Harish', last: 'Pandey' },
  { first: 'Sneha', last: 'Shukla' },
  { first: 'Varun', last: 'Trivedi' },
  { first: 'Aarti', last: 'Saxena' },
  { first: 'Praveen', last: 'Agarwal' },
  { first: 'Ritu', last: 'Bansal' },
  { first: 'Amit', last: 'Jain' },
  { first: 'Bhavna', last: 'Shah' },
  { first: 'Tarun', last: 'Dalal' },
  { first: 'Rekha', last: 'Malhotra' },
  { first: 'Siddharth', last: 'Kapoor' },
  { first: 'Padma', last: 'Venkatesh' },
];

const BIZ_NAME_PREFIXES = ['Apex', 'Sri', 'Royal', 'Prime', 'Elite', 'Zenith', 'Sunrise', 'Global', 'Vanguard', 'Heritage'];
const BIZ_NAME_SUFFIXES = ['Enterprises', 'Solutions', 'Hub', 'Services', 'Ventures', 'Associates', 'Studio', 'Agency', 'Trading Co.', 'Industries'];

async function run() {
  const logger = new Logger('SeedMemberBusinessProfiles');
  logger.log('Starting Member Business Profiles Setup...');

  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  const userRepo = dataSource.getRepository(User);
  const profileRepo = dataSource.getRepository(Profile);
  const bizRepo = dataSource.getRepository(BusinessProfile);
  const catRepo = dataSource.getRepository(BusinessCategory);
  const stateRepo = dataSource.getRepository(State);
  const districtRepo = dataSource.getRepository(District);

  try {
    // 1. Ensure categories are seeded
    await seedBusinessCategories(catRepo);
    const categories = await catRepo.find({ where: { is_active: true } });
    logger.log(`Found ${categories.length} active business categories.`);

    if (categories.length === 0) {
      throw new Error('No active business categories available in database.');
    }

    // 2. Fetch default location references
    const apState = await stateRepo.findOne({ where: { name: 'Andhra Pradesh' } }) ||
                    await stateRepo.findOne({ where: {} });
    const defaultDistrict = await districtRepo.findOne({ where: { name: 'Visakhapatnam' } }) ||
                            await districtRepo.findOne({ where: {} });

    // 3. Find all MEMBER users
    const members = await userRepo.find({
      where: { role: UserRole.MEMBER },
      relations: { profile: true },
      order: { created_at: 'ASC' }
    });

    logger.log(`Found ${members.length} member accounts.`);

    let updatedProfilesCount = 0;
    let createdBizCount = 0;
    let updatedBizCount = 0;

    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      let profile = member.profile;

      // 3.1 Create or Update Profile with realistic Indian name
      const nameObj = REAL_NAMES[i % REAL_NAMES.length];
      const fallbackName = `${nameObj.first} ${nameObj.last}`;

      if (!profile) {
        profile = profileRepo.create({
          user_id: member.id,
          full_name: fallbackName,
          state_id: apState?.id,
          district_id: defaultDistrict?.id,
          address: `${100 + (i % 900)}, Commercial Area, Main Road`,
        });
        await profileRepo.save(profile);
        updatedProfilesCount++;
      } else if (
        !profile.full_name ||
        profile.full_name.includes('Owner') ||
        profile.full_name.includes('Merchant User') ||
        profile.full_name.startsWith('Member')
      ) {
        profile.full_name = fallbackName;
        if (!profile.state_id && apState?.id) profile.state_id = apState.id;
        if (!profile.district_id && defaultDistrict?.id) profile.district_id = defaultDistrict.id;
        await profileRepo.save(profile);
        updatedProfilesCount++;
      }

      // 3.2 Create or Update BusinessProfile
      const category = categories[i % categories.length];
      const prefix = BIZ_NAME_PREFIXES[i % BIZ_NAME_PREFIXES.length];
      const suffix = BIZ_NAME_SUFFIXES[(i + 3) % BIZ_NAME_SUFFIXES.length];
      const categoryCore = category.name.split('&')[0].trim();
      const generatedBizName = `${prefix} ${nameObj.last} ${categoryCore} ${suffix}`.trim();

      let biz = await bizRepo.findOne({ where: { owner_id: member.id } });

      const stateId = profile.state_id || apState?.id || null;
      const districtId = profile.district_id || defaultDistrict?.id || null;

      if (!biz) {
        biz = bizRepo.create({
          owner_id: member.id,
          category_id: category.id,
          name: generatedBizName,
          description: `Leading provider of premium ${category.name.toLowerCase()} services and tailored customer deals by ${profile.full_name || fallbackName}.`,
          website: `https://${nameObj.last.toLowerCase()}${category.slug.replace(/[^a-z0-9]/g, '')}.bizzdeal.com`,
          gst_number: `37AAAAA${1000 + (i % 9000)}Z${(i % 9) + 1}`,
          address: profile.address || `${200 + (i % 800)}, Business Park, Sector ${(i % 12) + 1}`,
          state_id: stateId,
          district_id: districtId,
          status: BusinessStatus.ACTIVE,
          is_featured: i % 5 === 0,
          is_top: i % 3 === 0,
        });
        await bizRepo.save(biz);
        createdBizCount++;
      } else {
        biz.name = biz.name && !biz.name.includes('Store') && !biz.name.includes('undefined') ? biz.name : generatedBizName;
        biz.category_id = biz.category_id || category.id;
        biz.status = BusinessStatus.ACTIVE;
        if (!biz.state_id && stateId) biz.state_id = stateId;
        if (!biz.district_id && districtId) biz.district_id = districtId;
        if (!biz.description) {
          biz.description = `Leading provider of premium ${category.name.toLowerCase()} services and tailored customer deals.`;
        }
        await bizRepo.save(biz);
        updatedBizCount++;
      }

      // Link primary_business_id in profile
      if (profile && (!profile.primary_business_id || profile.primary_business_id !== biz.id)) {
        profile.primary_business_id = biz.id;
        await profileRepo.save(profile);
      }
    }

    logger.log(`--- SETUP SUMMARY ---`);
    logger.log(`Member Profiles Updated: ${updatedProfilesCount}`);
    logger.log(`Business Profiles Created: ${createdBizCount}`);
    logger.log(`Business Profiles Updated: ${updatedBizCount}`);
    logger.log('--- ALL MEMBER BUSINESS PROFILES SEEDED SUCCESSFULLY ---');
  } catch (error) {
    logger.error('Failed to setup member business profiles:', error);
  } finally {
    await app.close();
  }
}

run();
