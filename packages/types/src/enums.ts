export const ROLES = ['USER', 'COMPANION', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ['ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const KYC_STATUSES = ['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED'] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];

/**
 * Booking lifecycle:
 * PENDING_PAYMENT → REQUESTED (paid, escrow held) → ACCEPTED → IN_PROGRESS (start code) → COMPLETED (escrow released)
 * Side exits: DECLINED / EXPIRED / CANCELLED (refund rules apply), DISPUTED (escrow frozen until admin resolves)
 */
export const BOOKING_STATUSES = [
  'PENDING_PAYMENT',
  'REQUESTED',
  'ACCEPTED',
  'IN_PROGRESS',
  'COMPLETED',
  'DECLINED',
  'EXPIRED',
  'CANCELLED',
  'DISPUTED',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const ESCROW_STATUSES = ['HELD', 'FROZEN', 'RELEASED', 'REFUNDED', 'SETTLED'] as const;
export type EscrowStatus = (typeof ESCROW_STATUSES)[number];

export const PAYMENT_STATUSES = ['CREATED', 'PAID', 'FAILED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYOUT_STATUSES = ['REQUESTED', 'PAID', 'REJECTED'] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export const REPORT_REASONS = ['INAPPROPRIATE_BEHAVIOUR', 'SEXUAL_CONTENT', 'HARASSMENT', 'FAKE_PROFILE', 'SCAM_OR_OFF_PLATFORM_PAYMENT', 'SAFETY_CONCERN', 'NO_SHOW', 'OTHER'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ['OPEN', 'ACTIONED', 'DISMISSED'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const MODERATION_ACTIONS = ['DISMISS', 'WARN', 'SUSPEND', 'BAN'] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export const DISPUTE_STATUSES = ['OPEN', 'RESOLVED'] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const DISPUTE_OUTCOMES = ['REFUND', 'RELEASE', 'SPLIT'] as const;
export type DisputeOutcome = (typeof DISPUTE_OUTCOMES)[number];

export const SOS_STATUSES = ['ACTIVE', 'RESOLVED'] as const;
export type SosStatus = (typeof SOS_STATUSES)[number];

export const GENDERS = ['FEMALE', 'MALE', 'NON_BINARY', 'PREFER_NOT_TO_SAY'] as const;
export type Gender = (typeof GENDERS)[number];

export const ID_TYPES = ['AADHAAR', 'PAN', 'PASSPORT', 'DRIVING_LICENCE', 'VOTER_ID'] as const;
export type IdType = (typeof ID_TYPES)[number];

/** MANUAL: photo of an ID uploaded by the companion. DIGILOCKER: Aadhaar record shared from DigiLocker. */
export const KYC_METHODS = ['MANUAL', 'DIGILOCKER'] as const;
export type KycMethod = (typeof KYC_METHODS)[number];

/** Warnings from the automatic identity checks. Any flag means a person has to review the submission. */
export const KYC_FLAGS = [
  'LIVENESS_FAILED',
  'FACE_MISMATCH',
  'ID_PHOTO_NOT_COMPARED',
  'CHECKS_UNAVAILABLE',
  'GENDER_MISMATCH',
  'NAME_MISMATCH',
  'DOB_MISMATCH',
  'DUPLICATE_IDENTITY',
  'BANNED_IDENTITY',
] as const;
export type KycFlag = (typeof KYC_FLAGS)[number];

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];
