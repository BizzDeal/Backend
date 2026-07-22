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

dotenv.config();

// Ensure India Time Zone (Asia/Kolkata, UTC+05:30) for Node process and PostgreSQL driver
process.env.TZ = process.env.TZ || 'Asia/Kolkata';
process.env.PGTZ = process.env.PGTZ || 'Asia/Kolkata';

async function fixEnumsBeforeSync() {
  const logger = new Logger('PreSyncEnumFix');
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) return;

  const isSupabase = url.includes('supabase.com');
  const ds = new DataSource({
    type: 'postgres',
    url,
    synchronize: false,
    extra: {
      options: '-c timezone=Asia/Kolkata',
    },
    ssl:
      process.env.NODE_ENV === 'production' || isSupabase
        ? { rejectUnauthorized: false }
        : false,
  });

  try {
    await ds.initialize();
    logger.log('Running pre-sync enum adjustments...');
    // Clean up any REGISTERED status on users and businesses so TypeORM can sync status enums safely
    await ds.query(`ALTER TABLE users ALTER COLUMN status DROP DEFAULT;`);
    await ds.query(
      `UPDATE users SET status = 'PENDING' WHERE status::text = 'REGISTERED';`,
    );
    await ds.query(`ALTER TABLE businesses ALTER COLUMN status DROP DEFAULT;`);
    await ds.query(
      `UPDATE businesses SET status = 'PENDING' WHERE status::text = 'REGISTERED';`,
    );
    // Remove unnecessary/deprecated location & sync tables in Supabase / PostgreSQL
    logger.log('Cleaning up unnecessary location & sync tables in database...');
    await ds.query(`
      DROP TABLE IF EXISTS "village_pincode_mappings", "villages", "sub_districts", "urban_pincode_mappings", "urban_local_bodies", "location_sync_file_jobs", "location_sync_jobs" CASCADE;
    `);
    await ds.query(`
      DROP TYPE IF EXISTS "public"."location_sync_jobs_status_enum" CASCADE;
    `);
    logger.log('Dropping old chat tables to wipe data and apply new schema...');
    await ds.query(`DROP TABLE IF EXISTS "chat_messages" CASCADE;`);
    await ds.query(`DROP TABLE IF EXISTS "chat_conversations" CASCADE;`);
    await ds.query(`NOTIFY pgrst, 'reload schema';`);
    logger.log('Pre-sync adjustments and schema cleanup successful.');
  } catch (err: any) {
    logger.warn(`Notice during pre-sync adjustments: ${err.message}`);
  } finally {
    if (ds.isInitialized) {
      await ds.destroy();
    }
  }
}

async function bootstrap() {
  const logger = new Logger('DatabaseSync');
  await fixEnumsBeforeSync();
  logger.log('Starting Database Synchronization & Seeding...');

  // Creating application context initializes TypeORM and synchronizes database schemas
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const categoryRepo = app.get(getRepositoryToken(BusinessCategory));
    await seedBusinessCategories(categoryRepo);
    await seedLocations(app.get(DataSource));

    const paymentSettingsRepo = app.get(getRepositoryToken(PaymentSetting));
    await seedPaymentSettings(paymentSettingsRepo);

    logger.log(
      'Database synchronization & all individual seed scripts completed successfully.',
    );
  } catch (error) {
    logger.error('Error during database synchronization & seeding', error);
  } finally {
    await app.close();
  }
}

bootstrap();
