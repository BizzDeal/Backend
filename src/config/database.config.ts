import { registerAs } from '@nestjs/config';

export default registerAs('database', () => {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const isSupabase = url?.includes('supabase.com');

  return {
    type: 'postgres' as const,
    url,
    synchronize: true, // Auto sync schema with postgres DB as per requirement
    autoLoadEntities: true,
    ssl:
      process.env.NODE_ENV === 'production' || isSupabase
        ? { rejectUnauthorized: false }
        : false,
  };
});
