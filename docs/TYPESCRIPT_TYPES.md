# FAHM TypeScript Type Definitions

> All TypeScript types for the FAHM Next.js frontend, matching backend MongoDB models.

---

## Common Types

```typescript
// types/api.types.ts

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  status: number;
  errors?: Record<string, string[]>;
}

export interface TimestampFields {
  createdAt: string;
  updatedAt: string;
}
```

---

## Auth & User Types

```typescript
// types/auth.types.ts

export interface Capability {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  category: CapabilityCategory;
}

export type CapabilityCategory =
  | 'loan'
  | 'document'
  | 'rates'
  | 'alerts'
  | 'messages'
  | 'dashboard'
  | 'webhooks'
  | 'users'
  | 'audit'
  | 'log'
  | 'other';

export interface Role {
  _id: string;
  name: string;
  slug: RoleSlug;
  capabilities: Capability[];
  createdAt: string;
  updatedAt: string;
}

export type RoleSlug =
  | 'admin'
  | 'branch_manager'
  | 'loan_officer_retail'
  | 'loan_officer_tpo'
  | 'broker'
  | 'realtor'
  | 'borrower';

export interface Branch {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  title?: string;
  photo?: string;
  nmls?: string;
  role: Role;
  branch?: Branch;
  azureAdB2CId?: string;
  emailVerified: boolean;
  isActive: boolean;
  expoPushToken?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  role: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: User;
}

export interface RefreshResponse {
  token: string;
  refreshToken: string;
}
```

---

## Loan Types

```typescript
// types/loan.types.ts

export type LoanStatus =
  | 'application'
  | 'processing'
  | 'underwriting'
  | 'closing'
  | 'funded';

export type LoanSource = 'retail' | 'tpo';
export type POSSystem = 'blend' | 'big_pos';

export interface Milestone {
  name: string;
  status: 'pending' | 'in_progress' | 'completed';
  completedAt?: string;
}

export interface PropertyAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface LoanApplication {
  _id: string;
  borrower: Pick<User, '_id' | 'name' | 'email'>;
  assignedOfficer: Pick<User, '_id' | 'name' | 'email'>;
  amount: number;
  propertyAddress: PropertyAddress;
  status: LoanStatus;
  milestones: Milestone[];
  source: LoanSource;
  referralSource?: string;
  encompassLoanId?: string;
  lastEncompassSync?: string;
  encompassData?: Record<string, any>;
  posSystem?: POSSystem;
  posApplicationId?: string;
  lastPOSSync?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLoanRequest {
  borrower?: string;
  amount: number;
  propertyAddress: PropertyAddress;
}

export interface UpdateLoanStatusRequest {
  status: LoanStatus;
  milestones?: Milestone[];
}
```

---

## Document Types

```typescript
// types/document.types.ts

export type DocumentType =
  | 'paystub'
  | 'w2'
  | 'tax_return'
  | 'bank_statement'
  | 'id'
  | 'proof_of_employment'
  | 'appraisal'
  | 'purchase_agreement'
  | 'insurance'
  | 'credit_report'
  | 'other';

export type DocumentMimeType =
  | 'application/pdf'
  | 'image/png'
  | 'image/jpeg'
  | 'image/jpg';

export interface DocumentUpload {
  _id: string;
  loan: string;
  uploadedBy: string;
  fileName: string;
  originalFileName: string;
  fileSize: number;
  mimeType: DocumentMimeType;
  documentType: DocumentType;
  blobUrl: string;
  status: string;
  metadata: {
    uploadSource?: string;
    ipAddress?: string;
    userAgent?: string;
    pageCount?: number;
    isComplete?: boolean;
  };
  notifications: {
    loNotified: boolean;
    processorNotified: boolean;
  };
  encompassDocId?: string;
  encompassSyncedAt?: string;
  posSystem?: string;
  posDocumentId?: string;
  posSyncedAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PresignRequest {
  fileName: string;
  mimeType: DocumentMimeType;
  loanId: string;
}

export interface PresignResponse {
  uploadUrl: string;
  expiresAt: string;
}
```

---

## Rate Types

```typescript
// types/rate.types.ts

export type ProductType =
  | 'conventional'
  | 'fha'
  | 'va'
  | 'usda'
  | 'jumbo';

export type PropertyType = 'single_family' | 'condo' | 'townhouse' | 'multi_family';

export type AlertTriggerType = 'below' | 'above' | 'drops_by';
export type NotificationMethod = 'push' | 'sms' | 'email' | 'all';
export type AlertStatus = 'active' | 'paused' | 'triggered' | 'expired' | 'cancelled';

export interface RateAlert {
  _id: string;
  user: string;
  productType: ProductType;
  loanTerm: number;
  loanAmount: number;
  creditScore: number;
  ltv: number;
  propertyType: PropertyType;
  targetRate: number;
  triggerType: AlertTriggerType;
  dropAmount?: number;
  notificationMethod: NotificationMethod;
  status: AlertStatus;
  loan?: string;
  triggerHistory: Array<{
    triggeredAt: string;
    rate: number;
    notificationSent: boolean;
  }>;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAlertRequest {
  productType: ProductType;
  loanTerm: number;
  loanAmount: number;
  creditScore: number;
  ltv: number;
  propertyType: PropertyType;
  targetRate: number;
  triggerType: AlertTriggerType;
  dropAmount?: number;
  notificationMethod: NotificationMethod;
}

export interface RateLock {
  _id: string;
  loan: string;
  user: string;
  productType: ProductType;
  rate: number;
  lockDays: number;
  status: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface RateSnapshot {
  _id: string;
  productType: ProductType;
  term: number;
  rate: number;
  apr: number;
  source: string;
  capturedAt: string;
}

export interface ProductPricing {
  _id: string;
  productType: ProductType;
  term: number;
  rate: number;
  apr: number;
  points: number;
  monthlyPayment: number;
  lastUpdated: string;
}
```

---

## Credit Types

```typescript
// types/credit.types.ts

export type CreditBureau = 'equifax' | 'experian' | 'transunion';
export type ReportType = 'tri_merge' | 'single_bureau' | 'soft_pull';
export type ReportStatus = 'pending' | 'completed' | 'failed' | 'expired';

export interface CreditScore {
  bureau: CreditBureau;
  score: number;
  scoreModel: string;
  factors: string[];
}

export interface CreditSummary {
  totalAccounts: number;
  openAccounts: number;
  totalDebt: number;
  availableCredit: number;
  creditUtilization: number;
  oldestAccountAge?: number;
  recentInquiries?: number;
}

export interface CreditReport {
  _id: string;
  loan: string;
  borrower: string;
  requestedBy: string;
  xactusReportId?: string;
  reportType: ReportType;
  status: ReportStatus;
  scores: CreditScore[];
  midScore: number;
  tradelines: any[];
  publicRecords: any[];
  inquiries: any[];
  summary: CreditSummary;
  expiresAt: string;
  retentionPeriodDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreditPullLog {
  _id: string;
  user: string;
  loan: string;
  borrower: string;
  reportType: ReportType;
  bureau: CreditBureau[];
  purpose: string;
  status: string;
  ip: string;
  userAgent: string;
  createdAt: string;
}
```

---

## Menu Types

```typescript
// types/menu.types.ts

export type MenuType = 'drawer' | 'tab' | 'stack';

export interface Menu {
  _id: string;
  alias: string;
  label: string;
  icon: string;
  route: string;
  type: MenuType;
  slug: string;
  content?: any;
  order: number;
  visible: boolean;
  override: boolean;
  roles: string[];
  analytics: {
    views: number;
    uniqueUsers: number;
    lastAccessed: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface GroupedMenus {
  drawer: Menu[];
  tab: Menu[];
  stack: Menu[];
}

export interface MenuVersion {
  _id: string;
  version: number;
  menus: Menu[];
  createdBy: string;
  reason?: string;
  createdAt: string;
}

export interface CreateMenuRequest {
  alias: string;
  label: string;
  icon: string;
  route: string;
  type: MenuType;
  order: number;
  visible?: boolean;
  roles?: string[];
  content?: any;
}

export interface UpdateMenuRequest extends Partial<CreateMenuRequest> {}
```

---

## CMS Types

```typescript
// types/cms.types.ts

export type ScreenStatus = 'draft' | 'published';
export type NavigationType = 'drawer' | 'tab' | 'stack' | 'modal';

export interface ScreenComponent {
  type: string;
  props: Record<string, any>;
}

export interface ScreenNavigation {
  type: NavigationType;
  icon: string;
  order: number;
}

export interface Screen {
  _id: string;
  slug: string;
  title: string;
  route: string;
  navigation: ScreenNavigation;
  roles: string[];
  tenant_scope: string[];
  components: ScreenComponent[];
  status: ScreenStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface NavigationConfig {
  _id: string;
  type: NavigationType;
  role: string;
  items: Array<{
    screen_slug: string;
    order: number;
  }>;
}

export interface FeatureFlag {
  _id: string;
  key: string;
  enabled: boolean;
  roles: string[];
  min_app_version?: string;
}

export interface ComponentRegistryItem {
  _id: string;
  type: string;
  allowed_props: Record<string, any>;
  allowed_actions: string[];
  supports_actions: boolean;
  status: 'active' | 'inactive';
}
```

---

## Message Types

```typescript
// types/message.types.ts

export type MessageType = 'text' | 'system' | 'document' | 'milestone';

export interface Message {
  _id: string;
  loan: string;
  sender: Pick<User, '_id' | 'name' | 'email'>;
  recipient: Pick<User, '_id' | 'name' | 'email'>;
  messageType: MessageType;
  content: string;
  read: boolean;
  readAt?: string;
  metadata?: Record<string, any>;
  encompassSynced: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMessageRequest {
  loan: string;
  recipient: string;
  content: string;
  messageType?: MessageType;
}

export interface SMSMessage {
  _id: string;
  from: string;
  to: string;
  body: string;
  direction: 'outbound' | 'inbound';
  status: string;
  twilioSid: string;
  loan?: string;
  user?: string;
  read: boolean;
  readAt?: string;
  encompassSynced: boolean;
  createdAt: string;
  updatedAt: string;
}
```

---

## Dashboard Types

```typescript
// types/dashboard.types.ts

export interface DashboardReport {
  _id: string;
  name: string;
  reportId: string;
  groupId: string;
  embedUrl: string;
  roles: string[];
  description?: string;
}

export interface EmbedConfig {
  embedUrl: string;
  embedToken: string;
  reportId: string;
  expiration: string;
}

export interface DashboardMetric {
  _id: string;
  name: string;
  value: number;
  previousValue?: number;
  changePercent?: number;
  period: string;
  category: string;
}

export interface KPI {
  metric: string;
  value: number;
  target: number;
  percentOfTarget: number;
  trend: 'up' | 'down' | 'flat';
}

export interface BranchPerformance {
  branchName: string;
  totalLoans: number;
  totalVolume: number;
  avgDaysToClose: number;
  pullThroughRate: number;
}

export interface LeaderboardEntry {
  user: Pick<User, '_id' | 'name' | 'photo'>;
  totalLoans: number;
  totalVolume: number;
  rank: number;
}
```

---

## Business Card Types

```typescript
// types/business-card.types.ts

export interface SocialLinks {
  linkedin?: string;
  facebook?: string;
  twitter?: string;
  instagram?: string;
}

export interface CardBranding {
  primaryColor: string;    // default: #003B5C
  secondaryColor: string;  // default: #FF6B35
  logo?: string;
  partnerLogo?: string;
  partnerName?: string;
}

export interface CardStats {
  views: number;
  applies: number;
  shares: number;
}

export interface BusinessCard {
  _id: string;
  user: string;
  slug: string;
  nmls: string;
  title: string;
  photo: string;
  bio: string;
  phone: string;
  email: string;
  branch: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
  };
  socialLinks: SocialLinks;
  referralSource?: string;
  branding: CardBranding;
  qrCode: string;
  applyNowUrl: string;
  stats: CardStats;
  isActive: boolean;
  isPublic: boolean;
  customDomain?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CardAnalytics {
  views: number;
  applies: number;
  shares: number;
  viewsByDate: Array<{ date: string; count: number }>;
  appliesByDate: Array<{ date: string; count: number }>;
}
```

---

## Chatbot Types

```typescript
// types/chatbot.types.ts

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface ChatbotSession {
  _id: string;
  user: string;
  messages: ChatMessage[];
  status: 'active' | 'escalated' | 'closed';
  escalatedTo?: string;
  escalationReason?: string;
  rating?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatbotStats {
  totalSessions: number;
  activeSessions: number;
  escalatedSessions: number;
  avgRating: number;
  avgMessagesPerSession: number;
}
```

---

## Preapproval Types

```typescript
// types/preapproval.types.ts

export interface BorrowerData {
  primaryBorrower: {
    name: string;
    email: string;
    phone?: string;
  };
  coBorrower?: {
    name: string;
    email: string;
    phone?: string;
  };
}

export interface PreapprovalLoanData {
  loanAmount: number;
  purchasePrice: number;
  downPayment: number;
  propertyType: string;
  loanType: string;
  interestRate?: number;
  term?: number;
}

export interface PreapprovalSignatures {
  loName: string;
  loTitle: string;
  loNMLS: string;
  companyNMLS: string;
}

export type PreapprovalStatus = 'draft' | 'generated' | 'sent' | 'viewed' | 'expired';

export interface PreapprovalLetter {
  _id: string;
  loan: string;
  borrower: string;
  loanOfficer: string;
  letterNumber: string;  // Format: PA-YYYY-000001
  borrowerData: BorrowerData;
  loanData: PreapprovalLoanData;
  creditData?: any;
  referralSource?: string;
  branding?: CardBranding;
  pdfUrl: string;
  status: PreapprovalStatus;
  expirationDate: string;
  conditions: string[];
  disclaimers: string[];
  signatures: PreapprovalSignatures;
  sharing: {
    sharedViaEmail: boolean;
    sharedViaSMS: boolean;
    shareHistory: Array<{
      method: 'email' | 'sms' | 'link';
      recipient: string;
      sharedAt: string;
    }>;
  };
  viewHistory: Array<{
    viewedAt: string;
    ip?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface ShareLetterRequest {
  method: 'email' | 'sms' | 'link';
  recipient?: string;
}
```

---

## Consent Types

```typescript
// types/consent.types.ts

export type ConsentStatus = 'pending' | 'granted' | 'revoked' | 'expired';

export interface ConsentManagement {
  _id: string;
  borrower: string;
  requestedBy: string;
  dataTypes: string[];
  purpose: string;
  status: ConsentStatus;
  grantedAt?: string;
  revokedAt?: string;
  expiresAt?: string;
  accessLog: Array<{
    accessedBy: string;
    dataType: string;
    accessedAt: string;
    purpose: string;
  }>;
  createdAt: string;
  updatedAt: string;
}
```

---

## Referral Source Types

```typescript
// types/referral.types.ts

export interface ReferralBranding {
  primaryColor?: string;
  secondaryColor?: string;
  logo?: string;
  partnerLogo?: string;
  partnerName?: string;
}

export interface ReferralSource {
  _id: string;
  name: string;
  type: string;
  company: string;
  contactEmail: string;
  contactPhone: string;
  assignedTo: string;
  branding: ReferralBranding;
  isActive: boolean;
  stats: {
    totalLeads: number;
    totalApplications: number;
    totalFunded: number;
    conversionRate: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ReferralAnalytics {
  referralSourceId: string;
  period: { startDate: string; endDate: string };
  leads: number;
  applications: number;
  funded: number;
  volume: number;
  conversionRate: number;
  byMonth: Array<{
    month: string;
    leads: number;
    applications: number;
    funded: number;
  }>;
}
```

---

## POS Session Types

```typescript
// types/pos.types.ts

export type POSSessionStatus = 'pending' | 'active' | 'completed' | 'expired' | 'cancelled';

export interface POSSession {
  _id: string;
  loan: string;
  user: string;
  posSystem: 'blend' | 'big_pos';
  sessionId: string;
  handoffUrl: string;
  status: POSSessionStatus;
  analytics: Array<{
    event: string;
    timestamp: string;
    data?: Record<string, any>;
  }>;
  createdAt: string;
  updatedAt: string;
}
```

---

## Notification Types

```typescript
// types/notification.types.ts

export type NotificationType = 'info' | 'status' | 'rate_alert' | 'message';

export interface Notification {
  _id: string;
  user: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  readAt?: string;
  data?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}
```

---

## Audit Log Types

```typescript
// types/audit.types.ts

export interface AuditLog {
  _id: string;
  user: string;
  action: string;
  entityType: string;
  entityId: string;
  status: 'success' | 'error';
  ip: string;
  userAgent: string;
  metadata?: Record<string, any>;
  createdAt: string;
}
```

---

## WebSocket Event Types

```typescript
// types/websocket.types.ts

export type WSEventType = 'menu_updated' | 'screen_updated' | 'content_updated';

export interface WSMenuUpdatedEvent {
  type: 'menu_updated';
  timestamp: string;
}

export interface WSScreenUpdatedEvent {
  type: 'screen_updated';
  screenId: string;
  alias: string;
  timestamp: string;
}

export interface WSContentUpdatedEvent {
  type: 'content_updated';
  timestamp: string;
}

export type WSEvent =
  | WSMenuUpdatedEvent
  | WSScreenUpdatedEvent
  | WSContentUpdatedEvent;
```
