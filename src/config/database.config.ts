import { registerAs } from '@nestjs/config';

export default registerAs('database', () => {
  // Ensure Node environment and PostgreSQL default timezone operates in India Time Zone (IST)
  process.env.TZ = process.env.TZ || 'Asia/Kolkata';
  process.env.PGTZ = process.env.PGTZ || 'Asia/Kolkata';

  const url = process.env.DATABASE_URL;

  return {
    type: 'postgres' as const,
    url,
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    autoLoadEntities: true,
    extra: {
      options: '-c timezone=Asia/Kolkata',
    },
    ssl:
      process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
  };
});
