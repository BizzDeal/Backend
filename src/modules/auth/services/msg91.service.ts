import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class Msg91Service {
  private readonly logger = new Logger(Msg91Service.name);
  private readonly authKey: string;
  private readonly templateId: string;

  constructor(private readonly configService: ConfigService) {
    const authKey = this.configService.get<string>('MSG91_AUTH_KEY');
    if (!authKey) {
      throw new Error(
        'Critical Configuration Missing: MSG91_AUTH_KEY is not defined in the environment variables.',
      );
    }
    this.authKey = authKey;
    this.templateId = this.configService.get<string>('MSG91_TEMPLATE_ID') || '';
  }

  async sendOtp(
    phone: string,
    otp: string,
  ): Promise<{ success: boolean; requestId: string; message: string }> {
    try {
      const url = new URL('https://control.msg91.com/api/v5/otp');
      url.searchParams.append('authkey', this.authKey);
      url.searchParams.append('mobile', phone);
      url.searchParams.append('otp', otp);
      if (this.templateId) {
        url.searchParams.append('template_id', this.templateId);
      }

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = (await response.json()) as any;

      if (response.ok && (data.type === 'success' || data.type === 'Success')) {
        this.logger.log(`OTP sent successfully via MSG91 to ${phone}`);
        return {
          success: true,
          requestId: data.message || data.request_id || otp,
          message: 'OTP sent successfully',
        };
      }

      const errorMsg = `MSG91 API error response: ${JSON.stringify(data)}`;
      this.logger.error(errorMsg);
      throw new Error(`Failed to send OTP via MSG91: ${data.message || 'Unknown MSG91 API error'}`);
    } catch (error) {
      this.logger.error(
        `Error sending OTP via MSG91 to ${phone}: ${error instanceof Error ? error.message : error}`,
      );
      throw new Error(
        `Failed to send OTP: ${error instanceof Error ? error.message : 'Unknown error during MSG91 connection'}`,
      );
    }
  }

  async verifyOtp(phone: string, otp: string): Promise<boolean> {
    try {
      const url = new URL('https://control.msg91.com/api/v5/otp/verify');
      url.searchParams.append('authkey', this.authKey);
      url.searchParams.append('mobile', phone);
      url.searchParams.append('otp', otp);

      const response = await fetch(url.toString(), {
        method: 'GET',
      });

      const data = (await response.json()) as any;
      if (response.ok && (data.type === 'success' || data.type === 'Success' || data.message === 'OTP verified success')) {
        return true;
      }

      this.logger.warn(`MSG91 verification check failed for ${phone}: ${JSON.stringify(data)}`);
      return false;
    } catch (error) {
      this.logger.error(
        `Error verifying OTP via MSG91 for ${phone}: ${error instanceof Error ? error.message : error}`,
      );
      throw new Error(
        `OTP Verification failed: ${error instanceof Error ? error.message : 'Unknown error during MSG91 connection'}`,
      );
    }
  }
}
