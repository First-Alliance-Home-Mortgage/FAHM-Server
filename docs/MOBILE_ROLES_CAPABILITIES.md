# Mobile App Implementation: Roles, Capabilities & Menu Visibility

> React Native / Expo Router guide for FAHM mobile app authorization.
> Source of truth: `src/config/roles.js`, `scripts/seedRoles.js`, `scripts/seedCapabilities.js`, `scripts/seedMenus.js`

---

## 1. Roles

7 roles, identified by `slug` (underscore-delimited, lowercase).

| Slug | Display Name | Description |
|------|-------------|-------------|
| `admin` | Admin | Full platform access -- CMS, menus, users, billing, all features |
| `branch_manager` | Branch Manager | Team pipeline oversight, branch analytics, user management |
| `loan_officer_retail` | Loan Officer (Retail) | Full loan lifecycle, rate locks, borrower engagement |
| `loan_officer_tpo` | Loan Officer (TPO) | Third-party origination -- same capabilities as retail LO |
| `broker` | Broker | Pipeline view, rate alerts, document upload, business cards |
| `realtor` | Realtor | Shared loan view, messaging, rates, business cards |
| `borrower` | Borrower | Self-service loan tracking, documents, calculators, chatbot |

### Role Groups

Use these for access-control checks that apply to multiple roles.

| Group | Slugs |
|-------|-------|
| `STAFF_ROLES` | `admin`, `loan_officer_retail`, `loan_officer_tpo` |
| `ALL_LO_ROLES` | `loan_officer_retail`, `loan_officer_tpo` |
| `MANAGEMENT_ROLES` | `admin`, `branch_manager` |
| `INTERNAL_ROLES` | `admin`, `branch_manager`, `loan_officer_retail`, `loan_officer_tpo` |
| `EXTERNAL_ROLES` | `broker`, `realtor`, `borrower` |
| `ALL_ROLES` | All 7 |

---

## 2. Capabilities (36 total)

Capabilities are the fine-grained permissions assigned to each role. The backend checks them in `authorize({ capabilities: [...] })` middleware.

### Capability Catalog

| Category | Capability | Description |
|----------|-----------|-------------|
| **loan** | `loan:read:self` | Read own loan information |
| | `loan:update:self` | Update own loan information |
| | `loan:read` | Read all loan information |
| | `loan:update` | Update loan information |
| | `loan:create` | Create new loans |
| | `loan:read:shared` | Read shared loan information (referral partners) |
| **document** | `document:upload` | Upload documents to loans |
| | `document:download` | Download loan documents |
| **rates** | `rates:view` | View mortgage rates and product pricing |
| | `rates:lock` | Submit and manage rate lock requests |
| **alerts** | `alerts:manage` | Create, update, and delete rate alerts |
| **messages** | `messages:send` | Send in-app messages on loans |
| **dashboard** | `dashboard:view` | View dashboard metrics and reports |
| | `dashboard:branch` | View branch performance analytics |
| **webhooks** | `webhooks:ingest` | Receive and process webhook data |
| **users** | `users:manage` | Full user management (create, update, deactivate) |
| | `users:manage:branch` | Manage users within own branch |
| **audit** | `audit:read` | Read audit log entries |
| | `audit:view` | View audit logs (consent, CRM, credit) |
| **cms** | `cms:manage` | Create, edit, publish CMS screens and navigation |
| | `menu:manage` | Create, edit, delete, restore dynamic menus |
| | `featureflags:manage` | Toggle and configure feature flags |
| | `content:broadcast` | Broadcast content update events via WebSocket |
| **credit** | `credit:request` | Request tri-merge credit reports via Xactus |
| | `credit:read` | View credit reports and pull history |
| **preapproval** | `preapproval:generate` | Generate PDF pre-approval letters |
| | `preapproval:share` | Share pre-approval letters via SMS/email |
| **sms** | `sms:send` | Send SMS messages via Twilio |
| | `sms:read` | Read SMS conversation threads |
| **chatbot** | `chatbot:use` | Use AI chatbot sessions (Azure OpenAI) |
| **pos** | `pos:handoff` | Create POS handoff sessions (Blend, BigPOS) |
| **referral** | `referral:manage` | Manage referral sources and co-branding |
| | `referral:analytics` | View referral source analytics |
| **businesscard** | `businesscard:manage` | Create and manage digital business cards |
| **consent** | `consent:manage` | View and manage borrower data-sharing consents |
| | `consent:grant` | Grant data-sharing consent (borrower) |
| **calculator** | `calculator:use` | Use mortgage calculators |
| **crm** | `crm:manage` | Manage CRM sync, contacts, journeys |
| **tenant** | `tenant:manage` | Manage tenant/organization settings |
| **billing** | `billing:manage` | Manage subscription billing and usage |

---

## 3. Role-to-Capability Matrix

`x` = role has the capability.

| Capability | Borrower | Realtor | Broker | LO Retail | LO TPO | Branch Mgr | Admin |
|-----------|:--------:|:-------:|:------:|:---------:|:------:|:----------:|:-----:|
| `loan:read:self` | x | | | | | | |
| `loan:update:self` | x | | | | | | |
| `loan:read` | | | x | x | x | x | x |
| `loan:update` | | | | x | x | x | x |
| `loan:create` | | | x | x | x | x | x |
| `loan:read:shared` | | x | | | | | |
| `document:upload` | x | | x | x | x | x | x |
| `document:download` | x | | x | x | x | x | x |
| `rates:view` | x | x | x | x | x | x | x |
| `rates:lock` | | | | x | x | x | x |
| `alerts:manage` | x | | x | x | x | x | x |
| `messages:send` | x | x | x | x | x | x | x |
| `dashboard:view` | | | | x | x | x | x |
| `dashboard:branch` | | | | | | x | x |
| `webhooks:ingest` | | | | x | x | | x |
| `users:manage` | | | | | | | x |
| `users:manage:branch` | | | | | | x | |
| `audit:read` | | | | | | | x |
| `audit:view` | | | | | | | x |
| `cms:manage` | | | | | | | x |
| `menu:manage` | | | | | | | x |
| `featureflags:manage` | | | | | | | x |
| `content:broadcast` | | | | | | x | x |
| `credit:request` | | | | x | x | x | x |
| `credit:read` | | | x | x | x | x | x |
| `preapproval:generate` | | | | x | x | x | x |
| `preapproval:share` | | | | x | x | x | x |
| `sms:send` | | | | x | x | x | x |
| `sms:read` | | | x | x | x | x | x |
| `chatbot:use` | x | x | x | x | x | x | x |
| `pos:handoff` | | | | x | x | x | x |
| `referral:manage` | | | | x | x | x | x |
| `referral:analytics` | | | | | | x | x |
| `businesscard:manage` | | | x | x | x | x | x |
| `consent:manage` | | | x | x | x | x | x |
| `consent:grant` | x | | | | | | |
| `calculator:use` | x | x | x | x | x | x | x |
| `crm:manage` | | | | x | x | x | x |
| `tenant:manage` | | | | | | | x |
| `billing:manage` | | | | | | | x |

---

## 4. Menu / Tab Visibility by Role

Menus are fetched from `GET /api/v1/menus` (or `GET /api/v1/menus/grouped`). Each menu has a `roles` array -- only show the menu item if the user's role slug is in that array.

### Tab Bar

| Tab | Icon | Route | Visible To |
|-----|------|-------|-----------|
| Home | `home` | `/(app)/(drawer)/(tabs)/index` | ALL |
| Messages | `chat` | `/(app)/(drawer)/(tabs)/messages` | ALL |
| My Loans | `description` | `/(app)/(drawer)/(tabs)/my-loan` | borrower |
| Pipeline | `list` | `/(app)/(drawer)/(tabs)/pipeline` | admin, loan_officer_tpo, loan_officer_retail, branch_manager |
| Rates | `trending-up` | `/(app)/(drawer)/(tabs)/rates` | admin, broker, realtor |
| Calculators | `assignment` | `/(app)/(drawer)/(tabs)/calculators` | ALL |
| New Loan | `add-box` | `/(app)/(drawer)/(tabs)/new-application` | admin, loan_officer_tpo, loan_officer_retail |
| Refer | `person-add` | `/(app)/(drawer)/(tabs)/refer` | broker, realtor |
| Scanner | `camera-alt` | `/(app)/(drawer)/(tabs)/scanner` | borrower |
| More | `more-horiz` | `/(app)/(drawer)/(tabs)/more` | ALL |

### Stack Screens (ALL ROLES)

All 47 stack screens are visible to every role. Filter access at the API level via capabilities, not at the navigation level.

| Screen | Route |
|--------|-------|
| About | `/(app)/(stack)/about` |
| Active Loans | `/(app)/(stack)/active-loans` |
| Affordability Calculator | `/(app)/(stack)/affordability-calculator` |
| Apply | `/(app)/(stack)/apply` |
| Application | `/(app)/(stack)/application` |
| App Partners | `/(app)/(stack)/app-partners` |
| App Users | `/(app)/(stack)/app-users` |
| Borrower Profile | `/(app)/(stack)/borrower-profile` |
| Calculator | `/(app)/(stack)/calculator` |
| Chat Assistant | `/(app)/(stack)/chat-assistant` |
| Client App Users | `/(app)/(stack)/client-app-users` |
| Communication | `/(app)/(stack)/communication` |
| Contacts | `/(app)/(stack)/contacts` |
| Document Upload | `/(app)/(stack)/document-upload` |
| Document Viewer | `/(app)/(stack)/document-viewer` |
| Documents Uploaded | `/(app)/(stack)/documents-uploaded` |
| Documents | `/(app)/(stack)/documents` |
| Help | `/(app)/(stack)/help` |
| Insights | `/(app)/(stack)/insights` |
| Integrations | `/(app)/(stack)/integrations` |
| Learn | `/(app)/(stack)/learn` |
| Loan Application | `/(app)/(stack)/loan-application` |
| Loan Details | `/(app)/(stack)/loan-details` |
| Loan Management | `/(app)/(stack)/loan-management` |
| Loan Team | `/(app)/(stack)/loan-team` |
| Milestone Tracker | `/(app)/(stack)/milestone-tracker` |
| My Contact | `/(app)/(stack)/my-contact` |
| Notifications | `/(app)/(stack)/notifications` |
| Partners | `/(app)/(stack)/partners` |
| Pipeline Management | `/(app)/(stack)/pipeline-management` |
| Pre-Approval Letter | `/(app)/(stack)/pre-approval-letter` |
| Privacy Consent | `/(app)/(stack)/privacy-consent` |
| Profile | `/(app)/(stack)/profile` |
| Rate Alerts | `/(app)/(stack)/rate-alerts` |
| Rate Comparison | `/(app)/(stack)/rate-comparison` |
| Rates and Alerts | `/(app)/(stack)/rates-and-alerts` |
| Refinance Calculator | `/(app)/(stack)/refinance-calculator` |
| Reports | `/(app)/(stack)/reports` |
| Saved Calculations | `/(app)/(stack)/saved-calculations` |
| Scanner | `/(app)/(stack)/scanner` |
| Settings | `/(app)/(stack)/settings` |
| Share | `/(app)/(stack)/share` |
| Submissions | `/(app)/(stack)/submissions` |
| Support | `/(app)/(stack)/support` |
| User Management | `/(app)/(stack)/user-management` |
| Profile Setup | `/(auth)/profile-setup` |
| Login | `/(auth)/login` |

---

## 5. API Authentication Flow

### Login

```
POST /api/v1/auth/login
Content-Type: application/json

{ "email": "admin@fahmloans.com", "password": "Password123!" }
```

**Response:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "6c2d2f26e6e84c1bb0fd...",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Admin User",
    "email": "admin@fahmloans.com",
    "phone": "5551234567",
    "isActive": true,
    "role": {
      "_id": "507f1f77bcf86cd799439012",
      "name": "admin",
      "slug": "admin",
      "capabilities": [
        { "_id": "...", "name": "loan:read", "slug": "loan-read", "category": "loan" },
        { "_id": "...", "name": "users:manage", "slug": "users-manage", "category": "users" },
        { "_id": "...", "name": "cms:manage", "slug": "cms-manage", "category": "cms" }
      ]
    }
  }
}
```

### Token Refresh

```
POST /api/v1/auth/refresh
Content-Type: application/json

{ "refreshToken": "6c2d2f26e6e84c1bb0fd..." }
```

Returns same shape as login (new `token`, new `refreshToken`, updated `user`).

### Get Current User

```
GET /api/v1/users/me
Authorization: Bearer <token>
```

Returns `{ "user": { ... } }` with full role + capabilities tree.

### Fetch Menus

```
GET /api/v1/menus/grouped
Authorization: Bearer <token>
```

Returns `{ "drawer": [...], "tab": [...], "stack": [...] }` -- each item includes a `roles` array.

---

## 6. Mobile Implementation (React Native / Expo)

### TypeScript Types

```typescript
// types/auth.ts

export type RoleSlug =
  | 'admin'
  | 'branch_manager'
  | 'loan_officer_retail'
  | 'loan_officer_tpo'
  | 'broker'
  | 'realtor'
  | 'borrower';

export type CapabilityCategory =
  | 'loan' | 'document' | 'rates' | 'alerts' | 'messages' | 'dashboard'
  | 'webhooks' | 'users' | 'audit' | 'cms' | 'credit' | 'preapproval'
  | 'sms' | 'chatbot' | 'pos' | 'referral' | 'businesscard' | 'consent'
  | 'calculator' | 'notification' | 'crm' | 'integration' | 'tenant'
  | 'billing' | 'log' | 'other';

export interface Capability {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  category: CapabilityCategory;
}

export interface Role {
  _id: string;
  name: string;
  slug: RoleSlug;
  capabilities: Capability[];
}

export interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  title?: string;
  nmls?: string;
  photo?: string;
  role: Role;
  branch?: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    phone: string;
  };
  emailVerified: boolean;
  isActive: boolean;
  expoPushToken?: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: User;
}

export interface MenuItem {
  _id: string;
  alias: string;
  slug: string;
  label: string;
  icon: string;
  route: string;
  type: 'drawer' | 'tab' | 'stack';
  order: number;
  visible: boolean;
  roles: string[];
  content: any;
}
```

### Permission Helpers

```typescript
// utils/permissions.ts
import { User } from '@/types/auth';

// ── Role checks ──────────────────────────────────────────────────────────

export const hasRole = (user: User | null, roles: string[]): boolean => {
  if (!user?.role?.slug) return false;
  return roles.includes(user.role.slug);
};

export const isAdmin = (user: User | null) => hasRole(user, ['admin']);
export const isLoanOfficer = (user: User | null) => hasRole(user, ['loan_officer_retail', 'loan_officer_tpo']);
export const isBranchManager = (user: User | null) => hasRole(user, ['branch_manager']);
export const isBorrower = (user: User | null) => hasRole(user, ['borrower']);
export const isInternal = (user: User | null) => hasRole(user, ['admin', 'branch_manager', 'loan_officer_retail', 'loan_officer_tpo']);
export const isExternal = (user: User | null) => hasRole(user, ['broker', 'realtor', 'borrower']);

// ── Capability checks ────────────────────────────────────────────────────

export const hasCapability = (user: User | null, capability: string): boolean => {
  if (!user?.role?.capabilities) return false;
  return user.role.capabilities.some(
    (cap) => cap.name.toLowerCase() === capability.toLowerCase()
  );
};

export const hasAllCapabilities = (user: User | null, caps: string[]): boolean =>
  caps.every((cap) => hasCapability(user, cap));

export const hasAnyCapability = (user: User | null, caps: string[]): boolean =>
  caps.some((cap) => hasCapability(user, cap));

// ── Feature-specific permission shortcuts ────────────────────────────────

export const can = {
  // Loans
  readLoan:       (u: User | null) => hasAnyCapability(u, ['loan:read', 'loan:read:self', 'loan:read:shared']),
  readAllLoans:   (u: User | null) => hasCapability(u, 'loan:read'),
  readOwnLoan:    (u: User | null) => hasCapability(u, 'loan:read:self'),
  createLoan:     (u: User | null) => hasCapability(u, 'loan:create'),
  updateLoan:     (u: User | null) => hasCapability(u, 'loan:update'),

  // Documents
  uploadDoc:      (u: User | null) => hasCapability(u, 'document:upload'),
  downloadDoc:    (u: User | null) => hasCapability(u, 'document:download'),

  // Rates
  viewRates:      (u: User | null) => hasCapability(u, 'rates:view'),
  lockRates:      (u: User | null) => hasCapability(u, 'rates:lock'),
  manageAlerts:   (u: User | null) => hasCapability(u, 'alerts:manage'),

  // Dashboard
  viewDashboard:  (u: User | null) => hasCapability(u, 'dashboard:view'),
  viewBranch:     (u: User | null) => hasCapability(u, 'dashboard:branch'),

  // Users
  manageUsers:    (u: User | null) => hasCapability(u, 'users:manage'),
  manageBranch:   (u: User | null) => hasCapability(u, 'users:manage:branch'),

  // Audit
  viewAudit:      (u: User | null) => hasAnyCapability(u, ['audit:read', 'audit:view']),

  // CMS
  manageCMS:      (u: User | null) => hasCapability(u, 'cms:manage'),
  manageMenus:    (u: User | null) => hasCapability(u, 'menu:manage'),
  manageFlags:    (u: User | null) => hasCapability(u, 'featureflags:manage'),
  broadcast:      (u: User | null) => hasCapability(u, 'content:broadcast'),

  // Credit
  requestCredit:  (u: User | null) => hasCapability(u, 'credit:request'),
  readCredit:     (u: User | null) => hasCapability(u, 'credit:read'),

  // Pre-Approval
  genPreapproval: (u: User | null) => hasCapability(u, 'preapproval:generate'),
  sharePreapproval: (u: User | null) => hasCapability(u, 'preapproval:share'),

  // Communication
  sendMessages:   (u: User | null) => hasCapability(u, 'messages:send'),
  sendSMS:        (u: User | null) => hasCapability(u, 'sms:send'),
  readSMS:        (u: User | null) => hasCapability(u, 'sms:read'),
  useChatbot:     (u: User | null) => hasCapability(u, 'chatbot:use'),

  // POS
  handoffPOS:     (u: User | null) => hasCapability(u, 'pos:handoff'),

  // Referral & Business Cards
  manageReferrals:   (u: User | null) => hasCapability(u, 'referral:manage'),
  viewReferralStats: (u: User | null) => hasCapability(u, 'referral:analytics'),
  manageBizCard:     (u: User | null) => hasCapability(u, 'businesscard:manage'),

  // Consent
  manageConsent:  (u: User | null) => hasCapability(u, 'consent:manage'),
  grantConsent:   (u: User | null) => hasCapability(u, 'consent:grant'),

  // Calculator
  useCalculator:  (u: User | null) => hasCapability(u, 'calculator:use'),

  // CRM
  manageCRM:      (u: User | null) => hasCapability(u, 'crm:manage'),

  // Tenant & Billing
  manageTenant:   (u: User | null) => hasCapability(u, 'tenant:manage'),
  manageBilling:  (u: User | null) => hasCapability(u, 'billing:manage'),
};
```

### Menu Filtering

```typescript
// utils/menuFilter.ts
import { User, MenuItem } from '@/types/auth';

/**
 * Filter menu items based on the current user's role slug.
 * Only returns items where the user's role is in the menu's `roles` array
 * AND the item is marked as visible.
 */
export function filterMenusByRole(menus: MenuItem[], user: User | null): MenuItem[] {
  if (!user?.role?.slug) return [];
  return menus
    .filter((menu) => menu.visible && menu.roles.includes(user.role.slug))
    .sort((a, b) => a.order - b.order);
}

/**
 * Filter and group menus by type for Expo Router layout.
 */
export function getGroupedMenus(
  menus: MenuItem[],
  user: User | null
): { drawer: MenuItem[]; tab: MenuItem[]; stack: MenuItem[] } {
  const filtered = filterMenusByRole(menus, user);
  return {
    drawer: filtered.filter((m) => m.type === 'drawer'),
    tab:    filtered.filter((m) => m.type === 'tab'),
    stack:  filtered.filter((m) => m.type === 'stack'),
  };
}
```

### Auth Context (React Native)

```typescript
// contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { User, AuthResponse } from '@/types/auth';

const API_BASE = 'https://fahm-server.onrender.com/api/v1';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    (async () => {
      const savedToken = await SecureStore.getItemAsync('authToken');
      const savedRefresh = await SecureStore.getItemAsync('refreshToken');
      const savedUser = await SecureStore.getItemAsync('authUser');
      if (savedToken && savedUser) {
        setToken(savedToken);
        setRefreshToken(savedRefresh);
        setUser(JSON.parse(savedUser));
      }
      setIsLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error('Login failed');
    const data: AuthResponse = await res.json();

    setToken(data.token);
    setRefreshToken(data.refreshToken);
    setUser(data.user);

    await SecureStore.setItemAsync('authToken', data.token);
    await SecureStore.setItemAsync('refreshToken', data.refreshToken);
    await SecureStore.setItemAsync('authUser', JSON.stringify(data.user));
  };

  const refresh = async () => {
    if (!refreshToken) throw new Error('No refresh token');
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) { await logout(); throw new Error('Session expired'); }
    const data: AuthResponse = await res.json();

    setToken(data.token);
    setRefreshToken(data.refreshToken);
    setUser(data.user);

    await SecureStore.setItemAsync('authToken', data.token);
    await SecureStore.setItemAsync('refreshToken', data.refreshToken);
    await SecureStore.setItemAsync('authUser', JSON.stringify(data.user));
  };

  const logout = async () => {
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    await SecureStore.deleteItemAsync('authToken');
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('authUser');
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isAuthenticated: !!token, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
```

### Guard Components

```typescript
// components/RoleGuard.tsx
import { useAuth } from '@/contexts/AuthContext';
import { hasRole } from '@/utils/permissions';

interface Props {
  roles: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGuard({ roles, children, fallback = null }: Props) {
  const { user } = useAuth();
  return hasRole(user, roles) ? <>{children}</> : <>{fallback}</>;
}

// components/CapabilityGuard.tsx
import { useAuth } from '@/contexts/AuthContext';
import { hasCapability, hasAllCapabilities } from '@/utils/permissions';

interface Props {
  capability: string | string[];
  requireAll?: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function CapabilityGuard({ capability, requireAll = false, children, fallback = null }: Props) {
  const { user } = useAuth();
  const caps = Array.isArray(capability) ? capability : [capability];
  const ok = requireAll
    ? hasAllCapabilities(user, caps)
    : caps.some((c) => hasCapability(user, c));
  return ok ? <>{children}</> : <>{fallback}</>;
}
```

### Usage in Screens

```typescript
// Example: Pipeline screen
import { useAuth } from '@/contexts/AuthContext';
import { can, isAdmin } from '@/utils/permissions';
import { RoleGuard } from '@/components/RoleGuard';
import { CapabilityGuard } from '@/components/CapabilityGuard';

export default function PipelineScreen() {
  const { user } = useAuth();

  return (
    <View>
      {/* Loan list -- all pipeline roles see this */}
      <LoanList />

      {/* Rate lock button -- only if user can lock rates */}
      <CapabilityGuard capability="rates:lock">
        <RateLockButton />
      </CapabilityGuard>

      {/* Branch analytics -- management only */}
      <CapabilityGuard capability="dashboard:branch">
        <BranchAnalyticsCard />
      </CapabilityGuard>

      {/* Admin-only: user management link */}
      <RoleGuard roles={['admin']}>
        <UserManagementLink />
      </RoleGuard>

      {/* Pre-approval -- needs both generate AND share */}
      <CapabilityGuard capability={['preapproval:generate', 'preapproval:share']} requireAll>
        <PreApprovalButton />
      </CapabilityGuard>

      {/* Inline permission check */}
      {can.sendSMS(user) && <SMSButton />}
    </View>
  );
}
```

---

## 7. Backend API Authorization Quick Reference

How the backend enforces access on key endpoints:

| Endpoint | Method | Authorization |
|----------|--------|--------------|
| `/auth/login` | POST | Public |
| `/auth/register` | POST | Public |
| `/auth/refresh` | POST | Public |
| `/auth/logout` | POST | Authenticated |
| `/users/me` | GET | Authenticated |
| `/users/me` | PATCH | Authenticated |
| `/users` | GET/POST | admin |
| `/users/:id` | GET/PATCH/DELETE | admin |
| `/loans` | GET | admin, LO retail, LO TPO, broker, borrower |
| `/loans` | POST | admin, LO retail, LO TPO, broker, borrower |
| `/loans/:id/status` | PATCH | admin, LO retail, LO TPO |
| `/loans/:id/preapproval` | GET | admin, LO retail, LO TPO, branch_manager |
| `/encompass/loans/:id` | GET | staff (admin, LO retail, LO TPO) or own borrower |
| `/rates/products` | GET | admin, LO retail, LO TPO |
| `/rates/current` | GET | admin, LO TPO, LO retail, branch_manager, borrower |
| `/rates/lock` | POST | LO retail, LO TPO, branch_manager, admin |
| `/dashboard/reports` | GET | capability: `dashboard:view` |
| `/dashboard/metrics` | GET | capability: `dashboard:view` |
| `/dashboard/branch` | GET | admin, branch_manager |
| `/credit/loans/:id/request` | POST | admin, LO retail, LO TPO |
| `/credit/loans/:id/report` | GET | admin, LO retail, LO TPO |
| `/preapproval/generate` | POST | LO retail, LO TPO, branch_manager, admin |
| `/preapproval/:id/share` | POST | LO retail, LO TPO, branch_manager, admin |
| `/consent/request` | POST | admin, realtor, broker, LO retail, LO TPO |
| `/consent/:id/grant` | POST | borrower |
| `/menus` | GET | Authenticated |
| `/menus/grouped` | GET | Authenticated |
| `/menus` | POST/PUT/DELETE | admin |
| `/roles` | GET/POST/PUT/DELETE | admin |
| `/capabilities` | GET/POST/PUT/DELETE | admin |
| `/cms/screens` | GET/POST/PUT | admin |
| `/audit-logs/*` | GET | admin + capability: `audit:view` |
| `/sms/send` | POST | LO retail, LO TPO, branch_manager, admin |
| `/referral-sources` | GET/POST | LO retail, LO TPO, branch_manager, admin |
| `/business-cards` | GET/POST | Authenticated; admin/branch_manager for admin ops |
| `/chatbot/sessions` | POST | Authenticated (capability: `chatbot:use`) |
| `/document-uploads` | POST | admin, LO retail, LO TPO, broker, borrower |

---

## 8. Seed Test Accounts

Available after running `node scripts/seedUsers.js`:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@fahmloans.com` | `Password123!` |
| Branch Manager | `branch_manager@fahmloans.com` | `Password123!` |
| LO Retail | `loan_officer_retail@fahmloans.com` | `Password123!` |
| LO TPO | `loan_officer_tpo@fahmloans.com` | `Password123!` |
| Broker | `broker@fahmloans.com` | `Password123!` |
| Realtor | `realtor@fahmloans.com` | `Password123!` |
| Borrower | `borrower@fahmloans.com` | `Password123!` |

---

## 9. Seeding Order

Run seeds in this order to ensure correct ObjectId references:

```bash
node scripts/seedCapabilities.js   # 1. Capabilities first
node scripts/seedRoles.js          # 2. Roles (references capability ObjectIds)
node scripts/seedUsers.js          # 3. Users (references role ObjectIds)
node scripts/seedMenus.js          # 4. Menus
```
