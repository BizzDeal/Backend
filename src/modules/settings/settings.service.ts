import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformSettings } from './entities/platform-settings.entity';
import { UpdateSettingsDto } from './schemas/settings.schema';

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);

  // In-memory cache for fast reads
  private cachedSettings: PlatformSettings | null = null;

  constructor(
    @InjectRepository(PlatformSettings)
    private readonly settingsRepository: Repository<PlatformSettings>,
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

    const saved = await this.settingsRepository.save(settings);
    this.cachedSettings = saved;

    this.logger.log('Platform settings updated successfully.');

    return {
      success: true,
      message: 'Platform settings updated successfully',
      data: saved,
    };
  }
}
