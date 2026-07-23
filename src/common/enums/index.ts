export enum UserRole {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  CUSTOMER = 'CUSTOMER',
}

export enum UserStatus {
  UNVERIFIED = 'UNVERIFIED',
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
}

export enum DeviceType {
  ANDROID = 'ANDROID',
  IOS = 'IOS',
  WEB = 'WEB',
}

export enum BusinessStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
}

export enum OfferType {
  DISCOUNT = 'DISCOUNT',
  CASHBACK = 'CASHBACK',
}

export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
}

export enum OfferStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  INACTIVE = 'INACTIVE',
}

export enum VoucherStatus {
  ISSUED = 'ISSUED',
  REDEEMED = 'REDEEMED',
  CANCELLED = 'CANCELLED',
}

export enum WalletTransactionType {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
  SAVING = 'SAVING',
}

export enum WalletReferenceType {
  VOUCHER = 'VOUCHER',
  REFERRAL = 'REFERRAL',
  MANUAL = 'MANUAL',
}

export enum ReferralStatus {
  PENDING = 'PENDING',
  JOINED = 'JOINED',
  REWARDED = 'REWARDED',
  CANCELLED = 'CANCELLED',
}

export enum NotificationType {
  GENERAL = 'GENERAL',
  OFFER = 'OFFER',
  VOUCHER = 'VOUCHER',
  WALLET = 'WALLET',
  MEETING = 'MEETING',
  CHAT = 'CHAT',
}

export enum MediaType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  DOCUMENT = 'DOCUMENT',
}

export enum MediaPurpose {
  PROFILE_PIC = 'PROFILE_PIC',
  PAYMENT_RECEIPT = 'PAYMENT_RECEIPT',
  BUSINESS_LOGO = 'BUSINESS_LOGO',
  OFFER_IMAGE = 'OFFER_IMAGE',
  GENERAL = 'GENERAL',
}

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  FILE = 'FILE',
  VOICE = 'VOICE',
}

export enum ConversationType {
  DIRECT = 'DIRECT',
  GROUP = 'GROUP',
}

export enum MeetingStatus {
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum AttendeeStatus {
  INVITED = 'INVITED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  ATTENDED = 'ATTENDED',
  MISSED = 'MISSED',
}
