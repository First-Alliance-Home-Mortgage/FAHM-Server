# Frontend Implementation: Roles & Capabilities (Next.js)

This guide explains how to implement role-based and capability-based authorization on your Next.js frontend.

## Roles & Capabilities Reference

### 7 Roles (slug constants from `src/config/roles.js`)

| Role | Slug | Description |
|------|------|-------------|
| Admin | `admin` | Full platform access — CMS, menus, users, billing, all features |
| Branch Manager | `branch_manager` | Team pipeline oversight, branch analytics, user management |
| Loan Officer (Retail) | `loan_officer_retail` | Full loan lifecycle, rate locks, borrower engagement |
| Loan Officer (TPO) | `loan_officer_tpo` | Third-party origination — same as retail LO |
| Broker | `broker` | Pipeline view, rate alerts, document upload, business cards |
| Realtor | `realtor` | Shared loan view, messaging, rates, business cards |
| Borrower | `borrower` | Self-service loan tracking, documents, calculators, chatbot |

### Role Groups (from `src/config/roles.js`)

| Group | Roles | Usage |
|-------|-------|-------|
| `STAFF_ROLES` | admin, loan_officer_retail, loan_officer_tpo | Internal staff with loan management access |
| `ALL_LO_ROLES` | loan_officer_retail, loan_officer_tpo | Both loan officer types |
| `MANAGEMENT_ROLES` | admin, branch_manager | Management-level access |
| `INTERNAL_ROLES` | admin, branch_manager, loan_officer_retail, loan_officer_tpo | All internal company roles |
| `EXTERNAL_ROLES` | broker, realtor, borrower | External partner and borrower roles |
| `ALL_ROLES` | All 7 roles | Any authenticated user |

### 36 Capabilities (seeded by `scripts/seedCapabilities.js`)

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
| **users** | `users:manage` | Full user management |
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
| **chatbot** | `chatbot:use` | Use AI chatbot sessions |
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

### Role → Capability Matrix

| Capability | Borrower | Realtor | Broker | LO Retail | LO TPO | Branch Mgr | Admin |
|-----------|:--------:|:-------:|:------:|:---------:|:------:|:----------:|:-----:|
| loan:read:self | x | | | | | | |
| loan:update:self | x | | | | | | |
| loan:read | | | x | x | x | x | x |
| loan:update | | | | x | x | x | x |
| loan:create | | | x | x | x | x | x |
| loan:read:shared | | x | | | | | |
| document:upload | x | | x | x | x | x | x |
| document:download | x | | x | x | x | x | x |
| rates:view | x | x | x | x | x | x | x |
| rates:lock | | | | x | x | x | x |
| alerts:manage | x | | x | x | x | x | x |
| messages:send | x | x | x | x | x | x | x |
| dashboard:view | | | | x | x | x | x |
| dashboard:branch | | | | | | x | x |
| webhooks:ingest | | | | x | x | | x |
| users:manage | | | | | | | x |
| users:manage:branch | | | | | | x | |
| audit:read | | | | | | | x |
| audit:view | | | | | | | x |
| cms:manage | | | | | | | x |
| menu:manage | | | | | | | x |
| featureflags:manage | | | | | | | x |
| content:broadcast | | | | | | x | x |
| credit:request | | | | x | x | x | x |
| credit:read | | | x | x | x | x | x |
| preapproval:generate | | | | x | x | x | x |
| preapproval:share | | | | x | x | x | x |
| sms:send | | | | x | x | x | x |
| sms:read | | | x | x | x | x | x |
| chatbot:use | x | x | x | x | x | x | x |
| pos:handoff | | | | x | x | x | x |
| referral:manage | | | | x | x | x | x |
| referral:analytics | | | | | | x | x |
| businesscard:manage | | | x | x | x | x | x |
| consent:manage | | | x | x | x | x | x |
| consent:grant | x | | | | | | |
| calculator:use | x | x | x | x | x | x | x |
| crm:manage | | | | x | x | x | x |
| tenant:manage | | | | | | | x |
| billing:manage | | | | | | | x |

---

## 1. Authentication Flow

### Step 1: Login and Get Token

```typescript
// lib/auth.ts
interface LoginCredentials {
  email: string;
  password: string;
}

interface AuthResponse {
  token: string;
  refreshToken: string;
  user: {
    _id: string;
    name: string;
    email: string;
    role: {
      _id: string;
      name: string;
      slug: string;
      capabilities: Array<{
        _id: string;
        name: string;
        slug: string;
        category: string;
      }>;
    };
  };
}

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    throw new Error('Login failed');
  }

  return response.json();
}
```

### Step 2: Store Token & User in Context/State

```typescript
// contexts/AuthContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface Capability {
  _id: string;
  name: string;
  slug: string;
  category: string;
}

interface Role {
  _id: string;
  name: string;
  slug: string;
  capabilities: Capability[];
}

interface User {
  _id: string;
  name: string;
  email: string;
  role: Role;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('authUser');

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }

    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const data = await response.json();
      const { token, user } = data;

      setToken(token);
      setUser(user);

      localStorage.setItem('authToken', token);
      localStorage.setItem('authUser', JSON.stringify(user));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        isAuthenticated: !!token
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

## 2. Role-Based Access Control (RBAC)

### Check User Role

```typescript
// lib/permissions.ts
import { User } from '@/types/auth';

// ── Role checks ─────────────────────────────────────────────────────────────

export function hasRole(user: User | null, roles: string[]): boolean {
  if (!user?.role) return false;
  return roles.includes(user.role.slug);
}

export function isAdmin(user: User | null): boolean {
  return hasRole(user, ['admin']);
}

export function isLoanOfficer(user: User | null): boolean {
  return hasRole(user, ['loan_officer_retail', 'loan_officer_tpo']);
}

export function isBranchManager(user: User | null): boolean {
  return hasRole(user, ['branch_manager']);
}

export function isBorrower(user: User | null): boolean {
  return hasRole(user, ['borrower']);
}

export function isInternalRole(user: User | null): boolean {
  return hasRole(user, ['admin', 'branch_manager', 'loan_officer_retail', 'loan_officer_tpo']);
}

export function isExternalRole(user: User | null): boolean {
  return hasRole(user, ['broker', 'realtor', 'borrower']);
}
```

### Conditional Rendering Based on Role

```typescript
// components/RoleGuard.tsx
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { hasRole } from '@/lib/permissions';

interface RoleGuardProps {
  children: React.ReactNode;
  requiredRoles: string[];
  fallback?: React.ReactNode;
}

export function RoleGuard({
  children,
  requiredRoles,
  fallback = null
}: RoleGuardProps) {
  const { user } = useAuth();

  if (hasRole(user, requiredRoles)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

// Usage:
export function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>

      {/* Only show admin panel to admins */}
      <RoleGuard requiredRoles={['admin']}>
        <AdminPanel />
      </RoleGuard>

      {/* Only show loan officer metrics to loan officers */}
      <RoleGuard requiredRoles={['loan_officer_retail', 'loan_officer_tpo']}>
        <LoanOfficerMetrics />
      </RoleGuard>

      {/* Branch performance for management */}
      <RoleGuard requiredRoles={['admin', 'branch_manager']}>
        <BranchPerformance />
      </RoleGuard>
    </div>
  );
}
```

## 3. Capability-Based Access Control (CBAC)

### Check User Capabilities

```typescript
// lib/permissions.ts (continued)

// ── Capability checks ───────────────────────────────────────────────────────

export function hasCapability(user: User | null, capability: string): boolean {
  if (!user?.role?.capabilities) return false;
  return user.role.capabilities.some(cap => cap.name === capability);
}

export function hasCapabilities(user: User | null, capabilities: string[]): boolean {
  if (!user?.role?.capabilities) return false;
  return capabilities.every(cap =>
    user.role.capabilities.some(c => c.name === cap)
  );
}

export function hasAnyCapability(user: User | null, capabilities: string[]): boolean {
  if (!user?.role?.capabilities) return false;
  return capabilities.some(cap =>
    user.role.capabilities.some(c => c.name === cap)
  );
}

// ── Common permission checks ────────────────────────────────────────────────
// Organized by feature area to match the capability categories

export const permissions = {
  // Loan
  canReadLoan: (user: User | null) => hasAnyCapability(user, ['loan:read', 'loan:read:self', 'loan:read:shared']),
  canReadAllLoans: (user: User | null) => hasCapability(user, 'loan:read'),
  canReadOwnLoan: (user: User | null) => hasCapability(user, 'loan:read:self'),
  canCreateLoan: (user: User | null) => hasCapability(user, 'loan:create'),
  canUpdateLoan: (user: User | null) => hasCapability(user, 'loan:update'),

  // Documents
  canUploadDocument: (user: User | null) => hasCapability(user, 'document:upload'),
  canDownloadDocument: (user: User | null) => hasCapability(user, 'document:download'),

  // Rates
  canViewRates: (user: User | null) => hasCapability(user, 'rates:view'),
  canLockRates: (user: User | null) => hasCapability(user, 'rates:lock'),
  canManageAlerts: (user: User | null) => hasCapability(user, 'alerts:manage'),

  // Dashboard
  canViewDashboard: (user: User | null) => hasCapability(user, 'dashboard:view'),
  canViewBranchAnalytics: (user: User | null) => hasCapability(user, 'dashboard:branch'),

  // Users
  canManageUsers: (user: User | null) => hasCapability(user, 'users:manage'),
  canManageBranchUsers: (user: User | null) => hasCapability(user, 'users:manage:branch'),

  // Audit
  canReadAuditLogs: (user: User | null) => hasAnyCapability(user, ['audit:read', 'audit:view']),

  // CMS & Menus
  canManageCMS: (user: User | null) => hasCapability(user, 'cms:manage'),
  canManageMenus: (user: User | null) => hasCapability(user, 'menu:manage'),
  canManageFeatureFlags: (user: User | null) => hasCapability(user, 'featureflags:manage'),
  canBroadcastContent: (user: User | null) => hasCapability(user, 'content:broadcast'),

  // Credit
  canRequestCredit: (user: User | null) => hasCapability(user, 'credit:request'),
  canReadCredit: (user: User | null) => hasCapability(user, 'credit:read'),

  // Pre-Approval
  canGeneratePreapproval: (user: User | null) => hasCapability(user, 'preapproval:generate'),
  canSharePreapproval: (user: User | null) => hasCapability(user, 'preapproval:share'),

  // Communication
  canSendMessages: (user: User | null) => hasCapability(user, 'messages:send'),
  canSendSMS: (user: User | null) => hasCapability(user, 'sms:send'),
  canReadSMS: (user: User | null) => hasCapability(user, 'sms:read'),
  canUseChatbot: (user: User | null) => hasCapability(user, 'chatbot:use'),

  // POS
  canHandoffPOS: (user: User | null) => hasCapability(user, 'pos:handoff'),

  // Referral & Business Cards
  canManageReferrals: (user: User | null) => hasCapability(user, 'referral:manage'),
  canViewReferralAnalytics: (user: User | null) => hasCapability(user, 'referral:analytics'),
  canManageBusinessCard: (user: User | null) => hasCapability(user, 'businesscard:manage'),

  // Consent
  canManageConsent: (user: User | null) => hasCapability(user, 'consent:manage'),
  canGrantConsent: (user: User | null) => hasCapability(user, 'consent:grant'),

  // Calculator
  canUseCalculator: (user: User | null) => hasCapability(user, 'calculator:use'),

  // CRM
  canManageCRM: (user: User | null) => hasCapability(user, 'crm:manage'),

  // Tenant & Billing
  canManageTenant: (user: User | null) => hasCapability(user, 'tenant:manage'),
  canManageBilling: (user: User | null) => hasCapability(user, 'billing:manage'),
};
```

### Conditional Rendering Based on Capability

```typescript
// components/CapabilityGuard.tsx
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { hasCapability } from '@/lib/permissions';

interface CapabilityGuardProps {
  children: React.ReactNode;
  capability: string | string[];
  requireAll?: boolean; // true = all capabilities required, false = any capability
  fallback?: React.ReactNode;
}

export function CapabilityGuard({
  children,
  capability,
  requireAll = false,
  fallback = null
}: CapabilityGuardProps) {
  const { user } = useAuth();

  const capabilities = Array.isArray(capability) ? capability : [capability];

  let hasAccess: boolean;
  if (requireAll) {
    hasAccess = capabilities.every(cap => hasCapability(user, cap));
  } else {
    hasAccess = capabilities.some(cap => hasCapability(user, cap));
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

// Usage:
export function LoanManagement() {
  return (
    <div>
      {/* Show loan creation form if user can create loans */}
      <CapabilityGuard capability="loan:create">
        <CreateLoanForm />
      </CapabilityGuard>

      {/* Show rate lock panel if user can lock rates */}
      <CapabilityGuard capability="rates:lock">
        <RateLockPanel />
      </CapabilityGuard>

      {/* Show pre-approval generator if user can generate AND share */}
      <CapabilityGuard capability={['preapproval:generate', 'preapproval:share']} requireAll>
        <PreApprovalGenerator />
      </CapabilityGuard>

      {/* Show CMS admin panel */}
      <CapabilityGuard capability="cms:manage">
        <CMSAdminPanel />
      </CapabilityGuard>

      {/* Show chatbot for anyone with access */}
      <CapabilityGuard capability="chatbot:use">
        <ChatbotWidget />
      </CapabilityGuard>
    </div>
  );
}
```

## 4. Protected Routes

### Route Protection with Middleware

```typescript
// middleware.ts (Next.js 13+)
import { NextRequest, NextResponse } from 'next/server';

const publicRoutes = ['/login', '/signup', '/forgot-password'];

export function middleware(request: NextRequest) {
  const token = request.cookies.get('authToken')?.value;
  const pathname = request.nextUrl.pathname;

  // Allow public routes without token
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // Redirect to login if no token
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
```

### Role-Protected Page Component

```typescript
// app/admin/page.tsx
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user?.role?.slug !== 'admin') {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (user?.role?.slug !== 'admin') {
    return <div>Access Denied</div>;
  }

  return (
    <div>
      <h1>Admin Dashboard</h1>
      {/* Admin content */}
    </div>
  );
}
```

## 5. API Calls with Authentication

### API Client Utility

```typescript
// lib/api-client.ts
import { useAuth } from '@/contexts/AuthContext';

// Custom error for tier-gated features
export class UpgradeRequiredError extends Error {
  requiredTier: string;
  upgradeUrl: string;

  constructor(requiredTier: string, upgradeUrl: string) {
    super(`This feature requires a ${requiredTier} plan or higher.`);
    this.name = 'UpgradeRequiredError';
    this.requiredTier = requiredTier;
    this.upgradeUrl = upgradeUrl;
  }
}

export function useApiClient() {
  const { token, logout } = useAuth();

  const apiCall = async <T,>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> => {
    const headers = new Headers(options.headers);

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${url}`, {
      ...options,
      headers,
    });

    // Handle token expiration
    if (response.status === 401) {
      logout();
      throw new Error('Session expired');
    }

    // Handle tier upgrade required
    if (response.status === 403) {
      const error = await response.json();
      if (error.error === 'Upgrade required') {
        throw new UpgradeRequiredError(error.requiredTier, error.upgradeUrl);
      }
      throw new Error(error.message || 'Forbidden');
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'API request failed');
    }

    return response.json();
  };

  return { apiCall };
}
```

## 6. User Info Display

```typescript
// components/UserProfile.tsx
'use client';

import { useAuth } from '@/contexts/AuthContext';

export function UserProfile() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="user-profile">
      <h3>{user.name}</h3>
      <p>Email: {user.email}</p>
      <p>Role: {user.role.name}</p>

      <div>
        <h4>Capabilities:</h4>
        <ul>
          {user.role.capabilities.map(cap => (
            <li key={cap._id}>
              {cap.name} ({cap.category})
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

## 7. Complete Example: Dashboard with Permissions

```typescript
// app/dashboard/page.tsx
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { RoleGuard } from '@/components/RoleGuard';
import { CapabilityGuard } from '@/components/CapabilityGuard';
import { permissions } from '@/lib/permissions';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h1>Dashboard</h1>

      {/* Show user info */}
      {user && (
        <div className="user-info">
          <p>Welcome, {user.name}!</p>
          <p>Role: {user.role.name}</p>
        </div>
      )}

      {/* Admin-only: CMS management, user management, audit logs */}
      <RoleGuard requiredRoles={['admin']}>
        <section>
          <h2>Admin Panel</h2>
        </section>
      </RoleGuard>

      {/* Branch analytics for management */}
      <CapabilityGuard capability="dashboard:branch">
        <section>
          <h2>Branch Performance</h2>
        </section>
      </CapabilityGuard>

      {/* Loan creation form based on capability */}
      <CapabilityGuard capability="loan:create">
        <section>
          <h2>Create New Loan</h2>
        </section>
      </CapabilityGuard>

      {/* Document upload if allowed */}
      <CapabilityGuard capability="document:upload">
        <section>
          <h2>Upload Documents</h2>
        </section>
      </CapabilityGuard>

      {/* Rate locking */}
      {permissions.canLockRates(user) && (
        <section>
          <h2>Lock Rates</h2>
        </section>
      )}

      {/* Pre-approval letters */}
      <CapabilityGuard capability="preapproval:generate">
        <section>
          <h2>Pre-Approval Letters</h2>
        </section>
      </CapabilityGuard>

      {/* AI Chatbot (available to all authenticated users) */}
      <CapabilityGuard capability="chatbot:use">
        <ChatbotWidget />
      </CapabilityGuard>

      {/* Credit reports */}
      <CapabilityGuard capability="credit:request">
        <section>
          <h2>Request Credit Report</h2>
        </section>
      </CapabilityGuard>

      {/* Tenant & billing (admin only) */}
      <CapabilityGuard capability="tenant:manage">
        <section>
          <h2>Organization Settings</h2>
        </section>
      </CapabilityGuard>
    </div>
  );
}
```

## 8. Type Definitions

```typescript
// types/auth.ts
export type CapabilityCategory =
  | 'loan' | 'document' | 'rates' | 'alerts' | 'messages' | 'dashboard'
  | 'webhooks' | 'users' | 'audit' | 'cms' | 'credit' | 'preapproval'
  | 'sms' | 'chatbot' | 'pos' | 'referral' | 'businesscard' | 'consent'
  | 'calculator' | 'notification' | 'crm' | 'integration' | 'tenant'
  | 'billing' | 'log' | 'other';

export type RoleSlug =
  | 'admin'
  | 'branch_manager'
  | 'loan_officer_retail'
  | 'loan_officer_tpo'
  | 'broker'
  | 'realtor'
  | 'borrower';

export interface Capability {
  _id: string;
  name: string;
  slug: string;
  description: string;
  category: CapabilityCategory;
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  _id: string;
  name: string;
  slug: RoleSlug;
  capabilities: Capability[];
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: User;
}
```

## 9. Testing Permissions

```typescript
// __tests__/permissions.test.ts
import { hasCapability, hasRole, permissions } from '@/lib/permissions';
import { User } from '@/types/auth';

const mockAdminUser: User = {
  _id: '1',
  name: 'Admin User',
  email: 'admin@test.com',
  role: {
    _id: 'role-1',
    name: 'admin',
    slug: 'admin',
    capabilities: [
      { _id: '1', name: 'users:manage', slug: 'users-manage', description: 'Manage all users', category: 'users', createdAt: '', updatedAt: '' },
      { _id: '2', name: 'dashboard:view', slug: 'dashboard-view', description: 'View dashboard', category: 'dashboard', createdAt: '', updatedAt: '' },
      { _id: '3', name: 'cms:manage', slug: 'cms-manage', description: 'Manage CMS', category: 'cms', createdAt: '', updatedAt: '' },
      { _id: '4', name: 'tenant:manage', slug: 'tenant-manage', description: 'Manage tenant', category: 'tenant', createdAt: '', updatedAt: '' },
      { _id: '5', name: 'billing:manage', slug: 'billing-manage', description: 'Manage billing', category: 'billing', createdAt: '', updatedAt: '' },
      { _id: '6', name: 'chatbot:use', slug: 'chatbot-use', description: 'Use chatbot', category: 'chatbot', createdAt: '', updatedAt: '' },
    ],
    createdAt: '',
    updatedAt: '',
  },
  emailVerified: true,
  isActive: true,
  createdAt: '',
  updatedAt: '',
};

const mockBorrowerUser: User = {
  _id: '2',
  name: 'Borrower User',
  email: 'borrower@test.com',
  role: {
    _id: 'role-2',
    name: 'borrower',
    slug: 'borrower',
    capabilities: [
      { _id: '10', name: 'loan:read:self', slug: 'loan-read-self', description: 'Read own loans', category: 'loan', createdAt: '', updatedAt: '' },
      { _id: '11', name: 'chatbot:use', slug: 'chatbot-use', description: 'Use chatbot', category: 'chatbot', createdAt: '', updatedAt: '' },
      { _id: '12', name: 'calculator:use', slug: 'calculator-use', description: 'Use calculators', category: 'calculator', createdAt: '', updatedAt: '' },
      { _id: '13', name: 'consent:grant', slug: 'consent-grant', description: 'Grant consent', category: 'consent', createdAt: '', updatedAt: '' },
    ],
    createdAt: '',
    updatedAt: '',
  },
  emailVerified: true,
  isActive: true,
  createdAt: '',
  updatedAt: '',
};

describe('Role checks', () => {
  test('hasRole returns true for matching role', () => {
    expect(hasRole(mockAdminUser, ['admin'])).toBe(true);
  });

  test('hasRole returns false for non-matching role', () => {
    expect(hasRole(mockBorrowerUser, ['admin'])).toBe(false);
  });
});

describe('Capability checks', () => {
  test('hasCapability returns true for existing capability', () => {
    expect(hasCapability(mockAdminUser, 'users:manage')).toBe(true);
  });

  test('hasCapability returns false for missing capability', () => {
    expect(hasCapability(mockBorrowerUser, 'users:manage')).toBe(false);
  });
});

describe('Permission helpers', () => {
  test('admin can manage users', () => {
    expect(permissions.canManageUsers(mockAdminUser)).toBe(true);
  });

  test('borrower cannot manage users', () => {
    expect(permissions.canManageUsers(mockBorrowerUser)).toBe(false);
  });

  test('admin can manage CMS', () => {
    expect(permissions.canManageCMS(mockAdminUser)).toBe(true);
  });

  test('borrower cannot manage CMS', () => {
    expect(permissions.canManageCMS(mockBorrowerUser)).toBe(false);
  });

  test('both admin and borrower can use chatbot', () => {
    expect(permissions.canUseChatbot(mockAdminUser)).toBe(true);
    expect(permissions.canUseChatbot(mockBorrowerUser)).toBe(true);
  });

  test('admin can manage tenant and billing', () => {
    expect(permissions.canManageTenant(mockAdminUser)).toBe(true);
    expect(permissions.canManageBilling(mockAdminUser)).toBe(true);
  });

  test('borrower cannot manage tenant or billing', () => {
    expect(permissions.canManageTenant(mockBorrowerUser)).toBe(false);
    expect(permissions.canManageBilling(mockBorrowerUser)).toBe(false);
  });

  test('borrower can grant consent but not manage consent', () => {
    expect(permissions.canGrantConsent(mockBorrowerUser)).toBe(true);
    expect(permissions.canManageConsent(mockBorrowerUser)).toBe(false);
  });
});
```

## Summary

**Key Points:**
1. Store JWT token in localStorage/cookies
2. Fetch user with populated role & capabilities on login
3. Use Context/Provider for global auth state
4. Use role helper functions (`hasRole`, `isAdmin`, `isLoanOfficer`, `isInternalRole`)
5. Use capability helper functions (`hasCapability`, `permissions.*`)
6. Use Guard components (`RoleGuard`, `CapabilityGuard`) for conditional rendering
7. Protect routes with middleware & page-level checks
8. Include Authorization header on API calls
9. Handle token expiration and tier-gate 403 responses
10. Type everything with TypeScript (`RoleSlug`, `CapabilityCategory`, etc.)

**Changes from previous version:**
- Role slugs now use underscores (e.g. `loan_officer_retail` not `loan-officer-retail`) — matches `src/config/roles.js`
- 36 capabilities (up from 16) covering all platform features
- New capability categories: `cms`, `credit`, `preapproval`, `sms`, `chatbot`, `pos`, `referral`, `businesscard`, `consent`, `calculator`, `crm`, `tenant`, `billing`
- New permissions helpers for CMS, credit, pre-approval, SMS, chatbot, POS, referrals, consent, calculator, CRM, tenant, and billing
- `UpgradeRequiredError` for handling tier-gated feature responses
- Role group support (`STAFF_ROLES`, `INTERNAL_ROLES`, `EXTERNAL_ROLES`, etc.)
