export type UserRole =
  | 'root_super_admin'
  | 'super_admin'
  | 'finance_admin'
  | 'support_admin'
  | 'verification_admin'
  | 'content_manager'
  | 'customer'
  | 'companion';

export type BookingStatus =
  | 'requested'
  | 'accepted_awaiting_agreement'
  | 'declined'
  | 'price_agreed_awaiting_payment'
  | 'payment_pending'
  | 'confirmed_paid'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'disputed';

export type PaymentGateway = 'bkash' | 'nagad' | 'custom' | 'benson' | 'rocket' | 'sslcommerz' | 'cash';

export interface UserAccount {
  uid: string;
  username?: string;
  email: string;
  phone: string;
  fullName: string;
  role: UserRole;
  isAdultVerified18Plus: boolean;
  verificationStatus?: 'unverified' | 'pending' | 'approved' | 'rejected';
  phoneVerified: boolean;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  status: 'active' | 'suspended' | 'deactivated';
  photoUrl: string;
  gender?: 'male' | 'female';
  city?: string;
  area?: string;
  profileCompleted?: boolean;
  profileUpdatedAt?: string;
  profileDeadlineAt?: string;
  createdAt: string;
  isRootOwner?: boolean;
  adminId?: string;
  permissions?: string[];
  referralCode?: string;
  referralCreditsBdt?: number;
  referredByUid?: string;
  referredByCode?: string;
  referralCount?: number;
}

export interface CompanionProfile {
  uid: string;
  displayName: string;
  headline: string;
  bio: string;
  city: string;
  division?: string;
  areas: string[];
  languages: string[];
  categories: string[];
  interests?: string[];
  skills?: string[];
  hourlyRateBdt: number;
  sessionRateBdt: number;
  availabilityDays: string[];
  availabilityHours: string;
  isAvailableNow: boolean;
  verificationStatus: 'unverified' | 'pending' | 'approved' | 'rejected';
  ratingAvg: number;
  reviewCount: number;
  completedBookings: number;
  pendingBalanceBdt?: number;
  availableBalanceBdt?: number;
  photoUrl: string;
  gender?: 'male' | 'female';
  instagramHandle?: string;
  whatsappNumber?: string;
  contactEmail?: string;
  updatedAt: string;
  topRank?: number;
}

export interface BookingLocationPoint {
  lat: number;
  lng: number;
  addressLabel?: string;
  accuracyMeters?: number;
  updatedAt: string;
  updatedBy?: 'customer' | 'admin';
  consentGiven?: boolean;
}

export interface BookingRecord {
  id: string;
  bookingCode: string;
  customerUid: string;
  customerName: string;
  companionUid: string;
  companionName: string;
  companionPhoto?: string;
  category: string;
  city: string;
  division?: string;
  venueName: string;
  bookingDate: string;
  startTime: string;
  pricingType: 'hourly' | 'session';
  durationHours: number;
  proposedTotalBdt: number;
  originalTotalBdt?: number;
  creditsUsedBdt?: number;
  agreedPriceBdt: number;
  advanceRequiredBdt?: number;
  advancePaidBdt?: number;
  remainingDueBdt?: number;
  advanceStatus?: 'unpaid' | 'pending_verification' | 'paid';
  platformFeeBdt: number;
  companionNetBdt: number;
  status: BookingStatus;
  customerAgreed: boolean;
  companionAgreed: boolean;
  paymentStatus: 'unpaid' | 'pending' | 'advance_paid' | 'paid' | 'cash_pending' | 'refunded';
  notes: string;
  cancellationReason?: string;
  customerLiveLocation?: BookingLocationPoint | null;
  meetupLocation?: BookingLocationPoint | null;
  adminDispatchedLocation?: BookingLocationPoint | null;
  adminLocationMessage?: string;
  adminLocationStatus?: 'not_requested' | 'customer_location_requested' | 'customer_shared' | 'admin_dispatched';
  locationRequestedAt?: string;
  adminNotifiedAfter50At?: string;
  companionWhatsapp?: string;
  companionEmail?: string;
  customerWhatsapp?: string;
  customerEmail?: string;
  companionDepartedAt?: string;
  companionArrivedAt?: string;
  companionArrivalLat?: number;
  companionArrivalLng?: number;
  companionMilestoneStatus?: 'pending' | 'accepted' | 'departed' | 'arrived' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface BookingMessage {
  id: string;
  bookingId: string;
  senderUid: string;
  senderName: string;
  body: string;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  transactionId: string;
  bookingId: string;
  bookingCode?: string;
  customerUid: string;
  companionUid: string;
  gateway: PaymentGateway;
  mode: 'sandbox' | 'live';
  paymentStage?: 'advance_50' | 'remaining_50' | 'full';
  amountBdt: number;
  platformFeeBdt: number;
  companionNetBdt: number;
  status: 'initiated' | 'pending_manual_verification' | 'verified_paid' | 'cash_pending' | 'failed' | 'refunded';
  webhookVerified: boolean;
  gatewaySessionId?: string;
  senderReferenceTrxId?: string;
  bensonDeliveryMode?: 'in_person' | 'send_delivery';
  proofPhotoUrl?: string;
  equivalentItemLabel?: string;
  equivalentItemPackets?: number;
  createdAt: string;
  verifiedAt?: string;
}

export interface RefundRecord {
  id: string;
  paymentId: string;
  bookingId: string;
  customerUid: string;
  amountBdt: number;
  reason: string;
  status: 'requested' | 'approved' | 'processed' | 'rejected';
  processedByUid?: string;
  createdAt: string;
}

export interface CompanionPayoutRecord {
  id: string;
  companionUid: string;
  companionName?: string;
  amountBdt: number;
  method: 'bkash' | 'nagad' | 'rocket' | 'bank_eft' | 'whatsapp_handoff';
  accountMasked: string;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  reviewedByUid?: string;
  adminNote?: string;
  createdAt: string;
}

export interface ReviewRecord {
  id: string;
  bookingId: string;
  bookingCode?: string;
  category?: string;
  customerUid: string;
  companionUid: string;
  companionName?: string;
  customerName: string;
  rating: number;
  comment: string;
  tags?: string[];
  createdAt: string;
}

export interface VerificationRequestRecord {
  id: string;
  uid: string;
  fullName: string;
  documentType: 'nid' | 'school_roll' | 'student_id' | 'passport' | 'driving_license';
  documentNumberMasked: string;
  dateOfBirth: string;
  calculatedAge: number;
  city: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewerNote?: string;
  reviewedByUid?: string;
  createdAt: string;
}

export interface SupportTicketRecord {
  id: string;
  ticketCode: string;
  userUid: string;
  userName?: string;
  bookingId?: string;
  category: 'booking_dispute' | 'payment_complaint' | 'refund_request' | 'safety_report' | 'account_help';
  subject: string;
  description: string;
  status: 'open' | 'in_review' | 'resolved' | 'closed';
  adminReply?: string;
  assignedAdminUid?: string;
  createdAt: string;
}

export interface NotificationRecord {
  id: string;
  userUid: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: string;
}

export interface AuditLogRecord {
  id: string;
  actorUid: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  severity: 'info' | 'warning' | 'critical';
  createdAt: string;
}

export interface AdminAccountRecord {
  uid: string;
  adminId: string;
  username?: string;
  email: string;
  phone: string;
  fullName: string;
  role: UserRole;
  isRootOwner: boolean;
  status: 'active' | 'suspended';
  permissions: string[];
  customPermissions?: string[];
  createdByUid: string;
  createdAt: string;
}

export interface AdminRoleDefinition {
  roleKey: UserRole;
  label: string;
  permissions: string[];
  isSystemProtected: boolean;
}

export interface PlatformSettings {
  key: string;
  serviceFeePercent: number;
  paymentMode: 'sandbox' | 'live';
  merchantApproved: boolean;
  cashPaymentEnabled: boolean;
  maxCashBookingBdt: number;
  bkashPersonalNumber?: string;
  nagadPersonalNumber?: string;
  customPaymentLabel?: string;
  customPaymentNumber?: string;
  customPaymentInstructions?: string;
  bensonPaymentLabel?: string;
  bensonBaseBdt?: number;
  bensonPacketsPerBase?: number;
  bensonItemName?: string;
  bensonContactNumber?: string;
  bensonPaymentInstructions?: string;
  noticeBoardTitle?: string;
  noticeBoardMessage?: string;
  adminContactUsername?: string;
  adminContactEmail?: string;
  adminContactInstagram?: string;
  allowedDivision?: string;
  rootAdminUid: string;
  announcementBanner: string;
  safetyNotice: string;
  featuredHeadline: string;
  bookingCategories?: string[];
  referralReferrerBonusCredits?: number;
  referralSignupBonusCredits?: number;
  updatedAt: string;
}

export interface ReferralRecord {
  id: string;
  referrerUid: string;
  referrerName: string;
  referredUid: string;
  referredName: string;
  referredRole: UserRole;
  referralCode: string;
  referrerRewardCredits: number;
  referredBonusCredits: number;
  status: 'credited';
  createdAt: string;
}

export interface ReferralTransactionRecord {
  id: string;
  userUid: string;
  type: 'earned_referral' | 'earned_welcome_bonus' | 'redeemed_booking' | 'refunded_booking';
  creditsBdt: number;
  balanceAfterBdt: number;
  description: string;
  relatedReferralId?: string;
  relatedBookingId?: string;
  relatedBookingCode?: string;
  createdAt: string;
}

export interface CompanionApplicationRecord {
  id: string;
  fullName: string;
  whatsappNumber: string;
  contactEmail: string;
  city: string;
  division: string;
  gender: 'male' | 'female';
  dateOfBirth: string;
  calculatedAge: number;
  hourlyRateBdt: number;
  sessionRateBdt: number;
  headline: string;
  bio: string;
  instagramHandle?: string;
  photoUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote?: string;
  issuedUid?: string;
  issuedEmail?: string;
  reviewedByUid?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanionPostRecord {
  id: string;
  companionUid: string;
  companionName: string;
  companionPhoto?: string;
  city?: string;
  title: string;
  content: string;
  photoUrl?: string;
  tag?: string;
  createdAt: string;
}

