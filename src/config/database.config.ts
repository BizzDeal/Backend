import { registerAs } from '@nestjs/config';

export default registerAs('database', () => {
  // Ensure Node environment and PostgreSQL default timezone operates in India Time Zone (IST)
  process.env.TZ = process.env.TZ || 'Asia/Kolkata';
  process.env.PGTZ = process.env.PGTZ || 'Asia/Kolkata';

  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const isSupabase = url?.includes('supabase.com');

  return {
    type: 'postgres' as const,
    url,
    synchronize: true, // Auto sync schema with postgres DB as per requirement
    autoLoadEntities: true,
    extra: {
      options: '-c timezone=Asia/Kolkata',
    },
    ssl:
      process.env.NODE_ENV === 'production' || isSupabase
        ? { rejectUnauthorized: false }
        : false,
  };
});
