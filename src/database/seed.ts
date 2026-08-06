import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { BusinessCategory } from '../modules/businesses/entities/business-category.entity';
import { PaymentSetting } from '../modules/payment-settings/entities/payment-setting.entity';
import { seedBusinessCategories } from './seeds/business-categories.seed';
import { seedLocations } from './seeds/locations.seed';
import { seedPaymentSettings } from './seeds/payment-settings.seed';
import { seedAdminUser } from './seeds/admin.seed';
import { User } from '../modules/users/entities/user.entity';

dotenv.config();

// Ensure India Time Zone (Asia/Kolkata, UTC+05:30) for Node process and PostgreSQL driver
process.env.TZ = process.env.TZ || 'Asia/Kolkata';
process.env.PGTZ = process.env.PGTZ || 'Asia/Kolkata';

async function bootstrap() {
  const logger = new Logger('DatabaseSeed');
  logger.log('Starting Database Seeding...');

  // Creating application context initializes TypeORM and connects to the DB
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const categoryRepo = app.get(getRepositoryToken(BusinessCategory));
    await seedBusinessCategories(categoryRepo);
    
    await seedLocations(app.get(DataSource));

    const paymentSettingsRepo = app.get(getRepositoryToken(PaymentSetting));
    await seedPaymentSettings(paymentSettingsRepo);

    const userRepo = app.get(getRepositoryToken(User));
    await seedAdminUser(userRepo);

    logger.log('Database seeding completed successfully.');
  } catch (error) {
    logger.error('Error during database seeding', error);
  } finally {
    await app.close();
  }
}

bootstrap();
