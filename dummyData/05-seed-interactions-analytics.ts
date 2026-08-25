import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';
import { CustomerBusiness } from '../src/modules/businesses/entities/customer-business.entity';
import { Meeting } from '../src/modules/meetings/entities/meeting.entity';
import { MeetingAttendee } from '../src/modules/meetings/entities/meeting-attendee.entity';
import { ChatConversation } from '../src/modules/chat/entities/chat-conversation.entity';
import { ChatParticipant } from '../src/modules/chat/entities/chat-participant.entity';
import { ChatMessage } from '../src/modules/chat/entities/chat-message.entity';
import { Notification } from '../src/modules/notifications/entities/notification.entity';
import { Referral } from '../src/modules/referrals/entities/referral.entity';
import { PlatformKpi } from '../src/modules/analytics/entities/analytics-platform-kpi.entity';
import { MonthlyMetric } from '../src/modules/analytics/entities/analytics-monthly-metric.entity';
import { MeetingStatus, MeetingType, AttendeeStatus, ConversationType, MessageType, NotificationType, ReferralType } from '../src/common/enums';
import { SeededUsersResult } from './01-seed-users';
import { SeededBusinessesResult } from './02-seed-businesses';

export async function seedDummyInteractionsAndAnalytics(
  dataSource: DataSource,
  users: SeededUsersResult,
  businesses: SeededBusinessesResult,
): Promise<void> {
  const logger = new Logger('SeedDummyInteractionsAndAnalytics');
  logger.log('Seeding dummy meetings, chats, notifications, customer visits, and analytics...');

  const custBizRepo = dataSource.getRepository(CustomerBusiness);
  const meetingRepo = dataSource.getRepository(Meeting);
  const attendeeRepo = dataSource.getRepository(MeetingAttendee);
  const chatConvRepo = dataSource.getRepository(ChatConversation);
  const chatPartRepo = dataSource.getRepository(ChatParticipant);
  const chatMsgRepo = dataSource.getRepository(ChatMessage);
  const notifRepo = dataSource.getRepository(Notification);
  const referralRepo = dataSource.getRepository(Referral);
  const kpiRepo = dataSource.getRepository(PlatformKpi);
  const monthlyMetricRepo = dataSource.getRepository(MonthlyMetric);

  // 1. Customer Business Relationships (Saved / Favorites / Visits)
  const custBizEntries = [
    { customer_id: users.customer1.id, business_id: businesses.business1.id, is_favorite: true, notes: 'Loves Biryani combos' },
    { customer_id: users.customer1.id, business_id: businesses.business2.id, is_favorite: true, notes: 'Frequents fashion sale' },
    { customer_id: users.customer2.id, business_id: businesses.business1.id, is_favorite: false, notes: 'Visited twice' },
  ];

  for (const entry of custBizEntries) {
    const existing = await custBizRepo.findOne({ where: { customer_id: entry.customer_id, business_id: entry.business_id } });
    if (!existing) {
      await custBizRepo.save(custBizRepo.create(entry));
    }
  }

  // 2. Meetings & Attendees
  const meetingDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days from now
  let meeting = await meetingRepo.findOne({ where: { title: 'B2B Merchant Growth Workshop' } });
  if (!meeting) {
    meeting = await meetingRepo.save(
      meetingRepo.create({
        meeting_type: MeetingType.SPOTLIGHT,
        created_by_id: users.admin.id,
        business_id: businesses.business1.id,
        title: 'B2B Merchant Growth Workshop',
        description: 'Monthly strategy session for top performing food & retail merchants in Visakhapatnam.',
        meeting_date: meetingDate,
        location: 'Grand Bay Hotel, Beach Road, Visakhapatnam',
        meeting_link: 'https://meet.google.com/abc-defg-hij',
        status: MeetingStatus.SCHEDULED,
      }),
    );

    await attendeeRepo.save([
      attendeeRepo.create({
        meeting_id: meeting.id,
        user_id: users.owner1.id,
        status: AttendeeStatus.ACCEPTED,
      }),
      attendeeRepo.create({
        meeting_id: meeting.id,
        user_id: users.owner2.id,
        status: AttendeeStatus.ACCEPTED,
      }),
      attendeeRepo.create({
        meeting_id: meeting.id,
        user_id: users.agent1.id,
        status: AttendeeStatus.ATTENDED,
      }),
    ]);
    logger.log('Seeded Spotlight Meeting and Attendees.');
  }

  // Completed Regular Meeting
  let pastMeeting = await meetingRepo.findOne({ where: { title: 'Quarterly Review Sync' } });
  if (!pastMeeting) {
    pastMeeting = await meetingRepo.save(
      meetingRepo.create({
        meeting_type: MeetingType.REGULAR,
        created_by_id: users.admin.id,
        business_id: businesses.business1.id,
        title: 'Quarterly Review Sync',
        description: 'Review of last quarter performance.',
        meeting_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        location: 'Virtual',
        meeting_link: 'https://meet.google.com/xyz-abcd-efg',
        status: MeetingStatus.COMPLETED,
      }),
    );

    await attendeeRepo.save([
      attendeeRepo.create({
        meeting_id: pastMeeting.id,
        user_id: users.owner1.id,
        status: AttendeeStatus.ATTENDED,
      }),
      attendeeRepo.create({
        meeting_id: pastMeeting.id,
        user_id: users.agent2.id,
        status: AttendeeStatus.MISSED,
      }),
    ]);
  }

  // Cancelled Meeting
  let cancelledMeeting = await meetingRepo.findOne({ where: { title: 'Onboarding Follow-up' } });
  if (!cancelledMeeting) {
    cancelledMeeting = await meetingRepo.save(
      meetingRepo.create({
        meeting_type: MeetingType.REGULAR,
        created_by_id: users.admin.id,
        business_id: businesses.business2.id,
        title: 'Onboarding Follow-up',
        description: 'Follow-up on merchant onboarding process.',
        meeting_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        location: 'Phone Call',
        status: MeetingStatus.CANCELLED,
      }),
    );

    await attendeeRepo.save([
      attendeeRepo.create({
        meeting_id: cancelledMeeting.id,
        user_id: users.owner2.id,
        status: AttendeeStatus.REJECTED,
      }),
    ]);
  }

  // 3. Chat Conversations & Messages
  let conv = await chatConvRepo.findOne({ where: { type: ConversationType.DIRECT, name: 'Support & Inquiry' } });
  if (!conv) {
    conv = await chatConvRepo.save(
      chatConvRepo.create({
        type: ConversationType.DIRECT,
        name: 'Support & Inquiry',
        is_default_group: false,
        last_message_at: new Date(),
      }),
    );

    await chatPartRepo.save([
      chatPartRepo.create({ conversation_id: conv.id, user_id: users.customer1.id }),
      chatPartRepo.create({ conversation_id: conv.id, user_id: users.owner1.id }),
    ]);

    await chatMsgRepo.save([
      chatMsgRepo.create({
        conversation_id: conv.id,
        sender_id: users.customer1.id,
        message_type: MessageType.TEXT,
        message: 'Hi! Is the 30% discount applicable on home delivery orders?',
        created_at: new Date(Date.now() - 3600000),
      }),
      chatMsgRepo.create({
        conversation_id: conv.id,
        sender_id: users.owner1.id,
        message_type: MessageType.TEXT,
        message: 'Hello Kiran! Yes, it is applicable on dine-in as well as home delivery via BizzDeal voucher code!',
        created_at: new Date(Date.now() - 1800000),
      }),
    ]);
    logger.log('Seeded Direct Chat Conversation and Messages.');
  }

  // Group Chat - Single Default Community: BizzDeal Community
  const legacyGroups = await chatConvRepo.find({ where: { name: 'Visakha Merchants Hub' } });
  for (const legacy of legacyGroups) {
    await chatConvRepo.remove(legacy);
  }

  let groupConv = await chatConvRepo.findOne({ where: { is_default_group: true } });
  if (!groupConv) {
    groupConv = await chatConvRepo.save(
      chatConvRepo.create({
        type: ConversationType.GROUP,
        name: 'BizzDeal Community',
        is_default_group: true,
        last_message_at: new Date(),
      }),
    );
  } else {
    groupConv.name = 'BizzDeal Community';
    await chatConvRepo.save(groupConv);
  }

  // Ensure default participants are joined
  const participantUserIds = [users.admin.id, users.owner1.id, users.owner2.id];
  for (const uid of participantUserIds) {
    const existingPart = await chatPartRepo.findOne({
      where: { conversation_id: groupConv.id, user_id: uid },
    });
    if (!existingPart) {
      await chatPartRepo.save(
        chatPartRepo.create({ conversation_id: groupConv.id, user_id: uid }),
      );
    }
  }

  // Seed sample community messages if empty
  const existingMsgCount = await chatMsgRepo.count({ where: { conversation_id: groupConv.id } });
  if (existingMsgCount === 0) {
    await chatMsgRepo.save([
      chatMsgRepo.create({
        conversation_id: groupConv.id,
        sender_id: users.admin.id,
        message_type: MessageType.TEXT,
        message: 'Welcome all to the BizzDeal Community group!',
        created_at: new Date(Date.now() - 7200000),
      }),
      chatMsgRepo.create({
        conversation_id: groupConv.id,
        sender_id: users.owner2.id,
        message_type: MessageType.TEXT,
        message: 'Thank you Admin, glad to be here.',
        created_at: new Date(Date.now() - 3600000),
      }),
    ]);
  }
  logger.log('Seeded / Verified BizzDeal Community Group Chat and Messages.');

  // 4. System Notifications
  const notifs = [
    {
      user_id: users.customer1.id,
      title: 'Voucher Issued Successfully!',
      message: 'Your 30% OFF Spicy Bites voucher BZ-ACT-1001 is now active in your wallet.',
      type: NotificationType.VOUCHER,
      is_read: false,
    },
    {
      user_id: users.customer1.id,
      title: 'BizzCoins Credited!',
      message: '1500 BizzCoins credited as welcome bonus and offer reward.',
      type: NotificationType.WALLET,
      is_read: true,
      read_at: new Date(),
    },
    {
      user_id: users.owner1.id,
      title: 'New Voucher Redeemed!',
      message: 'Voucher BZ-RED-2001 was redeemed at Spicy Bites by Sneha Patel.',
      type: NotificationType.OFFER,
      is_read: true,
      read_at: new Date(),
    },
  ];

  for (const n of notifs) {
    const existing = await notifRepo.findOne({ where: { user_id: n.user_id, title: n.title } });
    if (!existing) {
      await notifRepo.save(notifRepo.create(n));
    }
  }

  // 5. Referrals
  let referral = await referralRepo.findOne({ where: { referrer_id: users.agent1.id, to_member_id: users.owner1.id } });
  if (!referral) {
    await referralRepo.save(
      referralRepo.create({
        referrer_id: users.agent1.id,
        to_member_id: users.owner1.id,
        referral_type: ReferralType.INHOUSE,
        contact_name: 'Suresh Reddy',
        contact_phone: '9876543213',
        contact_email: 'owner1@bizzdeal.com',
        comments: 'Referred Spicy Bites Restaurant for onboarding.',
        is_appreciated: true,
        cost_of_business: 15000.00,
      }),
    );
  }

  // 6. Analytics KPI & Monthly Data
  const bizCount = businesses.allBusinesses ? businesses.allBusinesses.length : 140;
  let existingKpi = await kpiRepo.findOne({ where: { id: 'PLATFORM_SUMMARY' } });
  if (!existingKpi) {
    await kpiRepo.save(
      kpiRepo.create({
        id: 'PLATFORM_SUMMARY',
        total_members: 2,
        active_members: 2,
        total_customers: 4,
        total_businesses: bizCount,
        total_vouchers_issued: 4,
        total_vouchers_redeemed: 1,
        total_revenue: 1250000.00,
        total_wallet_volume: 42000.00,
        total_referrals: 1,
        converted_referrals: 1,
      }),
    );
  } else {
    existingKpi.total_businesses = bizCount;
    await kpiRepo.save(existingKpi);
  }

  const existingMonthly = await monthlyMetricRepo.findOne({ where: { period_month: '2026-08' } });
  if (!existingMonthly) {
    await monthlyMetricRepo.save(
      monthlyMetricRepo.create({
        period_month: '2026-08',
        new_customers: 4,
        new_members: 2,
        vouchers_issued: 4,
        vouchers_redeemed: 1,
        wallet_credits: 25000.00,
        wallet_debits: 5000.00,
        revenue: 1250000.00,
      }),
    );
  }

  logger.log('Successfully seeded all interactions and analytics KPI data.');
}
