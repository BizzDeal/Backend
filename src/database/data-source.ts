import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config();

const url = process.env.DATABASE_URL;
const isSupabase = url?.includes('supabase.com');

export const AppDataSource = new DataSource({
  type: 'postgres',
  url,
  synchronize: false, // TypeORM CLI should never auto-sync, it manages migrations
  logging: true,
  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  extra: {
    options: '-c timezone=Asia/Kolkata',
  },
  ssl:
    process.env.NODE_ENV === 'production' || isSupabase
      ? { rejectUnauthorized: false }
      : false,
});
