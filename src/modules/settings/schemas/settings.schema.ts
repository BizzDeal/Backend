import { z } from 'zod';

export const updateSettingsSchema = z.object({
  mega_deals_percent_threshold: z.number().int().min(0).max(100).optional(),
  mega_deals_fixed_threshold: z.number().int().min(0).optional(),
  home_feed_limit: z.number().int().min(1).max(100).optional(),
});

export type UpdateSettingsDto = z.infer<typeof updateSettingsSchema>;
