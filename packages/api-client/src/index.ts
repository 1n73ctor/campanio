import type {
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
  KycSubmissionDto,
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

export type AdminPage = { page?: number; q?: string; status?: string; role?: string };
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

/** Typed SDK over the Companio REST API. One client for web, admin and (later) the Expo app. */
export function createApiClient(opts: ClientOptions) {
  const base = opts.baseUrl.replace(/\/$/, '');

  async function request<T>(method: string, path: string, body?: unknown, extra?: RequestInit): Promise<T> {
    const token = opts.getToken?.();
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    const res = await fetch(`${base}${path}`, {
      ...opts.fetchInit,
      ...extra,
      method,
      headers: {
        ...(isForm || body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
    const text = await res.text();
    const data = text ? safeJson(text) : undefined;
    if (!res.ok) {
      if (res.status === 401) opts.onUnauthorized?.();
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
    meta: {
      catalog: () => get<{ categories: Category[]; cities: City[]; languages: string[] }>('/meta/catalog'),
      pricing: () => get<{ connectionFee: number; gstPct: number; freeCancelHours: number; lateCancelRefundPct: number }>('/meta/pricing'),
      coverage: () => get<Record<string, Record<string, number>>>('/meta/coverage'),
      offers: () => get<OffersDto>('/meta/offers'),
    },
    auth: {
      requestOtp: (phone: string) => post<OtpRequestResponse>('/auth/otp/request', { phone }),
      verifyOtp: (phone: string, code: string, ref?: string) => post<AuthResponse>('/auth/otp/verify', { phone, code, ref }),
      firebase: (idToken: string, ref?: string) => post<AuthResponse>('/auth/firebase', { idToken, ref }),
      /** returns { twoFactorRequired: true } when the admin has 2FA on and no code was given */
      adminLogin: (email: string, password: string, code?: string) => post<AuthResponse | { twoFactorRequired: true }>('/auth/admin/login', { email, password, code }),
    },
    me: {
      get: () => get<UserDto>('/me'),
      update: (input: UpdateMeInput) => patch<UserDto>('/me', input),
      uploadAvatar: (file: File | Blob) => request<UserDto>('POST', '/me/avatar', form({ file })),
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
      submitKyc: (input: { idType: string; idLast4: string; idDoc: File | Blob; selfie: File | Blob }) =>
        request<KycSubmissionDto>('POST', '/companion/kyc', form(input)),
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
    payments: {
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
