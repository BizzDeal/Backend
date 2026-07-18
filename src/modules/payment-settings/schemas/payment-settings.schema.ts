import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

const numberPreprocess = (val: unknown) => {
  if (val === '' || val === null || val === undefined) return val;
  const num = Number(val);
  return isNaN(num) ? val : num;
};

export const updatePaymentSettingsSchema = z.object({
  upi_id: z.string().min(1, { message: 'UPI ID is required' }),
  account_name: z.string().min(1, { message: 'Account Name is required' }),
  registration_fee: z.preprocess(
    numberPreprocess,
    z.number().nonnegative({ message: 'Registration fee must be a non-negative number' }),
  ),
  currency: z.string().min(1, { message: 'Currency is required' }).default('INR'),
  card_title: z.string().min(1, { message: 'Card title is required' }),
  card_subtitle: z.string().min(1, { message: 'Card subtitle is required' }),
  benefits: z.string().min(1, { message: 'Benefits text is required' }),
});

export class UpdatePaymentSettingsDto {
  @ApiProperty({ example: 'bizzdeal@upi' })
  upi_id: string;

  @ApiProperty({ example: 'BIZZ DEAL Pvt Ltd' })
  account_name: string;

  @ApiProperty({ example: 10000 })
  registration_fee: number;

  @ApiProperty({ example: 'INR', default: 'INR' })
  currency: string;

  @ApiProperty({ example: 'Join BIZZ DEAL as Member' })
  card_title: string;

  @ApiProperty({ example: 'MEMBER ONBOARDING' })
  card_subtitle: string;

  @ApiProperty({ example: 'Unlock premium networking, verified lead sharing, referral vouchers, and business growth analytics.' })
  benefits: string;
}
