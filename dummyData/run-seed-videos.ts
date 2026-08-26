import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { AppModule } from '../src/app.module';
import { seedDummyVideos } from './06-seed-videos';

dotenv.config();

process.env.TZ = process.env.TZ || 'Asia/Kolkata';
process.env.PGTZ = process.env.PGTZ || 'Asia/Kolkata';

async function run() {
  const logger = new Logger('RunSeedVideos');
  logger.log('=====================================================');
  logger.log('STARTING DIRECT DATABASE INSERTION: DUMMY VIDEO DATA');
  logger.log('=====================================================');

  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const dataSource = app.get(DataSource);
    const result = await seedDummyVideos(dataSource);

    logger.log('\n=====================================================');
    logger.log(`SUCCESSFULLY SEEDED ${result.allVideos.length} DUMMY VIDEOS INTO DB!`);
    logger.log('=====================================================\n');
  } catch (error) {
    logger.error('Error during video seeding:', error);
  } finally {
    await app.close();
  }
}

run();
