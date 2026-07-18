import { Repository } from 'typeorm';
import { Logger } from '@nestjs/common';
import { PaymentSetting } from '../../modules/payment-settings/entities/payment-setting.entity';

export async function seedPaymentSettings(
  paymentSettingsRepository: Repository<PaymentSetting>,
): Promise<void> {
  const logger = new Logger('SeedPaymentSettings');
  logger.log('Checking and seeding Payment Settings...');

  const existing = await paymentSettingsRepository.find();
  if (existing.length === 0) {
    const settings = paymentSettingsRepository.create({
      upi_id: 'bizzdeal@upi',
      account_name: 'BIZZ DEAL Pvt Ltd',
      registration_fee: 10000,
      currency: 'INR',
      card_title: 'Join BIZZ DEAL as Member',
      card_subtitle: 'MEMBER ONBOARDING',
      benefits: 'Unlock premium networking, verified lead sharing, referral vouchers, and business growth analytics.',
    });
    await paymentSettingsRepository.save(settings);
    logger.log('Inserted default payment settings.');
  } else {
    logger.log('Payment settings already exist. Skipping.');
  }
}
