import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';

import { PaymentTransaction } from './entities/payment-transaction.entity';
import { PaymentStatus, PaymentPurpose, WalletReferenceType, UserRole } from '../../common/enums';
import { User } from '../users/entities/user.entity';
import { WalletService } from '../wallet/wallet.service';
import { UsersService } from '../users/users.service';
import { BusinessesService } from '../businesses/businesses.service';
import { UserStatus, BusinessStatus } from '../../common/enums';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private razorpayInstance: any;

  constructor(
    @InjectRepository(PaymentTransaction)
    private readonly paymentRepo: Repository<PaymentTransaction>,
    private readonly configService: ConfigService,
    private readonly walletService: WalletService,
    private readonly usersService: UsersService,
    private readonly businessesService: BusinessesService,
  ) {
    const key_id = this.configService.get<string>('RAZORPAY_KEY_ID');
    const key_secret = this.configService.get<string>('RAZORPAY_KEY_SECRET');
    
    if (key_id && key_secret) {
      this.razorpayInstance = new Razorpay({
        key_id,
        key_secret,
      });
    } else {
      this.logger.warn('Razorpay credentials not found in environment variables.');
    }
  }

  async createOrder(user: User, amount: number, purpose: PaymentPurpose): Promise<{ order_id: string; amount: number }> {
    if (!this.razorpayInstance) {
      throw new InternalServerErrorException('Payment gateway is not configured properly.');
    }

    // Razorpay amount is in paise (smallest currency unit), so multiply by 100 for INR
    const amountInPaise = Math.round(amount * 100);

    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `rcpt_${user.id.substring(0, 8)}_${Date.now()}`,
      notes: {
        userId: user.id,
        purpose,
      },
    };

    try {
      const order = await this.razorpayInstance.orders.create(options);

      const paymentTx = this.paymentRepo.create({
        user_id: user.id,
        razorpay_order_id: order.id,
        amount,
        currency: 'INR',
        status: PaymentStatus.PENDING,
        purpose,
      });

      await this.paymentRepo.save(paymentTx);

      return {
        order_id: order.id,
        amount: amount,
      };
    } catch (error) {
      this.logger.error('Error creating Razorpay order', error);
      throw new InternalServerErrorException('Could not initiate payment order.');
    }
  }

  async verifyPayment(
    user: User,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ): Promise<{ success: boolean; message: string }> {
    const paymentTx = await this.paymentRepo.findOne({
      where: { razorpay_order_id: razorpayOrderId },
    });

    if (!paymentTx) {
      throw new NotFoundException('Payment order not found.');
    }

    if (paymentTx.status === PaymentStatus.SUCCESS) {
      return { success: true, message: 'Payment already verified.' };
    }

    const secret = this.configService.get<string>('RAZORPAY_KEY_SECRET');
    const generatedSignature = crypto
      .createHmac('sha256', secret || '')
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (generatedSignature !== razorpaySignature) {
      paymentTx.status = PaymentStatus.FAILED;
      await this.paymentRepo.save(paymentTx);
      this.logger.error(`Signature mismatch. Generated: ${generatedSignature}, Expected: ${razorpaySignature}`);
      throw new BadRequestException('Invalid payment signature.');
    }

    paymentTx.status = PaymentStatus.SUCCESS;
    paymentTx.razorpay_payment_id = razorpayPaymentId;
    paymentTx.razorpay_signature = razorpaySignature;

    await this.paymentRepo.save(paymentTx);

    await this.handlePostPaymentSuccess(paymentTx);

    return {
      success: true,
      message: 'Payment verified successfully.',
    };
  }

  async handleWebhook(body: any, signature: string): Promise<{ received: boolean }> {
    const webhookSecret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET');
    
    if (!webhookSecret) {
      this.logger.warn('RAZORPAY_WEBHOOK_SECRET not set, ignoring webhook.');
      return { received: true };
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(body))
      .digest('hex');

    if (expectedSignature !== signature) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = body.event;
    
    if (event === 'payment.captured' || event === 'order.paid') {
      const orderId = body.payload.payment.entity.order_id;
      
      const paymentTx = await this.paymentRepo.findOne({
        where: { razorpay_order_id: orderId },
      });

      if (paymentTx && paymentTx.status !== PaymentStatus.SUCCESS) {
        paymentTx.status = PaymentStatus.SUCCESS;
        paymentTx.razorpay_payment_id = body.payload.payment.entity.id;
        await this.paymentRepo.save(paymentTx);

        await this.handlePostPaymentSuccess(paymentTx);

        this.logger.log(`Webhook marked order ${orderId} as SUCCESS`);
      }
    } else if (event === 'payment.failed') {
      const orderId = body.payload.payment.entity.order_id;
      
      const paymentTx = await this.paymentRepo.findOne({
        where: { razorpay_order_id: orderId },
      });

      if (paymentTx && paymentTx.status === PaymentStatus.PENDING) {
        paymentTx.status = PaymentStatus.FAILED;
        await this.paymentRepo.save(paymentTx);
        this.logger.log(`Webhook marked order ${orderId} as FAILED`);
      }
    }

    return { received: true };
  }

  private async handlePostPaymentSuccess(paymentTx: PaymentTransaction): Promise<void> {
    try {
      if (paymentTx.purpose === PaymentPurpose.WALLET_TOPUP) {
        // Check if already credited
        const existingTx = await this.walletService.checkExistingTransaction(WalletReferenceType.PAYMENT_GATEWAY, paymentTx.id);
        if (!existingTx) {
          await this.walletService.creditWallet({
            user_id: paymentTx.user_id,
            amount: paymentTx.amount,
            description: 'Wallet top-up via Razorpay',
            reference_type: WalletReferenceType.PAYMENT_GATEWAY,
            reference_id: paymentTx.id,
          });
        }
      } else if (paymentTx.purpose === PaymentPurpose.REGISTRATION_FEE) {
         const u = await this.usersService.findOneById(paymentTx.user_id);
          if (u && u.status === UserStatus.PENDING_PAYMENT) {
            await this.usersService.update(u.id, { status: UserStatus.PENDING });
            const business = await this.businessesService.findOneByOwnerId(u.id);
            if (business && business.status === BusinessStatus.PENDING_PAYMENT) {
              await this.businessesService.updateBusinessStatusInternal(business.id, BusinessStatus.PENDING);
            }
          }
         this.logger.log(`Registration fee verified for user ${paymentTx.user_id}, status updated to PENDING.`);
      }
    } catch (error) {
      this.logger.error(`Error processing post-payment logic for ${paymentTx.id}`, error);
    }
  }
}
