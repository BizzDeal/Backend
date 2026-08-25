import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { AppModule } from '../src/app.module';

import { seedDummyUsers } from './01-seed-users';
import { seedDummyBusinesses } from './02-seed-businesses';
import { seedDummyOffers } from './03-seed-offers';
import { seedDummyVouchersAndWallets } from './04-seed-vouchers-wallets';
import { seedDummyInteractionsAndAnalytics } from './05-seed-interactions-analytics';

dotenv.config();

process.env.TZ = process.env.TZ || 'Asia/Kolkata';
process.env.PGTZ = process.env.PGTZ || 'Asia/Kolkata';

async function bootstrap() {
  const logger = new Logger('MasterDummyDataSeeder');
  logger.log('=====================================================');
  logger.log('STARTING DIRECT DATABASE INSERTION: DUMMY TEST DATA');
  logger.log('=====================================================');

  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const dataSource = app.get(DataSource);

    // 1. Seed Users (Admin, Agents, Owners, Customers) - Password "1234"
    logger.log('\n--- Step 1: Seeding Users & Profiles ---');
    const users = await seedDummyUsers(dataSource);

    // 2. Seed Businesses (Active, Pending, Featured, Rejected)
    logger.log('\n--- Step 2: Seeding Businesses & Categories ---');
    const businesses = await seedDummyBusinesses(dataSource, users);

    // 3. Seed Offers (Percentage, Cashback, Expired, Pending)
    logger.log('\n--- Step 3: Seeding Offers & Deals ---');
    const offers = await seedDummyOffers(dataSource, businesses, users);

    // 4. Seed Vouchers, Wallets, and BizzCoin Wallets
    logger.log('\n--- Step 4: Seeding Vouchers, Wallets & BizzCoins ---');
    await seedDummyVouchersAndWallets(dataSource, users, businesses, offers);

    // 5. Seed Interactions (Meetings, Chats, Notifications, Analytics)
    logger.log('\n--- Step 5: Seeding Meetings, Chats, Notifications & Analytics ---');
    await seedDummyInteractionsAndAnalytics(dataSource, users, businesses);

    logger.log('\n=====================================================');
    logger.log('\n=====================================================');
    logger.log('SUCCESSFULLY INSERTED ALL EXPANDED DUMMY TEST DATA INTO DB!');
    logger.log('=====================================================');
    logger.log('DATASET SUMMARY:');
    logger.log('- Categories: 40+ official business categories');
    logger.log('- Businesses: 400+ businesses (10 per category: 1 featured, 5 top, 4 regular)');
    logger.log('- Offers:     2000+ offers (Multiple DISCOUNT, CASHBACK & BIZZ_COINS per business)');
    logger.log('- Users:      457 total users (1 Admin, 2 Agents, 450 Business Owners, 4 Customers)');
    logger.log('-----------------------------------------------------');
    logger.log('LOGIN CREDENTIALS SUMMARY (PASSWORD FOR ALL IS "1234"):');
    logger.log('- ADMIN:       admin@bizzdeal.com');
    logger.log('- SALES AGENT: agent1@bizzdeal.com');
    logger.log('- OWNERS:      owner1@bizzdeal.com to owner450@bizzdeal.com');
    logger.log('- CUSTOMER 1:  customer1@bizzdeal.com (VIP / Funded Wallet)');
    logger.log('- CUSTOMER 2:  customer2@bizzdeal.com (BizzCoins / Voucher)');
    logger.log('=====================================================\n');
  } catch (error) {
    logger.error('Error during master dummy data seeding:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
