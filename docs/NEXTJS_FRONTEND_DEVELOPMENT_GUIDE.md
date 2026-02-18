# FAHM Next.js Frontend Development Guide

> Complete guide for building the First Alliance Home Mortgage frontend application using Next.js (App Router).

## Table of Contents

1. [Project Setup](#1-project-setup)
2. [Architecture Overview](#2-architecture-overview)
3. [Environment Configuration](#3-environment-configuration)
4. [Authentication System](#4-authentication-system)
5. [API Client Layer](#5-api-client-layer)
6. [Role-Based Access Control (RBAC)](#6-role-based-access-control-rbac)
7. [Dynamic Menu & Navigation](#7-dynamic-menu--navigation)
8. [WebSocket Real-Time Updates](#8-websocket-real-time-updates)
9. [CMS Integration](#9-cms-integration)
10. [Feature Modules](#10-feature-modules)
11. [File Uploads](#11-file-uploads)
12. [State Management](#12-state-management)
13. [Error Handling](#13-error-handling)
14. [Testing Strategy](#14-testing-strategy)
15. [Deployment](#15-deployment)

---

## 1. Project Setup

### Initialize Next.js Project

```bash
npx create-next-app@latest fahm-web --typescript --tailwind --eslint --app --src-dir
cd fahm-web
```

### Install Dependencies

```bash
# Core
npm install axios zustand @tanstack/react-query zod

# UI
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-toast
npm install lucide-react class-variance-authority clsx tailwind-merge

# Forms
npm install react-hook-form @hookform/resolvers

# Date handling
npm install date-fns

# Charts (for dashboard)
npm install recharts

# PDF viewing
npm install @react-pdf-viewer/core @react-pdf-viewer/default-layout

# WebSocket
npm install ws
npm install -D @types/ws
```

### Recommended Project Structure

```
fahm-web/
├── src/
│   ├── app/                        # Next.js App Router pages
│   │   ├── (auth)/                 # Auth group (login, register)
│   │   │   ├── login/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/            # Authenticated layout group
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── loans/
│   │   │   │   ├── page.tsx        # Loan list
│   │   │   │   ├── [id]/page.tsx   # Loan detail
│   │   │   │   └── new/page.tsx    # Create loan
│   │   │   ├── documents/page.tsx
│   │   │   ├── rates/page.tsx
│   │   │   ├── messages/page.tsx
│   │   │   ├── business-card/page.tsx
│   │   │   ├── credit/page.tsx
│   │   │   ├── referrals/page.tsx
│   │   │   ├── chatbot/page.tsx
│   │   │   ├── settings/page.tsx
│   │   │   └── layout.tsx          # Dashboard shell (sidebar + nav)
│   │   ├── admin/                  # Admin-only pages
│   │   │   ├── users/page.tsx
│   │   │   ├── roles/page.tsx
│   │   │   ├── menus/page.tsx
│   │   │   ├── cms/page.tsx
│   │   │   ├── audit-logs/page.tsx
│   │   │   └── layout.tsx
│   │   ├── public/                 # Public pages (no auth)
│   │   │   └── business-card/[slug]/page.tsx
│   │   ├── layout.tsx              # Root layout
│   │   └── page.tsx                # Landing / redirect
│   ├── components/
│   │   ├── ui/                     # Reusable UI primitives
│   │   ├── forms/                  # Form components
│   │   ├── guards/                 # Auth & permission guards
│   │   │   ├── AuthGuard.tsx
│   │   │   ├── RoleGuard.tsx
│   │   │   └── CapabilityGuard.tsx
│   │   ├── layout/                 # Layout components
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── DynamicNav.tsx
│   │   └── modules/                # Feature-specific components
│   │       ├── loans/
│   │       ├── documents/
│   │       ├── rates/
│   │       ├── messages/
│   │       ├── dashboard/
│   │       ├── credit/
│   │       ├── chatbot/
│   │       └── business-card/
│   ├── hooks/                      # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useWebSocket.ts
│   │   ├── usePermissions.ts
│   │   └── useMenus.ts
│   ├── lib/                        # Utilities and core logic
│   │   ├── api-client.ts           # Axios instance with interceptors
│   │   ├── auth.ts                 # Auth helpers
│   │   ├── permissions.ts          # RBAC/CBAC helpers
│   │   ├── websocket.ts            # WebSocket client
│   │   └── utils.ts                # General utilities
│   ├── services/                   # API service modules
│   │   ├── auth.service.ts
│   │   ├── user.service.ts
│   │   ├── loan.service.ts
│   │   ├── document.service.ts
│   │   ├── rate.service.ts
│   │   ├── message.service.ts
│   │   ├── menu.service.ts
│   │   ├── cms.service.ts
│   │   ├── credit.service.ts
│   │   ├── dashboard.service.ts
│   │   ├── business-card.service.ts
│   │   ├── chatbot.service.ts
│   │   ├── sms.service.ts
│   │   ├── crm.service.ts
│   │   ├── consent.service.ts
│   │   ├── referral.service.ts
│   │   ├── preapproval.service.ts
│   │   ├── pos-link.service.ts
│   │   └── notification.service.ts
│   ├── stores/                     # Zustand stores
│   │   ├── auth.store.ts
│   │   ├── menu.store.ts
│   │   └── notification.store.ts
│   ├── types/                      # TypeScript type definitions
│   │   ├── auth.types.ts
│   │   ├── user.types.ts
│   │   ├── loan.types.ts
│   │   ├── document.types.ts
│   │   ├── rate.types.ts
│   │   ├── menu.types.ts
│   │   ├── cms.types.ts
│   │   ├── credit.types.ts
│   │   ├── message.types.ts
│   │   ├── dashboard.types.ts
│   │   ├── business-card.types.ts
│   │   ├── chatbot.types.ts
│   │   └── api.types.ts
│   └── config/
│       ├── routes.ts               # Route constants
│       └── constants.ts            # App constants
├── public/
├── .env.local
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js App (Frontend)                │
│                                                         │
│  ┌─────────┐   ┌──────────┐   ┌───────────────────┐   │
│  │  Pages   │──▶│  Hooks   │──▶│  Services (API)   │   │
│  │  (App    │   │  & Stores│   │  via Axios Client  │   │
│  │  Router) │   └──────────┘   └─────────┬─────────┘   │
│  └─────────┘                             │              │
│       │                                  │              │
│  ┌─────────┐   ┌──────────────┐         │              │
│  │  Guards  │   │  WebSocket   │         │              │
│  │  (RBAC)  │   │  Client      │         │              │
│  └─────────┘   └──────┬───────┘         │              │
│                        │                 │              │
└────────────────────────┼─────────────────┼──────────────┘
                         │                 │
                    WebSocket          REST API
                    (wss://)          (https://)
                         │                 │
                         ▼                 ▼
               ┌─────────────────────────────────┐
               │     FAHM-Server (Backend)        │
               │     Express + MongoDB            │
               │     Base: /api/v1                │
               └─────────────────────────────────┘
```

### Key Patterns

- **App Router** with route groups for auth/dashboard/admin layouts
- **Server Components** for data fetching where possible, **Client Components** for interactivity
- **React Query** (`@tanstack/react-query`) for server state (caching, refetching, optimistic updates)
- **Zustand** for client state (auth, UI, menus)
- **Axios** with interceptors for JWT injection and token refresh
- **WebSocket** for real-time menu/screen/content updates

---

## 3. Environment Configuration

Create `.env.local` in the Next.js project root:

```env
# Backend API
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000

# App
NEXT_PUBLIC_APP_NAME=FAHM Portal
NEXT_PUBLIC_APP_VERSION=1.0.0
```

> **Note:** Only `NEXT_PUBLIC_` prefixed variables are exposed to the browser. Never put secrets in `NEXT_PUBLIC_` vars.

---

## 4. Authentication System

### 4.1 Auth Types

```typescript
// types/auth.types.ts

export interface Capability {
  _id: string;
  name: string;
  slug: string;
  category: 'loan' | 'document' | 'rates' | 'alerts' | 'messages'
           | 'dashboard' | 'webhooks' | 'users' | 'audit' | 'log' | 'other';
}

export interface Role {
  _id: string;
  name: string;
  slug: string;
  capabilities: Capability[];
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

export interface LoginRequest {
  email: string;
  password: string;
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

### 4.2 Auth Store (Zustand)

```typescript
// stores/auth.store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types/auth.types';

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string, refreshToken: string) => void;
  setToken: (token: string, refreshToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, token, refreshToken) =>
        set({ user, token, refreshToken, isAuthenticated: true }),

      setToken: (token, refreshToken) =>
        set({ token, refreshToken }),

      logout: () =>
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false }),
    }),
    {
      name: 'fahm-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
```

### 4.3 Auth Service

```typescript
// services/auth.service.ts
import { apiClient } from '@/lib/api-client';
import type { LoginRequest, AuthResponse, RefreshResponse } from '@/types/auth.types';

export const authService = {
  login: (data: LoginRequest) =>
    apiClient.post<AuthResponse>('/auth/login', data),

  refresh: (refreshToken: string) =>
    apiClient.post<RefreshResponse>('/auth/refresh', { refreshToken }),

  logout: (refreshToken: string) =>
    apiClient.post('/auth/logout', { refreshToken }),

  register: (data: { name: string; email: string; password: string; role: string }) =>
    apiClient.post<AuthResponse>('/auth/register', data),
};
```

### 4.4 Login Page

```typescript
// app/(auth)/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/stores/auth.store';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      setError('');
      const { data: res } = await authService.login(data);
      setAuth(res.user, res.token, res.refreshToken);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-md space-y-4 p-8">
        <h1 className="text-2xl font-bold">Sign In</h1>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" {...register('email')} className="w-full border p-2 rounded" />
          {errors.email && <p className="text-red-500 text-sm">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="password">Password</label>
          <input id="password" type="password" {...register('password')} className="w-full border p-2 rounded" />
          {errors.password && <p className="text-red-500 text-sm">{errors.password.message}</p>}
        </div>

        <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white p-2 rounded">
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
```

### 4.5 Next.js Middleware (Route Protection)

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

const publicPaths = ['/login', '/register', '/forgot-password', '/public'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for auth token in cookie (set by client on login)
  const token = request.cookies.get('fahm-token')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|public).*)'],
};
```

---

## 5. API Client Layer

### 5.1 Axios Instance with Token Refresh

```typescript
// lib/api-client.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/auth.store';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const apiClient = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Request interceptor — inject JWT
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle 401 + token refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(apiClient(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = useAuthStore.getState().refreshToken;

      if (!refreshToken) {
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${API_BASE}/api/v1/auth/refresh`, { refreshToken });
        const { token: newToken, refreshToken: newRefreshToken } = data;

        useAuthStore.getState().setToken(newToken, newRefreshToken);
        processQueue(null, newToken);

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
```

### 5.2 React Query Provider

```typescript
// app/providers.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,       // 1 minute
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

### 5.3 Example Service with React Query

```typescript
// services/loan.service.ts
import { apiClient } from '@/lib/api-client';
import type { LoanApplication, CreateLoanRequest, PaginatedResponse } from '@/types/loan.types';

export const loanService = {
  list: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get<PaginatedResponse<LoanApplication>>('/loans', { params }),

  getById: (id: string) =>
    apiClient.get<LoanApplication>(`/loans/${id}`),

  create: (data: CreateLoanRequest) =>
    apiClient.post<LoanApplication>('/loans', data),

  updateStatus: (id: string, data: { status: string; milestones?: any[] }) =>
    apiClient.patch(`/loans/${id}/status`, data),
};

// hooks/useLoans.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loanService } from '@/services/loan.service';

export function useLoans(params?: { page?: number; limit?: number; status?: string }) {
  return useQuery({
    queryKey: ['loans', params],
    queryFn: () => loanService.list(params).then((r) => r.data),
  });
}

export function useLoan(id: string) {
  return useQuery({
    queryKey: ['loans', id],
    queryFn: () => loanService.getById(id).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: loanService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
    },
  });
}
```

---

## 6. Role-Based Access Control (RBAC)

### 6.1 Role Constants

```typescript
// config/constants.ts
export const ROLES = {
  ADMIN: 'admin',
  BRANCH_MANAGER: 'branch_manager',
  LOAN_OFFICER_RETAIL: 'loan_officer_retail',
  LOAN_OFFICER_TPO: 'loan_officer_tpo',
  BROKER: 'broker',
  REALTOR: 'realtor',
  BORROWER: 'borrower',
} as const;

export type RoleSlug = (typeof ROLES)[keyof typeof ROLES];

// Grouped role sets for common checks
export const ROLE_GROUPS = {
  LOAN_OFFICERS: [ROLES.LOAN_OFFICER_RETAIL, ROLES.LOAN_OFFICER_TPO],
  INTERNAL_STAFF: [ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.LOAN_OFFICER_RETAIL, ROLES.LOAN_OFFICER_TPO],
  EXTERNAL_PARTNERS: [ROLES.BROKER, ROLES.REALTOR],
  ALL_EXCEPT_BORROWER: [ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.LOAN_OFFICER_RETAIL, ROLES.LOAN_OFFICER_TPO, ROLES.BROKER, ROLES.REALTOR],
} as const;
```

### 6.2 Permission Helpers

```typescript
// lib/permissions.ts
import type { User } from '@/types/auth.types';

export function hasRole(user: User | null, roles: string | string[]): boolean {
  if (!user?.role?.slug) return false;
  const roleArray = Array.isArray(roles) ? roles : [roles];
  return roleArray.includes(user.role.slug);
}

export function hasCapability(user: User | null, capability: string): boolean {
  if (!user?.role?.capabilities) return false;
  return user.role.capabilities.some((c) => c.slug === capability);
}

export function hasAnyCapability(user: User | null, capabilities: string[]): boolean {
  if (!user?.role?.capabilities) return false;
  return capabilities.some((cap) => user.role.capabilities.some((c) => c.slug === cap));
}

export function hasAllCapabilities(user: User | null, capabilities: string[]): boolean {
  if (!user?.role?.capabilities) return false;
  return capabilities.every((cap) => user.role.capabilities.some((c) => c.slug === cap));
}
```

### 6.3 Guard Components

```typescript
// components/guards/RoleGuard.tsx
'use client';

import { useAuthStore } from '@/stores/auth.store';
import { hasRole } from '@/lib/permissions';

interface RoleGuardProps {
  children: React.ReactNode;
  roles: string | string[];
  fallback?: React.ReactNode;
}

export function RoleGuard({ children, roles, fallback = null }: RoleGuardProps) {
  const user = useAuthStore((s) => s.user);
  return hasRole(user, roles) ? <>{children}</> : <>{fallback}</>;
}

// components/guards/CapabilityGuard.tsx
'use client';

import { useAuthStore } from '@/stores/auth.store';
import { hasCapability, hasAnyCapability, hasAllCapabilities } from '@/lib/permissions';

interface CapabilityGuardProps {
  children: React.ReactNode;
  capability: string | string[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
}

export function CapabilityGuard({ children, capability, requireAll = false, fallback = null }: CapabilityGuardProps) {
  const user = useAuthStore((s) => s.user);

  const caps = Array.isArray(capability) ? capability : [capability];
  const allowed = requireAll ? hasAllCapabilities(user, caps) : hasAnyCapability(user, caps);

  return allowed ? <>{children}</> : <>{fallback}</>;
}
```

### 6.4 Role-to-Page Access Matrix

| Page / Feature | Admin | Branch Mgr | LO Retail | LO TPO | Broker | Realtor | Borrower |
|---|---|---|---|---|---|---|---|
| Dashboard | Full | Branch | Own KPIs | Own KPIs | - | - | Own |
| Loan List | All | Branch | Assigned | Assigned | Own | - | Own |
| Create Loan | Yes | Yes | Yes | Yes | Yes | - | Yes |
| Update Loan Status | Yes | Yes | Yes | Yes | - | - | - |
| Document Upload | Yes | Yes | Yes | Yes | Yes | - | Yes |
| Credit Reports | Yes | - | Yes | Yes | - | - | - |
| Rate Lock | Yes | Yes | Yes | Yes | - | - | - |
| Rate Alerts | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Messages | All | Branch | Assigned | Assigned | Own | Own | Own |
| Business Card | Yes | Yes | Yes | Yes | - | - | - |
| Preapproval Letters | Yes | Yes | Yes | - | - | - | - |
| User Management | Full | Branch | - | - | - | - | - |
| Menu / CMS Management | Full | - | - | - | - | - | - |
| Roles / Capabilities | Full | - | - | - | - | - | - |
| Audit Logs | Yes | - | - | - | - | - | - |
| Referral Sources | Yes | Yes | Yes | Yes | - | - | - |
| SMS Messaging | Yes | Yes | Yes | Yes | - | - | - |
| Chatbot Management | Yes | Yes | - | - | - | - | - |
| Consent Management | Yes | - | Yes | Yes | Yes | Yes | Yes |

---

## 7. Dynamic Menu & Navigation

The backend provides a fully dynamic menu system. Menus are role-filtered and organized by type (`drawer`, `tab`, `stack`).

### 7.1 Menu Types

```typescript
// types/menu.types.ts
export interface Menu {
  _id: string;
  alias: string;
  label: string;
  icon: string;
  route: string;
  type: 'drawer' | 'tab' | 'stack';
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
```

### 7.2 Menu Service & Hook

```typescript
// services/menu.service.ts
import { apiClient } from '@/lib/api-client';
import type { Menu, GroupedMenus } from '@/types/menu.types';

export const menuService = {
  getAll: () => apiClient.get<Menu[]>('/menus'),
  getGrouped: () => apiClient.get<GroupedMenus>('/menus/grouped'),
  getByAlias: (alias: string) => apiClient.get<Menu>(`/menus/alias/${alias}`),
  getById: (id: string) => apiClient.get<Menu>(`/menus/${id}`),

  // Admin
  create: (data: Partial<Menu>) => apiClient.post<Menu>('/menus', data),
  update: (id: string, data: Partial<Menu>) => apiClient.put<Menu>(`/menus/${id}`, data),
  toggleVisibility: (id: string) => apiClient.patch(`/menus/${id}/visibility`),
  remove: (id: string) => apiClient.delete(`/menus/${id}`),
  reset: () => apiClient.post('/menus/reset'),
};

// hooks/useMenus.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { menuService } from '@/services/menu.service';
import { useAuthStore } from '@/stores/auth.store';

export function useGroupedMenus() {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: ['menus', 'grouped'],
    queryFn: () => menuService.getGrouped().then((r) => r.data),
    enabled: !!user,
  });
}

/**
 * Filters menus by the current user's role.
 * Menus with an empty roles[] array are visible to everyone.
 */
export function useFilteredMenus() {
  const user = useAuthStore((s) => s.user);
  const { data: grouped, ...rest } = useGroupedMenus();

  const filterByRole = (menus: Menu[]) => {
    if (!user) return [];
    return menus.filter(
      (m) => m.visible && (m.roles.length === 0 || m.roles.includes(user.role.slug))
    );
  };

  const filtered = grouped
    ? {
        drawer: filterByRole(grouped.drawer),
        tab: filterByRole(grouped.tab),
        stack: filterByRole(grouped.stack),
      }
    : null;

  return { data: filtered, ...rest };
}
```

### 7.3 Dynamic Sidebar Component

```typescript
// components/layout/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useFilteredMenus } from '@/hooks/useMenus';

// Map icon names from DB to your icon library (e.g., lucide-react)
import * as Icons from 'lucide-react';

function getIcon(iconName: string) {
  const Icon = (Icons as any)[iconName] || Icons.Circle;
  return <Icon className="w-5 h-5" />;
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: menus, isLoading } = useFilteredMenus();

  if (isLoading) return <nav className="w-64 p-4">Loading...</nav>;

  // Use drawer menus for sidebar navigation
  const sidebarItems = menus?.drawer || [];

  return (
    <nav className="w-64 bg-gray-900 text-white min-h-screen p-4">
      <div className="mb-8">
        <h2 className="text-xl font-bold">FAHM Portal</h2>
      </div>

      <ul className="space-y-1">
        {sidebarItems.map((menu) => {
          const isActive = pathname === menu.route;
          return (
            <li key={menu._id}>
              <Link
                href={menu.route}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-800'
                }`}
              >
                {getIcon(menu.icon)}
                <span>{menu.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

---

## 8. WebSocket Real-Time Updates

The server broadcasts events via WebSocket at `ws(s)://<host>/ws/content` when menus, screens, or content are modified by admins.

### 8.1 WebSocket Hook

```typescript
// hooks/useWebSocket.ts
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useQueryClient } from '@tanstack/react-query';

type WSEventType = 'menu_updated' | 'screen_updated' | 'content_updated';

interface WSEvent {
  type: WSEventType;
  timestamp: string;
  screenId?: string;
  alias?: string;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';
const RECONNECT_BASE_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

export function useWebSocket() {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeout = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    if (!token) return;

    const ws = new WebSocket(`${WS_URL}/ws/content?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected');
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data: WSEvent = JSON.parse(event.data);

        switch (data.type) {
          case 'menu_updated':
            // Invalidate menu queries to refetch from server
            queryClient.invalidateQueries({ queryKey: ['menus'] });
            break;

          case 'screen_updated':
            queryClient.invalidateQueries({ queryKey: ['screens'] });
            if (data.alias) {
              queryClient.invalidateQueries({ queryKey: ['screens', data.alias] });
            }
            break;

          case 'content_updated':
            queryClient.invalidateQueries({ queryKey: ['cms'] });
            break;
        }
      } catch (err) {
        console.error('[WS] Parse error:', err);
      }
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected');
      // Exponential backoff reconnect
      const delay = Math.min(
        RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts.current),
        MAX_RECONNECT_DELAY
      );
      reconnectTimeout.current = setTimeout(() => {
        reconnectAttempts.current++;
        connect();
      }, delay);
    };

    ws.onerror = (err) => {
      console.error('[WS] Error:', err);
      ws.close();
    };
  }, [token, queryClient]);

  useEffect(() => {
    connect();

    return () => {
      clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  }, [connect]);
}
```

### 8.2 Usage in Root Layout

```typescript
// app/(dashboard)/layout.tsx
'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { useWebSocket } from '@/hooks/useWebSocket';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Connect WebSocket — auto-refreshes menus/screens on changes
  useWebSocket();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

---

## 9. CMS Integration

### 9.1 CMS Types

```typescript
// types/cms.types.ts
export interface Screen {
  _id: string;
  slug: string;
  title: string;
  route: string;
  navigation: {
    type: 'drawer' | 'tab' | 'stack' | 'modal';
    icon: string;
    order: number;
  };
  roles: string[];
  components: ScreenComponent[];
  status: 'draft' | 'published';
  version: number;
}

export interface ScreenComponent {
  type: string;
  props: Record<string, any>;
}

export interface FeatureFlag {
  _id: string;
  key: string;
  enabled: boolean;
  roles: string[];
  min_app_version?: string;
}

export interface NavigationConfig {
  _id: string;
  type: 'drawer' | 'tab' | 'stack' | 'modal';
  role: string;
  items: { screen_slug: string; order: number }[];
}
```

### 9.2 CMS Service

```typescript
// services/cms.service.ts
import { apiClient } from '@/lib/api-client';
import type { Screen, FeatureFlag, NavigationConfig } from '@/types/cms.types';

export const cmsService = {
  // Screens
  getScreens: () => apiClient.get<Screen[]>('/cms/screens'),
  getScreen: (slug: string) => apiClient.get<Screen>(`/cms/screens/${slug}`),
  getDashboard: () => apiClient.get('/cms/screens/dashboard'),
  createScreen: (data: Partial<Screen>) => apiClient.post<Screen>('/cms/screens', data),
  updateScreen: (slug: string, data: Partial<Screen>) => apiClient.patch(`/cms/screens/${slug}`, data),
  publishScreen: (slug: string) => apiClient.post(`/cms/screens/${slug}/publish`),

  // Feature Flags
  getFeatureFlags: () => apiClient.get<FeatureFlag[]>('/cms/feature-flags'),
  upsertFeatureFlags: (flags: FeatureFlag[]) => apiClient.put('/cms/feature-flags', flags),
  toggleFeatureFlag: (key: string) => apiClient.patch(`/cms/feature-flags/${key}`),

  // Navigation
  getNavigationConfigs: () => apiClient.get<NavigationConfig[]>('/cms/navigation-configs'),
  upsertNavigationConfig: (config: NavigationConfig) => apiClient.put('/cms/navigation-configs', config),

  // Component Registry
  getComponentRegistry: () => apiClient.get('/cms/component-registry'),
};
```

### 9.3 Feature Flag Hook

```typescript
// hooks/useFeatureFlags.ts
import { useQuery } from '@tanstack/react-query';
import { cmsService } from '@/services/cms.service';
import { useAuthStore } from '@/stores/auth.store';

export function useFeatureFlags() {
  return useQuery({
    queryKey: ['feature-flags'],
    queryFn: () => cmsService.getFeatureFlags().then((r) => r.data),
  });
}

export function useFeatureFlag(key: string): boolean {
  const user = useAuthStore((s) => s.user);
  const { data: flags } = useFeatureFlags();

  if (!flags) return false;

  const flag = flags.find((f) => f.key === key);
  if (!flag || !flag.enabled) return false;

  // If flag has role restrictions, check user role
  if (flag.roles.length > 0 && user) {
    return flag.roles.includes(user.role.slug);
  }

  return true;
}
```

---

## 10. Feature Modules

### 10.1 Loans Module

```typescript
// types/loan.types.ts
export type LoanStatus = 'application' | 'processing' | 'underwriting' | 'closing' | 'funded';

export interface Milestone {
  name: string;
  status: 'pending' | 'in_progress' | 'completed';
  completedAt?: string;
}

export interface LoanApplication {
  _id: string;
  borrower: { _id: string; name: string; email: string };
  assignedOfficer: { _id: string; name: string; email: string };
  amount: number;
  propertyAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  status: LoanStatus;
  milestones: Milestone[];
  source: 'retail' | 'tpo';
  referralSource?: string;
  encompassLoanId?: string;
  posSystem?: 'blend' | 'big_pos';
  createdAt: string;
  updatedAt: string;
}

export interface CreateLoanRequest {
  borrower?: string;
  amount: number;
  propertyAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
}
```

### 10.2 Rates Module

```typescript
// services/rate.service.ts
import { apiClient } from '@/lib/api-client';

export const rateService = {
  getCurrent: () => apiClient.get('/rates/current'),
  getHistory: () => apiClient.get('/rates/history'),
  getProducts: () => apiClient.get('/rates/products'),

  // Rate Alerts
  createAlert: (data: any) => apiClient.post('/rates/alerts', data),
  getAlerts: () => apiClient.get('/rates/alerts'),
  updateAlert: (id: string, data: any) => apiClient.put(`/rates/alerts/${id}`, data),
  deleteAlert: (id: string) => apiClient.delete(`/rates/alerts/${id}`),

  // Rate Locks
  submitLock: (data: any) => apiClient.post('/rates/locks', data),
  getLocksForLoan: (loanId: string) => apiClient.get(`/rates/locks/loan/${loanId}`),
  extendLock: (lockId: string, data: any) => apiClient.post(`/rates/locks/${lockId}/extend`, data),
};
```

### 10.3 Documents Module

```typescript
// services/document.service.ts
import { apiClient } from '@/lib/api-client';

export type DocumentType =
  | 'paystub' | 'w2' | 'tax_return' | 'bank_statement'
  | 'id' | 'proof_of_employment' | 'appraisal'
  | 'purchase_agreement' | 'insurance' | 'credit_report' | 'other';

export const documentService = {
  upload: (files: File[], loanId: string, documentType: DocumentType) => {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    formData.append('loanId', loanId);
    formData.append('documentType', documentType);

    return apiClient.post('/document-uploads/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getForLoan: (loanId: string) =>
    apiClient.get(`/document-uploads/loan/${loanId}`),

  download: (id: string) =>
    apiClient.get(`/document-uploads/${id}/download`, { responseType: 'blob' }),

  remove: (id: string) =>
    apiClient.delete(`/document-uploads/${id}`),

  getPresignedUrl: (data: { fileName: string; mimeType: string; loanId: string }) =>
    apiClient.post('/document-uploads/presign', data),
};
```

### 10.4 Dashboard Module

```typescript
// services/dashboard.service.ts
import { apiClient } from '@/lib/api-client';

export const dashboardService = {
  getReports: () => apiClient.get('/dashboard/reports'),
  getEmbedConfig: (reportId: string) => apiClient.get(`/dashboard/reports/${reportId}/embed`),
  refreshDataset: (reportId: string) => apiClient.post(`/dashboard/reports/${reportId}/refresh`),
  getMetrics: () => apiClient.get('/dashboard/metrics'),
  getMyKPIs: () => apiClient.get('/dashboard/my-kpis'),
  getBranchPerformance: () => apiClient.get('/dashboard/branch-performance'),
  getRegionalPerformance: () => apiClient.get('/dashboard/regional-performance'),
  getLeaderboard: () => apiClient.get('/dashboard/leaderboard'),
};
```

### 10.5 Credit Reports Module

```typescript
// services/credit.service.ts
import { apiClient } from '@/lib/api-client';

export const creditService = {
  requestReport: (loanId: string, data: { reportType: 'tri_merge' | 'single_bureau' | 'soft_pull' }) =>
    apiClient.post(`/credit/loans/${loanId}/request`, data),

  getReport: (reportId: string) =>
    apiClient.get(`/credit/reports/${reportId}`),

  getReportsForLoan: (loanId: string) =>
    apiClient.get(`/credit/loans/${loanId}/reports`),

  reissueReport: (reportId: string) =>
    apiClient.post(`/credit/reports/${reportId}/reissue`),

  getLogs: () =>
    apiClient.get('/credit/logs'),
};
```

### 10.6 Business Card Module

```typescript
// services/business-card.service.ts
import { apiClient } from '@/lib/api-client';

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
  socialLinks: {
    linkedin?: string;
    facebook?: string;
    twitter?: string;
    instagram?: string;
  };
  branding: {
    primaryColor: string;
    secondaryColor: string;
    logo?: string;
    partnerLogo?: string;
    partnerName?: string;
  };
  qrCode: string;
  applyNowUrl: string;
  stats: { views: number; applies: number; shares: number };
  isActive: boolean;
  isPublic: boolean;
}

export const businessCardService = {
  createOrUpdate: (data: Partial<BusinessCard>) =>
    apiClient.post('/business-cards', data),

  getMyCard: () =>
    apiClient.get<BusinessCard>('/business-cards/me'),

  deleteMyCard: () =>
    apiClient.delete('/business-cards/me'),

  getAnalytics: () =>
    apiClient.get('/business-cards/me/analytics'),

  regenerateQR: () =>
    apiClient.post('/business-cards/me/regenerate-qr'),

  // Public (no auth required for slug lookup)
  getBySlug: (slug: string) =>
    apiClient.get<BusinessCard>(`/business-cards/slug/${slug}`),

  trackApply: (slug: string) =>
    apiClient.post(`/business-cards/slug/${slug}/apply`),

  trackShare: (slug: string) =>
    apiClient.post(`/business-cards/slug/${slug}/share`),

  // Admin
  listAll: (params?: { page?: number; limit?: number }) =>
    apiClient.get('/business-cards', { params }),
};
```

### 10.7 Chatbot Module

```typescript
// services/chatbot.service.ts
import { apiClient } from '@/lib/api-client';

export const chatbotService = {
  startSession: () =>
    apiClient.post('/chatbot/start'),

  sendMessage: (data: { sessionId: string; message: string }) =>
    apiClient.post('/chatbot/message', data),

  getSession: (sessionId: string) =>
    apiClient.get(`/chatbot/session/${sessionId}`),

  listSessions: () =>
    apiClient.get('/chatbot/sessions'),

  escalate: (sessionId: string) =>
    apiClient.post(`/chatbot/session/${sessionId}/escalate`),

  closeSession: (sessionId: string, data?: { rating?: number }) =>
    apiClient.post(`/chatbot/session/${sessionId}/close`, data),

  // Admin
  getStats: () => apiClient.get('/chatbot/stats'),
  getEscalated: () => apiClient.get('/chatbot/escalated'),
  resolve: (sessionId: string, data: any) =>
    apiClient.post(`/chatbot/session/${sessionId}/resolve`, data),
};
```

### 10.8 Preapproval Letters

```typescript
// services/preapproval.service.ts
import { apiClient } from '@/lib/api-client';

export const preapprovalService = {
  generate: (data: any) =>
    apiClient.post('/preapproval/generate', data),

  getForLoan: (loanId: string) =>
    apiClient.get(`/preapproval/loan/${loanId}`),

  getById: (id: string) =>
    apiClient.get(`/preapproval/${id}`),

  download: (id: string) =>
    apiClient.get(`/preapproval/${id}/download`, { responseType: 'blob' }),

  share: (id: string, data: { method: 'email' | 'sms' | 'link'; recipient?: string }) =>
    apiClient.post(`/preapproval/${id}/share`, data),

  regenerate: (id: string) =>
    apiClient.post(`/preapproval/${id}/regenerate`),

  remove: (id: string) =>
    apiClient.delete(`/preapproval/${id}`),
};
```

### 10.9 Messages & SMS

```typescript
// services/message.service.ts
import { apiClient } from '@/lib/api-client';

export const messageService = {
  getMyMessages: () => apiClient.get('/messages/my-messages'),
  getForLoan: (loanId: string) => apiClient.get(`/messages/loan/${loanId}`),
  getById: (id: string) => apiClient.get(`/messages/${id}`),
  create: (data: { loan: string; recipient: string; content: string; messageType?: string }) =>
    apiClient.post('/messages', data),
  markRead: (id: string) => apiClient.patch(`/messages/${id}/read`),
  remove: (id: string) => apiClient.delete(`/messages/${id}`),
};

// services/sms.service.ts
import { apiClient } from '@/lib/api-client';

export const smsService = {
  send: (data: { to: string; body: string; loanId?: string }) =>
    apiClient.post('/sms/send', data),
  getConversation: (phone: string) =>
    apiClient.get(`/sms/conversation/${phone}`),
  getForLoan: (loanId: string) =>
    apiClient.get(`/sms/loan/${loanId}`),
  getMyMessages: () =>
    apiClient.get('/sms/my-messages'),
  markRead: (messageId: string) =>
    apiClient.patch(`/sms/${messageId}/read`),
  getStats: () =>
    apiClient.get('/sms/stats'),
};
```

### 10.10 CRM Integration

```typescript
// services/crm.service.ts
import { apiClient } from '@/lib/api-client';

export const crmService = {
  syncContacts: () => apiClient.post('/crm/sync/contacts'),
  getContacts: () => apiClient.get('/crm/contacts'),
  getEngagement: (contactId: string) => apiClient.get(`/crm/contacts/${contactId}/engagement`),
  syncJourneys: () => apiClient.post('/crm/sync/journeys'),
  getJourneys: () => apiClient.get('/crm/journeys'),
  enrollInJourney: (contactId: string, journeyId: string) =>
    apiClient.post(`/crm/contacts/${contactId}/journeys/${journeyId}/enroll`),
  triggerMilestoneJourney: (loanId: string) =>
    apiClient.post(`/crm/loans/${loanId}/trigger-milestone-journey`),
  logActivity: (contactId: string, data: any) =>
    apiClient.post(`/crm/contacts/${contactId}/activities`, data),
  getActivities: (contactId: string) =>
    apiClient.get(`/crm/contacts/${contactId}/activities`),
  getSyncLogs: () => apiClient.get('/crm/sync/logs'),
};
```

### 10.11 Consent Management

```typescript
// services/consent.service.ts
import { apiClient } from '@/lib/api-client';

export const consentService = {
  requestConsent: (data: { borrower: string; dataTypes: string[]; purpose: string }) =>
    apiClient.post('/consent/request', data),
  grant: (id: string) => apiClient.post(`/consent/${id}/grant`),
  revoke: (id: string) => apiClient.post(`/consent/${id}/revoke`),
  getAll: () => apiClient.get('/consent'),
  getById: (id: string) => apiClient.get(`/consent/${id}`),
  checkAccess: (params: { borrowerId: string; dataType: string }) =>
    apiClient.get('/consent/check-access', { params }),
};
```

### 10.12 Referral Sources

```typescript
// services/referral.service.ts
import { apiClient } from '@/lib/api-client';

export const referralService = {
  create: (data: any) => apiClient.post('/referral-sources', data),
  list: (params?: any) => apiClient.get('/referral-sources', { params }),
  getById: (id: string) => apiClient.get(`/referral-sources/${id}`),
  update: (id: string, data: any) => apiClient.patch(`/referral-sources/${id}`, data),
  remove: (id: string) => apiClient.delete(`/referral-sources/${id}`),
  getAnalytics: (id: string, params?: { startDate?: string; endDate?: string }) =>
    apiClient.get(`/referral-sources/${id}/analytics`, { params }),
  getTopPerformers: () => apiClient.get('/referral-sources/top-performers'),
  getBranding: (id: string) => apiClient.get(`/referral-sources/${id}/branding`),
  updateBranding: (id: string, data: any) => apiClient.patch(`/referral-sources/${id}/branding`, data),
  track: (id: string, data: { type: 'lead' | 'application' | 'funded' }) =>
    apiClient.post(`/referral-sources/${id}/track`, data),
};
```

### 10.13 POS Link Module

```typescript
// services/pos-link.service.ts
import { apiClient } from '@/lib/api-client';

export const posLinkService = {
  generate: (data: { loanId: string; posSystem: 'blend' | 'big_pos' }) =>
    apiClient.post('/pos-link/generate', data),
  getSession: (sessionId: string) =>
    apiClient.get(`/pos-link/session/${sessionId}`),
  getAnalytics: (sessionId: string) =>
    apiClient.get(`/pos-link/analytics/${sessionId}`),
  getMySessions: () =>
    apiClient.get('/pos-link/my-sessions'),
  getLOSessions: () =>
    apiClient.get('/pos-link/lo-sessions'),
  cancel: (sessionId: string) =>
    apiClient.post(`/pos-link/cancel/${sessionId}`),
};
```

### 10.14 Encompass Integration

```typescript
// services/encompass.service.ts
import { apiClient } from '@/lib/api-client';

export const encompassService = {
  testConnection: () => apiClient.get('/encompass/test-connection'),
  syncLoan: (loanId: string) => apiClient.post(`/encompass/loans/${loanId}/sync`),
  getContacts: (loanId: string) => apiClient.get(`/encompass/loans/${loanId}/contacts`),
  getMessages: (loanId: string) => apiClient.get(`/encompass/loans/${loanId}/messages`),
  sendMessage: (loanId: string, data: any) => apiClient.post(`/encompass/loans/${loanId}/messages`, data),
  markRead: (loanId: string, messageId: string) =>
    apiClient.post(`/encompass/loans/${loanId}/messages/${messageId}/read`),
  getSyncHistory: (loanId: string) => apiClient.get(`/encompass/loans/${loanId}/sync-history`),
  linkLoan: (loanId: string, data: { encompassLoanId: string }) =>
    apiClient.post(`/encompass/loans/${loanId}/link`, data),
  unlinkLoan: (loanId: string) => apiClient.post(`/encompass/loans/${loanId}/unlink`),
  getDocuments: (loanId: string) => apiClient.get(`/encompass/loans/${loanId}/documents`),
  uploadDocument: (loanId: string, formData: FormData) =>
    apiClient.post(`/encompass/loans/${loanId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  downloadDocument: (loanId: string, attachmentId: string) =>
    apiClient.get(`/encompass/loans/${loanId}/documents/${attachmentId}/download`, { responseType: 'blob' }),
};
```

### 10.15 Notifications

```typescript
// services/notification.service.ts
import { apiClient } from '@/lib/api-client';

export interface Notification {
  _id: string;
  user: string;
  type: 'info' | 'status' | 'rate_alert' | 'message';
  title: string;
  body: string;
  read: boolean;
  data?: Record<string, any>;
  createdAt: string;
}

export const notificationService = {
  getAll: (params?: { page?: number; limit?: number; read?: boolean }) =>
    apiClient.get('/notifications', { params }),
  markRead: (id: string) => apiClient.patch(`/notifications/${id}/read`),
  markAllRead: () => apiClient.post('/notifications/read-all'),
};
```

### 10.16 Admin: User Management

```typescript
// services/user.service.ts
import { apiClient } from '@/lib/api-client';
import type { User } from '@/types/auth.types';

export const userService = {
  getMe: () => apiClient.get<User>('/users/me'),
  updateMe: (data: { name?: string; phone?: string; title?: string }) =>
    apiClient.patch('/users/me', data),
  uploadProfilePicture: (file: File) => {
    const formData = new FormData();
    formData.append('photo', file);
    return apiClient.post('/users/profile-picture', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Admin endpoints
  list: (params?: { page?: number; limit?: number; role?: string; active?: boolean; q?: string; sort?: string }) =>
    apiClient.get('/users', { params }),
  getById: (id: string) => apiClient.get<User>(`/users/${id}`),
  create: (data: any) => apiClient.post('/users', data),
  update: (id: string, data: any) => apiClient.patch(`/users/${id}`, data),
  remove: (id: string) => apiClient.delete(`/users/${id}`),
};
```

### 10.17 Admin: Roles & Capabilities

```typescript
// services/role.service.ts
import { apiClient } from '@/lib/api-client';

export const roleService = {
  list: () => apiClient.get('/roles'),
  create: (data: { name: string; slug: string; capabilities: string[] }) =>
    apiClient.post('/roles', data),
  update: (id: string, data: any) => apiClient.put(`/roles/${id}`, data),
  remove: (id: string) => apiClient.delete(`/roles/${id}`),
};

// services/capability.service.ts
import { apiClient } from '@/lib/api-client';

export const capabilityService = {
  list: () => apiClient.get('/capabilities'),
  getById: (id: string) => apiClient.get(`/capabilities/${id}`),
  create: (data: { name: string; slug: string; category: string; description?: string }) =>
    apiClient.post('/capabilities', data),
  update: (id: string, data: any) => apiClient.put(`/capabilities/${id}`, data),
  remove: (id: string) => apiClient.delete(`/capabilities/${id}`),
};
```

### 10.18 Admin: Audit Logs

```typescript
// services/audit.service.ts
import { apiClient } from '@/lib/api-client';

export const auditService = {
  getConsentLogs: (params?: any) => apiClient.get('/audit-logs/consent', { params }),
  getCRMLogs: (params?: any) => apiClient.get('/audit-logs/crm', { params }),
  getCreditLogs: (params?: any) => apiClient.get('/audit-logs/credit', { params }),
};
```

---

## 11. File Uploads

### 11.1 Upload Constraints

| Constraint | Value |
|---|---|
| Max file size | 10 MB per file |
| Max files per request | 5 |
| Allowed MIME types | `application/pdf`, `image/png`, `image/jpeg`, `image/jpg` |
| Storage backend | Azure Blob Storage |

### 11.2 File Upload Component

```typescript
// components/modules/documents/FileUploader.tsx
'use client';

import { useState, useCallback } from 'react';
import { documentService, DocumentType } from '@/services/document.service';

interface FileUploaderProps {
  loanId: string;
  documentType: DocumentType;
  onSuccess?: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;
const ACCEPTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];

export function FileUploader({ loanId, documentType, onSuccess }: FileUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const validate = (selected: File[]): string | null => {
    if (selected.length > MAX_FILES) return `Max ${MAX_FILES} files allowed`;
    for (const f of selected) {
      if (f.size > MAX_FILE_SIZE) return `${f.name} exceeds 10MB limit`;
      if (!ACCEPTED_TYPES.includes(f.type)) return `${f.name} has unsupported type`;
    }
    return null;
  };

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const err = validate(selected);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setFiles(selected);
  };

  const handleUpload = async () => {
    if (!files.length) return;
    setUploading(true);
    try {
      await documentService.upload(files, loanId, documentType);
      setFiles([]);
      onSuccess?.();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <input
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg"
        onChange={handleSelect}
      />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      {files.length > 0 && (
        <div>
          <p>{files.length} file(s) selected</p>
          <button onClick={handleUpload} disabled={uploading} className="bg-blue-600 text-white px-4 py-2 rounded">
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## 12. State Management

### 12.1 Strategy

| State Type | Solution | Examples |
|---|---|---|
| Server state | React Query | Loans, users, menus, messages, rates |
| Auth state | Zustand (persisted) | User, token, refresh token |
| UI state | Zustand or React state | Sidebar open, modals, theme |
| Real-time state | WebSocket + Query invalidation | Menu changes, screen updates |

### 12.2 React Query Key Conventions

```typescript
// Use consistent query key structure
const queryKeys = {
  loans: {
    all: ['loans'] as const,
    list: (params: any) => ['loans', params] as const,
    detail: (id: string) => ['loans', id] as const,
    documents: (id: string) => ['loans', id, 'documents'] as const,
  },
  menus: {
    all: ['menus'] as const,
    grouped: ['menus', 'grouped'] as const,
  },
  users: {
    all: ['users'] as const,
    me: ['users', 'me'] as const,
    detail: (id: string) => ['users', id] as const,
  },
  rates: {
    current: ['rates', 'current'] as const,
    history: ['rates', 'history'] as const,
    alerts: ['rates', 'alerts'] as const,
  },
  dashboard: {
    metrics: ['dashboard', 'metrics'] as const,
    kpis: ['dashboard', 'my-kpis'] as const,
    leaderboard: ['dashboard', 'leaderboard'] as const,
  },
};
```

---

## 13. Error Handling

### 13.1 API Error Types

```typescript
// types/api.types.ts
export interface ApiError {
  message: string;
  status: number;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

### 13.2 Global Error Boundary

```typescript
// components/ErrorBoundary.tsx
'use client';

import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error boundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="p-8 text-center">
            <h2 className="text-xl font-bold text-red-600">Something went wrong</h2>
            <p className="text-gray-600 mt-2">{this.state.error?.message}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded"
            >
              Try Again
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
```

### 13.3 HTTP Status Code Handling

| Status | Meaning | Frontend Action |
|---|---|---|
| 200 | Success | Process response |
| 201 | Created | Process + show success toast |
| 400 | Validation error | Show field-level errors |
| 401 | Unauthorized | Attempt token refresh, then redirect to login |
| 403 | Forbidden (inactive or no permission) | Show "Access Denied" page |
| 404 | Not found | Show "Not Found" UI |
| 429 | Rate limited | Show retry message with backoff |
| 500 | Server error | Show generic error message |

---

## 14. Testing Strategy

### 14.1 Testing Stack

```bash
npm install -D jest @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install -D msw          # Mock Service Worker for API mocking
npm install -D @playwright/test  # E2E testing
```

### 14.2 Unit Test Example

```typescript
// __tests__/lib/permissions.test.ts
import { hasRole, hasCapability } from '@/lib/permissions';
import type { User } from '@/types/auth.types';

const mockAdmin: User = {
  _id: '1',
  name: 'Admin',
  email: 'admin@fahm.com',
  role: {
    _id: 'r1',
    name: 'Admin',
    slug: 'admin',
    capabilities: [
      { _id: 'c1', name: 'users:manage', slug: 'users:manage', category: 'users' },
      { _id: 'c2', name: 'dashboard:view', slug: 'dashboard:view', category: 'dashboard' },
    ],
  },
  emailVerified: true,
  isActive: true,
  createdAt: '',
  updatedAt: '',
};

describe('permissions', () => {
  it('hasRole returns true for matching role slug', () => {
    expect(hasRole(mockAdmin, 'admin')).toBe(true);
    expect(hasRole(mockAdmin, 'borrower')).toBe(false);
  });

  it('hasCapability returns true for existing capability', () => {
    expect(hasCapability(mockAdmin, 'users:manage')).toBe(true);
    expect(hasCapability(mockAdmin, 'loan:create')).toBe(false);
  });

  it('returns false for null user', () => {
    expect(hasRole(null, 'admin')).toBe(false);
    expect(hasCapability(null, 'users:manage')).toBe(false);
  });
});
```

### 14.3 MSW API Mock Example

```typescript
// __tests__/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

const API = process.env.NEXT_PUBLIC_API_URL;

export const handlers = [
  http.post(`${API}/api/v1/auth/login`, async ({ request }) => {
    const body = await request.json();
    if (body.email === 'admin@fahm.com' && body.password === 'password') {
      return HttpResponse.json({
        token: 'mock-jwt-token',
        refreshToken: 'mock-refresh-token',
        user: {
          _id: '1',
          name: 'Admin',
          email: 'admin@fahm.com',
          role: { _id: 'r1', name: 'Admin', slug: 'admin', capabilities: [] },
        },
      });
    }
    return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 });
  }),

  http.get(`${API}/api/v1/loans`, () => {
    return HttpResponse.json({
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    });
  }),
];
```

---

## 15. Deployment

### 15.1 Next.js Configuration

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.blob.core.windows.net', // Azure Blob for profile photos & documents
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
```

### 15.2 Environment Variables by Deployment

| Variable | Development | Production |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | `https://api.fahm.com` |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:4000` | `wss://api.fahm.com` |
| `NEXT_PUBLIC_APP_NAME` | `FAHM Dev` | `FAHM Portal` |

### 15.3 Health Check

The backend exposes `GET /health` (no auth required). Use this for deployment health checks and monitoring.

---

## Appendix A: Backend API Quick Reference

| Module | Base Path | Key Endpoints |
|---|---|---|
| Auth | `/api/v1/auth` | POST `/login`, `/refresh`, `/logout`, `/register` |
| Users | `/api/v1/users` | GET `/me`, PATCH `/me`, GET `/`, POST `/`, PATCH `/:id` |
| Loans | `/api/v1/loans` | GET `/`, POST `/`, GET `/:id`, PATCH `/:id/status` |
| Documents | `/api/v1/document-uploads` | POST `/upload`, GET `/loan/:loanId`, GET `/:id/download` |
| Rates | `/api/v1/rates` | GET `/current`, `/history`, `/products`, POST `/alerts`, `/locks` |
| Dashboard | `/api/v1/dashboard` | GET `/metrics`, `/my-kpis`, `/leaderboard`, `/reports` |
| Credit | `/api/v1/credit` | POST `/loans/:id/request`, GET `/reports/:id`, `/loans/:id/reports` |
| Menus | `/api/v1/menus` | GET `/`, `/grouped`, POST `/`, PUT `/:id`, PATCH `/:id/visibility` |
| CMS | `/api/v1/cms` | GET `/screens`, `/feature-flags`, `/navigation-configs` |
| Messages | `/api/v1/messages` | GET `/my-messages`, POST `/`, PATCH `/:id/read` |
| SMS | `/api/v1/sms` | POST `/send`, GET `/conversation/:phone`, `/my-messages` |
| Business Cards | `/api/v1/business-cards` | POST `/`, GET `/me`, `/slug/:slug` |
| Chatbot | `/api/v1/chatbot` | POST `/start`, `/message`, GET `/sessions` |
| Preapproval | `/api/v1/preapproval` | POST `/generate`, GET `/loan/:id`, `/:id/download` |
| Encompass | `/api/v1/encompass` | POST `/loans/:id/sync`, GET `/loans/:id/documents` |
| CRM | `/api/v1/crm` | POST `/sync/contacts`, GET `/contacts`, `/journeys` |
| Consent | `/api/v1/consent` | POST `/request`, `/:id/grant`, `/:id/revoke` |
| Referrals | `/api/v1/referral-sources` | POST `/`, GET `/`, `/:id/analytics`, `/top-performers` |
| POS Link | `/api/v1/pos-link` | POST `/generate`, GET `/session/:id`, `/my-sessions` |
| Notifications | `/api/v1/notifications` | GET `/`, PATCH `/:id/read` |
| Roles (Admin) | `/api/v1/roles` | GET `/`, POST `/`, PUT `/:id`, DELETE `/:id` |
| Capabilities | `/api/v1/capabilities` | GET `/`, POST `/`, PUT `/:id`, DELETE `/:id` |
| Audit Logs | `/api/v1/audit-logs` | GET `/consent`, `/crm`, `/credit` |
| WebSocket | `ws(s)://<host>/ws/content` | Events: `menu_updated`, `screen_updated`, `content_updated` |

## Appendix B: Swagger / Postman

- **Swagger UI**: `http://localhost:4000/api-docs` (interactive API explorer)
- **OpenAPI JSON**: `http://localhost:4000/api-docs.json`
- **Postman Collection**: `Postman_Collection_v1.json` in the backend repo root

## Appendix C: Related Documentation

- [FRONTEND_ROLES_CAPABILITIES.md](./FRONTEND_ROLES_CAPABILITIES.md) — Detailed RBAC/CBAC guide with full code examples
- [WEBSOCKET_CONTENT_UPDATE_GUIDE.md](./WEBSOCKET_CONTENT_UPDATE_GUIDE.md) — WebSocket architecture and event details
- [CMS_API_BACKEND_IMPLEMENTATION_GUIDE.md](./CMS_API_BACKEND_IMPLEMENTATION_GUIDE.md) — CMS data models and endpoint contracts
- [MENU_API_BACKEND_IMPLEMENTATION_GUIDE.md](./MENU_API_BACKEND_IMPLEMENTATION_GUIDE.md) — Dynamic menu system details
