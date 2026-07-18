import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentSetting } from './entities/payment-setting.entity';
import { UpdatePaymentSettingsDto } from './schemas/payment-settings.schema';

@Injectable()
export class PaymentSettingsService {
  constructor(
    @InjectRepository(PaymentSetting)
    private readonly paymentSettingRepository: Repository<PaymentSetting>,
  ) {}

  async getSettings(): Promise<PaymentSetting> {
    const settings = await this.paymentSettingRepository.find();
    if (settings.length > 0) {
      return settings[0];
    }
    // Return a default object and save it to the DB if none exists yet
    const defaultSettings = this.paymentSettingRepository.create({
      upi_id: 'bizzdeal@upi',
      account_name: 'BIZZ DEAL Pvt Ltd',
      registration_fee: 10000,
      currency: 'INR',
      card_title: 'Join BIZZ DEAL as Member',
      card_subtitle: 'MEMBER ONBOARDING',
      benefits: 'Unlock premium networking, verified lead sharing, referral vouchers, and business growth analytics.',
    });
    return this.paymentSettingRepository.save(defaultSettings);
  }

  async updateSettings(dto: UpdatePaymentSettingsDto): Promise<PaymentSetting> {
    const settings = await this.paymentSettingRepository.find();
    let record: PaymentSetting;
    if (settings.length > 0) {
      record = settings[0];
      this.paymentSettingRepository.merge(record, dto);
    } else {
      record = this.paymentSettingRepository.create(dto);
    }
    return this.paymentSettingRepository.save(record);
  }
}
