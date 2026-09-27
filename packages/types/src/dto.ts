import type {
  BookingStatus,
  DisputeOutcome,
  DisputeStatus,
  EscrowStatus,
  Gender,
  IdType,
  KycStatus,
  ModerationAction,
  PaymentStatus,
  PayoutStatus,
  ReportReason,
  ReportStatus,
  Role,
  SosStatus,
  UserStatus,
  Weekday,
} from './enums';

/** All money values are integer rupees (INR). */
export type Rupees = number;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------- auth / users ----------
export interface UserDto {
  id: string;
  phone: string | null;
  email: string | null;
  name: string | null;
  dob: string | null;
  gender: Gender | null;
  city: string | null;
  bio: string | null;
  avatarUrl: string | null;
  role: Role;
  status: UserStatus;
  onboarded: boolean;
  createdAt: string;
  companion?: CompanionProfileDto | null;
}

export interface AuthResponse {
  token: string;
  user: UserDto;
  isNew: boolean;
}

export interface OtpRequestResponse {
  sent: true;
  /** Only present when the API runs with OTP_DEV_ECHO=true (local dev). */
  devCode?: string;
}

export interface UpdateMeInput {
  name?: string;
  dob?: string;
  gender?: Gender;
  city?: string;
  bio?: string;
  acceptGuidelines?: boolean;
}

// ---------- companions ----------
export type Availability = Partial<Record<Weekday, { from: string; to: string }[]>>;

export interface CompanionProfileDto {
  id: string;
  userId: string;
  headline: string;
  about: string;
  hourlyRate: Rupees;
  categories: string[];
  languages: string[];
  city: string;
  photos: string[];
  availability: Availability;
  kycStatus: KycStatus;
  isListed: boolean;
  ratingAvg: number;
  ratingCount: number;
  completedBookings: number;
}

export interface CompanionCardDto {
  id: string; // companion profile id
  userId: string;
  name: string;
  avatarUrl: string | null;
  gender: Gender | null;
  age: number | null;
  headline: string;
  hourlyRate: Rupees;
  categories: string[];
  languages: string[];
  city: string;
  ratingAvg: number;
  ratingCount: number;
  completedBookings: number;
  verified: boolean;
}

export interface ReviewDto {
  id: string;
  rating: number;
  comment: string | null;
  authorName: string;
  createdAt: string;
}

export interface CompanionDetailDto extends CompanionCardDto {
  about: string;
  photos: string[];
  availability: Availability;
  bio: string | null;
  memberSince: string;
  reviews: ReviewDto[];
}

export interface CompanionSearchQuery {
  category?: string;
  city?: string;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  gender?: Gender;
  language?: string;
  sort?: 'recommended' | 'rating' | 'price_asc' | 'price_desc' | 'newest';
  page?: number;
  pageSize?: number;
}

export interface ApplyCompanionInput {
  headline: string;
  about: string;
  hourlyRate: Rupees;
  categories: string[];
  languages: string[];
  city: string;
}

export interface KycSubmissionDto {
  id: string;
  userId: string;
  userName: string | null;
  userPhone: string | null;
  idType: IdType;
  idLast4: string;
  idDocUrl: string;
  selfieUrl: string;
  status: KycStatus;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

// ---------- bookings ----------
export interface QuoteInput {
  companionId: string;
  hours: number;
}

export interface QuoteDto {
  hourlyRate: Rupees;
  hours: number;
  subtotal: Rupees;
  connectionFee: Rupees;
  gst: Rupees;
  total: Rupees;
}

export interface CreateBookingInput {
  companionId: string;
  category: string;
  startAt: string;
  hours: number;
  meetingPoint: string;
  note?: string;
}

export interface BookingPartyDto {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  phoneMasked: string | null;
}

export interface EscrowDto {
  amount: Rupees;
  status: EscrowStatus;
  refunded: Rupees;
  released: Rupees;
}

export interface BookingDto {
  id: string;
  status: BookingStatus;
  category: string;
  startAt: string;
  endAt: string;
  hours: number;
  meetingPoint: string;
  note: string | null;
  hourlyRate: Rupees;
  subtotal: Rupees;
  connectionFee: Rupees;
  gst: Rupees;
  total: Rupees;
  commission: Rupees;
  companionPayout: Rupees;
  /** Only visible to the booking user, shown at meet-up so the companion can start the session. */
  startCode?: string | null;
  user: BookingPartyDto;
  companion: BookingPartyDto & { profileId: string };
  escrow: EscrowDto | null;
  viewerRole: 'user' | 'companion' | 'admin';
  hasReview: boolean;
  dispute: { id: string; status: DisputeStatus; reason: string } | null;
  cancelReason: string | null;
  createdAt: string;
  acceptedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
}

export interface MessageDto {
  id: string;
  bookingId: string;
  senderId: string;
  body: string;
  flagged: boolean;
  hidden: boolean;
  createdAt: string;
}

export interface LocationDto {
  bookingId: string;
  userId: string;
  lat: number;
  lng: number;
  updatedAt: string;
}

// ---------- payments / wallet ----------
export interface CheckoutInput {
  bookingId: string;
  useWallet?: boolean;
}

export type CheckoutResponse =
  | { status: 'PAID'; bookingId: string }
  | { status: 'ACTION_REQUIRED'; provider: 'mock'; orderId: string; amount: Rupees; walletAmount: Rupees }
  | { status: 'ACTION_REQUIRED'; provider: 'razorpay'; orderId: string; amount: Rupees; walletAmount: Rupees; keyId: string };

export interface VerifyPaymentInput {
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface WalletTxnDto {
  id: string;
  type: 'CREDIT' | 'DEBIT';
  amount: Rupees;
  reason: string;
  balanceAfter: Rupees;
  createdAt: string;
}

export interface WalletDto {
  balance: Rupees;
  txns: WalletTxnDto[];
}

export interface PayoutDto {
  id: string;
  userId: string;
  userName: string | null;
  amount: Rupees;
  upiId: string;
  status: PayoutStatus;
  reference: string | null;
  note: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface CompanionDashboardDto {
  profile: CompanionProfileDto;
  walletBalance: Rupees;
  inEscrow: Rupees;
  lifetimeEarnings: Rupees;
  thisMonthEarnings: Rupees;
  pendingRequests: BookingDto[];
  upcoming: BookingDto[];
  payouts: PayoutDto[];
  latestKyc: KycSubmissionDto | null;
}

// ---------- safety / moderation ----------
export interface CreateReportInput {
  targetUserId: string;
  bookingId?: string;
  messageId?: string;
  reason: ReportReason;
  details?: string;
}

export interface ReportDto {
  id: string;
  reporter: { id: string; name: string | null };
  target: { id: string; name: string | null; status: UserStatus };
  bookingId: string | null;
  message: MessageDto | null;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  resolution: string | null;
  action: ModerationAction | null;
  createdAt: string;
}

export interface DisputeDto {
  id: string;
  bookingId: string;
  raisedBy: { id: string; name: string | null };
  reason: string;
  details: string | null;
  status: DisputeStatus;
  outcome: DisputeOutcome | null;
  refundAmount: Rupees | null;
  resolutionNote: string | null;
  booking: BookingDto;
  createdAt: string;
  resolvedAt: string | null;
}

export interface SosAlertDto {
  id: string;
  bookingId: string;
  user: { id: string; name: string | null; phone: string | null };
  lat: number | null;
  lng: number | null;
  status: SosStatus;
  note: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface ReferralDto {
  code: string;
  reward: number;
  /** friends who signed up with the code */
  invited: number;
  /** of those, how many completed a first booking (both sides got the reward) */
  rewarded: number;
  /** total referral credit this user has received, as inviter or as invited friend */
  earned: number;
}

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

// ---------- admin ----------
export interface AdminStatsDto {
  users: number;
  companions: number;
  listedCompanions: number;
  bookings: Record<string, number>;
  gmv: Rupees;
  revenue: Rupees;
  inEscrow: Rupees;
  pendingKyc: number;
  openDisputes: number;
  openReports: number;
  activeSos: number;
  pendingPayouts: number;
  series: { date: string; bookings: number; gmv: Rupees; signups: number }[];
}

export interface AdminUserDto extends UserDto {
  bookingsCount: number;
  reportsAgainst: number;
  walletBalance: Rupees;
}

export interface PlatformSettings {
  connectionFee: Rupees;
  gstPct: number;
  commissionPct: number;
  /** hours before start when a cancelled accepted booking still gets a full subtotal refund */
  freeCancelHours: number;
  /** % of subtotal refunded on late cancellation by user */
  lateCancelRefundPct: number;
  /** hours after booking end before escrow auto-releases */
  autoReleaseHours: number;
  /** hours a companion has to accept a request */
  requestExpiryHours: number;
  minPayout: Rupees;
}

export interface AuditLogDto {
  id: string;
  admin: { id: string; name: string | null; email: string | null };
  action: string;
  targetType: string;
  targetId: string;
  meta: string | null;
  createdAt: string;
}
