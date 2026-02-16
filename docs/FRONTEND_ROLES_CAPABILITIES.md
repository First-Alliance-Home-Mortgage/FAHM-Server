# Frontend Implementation: Roles & Capabilities (Next.js)

This guide explains how to implement role-based and capability-based authorization on your Next.js frontend.

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

export function hasRole(user: User | null, roles: string[]): boolean {
  if (!user?.role) return false;
  return roles.includes(user.role.name);
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
    </div>
  );
}
```

## 3. Capability-Based Access Control (CBAC)

### Check User Capabilities

```typescript
// lib/permissions.ts
import { User } from '@/types/auth';

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

// Common capability checks
export const permissions = {
  canViewDashboard: (user: User | null) => hasCapability(user, 'dashboard:view'),
  canManageUsers: (user: User | null) => hasCapability(user, 'users:manage'),
  canManageBranchUsers: (user: User | null) => hasCapability(user, 'users:manage:branch'),
  canCreateLoan: (user: User | null) => hasCapability(user, 'loan:create'),
  canUpdateLoan: (user: User | null) => hasCapability(user, 'loan:update'),
  canReadLoan: (user: User | null) => hasCapability(user, 'loan:read'),
  canReadOwnLoan: (user: User | null) => hasCapability(user, 'loan:read:self'),
  canUploadDocument: (user: User | null) => hasCapability(user, 'document:upload'),
  canDownloadDocument: (user: User | null) => hasCapability(user, 'document:download'),
  canLockRates: (user: User | null) => hasCapability(user, 'rates:lock'),
  canViewRates: (user: User | null) => hasCapability(user, 'rates:view'),
  canManageAlerts: (user: User | null) => hasCapability(user, 'alerts:manage'),
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
export function LoanForm() {
  const { user } = useAuth();
  
  return (
    <form>
      <input type="text" placeholder="Loan amount" />
      
      {/* Only show submit button if user can create loans */}
      <CapabilityGuard capability="loan:create">
        <button type="submit">Create Loan</button>
      </CapabilityGuard>
      
      {/* Show read-only message if user can only read */}
      <CapabilityGuard 
        capability="loan:create" 
        fallback={<p>You don't have permission to create loans</p>}
      >
        <button type="submit">Create Loan</button>
      </CapabilityGuard>
    </form>
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
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
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
    if (!isLoading && user?.role?.name !== 'admin') {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (user?.role?.name !== 'admin') {
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

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'API request failed');
    }

    return response.json();
  };

  return { apiCall };
}

// Usage in component:
export function UserList() {
  const { apiCall } = useApiClient();
  const [users, setUsers] = useState([]);

  useEffect(() => {
    apiCall<any>('/api/v1/users', {
      method: 'GET'
    })
      .then(data => setUsers(data.users))
      .catch(err => console.error(err));
  }, []);

  return (
    <ul>
      {users.map(user => (
        <li key={user._id}>{user.name}</li>
      ))}
    </ul>
  );
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

      {/* Show metrics based on role */}
      <RoleGuard requiredRoles={['admin']}>
        <section>
          <h2>Admin Metrics</h2>
          {/* Admin-only content */}
        </section>
      </RoleGuard>

      {/* Show loan creation form based on capability */}
      <CapabilityGuard capability="loan:create">
        <section>
          <h2>Create New Loan</h2>
          {/* Loan form */}
        </section>
      </CapabilityGuard>

      {/* Show document upload if allowed */}
      <CapabilityGuard capability="document:upload">
        <section>
          <h2>Upload Documents</h2>
          {/* Document upload */}
        </section>
      </CapabilityGuard>

      {/* Show rates locking if allowed */}
      {permissions.canLockRates(user) && (
        <section>
          <h2>Lock Rates</h2>
          {/* Rate locking UI */}
        </section>
      )}
    </div>
  );
}
```

## 8. Type Definitions

```typescript
// types/auth.ts
export interface Capability {
  _id: string;
  name: string;
  slug: string;
  category: 'loan' | 'document' | 'rates' | 'alerts' | 'messages' | 'dashboard' | 'webhooks' | 'users' | 'audit' | 'other';
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  _id: string;
  name: string;
  slug: string;
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
  role: Role;
  emailVerified: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
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
      { _id: '1', name: 'users:manage', slug: 'users-manage', category: 'users', createdAt: '', updatedAt: '' },
      { _id: '2', name: 'dashboard:view', slug: 'dashboard-view', category: 'dashboard', createdAt: '', updatedAt: '' },
    ],
    createdAt: '',
    updatedAt: '',
  },
  emailVerified: true,
  isActive: true,
  createdAt: '',
  updatedAt: '',
};

describe('permissions', () => {
  test('hasRole returns true for matching role', () => {
    expect(hasRole(mockAdminUser, ['admin'])).toBe(true);
  });

  test('hasCapability returns true for existing capability', () => {
    expect(hasCapability(mockAdminUser, 'users:manage')).toBe(true);
  });

  test('permissions.canManageUsers works correctly', () => {
    expect(permissions.canManageUsers(mockAdminUser)).toBe(true);
  });
});
```

## Summary

**Key Points:**
1. ✅ Store JWT token in localStorage/cookies
2. ✅ Fetch user with populated role & capabilities on login
3. ✅ Use Context/Provider for global auth state
4. ✅ Create helper functions for role/capability checks
5. ✅ Use Guard components for conditional rendering
6. ✅ Protect routes with middleware & page-level checks
7. ✅ Include Authorization header on API calls
8. ✅ Handle token expiration by logging out
9. ✅ Type everything with TypeScript

This implementation gives you both **role-based** (admin, borrower, etc.) and **capability-based** (users:manage, loan:create, etc.) access control on your frontend!
