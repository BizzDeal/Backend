import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentPurpose } from '../../../common/enums';

export const createOrderSchema = z.object({
  amount: z.coerce.number().positive('Amount must be a positive number'),
  purpose: z.nativeEnum(PaymentPurpose),
});

export class CreateOrderDto {
  @ApiProperty({
    description: 'The amount to be paid (in INR)',
    example: 10000,
  })
  amount: number;

  @ApiProperty({
    description: 'The purpose of the payment',
    enum: PaymentPurpose,
    example: PaymentPurpose.REGISTRATION_FEE,
  })
  purpose: PaymentPurpose;
}

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1, 'Order ID is required'),
  razorpay_payment_id: z.string().min(1, 'Payment ID is required'),
  razorpay_signature: z.string().min(1, 'Signature is required'),
});

export class VerifyPaymentDto {
  @ApiProperty({
    description: 'The Razorpay Order ID returned during creation',
    example: 'order_IluGWxBm9U8zJ8',
  })
  razorpay_order_id: string;

  @ApiProperty({
    description: 'The Razorpay Payment ID returned upon successful payment',
    example: 'pay_IluGWxBm9U8zJ8',
  })
  razorpay_payment_id: string;

  @ApiProperty({
    description: 'The Razorpay signature used for verification',
    example: '2c1b9b9c9...',
  })
  razorpay_signature: string;
}
