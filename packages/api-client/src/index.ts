import type {
  CoinPurchaseDto,
  CoinPurchaseSummaryDto,
  TopUpOfferDto,
  AdminChatStatsDto,
  AdminChatUnlockDto,
  ChatPricesDto,
  ChatUnlockKind,
  ConversationDto,
  DirectMessageDto,
  AdminStatsDto,
  AdminUserDto,
  ApplyCompanionInput,
  AuditLogDto,
  AuthResponse,
  Availability,
  BookingDto,
  Category,
  CheckoutResponse,
  City,
  CompanionCardDto,
  CompanionFeeDto,
  SafetyShareDto,
  SafetyShareViewDto,
  OffersDto,
  FeeCheckoutResponse,
  ReferralDto,
  CompanionDashboardDto,
  CompanionDetailDto,
  CompanionProfileDto,
  CompanionSearchQuery,
  CreateBookingInput,
  CreateReportInput,
  DisputeDto,
  DisputeOutcome,
  KycOptionsDto,
  KycSubmissionDto,
  DigilockerIdentityDto,
  LocationDto,
  MessageDto,
  ModerationAction,
  NotificationDto,
  OtpRequestResponse,
  Paginated,
  PayoutDto,
  PlatformSettings,
  QuoteDto,
  ReportDto,
  SosAlertDto,
  UpdateMeInput,
  UserDto,
  UserStatus,
  VerifyPaymentInput,
  WalletDto,
  WalletTxnDto,
} from '@companio/types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
  }
}

export interface ClientOptions {
  baseUrl: string;
  getToken?: () => string | null | undefined;
  onUnauthorized?: () => void;
  /** the site was put under maintenance (503 { maintenance: true }) */
  onMaintenance?: () => void;
  /** forwarded to fetch — e.g. Next.js `{ next: { revalidate: 300 } }` for ISR pages */
  fetchInit?: RequestInit & Record<string, unknown>;
}

type Query = Record<string, string | number | boolean | undefined | null>;
const qs = (q?: Query) => {
  if (!q) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export type AdminPage = { page?: number; q?: string; status?: string; role?: string; gender?: string; city?: string; source?: 'admin' | 'self' };
export type AdminChatConversation = {
  id: string;
  user: { id: string; name: string | null };
  host: { id: string; name: string | null };
  permanent: boolean;
  accessUntil: string | null;
  messages: (DirectMessageDto & { flagged: boolean; flagReason: string | null; hidden: boolean })[];
  unlocks: { id: string; kind: string; price: number; hours: number | null; status: string; hostEarning: number; createdAt: string; refundedAt: string | null }[];
};

export type AdminAssistantStats = {
  /** chats waiting for a reply from the team */
  waiting: number;
  configured: boolean;
  model: string;
  last7Days: { conversations: number; handoffs: number; liked: number; disliked: number; aiReplies: number; freeReplies: number; tokensIn: number; tokensOut: number; costUsd: number };
  knowledge: number;
};
export type AdminAssistantConversation = { id: string; user: { id: string; name: string | null } | null; firstQuestion: string; messages: number; handoff: boolean; human: string | null; contactEmail: string | null; summary: string | null; rating: number | null; lastAt: string };
export type AdminAssistantTranscript = { id: string; user: { id: string; name: string | null } | null; handoff: boolean; human: string | null; contactEmail: string | null; summary: string | null; rating: number | null; messages: { id: string; role: string; content: string; name: string | null; at: string }[] };
export type AssistantLine = { role: 'user' | 'assistant' | 'agent' | 'note'; content: string; name: string | null; at: string };
export type AdminAssistantKnowledge = { id: string; question: string; answer: string; active: boolean; createdAt: string; updatedAt: string };

export type AdminEditUserInput = {
  name?: string;
  /** '' removes it */
  email?: string;
  emailVerified?: boolean;
  dob?: string;
  gender?: string;
  city?: string;
  bio?: string;
  companion?: { headline?: string; about?: string; hourlyRate?: number; categories?: string[]; languages?: string[]; city?: string; womenOnly?: boolean };
  reason: string;
};

export type AdminUserDetail = {
  user: AdminUserDto;
  warnings: number;
  statusReason: string | null;
  wallet: WalletTxnDto[];
  bookings: BookingDto[];
  reports: ReportDto[];
  kyc: KycSubmissionDto[];
  /** other accounts with the same phone number (earlier deleted accounts, or a new sign-up after deletion) */
  linkedAccounts: { id: string; name: string | null; status: string; createdAt: string; deletedAt: string | null }[];
};
export type AdminBookingDetail = {
  booking: BookingDto;
  messages: (MessageDto & { flagReason: string | null })[];
  payments: { id: string; provider: string; orderId: string; paymentId: string | null; amount: number; walletAmount: number; status: string; createdAt: string }[];
  escrow: { amount: number; refunded: number; released: number; retained: number; status: string; heldAt: string; settledAt: string | null } | null;
  sos: SosAlertDto[];
  locations: { userId: string; lat: number; lng: number; updatedAt: string }[];
};
export type AdminKyc = KycSubmissionDto & { companion: { headline: string; city: string; dob: string | null } | null };
export type FlaggedMessage = MessageDto & { flagReason: string | null; sender: { id: string; name: string | null } };
export type AdminReview = { id: string; bookingId: string; rating: number; comment: string | null; hidden: boolean; author: { id: string; name: string | null }; target: { id: string; name: string | null }; createdAt: string };
export type AdminSos = SosAlertDto & { booking: { id: string; meetingPoint: string; startAt: string; userName: string | null; companionName: string | null; status: string } };

/** waits between retries while the API restarts (about 2s during a deploy): ~10s in all */
const RETRY_DELAYS = [400, 800, 1500, 2500, 5000];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Typed SDK over the Companio REST API. One client for web, admin and (later) the Expo app. */
export function createApiClient(opts: ClientOptions) {
  const base = opts.baseUrl.replace(/\/$/, '');

  async function request<T>(method: string, path: string, body?: unknown, extra?: RequestInit): Promise<T> {
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    const send = () => {
      const token = opts.getToken?.();
      return fetch(`${base}${path}`, {
        ...opts.fetchInit,
        ...extra,
        method,
        headers: {
          ...(isForm || body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      });
    };
    // A deploy restarts the API for a couple of seconds; nginx then answers 503 { retry: true } (the request never
    // reached the API, so repeating it is safe for any method). Reads are also repeated after a dropped connection.
    const safeToRepeat = method === 'GET' || method === 'HEAD';
    let res: Response | undefined;
    for (let attempt = 0; ; attempt++) {
      const last = attempt >= RETRY_DELAYS.length;
      try {
        res = await send();
      } catch (e) {
        if (!last && safeToRepeat) {
          await sleep(RETRY_DELAYS[attempt]);
          continue;
        }
        throw new ApiError(0, 'Couldn’t reach Companio — check your internet connection and try again.', e);
      }
      if (res.status === 503 && !last && (await res.clone().json().catch(() => null))?.retry === true) {
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }
      break;
    }
    const text = await res.text();
    const data = text ? safeJson(text) : undefined;
    if (!res.ok) {
      if (res.status === 401) opts.onUnauthorized?.();
      if (res.status === 503 && (data as { maintenance?: boolean } | undefined)?.maintenance) opts.onMaintenance?.();
      const msg = (data as { message?: string | string[] } | undefined)?.message;
      throw new ApiError(res.status, Array.isArray(msg) ? msg[0] : msg ?? `Request failed (${res.status})`, data);
    }
    return data as T;
  }

  const get = <T>(p: string, q?: Query) => request<T>('GET', p + qs(q));
  const post = <T>(p: string, b?: unknown) => request<T>('POST', p, b ?? {});
  const patch = <T>(p: string, b: unknown) => request<T>('PATCH', p, b);
  const put = <T>(p: string, b: unknown) => request<T>('PUT', p, b);
  const del = <T>(p: string) => request<T>('DELETE', p);

  return {
    request,
    /** the AI support assistant (works signed in or out; `key` is the browser's secret for its conversation) */
    assistant: {
      status: () => get<{ enabled: boolean; name: string }>('/assistant/status'),
      chat: (message: string, key?: string) => post<{ conversationKey: string; reply: string | null; handoff: boolean; summary: string | null; human: string | null }>('/assistant/chat', { message, key }),
      history: (key: string) => post<{ handoff: boolean; human: string | null; contactEmail: string | null; rating: number | null; messages: AssistantLine[] }>('/assistant/history', { key }),
      rate: (key: string, rating: 1 | -1) => post<{ ok: true }>('/assistant/rate', { key, rating }),
      contact: (key: string, email: string) => post<{ contactEmail: string }>('/assistant/contact', { key, email }),
      human: (key?: string) => post<{ conversationKey: string; summary: string; human: string }>('/assistant/human', { key }),
    },
    meta: {
      catalog: () => get<{ categories: Category[]; cities: City[]; languages: string[] }>('/meta/catalog'),
      pricing: () => get<{ connectionFee: number; gstPct: number; freeCancelHours: number; lateCancelRefundPct: number }>('/meta/pricing'),
      coverage: () => get<Record<string, Record<string, number>>>('/meta/coverage'),
      offers: () => get<OffersDto>('/meta/offers'),
      status: () => get<{ maintenance: boolean }>('/meta/status'),
    },
    auth: {
      requestOtp: (phone: string, channel?: 'whatsapp' | 'sms') => post<OtpRequestResponse>('/auth/otp/request', { phone, channel }),
      otpStatus: (phone: string) => post<{ status: 'sent' | 'delivered' | 'failed' | 'unknown' }>('/auth/otp/status', { phone }),
      verifyOtp: (phone: string, code: string, ref?: string) => post<AuthResponse>('/auth/otp/verify', { phone, code, ref }),
      firebase: (idToken: string, ref?: string) => post<AuthResponse>('/auth/firebase', { idToken, ref }),
      /** returns { twoFactorRequired: true } when the admin has 2FA on and no code was given */
      adminLogin: (email: string, password: string, code?: string) => post<AuthResponse | { twoFactorRequired: true }>('/auth/admin/login', { email, password, code }),
    },
    me: {
      get: () => get<UserDto>('/me'),
      update: (input: UpdateMeInput) => patch<UserDto>('/me', input),
      uploadAvatar: (file: File | Blob) => request<UserDto>('POST', '/me/avatar', form({ file })),
      /** emails a fresh "confirm your email" link */
      resendEmailVerification: () => post<{ sent: boolean; verified: boolean }>('/me/email/resend'),
      /** the token from the emailed link (no sign-in needed) */
      verifyEmail: (token: string) => post<{ verified: true; email: string }>('/email/verify', { token }),
      /** account deletion step 1: re-confirm the phone (dev code or Firebase token) → short-lived deletion token */
      /** signs out every other device; returns a fresh token for this one */
      logoutOthers: () => post<{ token: string }>('/me/logout-others'),
      confirmDelete: (proof: { code?: string; idToken?: string }) => post<{ deleteToken: string }>('/me/delete/confirm', proof),
      /** step 2, after the user's final "yes" */
      deleteAccount: (deleteToken: string) => post<{ deleted: true }>('/me/delete', { deleteToken }),
      blocks: () => get<{ userId: string; name: string | null; avatarUrl: string | null; createdAt: string }[]>('/me/blocks'),
      block: (userId: string) => post<{ blocked: boolean }>(`/me/blocks/${userId}`),
      unblock: (userId: string) => del<{ blocked: boolean }>(`/me/blocks/${userId}`),
    },
    companions: {
      search: (q: CompanionSearchQuery) => get<Paginated<CompanionCardDto>>('/companions', q as Query),
      get: (id: string) => get<CompanionDetailDto>(`/companions/${id}`),
    },
    companion: {
      /** registration fee owed before applying; `due: false` → no payment step */
      fee: () => get<CompanionFeeDto>('/companion/fee'),
      apply: (input: ApplyCompanionInput) => post<CompanionProfileDto>('/companion/apply', input),
      dashboard: () => get<CompanionDashboardDto>('/companion/dashboard'),
      updateProfile: (input: Partial<ApplyCompanionInput> & { womenOnly?: boolean }) => patch<CompanionProfileDto>('/companion/profile', input),
      setAvailability: (availability: Availability) => put<CompanionProfileDto>('/companion/availability', { availability }),
      setListed: (listed: boolean) => post<CompanionProfileDto>('/companion/listing', { listed }),
      addPhoto: (file: File | Blob) => request<CompanionProfileDto>('POST', '/companion/photos', form({ file })),
      removePhoto: (index: number) => del<CompanionProfileDto>(`/companion/photos/${index}`),
      /** manual: photo of an ID + selfie. DIGILOCKER: selfie only — the Aadhaar details come from DigiLocker. */
      /** two-sided IDs (Aadhaar, driving licence, voter ID) also send `idDocBack` */
      submitKyc: (input: { method?: 'MANUAL'; idType: string; idLast4: string; idDoc: File | Blob; idDocBack?: File | Blob; selfie: File | Blob } | { method: 'DIGILOCKER'; selfie: File | Blob }) =>
        request<KycSubmissionDto>('POST', '/companion/kyc', form(Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as Record<string, string | Blob>)),
      kycOptions: () => get<KycOptionsDto>('/companion/kyc/options'),
      /** go to `url`; DigiLocker sends the companion back to /companion/kyc?dl=1 */
      startDigilocker: () => post<{ url: string }>('/companion/kyc/digilocker'),
      completeDigilocker: () => post<DigilockerIdentityDto>('/companion/kyc/digilocker/complete'),
      /** verified Aadhaar details still waiting for a selfie, or null */
      currentDigilocker: () => get<DigilockerIdentityDto | null>('/companion/kyc/digilocker').then((d) => d ?? null),
      discardDigilocker: () => del<{ ok: true }>('/companion/kyc/digilocker'),
    },
    bookings: {
      quote: (companionId: string, hours: number) => post<QuoteDto>('/bookings/quote', { companionId, hours }),
      create: (input: CreateBookingInput) => post<BookingDto>('/bookings', input),
      list: (q: { as?: 'user' | 'companion'; scope?: 'upcoming' | 'past' | 'all' } = {}) => get<BookingDto[]>('/bookings', q),
      get: (id: string) => get<BookingDto>(`/bookings/${id}`),
      accept: (id: string) => post<BookingDto>(`/bookings/${id}/accept`),
      decline: (id: string, reason?: string) => post<BookingDto>(`/bookings/${id}/decline`, { reason }),
      start: (id: string, code: string) => post<BookingDto>(`/bookings/${id}/start`, { code }),
      complete: (id: string) => post<BookingDto>(`/bookings/${id}/complete`),
      cancel: (id: string, reason?: string) => post<BookingDto & { summary: string }>(`/bookings/${id}/cancel`, { reason }),
      dispute: (id: string, reason: string, details?: string) => post<BookingDto>(`/bookings/${id}/dispute`, { reason, details }),
      review: (id: string, rating: number, comment?: string) => post<BookingDto>(`/bookings/${id}/review`, { rating, comment }),
      sos: (id: string, input: { lat?: number; lng?: number; note?: string }) => post<{ alert: SosAlertDto; guidance: string }>(`/bookings/${id}/sos`, input),
      shareLocation: (id: string, lat: number, lng: number) => post<LocationDto>(`/bookings/${id}/location`, { lat, lng }),
      /** "watch my session" link for a trusted contact (null = not shared) */
      // the API answers an empty body when there's no link; normalise that to null
      safetyShare: (id: string) => get<SafetyShareDto | null>(`/bookings/${id}/share`).then((s) => s ?? null),
      createSafetyShare: (id: string) => post<SafetyShareDto>(`/bookings/${id}/share`),
      stopSafetyShare: (id: string) => request<{ ok: true }>('DELETE', `/bookings/${id}/share`),
      locations: (id: string) => get<LocationDto[]>(`/bookings/${id}/location`),
      messages: (id: string) => get<MessageDto[]>(`/bookings/${id}/messages`),
      send: (id: string, body: string) => post<{ message: MessageDto; warning: string | null }>(`/bookings/${id}/messages`, { body }),
    },
    /** paid chats with hosts (coins = wallet balance) */
    chats: {
      prices: () => get<ChatPricesDto>('/chats/prices'),
      list: () => get<ConversationDto[]>('/chats'),
      withHost: (companionId: string) => get<{ prices: ChatPricesDto; conversation: ConversationDto | null }>(`/chats/with/${companionId}`),
      unlock: (companionId: string, kind: ChatUnlockKind) => post<ConversationDto>('/chats/unlock', { companionId, kind }),
      get: (id: string) => get<{ conversation: ConversationDto; messages: DirectMessageDto[] }>(`/chats/${id}`),
      /** `earned`: coins the host just earned by replying (0 otherwise) */
      send: (id: string, body: string) => post<{ message: DirectMessageDto; warning: string | null; earned?: number }>(`/chats/${id}/messages`, { body }),
    },
    payments: {
      /** add coins (spend-only wallet balance); confirm with verify() like other payments */
      /** bonus offers this member can use when adding coins */
      topUpOffers: () => get<TopUpOfferDto[]>('/payments/topup/offers'),
      topUp: (amount: number) => post<FeeCheckoutResponse>('/payments/topup', { amount }),
      checkout: (bookingId: string, useWallet = true) => post<CheckoutResponse>('/payments/checkout', { bookingId, useWallet }),
      companionFee: (useWallet = true) => post<FeeCheckoutResponse>('/payments/companion-fee', { useWallet }),
      verify: (input: VerifyPaymentInput) => post<{ status: 'PAID'; bookingId: string | null; purpose: string }>('/payments/verify', input),
      mockPay: (orderId: string) => post<VerifyPaymentInput>(`/payments/mock/${orderId}/pay`),
    },
    /** public, no login: what a trusted contact sees on a shared link */
    safety: {
      view: (token: string) => get<SafetyShareViewDto>(`/share/${encodeURIComponent(token)}`),
      alert: (token: string, note?: string) => post<{ ok: true; guidance: string }>(`/share/${encodeURIComponent(token)}/alert`, { note }),
    },
    wallet: {
      get: () => get<WalletDto>('/wallet'),
      payouts: () => get<PayoutDto[]>('/wallet/payouts'),
      requestPayout: (amount: number, upiId: string) => post<PayoutDto>('/wallet/payouts', { amount, upiId }),
    },
    referrals: {
      me: () => get<ReferralDto>('/referrals/me'),
    },
    notifications: {
      list: () => get<{ items: NotificationDto[]; unread: number }>('/notifications'),
      readAll: () => post<{ ok: true }>('/notifications/read-all'),
      read: (id: string) => post<{ ok: true }>(`/notifications/${id}/read`),
    },
    reports: {
      create: (input: CreateReportInput) => post<{ id: string; status: string; message: string }>('/reports', input),
    },
    admin: {
      stats: () => get<AdminStatsDto>('/admin/stats'),
      users: (q: AdminPage) => get<Paginated<AdminUserDto>>('/admin/users', q),
      user: (id: string) => get<AdminUserDetail>(`/admin/users/${id}`),
      broadcastAudience: (audience: 'ALL' | 'MEMBERS' | 'HOSTS', city?: string) => get<{ count: number }>('/admin/broadcast/audience', { audience, city }),
      broadcast: (msg: { title: string; body: string; link?: string; audience: 'ALL' | 'MEMBERS' | 'HOSTS'; city?: string; expectedCount: number }) =>
        post<{ ok: true; sent: number }>('/admin/broadcast', msg),
      /** message shown in the person's notifications */
      messageUser: (id: string, msg: { title: string; body: string; link?: string; email?: boolean }) => post<{ ok: true; id: string; emailedTo: string | null }>(`/admin/users/${id}/message`, msg),
      /** correct someone's profile; only the fields sent change. `reason` goes in the audit log */
      /** add a member by hand; 409 (with body.userId) if the number already has an account */
      createUser: (input: { phone: string; name: string; email?: string; emailVerified?: boolean; dob?: string; gender?: string; city?: string; bio?: string; sendInvite?: boolean; note?: string }) =>
        post<{ id: string; invited: boolean }>('/admin/users', input),
      editUser: (id: string, input: AdminEditUserInput) => patch<{ ok: true; changed: string[] }>(`/admin/users/${id}/profile`, input),
      /** "log in as": a 30-minute read-only session as this user (audited with the reason) */
      chatStats: () => get<AdminChatStatsDto>('/admin/chats/stats'),
      chatUnlocks: (q: { page?: number; status?: string }) => get<Paginated<AdminChatUnlockDto>>('/admin/chats/unlocks', q),
      chatConversation: (id: string) => get<AdminChatConversation>(`/admin/chats/${id}`),
      assistantStats: () => get<AdminAssistantStats>('/admin/assistant/stats'),
      assistantConversations: (q: { page?: number; filter?: string }) => get<Paginated<AdminAssistantConversation>>('/admin/assistant/conversations', q),
      assistantConversation: (id: string) => get<AdminAssistantTranscript>(`/admin/assistant/conversations/${id}`),
      assistantKnowledge: () => get<AdminAssistantKnowledge[]>('/admin/assistant/knowledge'),
      saveAssistantKnowledge: (input: { id?: string; question: string; answer: string; active?: boolean }) => post<AdminAssistantKnowledge>('/admin/assistant/knowledge', input),
      coinSummary: () => get<CoinPurchaseSummaryDto>('/admin/coins/summary'),
      coinPurchases: (q: { page?: number; status?: string; q?: string }) => get<Paginated<CoinPurchaseDto>>('/admin/coins/purchases', q),
      topUpOffers: () => get<TopUpOfferDto[]>('/admin/coins/offers'),
      saveTopUpOffer: (o: { id?: string; title: string; minAmount: number; bonusPct: number; maxBonus?: number | null; firstOnly?: boolean; startsAt?: string | null; endsAt?: string | null; active?: boolean }) =>
        post<TopUpOfferDto>('/admin/coins/offers', o),
      deleteTopUpOffer: (id: string) => del<{ ok: true }>(`/admin/coins/offers/${id}`),
      deleteAssistantKnowledge: (id: string) => del<{ ok: true }>(`/admin/assistant/knowledge/${id}`),
      replyAssistant: (id: string, text: string) => post<AdminAssistantTranscript>(`/admin/assistant/conversations/${id}/reply`, { text }),
      closeAssistant: (id: string) => post<AdminAssistantTranscript>(`/admin/assistant/conversations/${id}/close`),
      /** your own admin account */
      updateMe: (input: { name?: string; email?: string; currentPassword?: string }) => patch<UserDto>('/admin/me', input),
      /** returns a fresh token for this session (other devices are signed out) */
      changePassword: (currentPassword: string, newPassword: string) => post<{ token: string; user: UserDto }>('/admin/me/password', { currentPassword, newPassword }),
      /** one click: the whole site under maintenance, or back */
      setMaintenance: (on: boolean) => post<{ maintenance: boolean }>('/admin/maintenance', { on }),
      impersonate: (id: string, reason: string, mode: 'view' | 'full' = 'full') => post<{ token: string; expiresAt: string; mode: 'view' | 'full' }>(`/admin/users/${id}/impersonate`, { reason, mode }),
      setUserStatus: (id: string, status: Exclude<UserStatus, 'DELETED'>, reason?: string) => post<{ ok: true }>(`/admin/users/${id}/status`, { status, reason }),
      kyc: (q: AdminPage) => get<Paginated<AdminKyc>>('/admin/kyc', q),
      approveKyc: (id: string, note?: string) => post<{ ok: true }>(`/admin/kyc/${id}/approve`, { note }),
      rejectKyc: (id: string, note: string, refundFee = false) => post<{ ok: true }>(`/admin/kyc/${id}/reject`, { note, refundFee }),
      twoFactor: () => get<{ enabled: boolean }>('/admin/2fa'),
      twoFactorSetup: () => post<{ secret: string; otpauthUrl: string; qrSvg: string }>('/admin/2fa/setup'),
      twoFactorEnable: (code: string) => post<{ enabled: true }>('/admin/2fa/enable', { code }),
      twoFactorDisable: (code: string) => post<{ enabled: false }>('/admin/2fa/disable', { code }),
      refundCompanionFee: (userId: string, note?: string) => post<{ ok: true; amount: number }>(`/admin/users/${userId}/refund-companion-fee`, { note }),
      bookings: (q: AdminPage) => get<Paginated<BookingDto>>('/admin/bookings', q),
      booking: (id: string) => get<AdminBookingDetail>(`/admin/bookings/${id}`),
      refund: (id: string, note: string, amount?: number) => post<{ ok: true; amount: number }>(`/admin/bookings/${id}/refund`, { note, amount }),
      disputes: (q: AdminPage) => get<Paginated<DisputeDto>>('/admin/disputes', q),
      resolveDispute: (id: string, input: { outcome: DisputeOutcome; refundAmount?: number; note: string }) =>
        post<{ ok: true; refund: number; release: number }>(`/admin/disputes/${id}/resolve`, input),
      reports: (q: AdminPage) => get<Paginated<ReportDto>>('/admin/reports', q),
      resolveReport: (id: string, input: { action: ModerationAction; hideMessage?: boolean; note: string }) => post<{ ok: true }>(`/admin/reports/${id}/resolve`, input),
      flaggedMessages: (q: AdminPage) => get<Paginated<FlaggedMessage>>('/admin/messages/flagged', q),
      setMessageHidden: (id: string, hidden: boolean) => post<{ ok: true }>(`/admin/messages/${id}/hidden`, { hidden }),
      reviews: (q: AdminPage) => get<Paginated<AdminReview>>('/admin/reviews', q),
      setReviewHidden: (id: string, hidden: boolean) => post<{ ok: true }>(`/admin/reviews/${id}/hidden`, { hidden }),
      payouts: (q: AdminPage) => get<Paginated<PayoutDto>>('/admin/payouts', q),
      payoutPaid: (id: string, reference: string) => post<{ ok: true }>(`/admin/payouts/${id}/paid`, { reference }),
      payoutReject: (id: string, note: string) => post<{ ok: true }>(`/admin/payouts/${id}/reject`, { note }),
      sos: (q: AdminPage = {}) => get<AdminSos[]>('/admin/sos', q),
      resolveSos: (id: string, note?: string) => post<{ ok: true }>(`/admin/sos/${id}/resolve`, { note }),
      settings: () => get<PlatformSettings>('/admin/settings'),
      kycChecks: () => get<KycOptionsDto>('/admin/kyc/checks'),
      updateSettings: (patch: Partial<PlatformSettings>) => put<PlatformSettings>('/admin/settings', patch),
      audit: (q: AdminPage) => get<Paginated<AuditLogDto>>('/admin/audit', q),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

function form(fields: Record<string, string | Blob>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

function safeJson(t: string) {
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}
