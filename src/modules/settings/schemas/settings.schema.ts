import { z } from 'zod';

export const updateSettingsSchema = z.object({
  mega_deals_percent_threshold: z.number().int().min(0).max(100).optional(),
  mega_deals_fixed_threshold: z.number().int().min(0).optional(),
  home_feed_limit: z.number().int().min(1).max(100).optional(),
  bizz_coin_value: z.coerce.number().min(0.01, 'Bizz Coin value must be at least 0.01').optional(),
  customer_signup_bizz_points: z.coerce.number().int().min(0, 'Customer signup points must be at least 0').optional(),
  customer_redemption_reward_bizz_points: z.coerce.number().int().min(0, 'Customer redemption reward points must be at least 0').optional(),
  member_referral_bizz_points: z.coerce.number().int().min(0, 'Member referral points must be at least 0').optional(),
});

export type UpdateSettingsDto = z.infer<typeof updateSettingsSchema>;
