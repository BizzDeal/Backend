import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Wallet } from './entities/wallet.entity';
import { WalletTransaction } from './entities/wallet-transaction.entity';
import { User } from '../users/entities/user.entity';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, WalletTransaction, User]),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'bizz_deal_access_secret',
    }),
  ],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
