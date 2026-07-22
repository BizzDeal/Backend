import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { UserStatus, BusinessStatus } from '../../common/enums';

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

  private getBackendUrl(): string {
    const domain = this.configService.get<string>('DOMAIN') || 'http://localhost';
    const port = this.configService.get<number>('PORT') || 3000;
    const contextPath = this.configService.get<string>('CONTEXT_PATH') || '/bizzdeal/api';
    
    const isProd = domain.startsWith('https');
    return isProd ? `${domain}${contextPath}` : `${domain}:${port}${contextPath}`;
  }

  private getBaseUrl(): string {
    const domain = this.configService.get<string>('DOMAIN') || 'http://localhost';
    const port = this.configService.get<number>('PORT') || 3000;
    const isProd = domain.startsWith('https');
    return isProd ? domain : `${domain}:${port}`;
  }

  private getHeaderHtml(): string {
    const baseUrl = this.getBaseUrl();
    return `
      <div style="text-align: center; margin-bottom: 20px;">
        <img src="${baseUrl}/assets/logo-text.png" alt="BizzDeal Logo" style="max-height: 50px;">
      </div>
    `;
  }

  private getFooterHtml(): string {
    const baseUrl = this.getBaseUrl();
    return `
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
        <img src="${baseUrl}/assets/icon-only.jpg" alt="BizzDeal Icon" style="max-height: 30px; margin-bottom: 10px; border-radius: 4px;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} BizzDeal. All rights reserved.</p>
      </div>
    `;
  }

  async sendOtpEmail(to: string, otp: string): Promise<boolean> {
    const fromName = this.configService.get<string>('MAIL_FROM_NAME') || 'BizzDeal';
    const fromEmail = this.configService.get<string>('MAIL_FROM') || this.configService.get<string>('MAIL_USER');

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject: 'Your BizzDeal OTP Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          ${this.getHeaderHtml()}
          <h2 style="color: #4f46e5; text-align: center;">BizzDeal Verification</h2>
          <p style="color: #374151;">Please use the following One Time Password (OTP) to proceed with your request. This code is valid for 10 minutes.</p>
          <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <h1 style="font-size: 36px; letter-spacing: 5px; margin: 0; color: #1f2937;">${otp}</h1>
          </div>
          <p style="color: #6b7280; font-size: 14px;">If you didn't request this code, you can safely ignore this email.</p>
          ${this.getFooterHtml()}
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
    const backendUrl = this.getBackendUrl();
    const confirmationLink = `${backendUrl}/auth/verify-email?token=${token}`;

    const fromName = this.configService.get<string>('MAIL_FROM_NAME') || 'BizzDeal';
    const fromEmail = this.configService.get<string>('MAIL_FROM') || this.configService.get<string>('MAIL_USER');

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject: 'Verify Your BizzDeal Account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          ${this.getHeaderHtml()}
          <h2 style="color: #4f46e5; text-align: center;">Welcome to BizzDeal!</h2>
          <p style="color: #374151;">Thank you for registering. Please click the link below to verify your email address and finalize your account.</p>
          <div style="margin: 20px 0; text-align: center;">
            <a href="${confirmationLink}" style="color: #4f46e5; text-decoration: underline; font-weight: bold; word-break: break-all;">${confirmationLink}</a>
          </div>
          <p style="color: #6b7280; font-size: 14px;">If you didn't create an account, you can safely ignore this email.</p>
          ${this.getFooterHtml()}
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

  async sendMemberStatusEmail(to: string, status: UserStatus): Promise<boolean> {
    let title = '';
    let message = '';
    let color = '';

    if (status === UserStatus.ACTIVE) {
      title = 'Member Account Approved';
      message = 'Great news! Your BizzDeal member account has been approved and is now active.';
      color = '#10b981'; // green
    } else if (status === UserStatus.REJECTED) {
      title = 'Member Account Update';
      message = 'We regret to inform you that your BizzDeal member account application has been rejected.';
      color = '#ef4444'; // red
    } else if (status === UserStatus.SUSPENDED) {
      title = 'Member Account Suspended';
      message = 'Your BizzDeal member account has been suspended. Please contact support for more information.';
      color = '#f59e0b'; // orange
    } else {
      return false;
    }

    const fromName = this.configService.get<string>('MAIL_FROM_NAME') || 'BizzDeal';
    const fromEmail = this.configService.get<string>('MAIL_FROM') || this.configService.get<string>('MAIL_USER');

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject: `BizzDeal: ${title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          ${this.getHeaderHtml()}
          <h2 style="color: ${color}; text-align: center;">${title}</h2>
          <p style="color: #374151; font-size: 16px;">${message}</p>
          ${this.getFooterHtml()}
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Member status email sent to ${to} (${status})`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send member status email to ${to}: ${error.message}`);
      return false;
    }
  }

  async sendBusinessStatusEmail(to: string, status: BusinessStatus, businessName: string): Promise<boolean> {
    let title = '';
    let message = '';
    let color = '';

    if (status === BusinessStatus.ACTIVE) {
      title = 'Business Profile Approved';
      message = `Great news! Your business profile for <strong>${businessName}</strong> has been approved and is now live.`;
      color = '#10b981'; // green
    } else if (status === BusinessStatus.REJECTED) {
      title = 'Business Profile Update';
      message = `We regret to inform you that your business profile for <strong>${businessName}</strong> has been rejected.`;
      color = '#ef4444'; // red
    } else if (status === BusinessStatus.SUSPENDED) {
      title = 'Business Profile Suspended';
      message = `Your business profile for <strong>${businessName}</strong> has been suspended. Please contact support for more information.`;
      color = '#f59e0b'; // orange
    } else {
      return false;
    }

    const fromName = this.configService.get<string>('MAIL_FROM_NAME') || 'BizzDeal';
    const fromEmail = this.configService.get<string>('MAIL_FROM') || this.configService.get<string>('MAIL_USER');

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject: `BizzDeal: ${title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          ${this.getHeaderHtml()}
          <h2 style="color: ${color}; text-align: center;">${title}</h2>
          <p style="color: #374151; font-size: 16px;">${message}</p>
          ${this.getFooterHtml()}
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Business status email sent to ${to} (${status})`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send business status email to ${to}: ${error.message}`);
      return false;
    }
  }

  async sendMeetingEmail(to: string, eventType: 'CREATED' | 'UPDATED' | 'CANCELED', meetingTitle: string, date: string, time: string): Promise<boolean> {
    let title = '';
    let message = '';
    let color = '#4f46e5';

    if (eventType === 'CREATED') {
      title = 'New Meeting Scheduled';
      message = 'A new meeting has been scheduled with you.';
    } else if (eventType === 'UPDATED') {
      title = 'Meeting Updated';
      message = 'There has been an update to a meeting you are attending.';
    } else if (eventType === 'CANCELED') {
      title = 'Meeting Canceled';
      message = 'A meeting you were scheduled to attend has been canceled.';
      color = '#ef4444';
    }

    const fromName = this.configService.get<string>('MAIL_FROM_NAME') || 'BizzDeal';
    const fromEmail = this.configService.get<string>('MAIL_FROM') || this.configService.get<string>('MAIL_USER');

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject: `BizzDeal: ${title} - ${meetingTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          ${this.getHeaderHtml()}
          <h2 style="color: ${color}; text-align: center;">${title}</h2>
          <p style="color: #374151; font-size: 16px;">${message}</p>
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid ${color};">
            <p style="margin: 0 0 10px 0; color: #111827;"><strong>Meeting:</strong> ${meetingTitle}</p>
            <p style="margin: 0 0 10px 0; color: #111827;"><strong>Date:</strong> ${date}</p>
            <p style="margin: 0; color: #111827;"><strong>Time:</strong> ${time}</p>
          </div>
          ${this.getFooterHtml()}
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Meeting email (${eventType}) sent to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send meeting email to ${to}: ${error.message}`);
      return false;
    }
  }
}
