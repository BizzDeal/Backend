import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformSettings } from './entities/platform-settings.entity';
import { UpdateSettingsDto } from './schemas/settings.schema';
import { AppEventsGateway } from '../events/events.gateway';

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);

  // In-memory cache for fast reads
  private cachedSettings: PlatformSettings | null = null;

  constructor(
    @InjectRepository(PlatformSettings)
    private readonly settingsRepository: Repository<PlatformSettings>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly appEventsGateway: AppEventsGateway,
  ) {}

  async onModuleInit() {
    await this.ensureDefaultSettings();
  }

  private async ensureDefaultSettings() {
    let settings = await this.settingsRepository.findOne({ where: {}, order: { updated_at: 'DESC' } });
    
    if (!settings) {
      this.logger.log('No platform settings found. Creating default settings...');
      settings = this.settingsRepository.create({
        mega_deals_percent_threshold: 30,
        mega_deals_fixed_threshold: 500,
        home_feed_limit: 20,
        bizz_coin_value: 1.00,
        customer_signup_bizz_points: 100,
        customer_redemption_reward_bizz_points: 75,
        member_referral_bizz_points: 100,
        app_share_sharer_bizz_points: 50,
        app_share_joiner_bizz_points: 50,
        app_invite_base_url: 'https://play.google.com/store/apps/details?id=com.bizzdeal.app',
      });
      await this.settingsRepository.save(settings);
    }
    
    this.cachedSettings = settings;
  }

  async getSettings(): Promise<PlatformSettings> {
    if (this.cachedSettings) {
      return this.cachedSettings;
    }

    const settings = await this.settingsRepository.findOne({ where: {}, order: { updated_at: 'DESC' } });
    if (settings) {
      this.cachedSettings = settings;
      return settings;
    }

    // Fallback if somehow deleted
    const defaultSettings = this.settingsRepository.create({
      mega_deals_percent_threshold: 30,
      mega_deals_fixed_threshold: 500,
      home_feed_limit: 20,
      bizz_coin_value: 1.00,
      customer_signup_bizz_points: 100,
      customer_redemption_reward_bizz_points: 75,
      member_referral_bizz_points: 100,
      app_share_sharer_bizz_points: 50,
      app_share_joiner_bizz_points: 50,
      app_invite_base_url: 'https://play.google.com/store/apps/details?id=com.bizzdeal.app',
    });
    const saved = await this.settingsRepository.save(defaultSettings);
    this.cachedSettings = saved;
    return saved;
  }

  async updateSettings(dto: UpdateSettingsDto): Promise<{ success: boolean; data: PlatformSettings; message: string }> {
    const settings = await this.getSettings();

    if (dto.mega_deals_percent_threshold !== undefined) {
      settings.mega_deals_percent_threshold = dto.mega_deals_percent_threshold;
    }
    if (dto.mega_deals_fixed_threshold !== undefined) {
      settings.mega_deals_fixed_threshold = dto.mega_deals_fixed_threshold;
    }
    if (dto.home_feed_limit !== undefined) {
      settings.home_feed_limit = dto.home_feed_limit;
    }
    if (dto.bizz_coin_value !== undefined) {
      settings.bizz_coin_value = dto.bizz_coin_value;
    }
    if (dto.customer_signup_bizz_points !== undefined) {
      settings.customer_signup_bizz_points = dto.customer_signup_bizz_points;
    }
    if (dto.customer_redemption_reward_bizz_points !== undefined) {
      settings.customer_redemption_reward_bizz_points = dto.customer_redemption_reward_bizz_points;
    }
    if (dto.member_referral_bizz_points !== undefined) {
      settings.member_referral_bizz_points = dto.member_referral_bizz_points;
    }
    if (dto.app_share_sharer_bizz_points !== undefined) {
      settings.app_share_sharer_bizz_points = dto.app_share_sharer_bizz_points;
    }
    if (dto.app_share_joiner_bizz_points !== undefined) {
      settings.app_share_joiner_bizz_points = dto.app_share_joiner_bizz_points;
    }
    if (dto.app_invite_base_url !== undefined) {
      settings.app_invite_base_url = dto.app_invite_base_url;
    }

    const saved = await this.settingsRepository.save(settings);
    this.cachedSettings = saved;

    this.logger.log('Platform settings updated successfully.');

    try {
      this.appEventsGateway.emitToAll('PLATFORM_SETTINGS_UPDATED', saved);
    } catch (err) {
      this.logger.warn(`Failed to broadcast PLATFORM_SETTINGS_UPDATED event: ${err}`);
    }

    return {
      success: true,
      message: 'Platform settings updated successfully',
      data: saved,
    };
  }

  async clearSystemCache(): Promise<{ success: boolean; message: string }> {
    await this.cacheManager.clear();
    this.logger.log('Global system cache cleared by admin.');
    return {
      success: true,
      message: 'System cache cleared successfully.',
    };
  }
}
