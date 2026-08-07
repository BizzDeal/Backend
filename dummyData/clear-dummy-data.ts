import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { DataSource, Like } from 'typeorm';
import * as dotenv from 'dotenv';
import { AppModule } from '../src/app.module';

import { User } from '../src/modules/users/entities/user.entity';

dotenv.config();

process.env.TZ = process.env.TZ || 'Asia/Kolkata';
process.env.PGTZ = process.env.PGTZ || 'Asia/Kolkata';

async function clearDummyData() {
  const logger = new Logger('ClearDummyData');
  logger.log('=====================================================');
  logger.log('STARTING CLEANUP: PURGING DUMMY TEST DATA FROM DB');
  logger.log('=====================================================');

  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const dataSource = app.get(DataSource);
    const userRepo = dataSource.getRepository(User);

    const dummyUsers = await userRepo.find({ where: { email: Like('%@bizzdeal.com') } });
    if (dummyUsers.length === 0) {
      logger.log('No dummy test users found in database.');
      return;
    }

    logger.log(`Found ${dummyUsers.length} dummy test users to delete...`);

    // CASCADE Deletes via Foreign Keys:
    // Deleting users removes Profiles, Business Profiles, Offers, Vouchers, Wallets, Chats, Notifications, Meetings.
    for (const user of dummyUsers) {
      await userRepo.remove(user);
      logger.log(`Deleted test user: ${user.email}`);
    }

    // Clean up dummy analytics
    await dataSource.query(`DELETE FROM analytics_platform_kpis WHERE month = '2026-08'`).catch(() => null);
    await dataSource.query(`DELETE FROM analytics_monthly_metrics WHERE year = 2026 AND month = 8`).catch(() => null);

    logger.log('\n=====================================================');
    logger.log('SUCCESSFULLY PURGED ALL DUMMY TEST DATA!');
    logger.log('=====================================================\n');
  } catch (error) {
    logger.error('Error while purging dummy test data:', error);
  } finally {
    await app.close();
  }
}

clearDummyData();
