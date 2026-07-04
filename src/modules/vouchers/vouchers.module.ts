import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Voucher } from './entities/voucher.entity';
import { Offer } from '../offers/entities/offer.entity';
import { Business } from '../businesses/entities/business.entity';
import { User } from '../users/entities/user.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { WalletTransaction } from '../wallet/entities/wallet-transaction.entity';
import { VouchersService } from './vouchers.service';
import { VouchersController } from './vouchers.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Voucher,
      Offer,
      Business,
      User,
      Wallet,
      WalletTransaction,
    ]),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'bizz_deal_access_secret',
    }),
  ],
  controllers: [VouchersController],
  providers: [VouchersService],
  exports: [VouchersService],
})
export class VouchersModule {}
