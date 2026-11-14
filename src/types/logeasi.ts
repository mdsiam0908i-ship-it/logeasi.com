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

export type PaymentGateway = 'bkash' | 'nagad' | 'rocket' | 'sslcommerz' | 'cash';

export interface UserAccount {
  uid: string;
  username?: string;
  email: string;
  phone: string;
  fullName: string;
  role: UserRole;
  isAdultVerified18Plus: boolean;
  phoneVerified: boolean;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  status: 'active' | 'suspended' | 'deactivated';
  photoUrl: string;
  city?: string;
  area?: string;
  createdAt: string;
  isRootOwner?: boolean;
  adminId?: string;
  permissions?: string[];
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
  instagramHandle?: string;
  whatsappNumber?: string;
  contactEmail?: string;
  updatedAt: string;
  topRank?: number;
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
  agreedPriceBdt: number;
  platformFeeBdt: number;
  companionNetBdt: number;
  status: BookingStatus;
  customerAgreed: boolean;
  companionAgreed: boolean;
  paymentStatus: 'unpaid' | 'pending' | 'paid' | 'cash_pending' | 'refunded';
  notes: string;
  cancellationReason?: string;
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
  amountBdt: number;
  platformFeeBdt: number;
  companionNetBdt: number;
  status: 'initiated' | 'pending_manual_verification' | 'verified_paid' | 'cash_pending' | 'failed' | 'refunded';
  webhookVerified: boolean;
  gatewaySessionId?: string;
  senderReferenceTrxId?: string;
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
  method: 'bkash' | 'nagad' | 'rocket' | 'bank_eft';
  accountMasked: string;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  reviewedByUid?: string;
  createdAt: string;
}

export interface ReviewRecord {
  id: string;
  bookingId: string;
  customerUid: string;
  companionUid: string;
  customerName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface VerificationRequestRecord {
  id: string;
  uid: string;
  fullName: string;
  documentType: 'nid' | 'passport' | 'driving_license';
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
  allowedDivision?: string;
  rootAdminUid: string;
  announcementBanner: string;
  safetyNotice: string;
  featuredHeadline: string;
  bookingCategories?: string[];
  updatedAt: string;
}
