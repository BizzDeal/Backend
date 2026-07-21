import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('MAIL_HOST');
    const port = this.configService.get<number>('MAIL_PORT') || 587;
    const user = this.configService.get<string>('MAIL_USER');
    const pass = this.configService.get<string>('MAIL_PASSWORD');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: this.configService.get<string>('MAIL_SECURE') === 'true' || port === 465,
      auth: {
        user,
        pass,
      },
    });
  }

  async sendOtpEmail(to: string, otp: string): Promise<boolean> {
    const fromName = this.configService.get<string>('MAIL_FROM_NAME') || 'BizzDeal';
    const fromEmail = this.configService.get<string>('MAIL_FROM') || this.configService.get<string>('MAIL_USER');

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject: 'Your BizzDeal OTP Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">BizzDeal Verification</h2>
          <p>Please use the following One Time Password (OTP) to proceed with your request. This code is valid for 10 minutes.</p>
          <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <h1 style="font-size: 36px; letter-spacing: 5px; margin: 0; color: #1f2937;">${otp}</h1>
          </div>
          <p style="color: #6b7280; font-size: 14px;">If you didn't request this code, you can safely ignore this email.</p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`OTP email sent successfully to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${to}: ${error.message}`, error.stack);
      throw new Error('Failed to send email. Please verify your email configuration.');
    }
  }

  async sendConfirmationEmail(to: string, token: string): Promise<boolean> {
    const domain = this.configService.get<string>('DOMAIN') || 'http://localhost';
    const port = this.configService.get<number>('PORT') || 3000;
    const contextPath = this.configService.get<string>('CONTEXT_PATH') || '/bizzdeal/api';
    
    const isProd = domain.startsWith('https');
    const backendUrl = isProd ? `${domain}${contextPath}` : `${domain}:${port}${contextPath}`;
    const confirmationLink = `${backendUrl}/auth/verify-email?token=${token}`;

    const fromName = this.configService.get<string>('MAIL_FROM_NAME') || 'BizzDeal';
    const fromEmail = this.configService.get<string>('MAIL_FROM') || this.configService.get<string>('MAIL_USER');

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject: 'Verify Your BizzDeal Account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">Welcome to BizzDeal!</h2>
          <p>Thank you for registering. Please click the button below to verify your email address and finalize your account.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${confirmationLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Verify Email</a>
          </div>
          <p style="color: #6b7280; font-size: 14px;">If the button doesn't work, copy and paste the following link into your browser:</p>
          <p style="color: #6b7280; font-size: 14px; word-break: break-all;">${confirmationLink}</p>
          <p style="color: #6b7280; font-size: 14px;">If you didn't create an account, you can safely ignore this email.</p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Confirmation email sent successfully to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send confirmation email to ${to}: ${error.message}`, error.stack);
      throw new Error('Failed to send confirmation email. Please verify your email configuration.');
    }
  }
}
