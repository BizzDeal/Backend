import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';
import { Voucher } from '../src/modules/vouchers/entities/voucher.entity';
import { Wallet } from '../src/modules/wallet/entities/wallet.entity';
import { WalletTransaction } from '../src/modules/wallet/entities/wallet-transaction.entity';
import { BizzCoinWallet } from '../src/modules/bizz-coins/entities/bizz-coin-wallet.entity';
import { BizzCoinTransaction, BizzCoinTransactionType } from '../src/modules/bizz-coins/entities/bizz-coin-transaction.entity';
import { VoucherStatus, WalletTransactionType, WalletReferenceType } from '../src/common/enums';
import { SeededUsersResult } from './01-seed-users';
import { SeededBusinessesResult } from './02-seed-businesses';
import { SeededOffersResult } from './03-seed-offers';

export async function seedDummyVouchersAndWallets(
  dataSource: DataSource,
  users: SeededUsersResult,
  businesses: SeededBusinessesResult,
  offers: SeededOffersResult,
): Promise<void> {
  const logger = new Logger('SeedDummyVouchersAndWallets');
  logger.log('Seeding dummy wallets, transactions, bizz coins, and vouchers...');

  const walletRepo = dataSource.getRepository(Wallet);
  const walletTxRepo = dataSource.getRepository(WalletTransaction);
  const coinWalletRepo = dataSource.getRepository(BizzCoinWallet);
  const coinTxRepo = dataSource.getRepository(BizzCoinTransaction);
  const voucherRepo = dataSource.getRepository(Voucher);

  // 1. Seed Cash Wallets & Transactions
  const userWallets = [
    { user: users.customer1, balance: 2500.00, totalSavings: 850.00 },
    { user: users.customer2, balance: 1200.00, totalSavings: 350.00 },
    { user: users.customer3, balance: 0.00, totalSavings: 0.00 },
    { user: users.customer4, balance: 150.00, totalSavings: 100.00 },
    { user: users.owner1, balance: 15400.00, totalSavings: 0.00 },
    { user: users.owner2, balance: 22800.00, totalSavings: 0.00 },
    { user: users.agent1, balance: 4500.00, totalSavings: 0.00 },
  ];

  for (const w of userWallets) {
    let wallet = await walletRepo.findOne({ where: { user_id: w.user.id } });
    if (!wallet) {
      wallet = walletRepo.create({
        user_id: w.user.id,
        balance: w.balance,
        total_savings: w.totalSavings,
      });
      wallet = await walletRepo.save(wallet);
    } else {
      wallet.balance = w.balance;
      wallet.total_savings = w.totalSavings;
      wallet = await walletRepo.save(wallet);
    }

    // Seed 2 transactions per funded wallet
    if (w.balance > 0) {
      const existingTx = await walletTxRepo.findOne({ where: { wallet_id: wallet.id } });
      if (!existingTx) {
        await walletTxRepo.save([
          walletTxRepo.create({
            wallet_id: wallet.id,
            user_id: w.user.id,
            type: WalletTransactionType.CREDIT,
            amount: w.balance * 0.7,
            description: 'Initial wallet recharge / bonus credit',
            reference_type: WalletReferenceType.MANUAL,
          }),
          walletTxRepo.create({
            wallet_id: wallet.id,
            user_id: w.user.id,
            type: WalletTransactionType.SAVING,
            amount: w.totalSavings,
            description: 'Voucher discount savings cashback',
            reference_type: WalletReferenceType.VOUCHER,
          }),
        ]);
      }
    }
  }

  // 2. Seed BizzCoin Wallets & Transactions
  const coinWallets = [
    { user: users.customer1, balance: 1500 },
    { user: users.customer2, balance: 750 },
    { user: users.customer3, balance: 0 },
    { user: users.customer4, balance: 250 },
  ];

  for (const cw of coinWallets) {
    let coinWallet = await coinWalletRepo.findOne({ where: { user_id: cw.user.id } });
    if (!coinWallet) {
      coinWallet = coinWalletRepo.create({
        user_id: cw.user.id,
        balance: cw.balance,
      });
      coinWallet = await coinWalletRepo.save(coinWallet);
    } else {
      coinWallet.balance = cw.balance;
      coinWallet = await coinWalletRepo.save(coinWallet);
    }

    if (cw.balance > 0) {
      const existingCoinTx = await coinTxRepo.findOne({ where: { bizz_coin_wallet_id: coinWallet.id } });
      if (!existingCoinTx) {
        await coinTxRepo.save([
          coinTxRepo.create({
            bizz_coin_wallet_id: coinWallet.id,
            user_id: cw.user.id,
            business_id: businesses.business1.id,
            type: BizzCoinTransactionType.CREDIT,
            amount: cw.balance,
            description: 'Welcome Bonus & Offer Cashback Reward',
          }),
        ]);
      }
    }
  }

  // 3. Seed Vouchers
  const voucherConfigs = [
    {
      code: 'BZ-ACT-1001',
      offerId: offers.offer1.id,
      customerId: users.customer1.id,
      businessId: businesses.business1.id,
      status: VoucherStatus.ISSUED,
      redeemedAt: null,
      redeemedById: null,
    },
    {
      code: 'BZ-ACT-1002',
      offerId: offers.offer3.id,
      customerId: users.customer1.id,
      businessId: businesses.business2.id,
      status: VoucherStatus.ISSUED,
      redeemedAt: null,
      redeemedById: null,
    },
    {
      code: 'BZ-RED-2001',
      offerId: offers.offer2.id,
      customerId: users.customer2.id,
      businessId: businesses.business1.id,
      status: VoucherStatus.REDEEMED,
      redeemedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      redeemedById: users.owner1.id,
    },
    {
      code: 'BZ-CAN-3001',
      offerId: offers.offerExpired.id,
      customerId: users.customer4.id,
      businessId: businesses.business1.id,
      status: VoucherStatus.CANCELLED,
      redeemedAt: null,
      redeemedById: null,
    },
  ];

  for (const vc of voucherConfigs) {
    let voucher = await voucherRepo.findOne({ where: { voucher_code: vc.code } });
    if (!voucher) {
      voucher = voucherRepo.create({
        voucher_code: vc.code,
        offer_id: vc.offerId,
        customer_id: vc.customerId,
        business_id: vc.businessId,
        status: vc.status,
        issued_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        redeemed_at: vc.redeemedAt,
        redeemed_by_id: vc.redeemedById,
      });
      await voucherRepo.save(voucher);
    } else {
      voucher.status = vc.status;
      voucher.redeemed_at = vc.redeemedAt;
      voucher.redeemed_by_id = vc.redeemedById;
      await voucherRepo.save(voucher);
    }
    logger.log(`Seeded Voucher Code: ${vc.code} (${vc.status})`);
  }
}
