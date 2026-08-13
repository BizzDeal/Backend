import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';
import { Offer } from '../src/modules/offers/entities/offer.entity';
import { OfferType, DiscountType, OfferStatus } from '../src/common/enums';
import { SeededBusinessesResult } from './02-seed-businesses';
import { SeededUsersResult } from './01-seed-users';

export interface SeededOffersResult {
  offer1: Offer;
  offer2: Offer;
  offer3: Offer;
  offer4: Offer;
  offerExpired: Offer;
  offerPending: Offer;
  offerRejected: Offer;
  offerInactive: Offer;
  allOffers: Offer[];
}

export async function seedDummyOffers(
  dataSource: DataSource,
  businesses: SeededBusinessesResult,
  users: SeededUsersResult,
): Promise<SeededOffersResult> {
  const logger = new Logger('SeedDummyOffers');
  logger.log('Seeding dummy offers (Multiple DISCOUNT, CASHBACK, and BIZZ_COINS offers per business)...');

  const offerRepo = dataSource.getRepository(Offer);

  const now = new Date();
  const sixtyDaysLater = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

  const allBizList = businesses.allBusinesses || [
    businesses.business1,
    businesses.business2,
    businesses.business3,
    businesses.business4,
  ].filter(Boolean);

  const resultMap: Record<string, Offer> = {};
  const allSeededOffers: Offer[] = [];

  let totalCount = 0;

  for (let idx = 0; idx < allBizList.length; idx++) {
    const biz = allBizList[idx];

    // Generate multiple offers of EACH offer type for each business:
    // 2 DISCOUNT, 2 CASHBACK, 2 BIZZ_COINS
    const offerTemplates = [
      {
        title: `${biz.name} - 25% OFF Special Discount`,
        description: `Get 25% discount on all orders and bookings above ₹499 at ${biz.name}. Exclusive BizzDeal offer!`,
        offerType: OfferType.DISCOUNT,
        discountType: DiscountType.PERCENTAGE,
        discountValue: 25.00,
        status: OfferStatus.APPROVED,
        startDate: thirtyDaysAgo,
        endDate: sixtyDaysLater,
      },
      {
        title: `${biz.name} - Flat ₹200 Instant Discount`,
        description: `Save Flat ₹200 instantly on minimum bill of ₹999 at ${biz.name}. Limited time deal!`,
        offerType: OfferType.DISCOUNT,
        discountType: DiscountType.FIXED_AMOUNT,
        discountValue: 200.00,
        status: OfferStatus.APPROVED,
        startDate: thirtyDaysAgo,
        endDate: sixtyDaysLater,
      },
      {
        title: `${biz.name} - Flat ₹150 Wallet Cashback`,
        description: `Receive ₹150 instant cashback in your cash wallet on your first transaction at ${biz.name}.`,
        offerType: OfferType.CASHBACK,
        discountType: DiscountType.FIXED_AMOUNT,
        discountValue: 150.00,
        status: OfferStatus.APPROVED,
        startDate: thirtyDaysAgo,
        endDate: sixtyDaysLater,
      },
      {
        title: `${biz.name} - 15% Instant Wallet Cashback`,
        description: `Earn 15% cashback directly into your BizzDeal wallet on all purchases at ${biz.name}.`,
        offerType: OfferType.CASHBACK,
        discountType: DiscountType.PERCENTAGE,
        discountValue: 15.00,
        status: OfferStatus.APPROVED,
        startDate: thirtyDaysAgo,
        endDate: sixtyDaysLater,
      },
      {
        title: `${biz.name} - Earn 500 BizzCoins Reward`,
        description: `Get 500 bonus BizzCoins credited to your coin balance when you redeem vouchers at ${biz.name}.`,
        offerType: OfferType.BIZZ_COINS,
        discountType: DiscountType.FIXED_AMOUNT,
        discountValue: 500.00,
        status: OfferStatus.APPROVED,
        startDate: thirtyDaysAgo,
        endDate: sixtyDaysLater,
      },
      {
        title: `${biz.name} - Mega Deal: 1200 BizzCoins Bonus`,
        description: `Earn a whopping 1200 BizzCoins reward for premium purchases & combos at ${biz.name}.`,
        offerType: OfferType.BIZZ_COINS,
        discountType: DiscountType.FIXED_AMOUNT,
        discountValue: 1200.00,
        status: OfferStatus.APPROVED,
        startDate: thirtyDaysAgo,
        endDate: sixtyDaysLater,
      },
    ];

    for (const tpl of offerTemplates) {
      totalCount++;
      let offer = await offerRepo.findOne({ where: { title: tpl.title, business_id: biz.id } });
      if (!offer) {
        offer = offerRepo.create({
          business_id: biz.id,
          title: tpl.title,
          description: tpl.description,
          offer_type: tpl.offerType,
          discount_type: tpl.discountType,
          discount_value: tpl.discountValue,
          start_date: tpl.startDate,
          end_date: tpl.endDate,
          status: tpl.status,
          approved_by_id: users.admin ? users.admin.id : null,
          approved_at: users.admin ? new Date() : null,
        });
        offer = await offerRepo.save(offer);
      } else {
        offer.description = tpl.description;
        offer.offer_type = tpl.offerType;
        offer.discount_type = tpl.discountType;
        offer.discount_value = tpl.discountValue;
        offer.start_date = tpl.startDate;
        offer.end_date = tpl.endDate;
        offer.status = tpl.status;
        offer.approved_by_id = users.admin ? users.admin.id : null;
        offer = await offerRepo.save(offer);
      }

      allSeededOffers.push(offer);

      // Key legacy references mapping
      if (allSeededOffers.length === 1) resultMap['offer1'] = offer;
      if (allSeededOffers.length === 2) resultMap['offer2'] = offer;
      if (allSeededOffers.length === 3) resultMap['offer3'] = offer;
      if (allSeededOffers.length === 4) resultMap['offer4'] = offer;
    }
  }

  // Add dedicated Expired and Pending offers for legacy tests
  if (allBizList.length > 0) {
    const biz1 = allBizList[0];
    const expTitle = `${biz1.name} - Expired Special Discount`;
    let expOffer = await offerRepo.findOne({ where: { title: expTitle, business_id: biz1.id } });
    if (!expOffer) {
      expOffer = await offerRepo.save(
        offerRepo.create({
          business_id: biz1.id,
          title: expTitle,
          description: 'Monsoon special 20% discount offer (Expired).',
          offer_type: OfferType.DISCOUNT,
          discount_type: DiscountType.PERCENTAGE,
          discount_value: 20.00,
          start_date: thirtyDaysAgo,
          end_date: tenDaysAgo,
          status: OfferStatus.EXPIRED,
          approved_by_id: users.admin ? users.admin.id : null,
        }),
      );
    }
    resultMap['offerExpired'] = expOffer;

    const pendTitle = `${biz1.name} - Festive Preview Sale (Pending Approval)`;
    let pendOffer = await offerRepo.findOne({ where: { title: pendTitle, business_id: biz1.id } });
    if (!pendOffer) {
      pendOffer = await offerRepo.save(
        offerRepo.create({
          business_id: biz1.id,
          title: pendTitle,
          description: 'Upcoming festive promotion waiting for admin review.',
          offer_type: OfferType.DISCOUNT,
          discount_type: DiscountType.PERCENTAGE,
          discount_value: 40.00,
          start_date: now,
          end_date: sixtyDaysLater,
          status: OfferStatus.PENDING,
          approved_by_id: null,
        }),
      );
    }
    resultMap['offerPending'] = pendOffer;

    const rejTitle = `${biz1.name} - Disallowed Promotion (Rejected)`;
    let rejOffer = await offerRepo.findOne({ where: { title: rejTitle, business_id: biz1.id } });
    if (!rejOffer) {
      rejOffer = await offerRepo.save(
        offerRepo.create({
          business_id: biz1.id,
          title: rejTitle,
          description: 'A promotion that violated our terms of service.',
          offer_type: OfferType.DISCOUNT,
          discount_type: DiscountType.FIXED_AMOUNT,
          discount_value: 50.00,
          start_date: thirtyDaysAgo,
          end_date: sixtyDaysLater,
          status: OfferStatus.REJECTED,
          approved_by_id: users.admin ? users.admin.id : null,
        }),
      );
    }
    resultMap['offerRejected'] = rejOffer;

    const inactiveTitle = `${biz1.name} - Paused Promotion (Inactive)`;
    let inactiveOffer = await offerRepo.findOne({ where: { title: inactiveTitle, business_id: biz1.id } });
    if (!inactiveOffer) {
      inactiveOffer = await offerRepo.save(
        offerRepo.create({
          business_id: biz1.id,
          title: inactiveTitle,
          description: 'A promotion that is currently paused by the business owner.',
          offer_type: OfferType.CASHBACK,
          discount_type: DiscountType.PERCENTAGE,
          discount_value: 10.00,
          start_date: thirtyDaysAgo,
          end_date: sixtyDaysLater,
          status: OfferStatus.INACTIVE,
          approved_by_id: users.admin ? users.admin.id : null,
        }),
      );
    }
    resultMap['offerInactive'] = inactiveOffer;
  }

  logger.log(`Successfully seeded ${allSeededOffers.length} offers across ${allBizList.length} businesses (Multiple DISCOUNT, CASHBACK & BIZZ_COINS per business).`);

  resultMap['allOffers'] = allSeededOffers as unknown as Offer;

  return resultMap as unknown as SeededOffersResult;
}
