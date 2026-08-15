import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { WalletModule } from '../wallet/wallet.module';
import { UsersModule } from '../users/users.module';

import { BusinessesModule } from '../businesses/businesses.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentTransaction]),
    WalletModule,
    UsersModule,
    BusinessesModule,
    forwardRef(() => AuthModule),
  ],
  providers: [PaymentsService],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
