import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

interface OtpRecord {
  otp: string;
  expiresAt: Date;
}

@Injectable()
export class OtpService {
  private otps: Map<string, OtpRecord> = new Map();

  generateOtp(): string {
    // Generate 6 digit numeric OTP
    return crypto.randomInt(100000, 999999).toString();
  }

  saveOtp(email: string, otp: string, expiresInMinutes: number = 10): void {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);
    this.otps.set(email.toLowerCase(), { otp, expiresAt });
  }

  verifyOtp(email: string, otp: string): boolean {
    const key = email.toLowerCase();
    const record = this.otps.get(key);

    if (!record) {
      throw new BadRequestException('No pending OTP found for this email.');
    }

    if (new Date() > record.expiresAt) {
      this.otps.delete(key);
      throw new BadRequestException('OTP has expired. Please request a new one.');
    }

    if (record.otp !== otp) {
      throw new BadRequestException('Invalid OTP code.');
    }

    // OTP is valid, remove it so it cannot be reused
    this.otps.delete(key);
    return true;
  }
}
