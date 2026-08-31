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
import { BusinessStatus, UserStatus } from '../src/common/enums';

dotenv.config();

const FIRST_NAMES = [
  'Rajesh', 'Suresh', 'Ramesh', 'Vikram', 'Amit', 'Anand', 'Kiran', 'Deepak',
  'Sunil', 'Praveen', 'Manoj', 'Vijay', 'Sanjay', 'Santosh', 'Mahesh', 'Ganesh',
  'Priya', 'Ananya', 'Sneha', 'Kavita', 'Pooja', 'Sunita', 'Divya', 'Lakshmi',
  'Deepa', 'Swati', 'Meera', 'Radha', 'Shweta', 'Nisha', 'Aarti', 'Ritu',
  'Karthik', 'Arjun', 'Rahul', 'Rohit', 'Varun', 'Tarun', 'Harish', 'Naveen',
  'Siddharth', 'Aditya', 'Gaurav', 'Alok', 'Prashant', 'Ashish', 'Vikas', 'Manish',
  'Bhavna', 'Geeta', 'Suman', 'Sarita', 'Rekha', 'Usha', 'Madhavi', 'Padma'
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Patel', 'Reddy', 'Rao', 'Nair', 'Mehta', 'Joshi',
  'Gupta', 'Kumar', 'Singh', 'Sundaram', 'Iyer', 'Menon', 'Kulkarni', 'Deshmukh',
  'Bhat', 'Hegde', 'Pillai', 'Choudhury', 'Mishra', 'Pandey', 'Shukla', 'Trivedi',
  'Saxena', 'Agarwal', 'Bansal', 'Jain', 'Shah', 'Dalal', 'Malhotra', 'Kapoor'
];

async function run() {
  const logger = new Logger('FixAdminAndMemberNames');
  logger.log('Starting Admin Deduplication and Member Names Update...');

  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  const userRepo = dataSource.getRepository(User);
  const profileRepo = dataSource.getRepository(Profile);
  const bizRepo = dataSource.getRepository(BusinessProfile);
  const catRepo = dataSource.getRepository(BusinessCategory);
  const stateRepo = dataSource.getRepository(State);
  const districtRepo = dataSource.getRepository(District);

  try {
    // 1. DEDUPLICATE ADMINS
    logger.log('--- Step 1: Deduplicating Admin Users ---');
    const duplicateAdmin = await userRepo.findOne({ where: { email: 'support@bizzdeal.in' } });
    if (duplicateAdmin) {
      logger.log(`Found duplicate admin support@bizzdeal.in (ID: ${duplicateAdmin.id}). Removing/Deactivating...`);
      // Soft-delete or change status to unverified so it won't show in chat contacts
      duplicateAdmin.status = UserStatus.UNVERIFIED;
      await userRepo.save(duplicateAdmin);
      logger.log('Deactivated duplicate admin support@bizzdeal.in successfully.');
    }

    // Ensure primary admin admin@bizzdeal.com has profile with full_name 'System Administrator'
    const mainAdmin = await userRepo.findOne({ where: { email: 'admin@bizzdeal.com' } });
    if (mainAdmin) {
      let mainAdminProfile = await profileRepo.findOne({ where: { user_id: mainAdmin.id } });
      if (!mainAdminProfile) {
        mainAdminProfile = profileRepo.create({
          user_id: mainAdmin.id,
          full_name: 'System Administrator',
          address: '101 Admin Towers, Visakhapatnam, Andhra Pradesh',
        });
      } else {
        mainAdminProfile.full_name = 'System Administrator';
      }
      await profileRepo.save(mainAdminProfile);
      logger.log('Verified primary admin: admin@bizzdeal.com as "System Administrator".');
    }

    // 2. ASSIGN BUSINESS PROFILES TO RAMESH KUMAR & SITA LAKSHMI
    logger.log('--- Step 2: Assigning Business Profiles to Ramesh Kumar & Sita Lakshmi ---');
    const apState = await stateRepo.findOne({ where: { name: 'Andhra Pradesh' } });
    const visakhaDistrict = await districtRepo.findOne({ where: { name: 'Visakhapatnam' } }) ||
                            await districtRepo.findOne({ where: {} });
    const vijayawadaDistrict = await districtRepo.findOne({ where: { name: 'NTR' } }) ||
                               await districtRepo.findOne({ where: { name: 'Krishna' } }) ||
                               visakhaDistrict;

    const firstCat = await catRepo.findOne({ where: { is_active: true } });
    const secondCat = (await catRepo.find({ where: { is_active: true }, take: 2 }))[1] || firstCat;

    // Agent 1: Ramesh Kumar
    const agent1 = await userRepo.findOne({ where: { email: 'agent1@bizzdeal.com' } });
    if (agent1) {
      let rameshBiz = await bizRepo.findOne({ where: { owner_id: agent1.id } });
      if (!rameshBiz) {
        rameshBiz = bizRepo.create({
          owner_id: agent1.id,
          category_id: firstCat?.id,
          name: 'Apex Commercial Solutions',
          description: 'Specialized enterprise consulting, wholesale supplies, and corporate commercial deals by Ramesh Kumar.',
          website: 'https://apexcommercial.bizzdeal.com',
          gst_number: '37AAAAA90011Z5',
          address: '202 Commercial Plaza, Rushikonda, Visakhapatnam',
          state_id: apState?.id,
          district_id: visakhaDistrict?.id,
          status: BusinessStatus.ACTIVE,
          is_featured: true,
          is_top: true,
        });
        await bizRepo.save(rameshBiz);
        logger.log(`Created business profile for Ramesh Kumar: "${rameshBiz.name}".`);
      } else {
        rameshBiz.status = BusinessStatus.ACTIVE;
        await bizRepo.save(rameshBiz);
        logger.log(`Updated business profile for Ramesh Kumar: "${rameshBiz.name}".`);
      }
    }

    // Agent 2: Sita Lakshmi
    const agent2 = await userRepo.findOne({ where: { email: 'agent2@bizzdeal.com' } });
    if (agent2) {
      let sitaBiz = await bizRepo.findOne({ where: { owner_id: agent2.id } });
      if (!sitaBiz) {
        sitaBiz = bizRepo.create({
          owner_id: agent2.id,
          category_id: secondCat?.id,
          name: 'Lakshmi Financial & Advisory Hub',
          description: 'Professional financial consulting, business audit, and investment networking by Sita Lakshmi.',
          website: 'https://lakshmifinancial.bizzdeal.com',
          gst_number: '37AAAAA90021Z5',
          address: '303 Business Complex, Governorpet, Vijayawada',
          state_id: apState?.id,
          district_id: vijayawadaDistrict?.id,
          status: BusinessStatus.ACTIVE,
          is_featured: true,
          is_top: true,
        });
        await bizRepo.save(sitaBiz);
        logger.log(`Created business profile for Sita Lakshmi: "${sitaBiz.name}".`);
      } else {
        sitaBiz.status = BusinessStatus.ACTIVE;
        await bizRepo.save(sitaBiz);
        logger.log(`Updated business profile for Sita Lakshmi: "${sitaBiz.name}".`);
      }
    }

    // 3. RENAME DUMMY OWNER NAMES TO REALISTIC INDIAN NAMES
    logger.log('--- Step 3: Renaming Placeholder Owner Names to Realistic Indian Names ---');
    const allProfiles = await profileRepo.find();
    let renamedCount = 0;

    for (let i = 0; i < allProfiles.length; i++) {
      const profile = allProfiles[i];
      if (profile.full_name && profile.full_name.includes('Owner') && profile.full_name.includes('Merchant User')) {
        const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
        const lastName = LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length];
        const realName = `${firstName} ${lastName}`;

        profile.full_name = realName;
        await profileRepo.save(profile);
        renamedCount++;
      }
    }

    logger.log(`Renamed ${renamedCount} owner profiles to realistic Indian names!`);
    logger.log('--- ALL UPDATES COMPLETED SUCCESSFULLY ---');
  } catch (error) {
    logger.error('Error fixing admin and member names:', error);
  } finally {
    await app.close();
  }
}

run();
