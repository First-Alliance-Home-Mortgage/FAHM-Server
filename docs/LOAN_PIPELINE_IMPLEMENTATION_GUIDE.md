# Loan Pipeline Implementation Guide (Next.js)

> A complete guide to building the loan pipeline data table view in Next.js, connected to the enhanced `GET /api/v1/loans` backend endpoint.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Backend API Reference](#2-backend-api-reference)
3. [TypeScript Types](#3-typescript-types)
4. [Loan Service & React Query Hooks](#4-loan-service--react-query-hooks)
5. [Pipeline Page Implementation](#5-pipeline-page-implementation)
6. [Filter Bar Component](#6-filter-bar-component)
7. [Data Table Component](#7-data-table-component)
8. [Status Badge Component](#8-status-badge-component)
9. [Pipeline Stats Summary](#9-pipeline-stats-summary)
10. [Pagination Component](#10-pagination-component)
11. [Row Actions](#11-row-actions)
12. [Role-Based Visibility](#12-role-based-visibility)
13. [Complete File Structure](#13-complete-file-structure)

---

## 1. Overview

The loan pipeline is the primary view for loan officers, branch managers, and admins to track all loans through their lifecycle stages:

```
Application → Processing → Underwriting → Closing → Funded
```

### Architecture

```
┌──────────────────────────────────────────────────────┐
│  Pipeline Page (app/(dashboard)/pipeline/page.tsx)   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  Pipeline Stats (counts per status)           │   │
│  └──────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────┐   │
│  │  Filter Bar (search, status, source, dates)   │   │
│  └──────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────┐   │
│  │  Data Table (sortable columns, status badges) │   │
│  └──────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────┐   │
│  │  Pagination (page controls + page size)       │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  Data Flow:                                          │
│  FilterState → useLoans(params) → React Query        │
│  → GET /api/v1/loans?status=...&page=...&sort=...    │
│  → Server response { data, total, page, totalPages } │
└──────────────────────────────────────────────────────┘
```

---

## 2. Backend API Reference

### `GET /api/v1/loans`

**Auth:** Bearer token required. Borrowers are automatically scoped to their own loans.

### Query Parameters

| Param | Type | Default | Description |
|---|---|---|---|
| `status` | string | — | Comma-separated statuses: `processing,underwriting` |
| `source` | string | — | `retail` or `tpo` |
| `assignedOfficer` | string | — | MongoDB ObjectId of the loan officer |
| `q` | string | — | Text search on borrower name, email, or property address |
| `dateFrom` | string (ISO 8601) | — | Filter `createdAt >= dateFrom` |
| `dateTo` | string (ISO 8601) | — | Filter `createdAt <= dateTo` |
| `page` | integer | `1` | Page number (starts at 1) |
| `limit` | integer | `20` | Items per page (max 100) |
| `sort` | string | `-createdAt` | Sort field. Prefix with `-` for descending. |

### Sortable Fields

| Field | Sort Value | Description |
|---|---|---|
| Created date (newest) | `-createdAt` | Default |
| Created date (oldest) | `createdAt` | |
| Amount (high to low) | `-amount` | |
| Amount (low to high) | `amount` | |
| Status | `status` | Alphabetical |
| Last updated | `-updatedAt` | |

### Response

```json
{
  "data": [
    {
      "_id": "64abc123...",
      "borrower": {
        "_id": "64user1...",
        "name": "John Smith",
        "email": "john@example.com"
      },
      "assignedOfficer": {
        "_id": "64user2...",
        "name": "Jane LO",
        "email": "jane@fahm.com",
        "role": "64role1..."
      },
      "amount": 350000,
      "propertyAddress": "789 Home St, Scottsdale, AZ 85251",
      "status": "processing",
      "milestones": [
        { "name": "Application Submitted", "status": "completed", "updatedAt": "2024-03-15T00:00:00.000Z" },
        { "name": "Documents Reviewed", "status": "in_progress", "updatedAt": "2024-03-20T00:00:00.000Z" },
        { "name": "Underwriting", "status": "pending", "updatedAt": "2024-03-20T00:00:00.000Z" }
      ],
      "source": "retail",
      "encompassLoanId": "ENC-GUID-001",
      "lastEncompassSync": "2024-03-25T12:00:00.000Z",
      "createdAt": "2024-03-15T00:00:00.000Z",
      "updatedAt": "2024-03-25T12:00:00.000Z"
    }
  ],
  "total": 143,
  "page": 1,
  "limit": 20,
  "totalPages": 8
}
```

### Example Requests

```bash
# All loans, page 1, default sort
GET /api/v1/loans

# Filter by status
GET /api/v1/loans?status=processing,underwriting

# Search + paginate
GET /api/v1/loans?q=smith&page=2&limit=10

# Date range + source + sort by amount
GET /api/v1/loans?dateFrom=2024-01-01&dateTo=2024-06-30&source=retail&sort=-amount

# Loans for a specific officer
GET /api/v1/loans?assignedOfficer=64abc123...&status=application
```

---

## 3. TypeScript Types

```typescript
// types/pipeline.types.ts

export type LoanStatus = 'application' | 'processing' | 'underwriting' | 'closing' | 'funded';
export type LoanSource = 'retail' | 'tpo';
export type MilestoneStatus = 'pending' | 'in_progress' | 'completed';

export interface Milestone {
  name: string;
  status: MilestoneStatus;
  updatedAt: string;
}

export interface LoanBorrower {
  _id: string;
  name: string;
  email: string;
}

export interface LoanOfficer {
  _id: string;
  name: string;
  email: string;
  role: string;
}

export interface LoanApplication {
  _id: string;
  borrower: LoanBorrower;
  assignedOfficer: LoanOfficer | null;
  amount: number;
  propertyAddress: string;
  status: LoanStatus;
  milestones: Milestone[];
  source: LoanSource;
  encompassLoanId?: string;
  lastEncompassSync?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineFilters {
  status?: string;       // comma-separated
  source?: LoanSource;
  assignedOfficer?: string;
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  limit: number;
  sort: string;
}

export interface PaginatedLoans {
  data: LoanApplication[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Status configuration for UI rendering
export interface StatusConfig {
  label: string;
  color: string;       // Tailwind text color
  bgColor: string;     // Tailwind bg color
  dotColor: string;    // Tailwind dot color
}

export const STATUS_CONFIG: Record<LoanStatus, StatusConfig> = {
  application: {
    label: 'Application',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    dotColor: 'bg-blue-500',
  },
  processing: {
    label: 'Processing',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    dotColor: 'bg-yellow-500',
  },
  underwriting: {
    label: 'Underwriting',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    dotColor: 'bg-purple-500',
  },
  closing: {
    label: 'Closing',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    dotColor: 'bg-orange-500',
  },
  funded: {
    label: 'Funded',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    dotColor: 'bg-green-500',
  },
};

export const ALL_STATUSES: LoanStatus[] = [
  'application',
  'processing',
  'underwriting',
  'closing',
  'funded',
];
```

---

## 4. Loan Service & React Query Hooks

### Service

```typescript
// services/loan.service.ts

import { apiClient } from '@/lib/api-client';
import type { PaginatedLoans, PipelineFilters } from '@/types/pipeline.types';

export const loanService = {
  list: (params: Partial<PipelineFilters>) => {
    // Remove empty/undefined values before sending
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== '' && v !== null)
    );
    return apiClient.get<PaginatedLoans>('/loans', { params: cleanParams });
  },

  getById: (id: string) =>
    apiClient.get(`/loans/${id}`),

  updateStatus: (id: string, data: { status: string; milestones?: any[] }) =>
    apiClient.patch(`/loans/${id}/status`, data),

  create: (data: any) =>
    apiClient.post('/loans', data),
};
```

### React Query Hooks

```typescript
// hooks/useLoans.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loanService } from '@/services/loan.service';
import type { PipelineFilters } from '@/types/pipeline.types';

export function useLoans(filters: Partial<PipelineFilters>) {
  return useQuery({
    queryKey: ['loans', filters],
    queryFn: () => loanService.list(filters).then((r) => r.data),
    placeholderData: (prev) => prev, // Keep previous data while fetching
  });
}

export function useLoan(id: string) {
  return useQuery({
    queryKey: ['loans', id],
    queryFn: () => loanService.getById(id).then((r) => r.data),
    enabled: !!id,
  });
}

export function useUpdateLoanStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; status: string; milestones?: any[] }) =>
      loanService.updateStatus(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
    },
  });
}
```

### Filter State Hook

```typescript
// hooks/usePipelineFilters.ts

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { PipelineFilters } from '@/types/pipeline.types';

const DEFAULTS: PipelineFilters = {
  page: 1,
  limit: 20,
  sort: '-createdAt',
};

export function usePipelineFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters: PipelineFilters = useMemo(() => ({
    status: searchParams.get('status') || undefined,
    source: (searchParams.get('source') as PipelineFilters['source']) || undefined,
    assignedOfficer: searchParams.get('assignedOfficer') || undefined,
    q: searchParams.get('q') || undefined,
    dateFrom: searchParams.get('dateFrom') || undefined,
    dateTo: searchParams.get('dateTo') || undefined,
    page: Number(searchParams.get('page')) || DEFAULTS.page,
    limit: Number(searchParams.get('limit')) || DEFAULTS.limit,
    sort: searchParams.get('sort') || DEFAULTS.sort,
  }), [searchParams]);

  const setFilters = useCallback(
    (updates: Partial<PipelineFilters>) => {
      const params = new URLSearchParams(searchParams.toString());

      // Reset to page 1 when filters change (except when explicitly setting page)
      if (!('page' in updates)) {
        params.set('page', '1');
      }

      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === '' || value === null) {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      });

      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const resetFilters = useCallback(() => {
    router.push(pathname);
  }, [router, pathname]);

  return { filters, setFilters, resetFilters };
}
```

---

## 5. Pipeline Page Implementation

```typescript
// app/(dashboard)/pipeline/page.tsx
'use client';

import { Suspense } from 'react';
import { PipelineContent } from '@/components/modules/pipeline/PipelineContent';

export default function PipelinePage() {
  return (
    <Suspense fallback={<PipelineLoadingSkeleton />}>
      <PipelineContent />
    </Suspense>
  );
}

function PipelineLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-gray-200 rounded" />
      <div className="grid grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-200 rounded-lg" />
        ))}
      </div>
      <div className="h-12 bg-gray-200 rounded-lg" />
      <div className="h-96 bg-gray-200 rounded-lg" />
    </div>
  );
}
```

### Pipeline Content (wraps everything)

```typescript
// components/modules/pipeline/PipelineContent.tsx
'use client';

import { useLoans } from '@/hooks/useLoans';
import { usePipelineFilters } from '@/hooks/usePipelineFilters';
import { PipelineStats } from './PipelineStats';
import { PipelineFilterBar } from './PipelineFilterBar';
import { PipelineTable } from './PipelineTable';
import { Pagination } from '@/components/ui/Pagination';

export function PipelineContent() {
  const { filters, setFilters, resetFilters } = usePipelineFilters();
  const { data, isLoading, isError, error } = useLoans(filters);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Loan Pipeline</h1>
        <span className="text-sm text-gray-500">
          {data ? `${data.total} total loans` : ''}
        </span>
      </div>

      {/* Status counts across the top */}
      <PipelineStats
        currentStatus={filters.status}
        onStatusClick={(status) =>
          setFilters({ status: filters.status === status ? undefined : status })
        }
      />

      {/* Filter bar */}
      <PipelineFilterBar
        filters={filters}
        onFilterChange={setFilters}
        onReset={resetFilters}
      />

      {/* Error state */}
      {isError && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          Failed to load loans: {(error as Error).message}
        </div>
      )}

      {/* Data table */}
      <PipelineTable
        loans={data?.data || []}
        isLoading={isLoading}
        sort={filters.sort}
        onSortChange={(sort) => setFilters({ sort })}
      />

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          limit={data.limit}
          total={data.total}
          onPageChange={(page) => setFilters({ page })}
          onLimitChange={(limit) => setFilters({ limit, page: 1 })}
        />
      )}
    </div>
  );
}
```

---

## 6. Filter Bar Component

```typescript
// components/modules/pipeline/PipelineFilterBar.tsx
'use client';

import { useState, useEffect } from 'react';
import { Search, X, Filter } from 'lucide-react';
import type { PipelineFilters, LoanSource } from '@/types/pipeline.types';
import { ALL_STATUSES, STATUS_CONFIG } from '@/types/pipeline.types';

interface PipelineFilterBarProps {
  filters: PipelineFilters;
  onFilterChange: (updates: Partial<PipelineFilters>) => void;
  onReset: () => void;
}

export function PipelineFilterBar({ filters, onFilterChange, onReset }: PipelineFilterBarProps) {
  const [searchValue, setSearchValue] = useState(filters.q || '');

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== (filters.q || '')) {
        onFilterChange({ q: searchValue || undefined });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchValue]);

  // Sync external filter changes
  useEffect(() => {
    setSearchValue(filters.q || '');
  }, [filters.q]);

  const activeFilterCount = [
    filters.status,
    filters.source,
    filters.assignedOfficer,
    filters.q,
    filters.dateFrom,
    filters.dateTo,
  ].filter(Boolean).length;

  const selectedStatuses = filters.status ? filters.status.split(',') : [];

  const toggleStatus = (status: string) => {
    let updated: string[];
    if (selectedStatuses.includes(status)) {
      updated = selectedStatuses.filter((s) => s !== status);
    } else {
      updated = [...selectedStatuses, status];
    }
    onFilterChange({ status: updated.length > 0 ? updated.join(',') : undefined });
  };

  return (
    <div className="bg-white border rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search borrower, email, or address..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          {searchValue && (
            <button
              onClick={() => setSearchValue('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>

        {/* Source filter */}
        <select
          value={filters.source || ''}
          onChange={(e) => onFilterChange({ source: (e.target.value as LoanSource) || undefined })}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Sources</option>
          <option value="retail">Retail</option>
          <option value="tpo">TPO</option>
        </select>

        {/* Date From */}
        <input
          type="date"
          value={filters.dateFrom || ''}
          onChange={(e) => onFilterChange({ dateFrom: e.target.value || undefined })}
          className="border rounded-lg px-3 py-2 text-sm"
          placeholder="From date"
        />

        {/* Date To */}
        <input
          type="date"
          value={filters.dateTo || ''}
          onChange={(e) => onFilterChange({ dateTo: e.target.value || undefined })}
          className="border rounded-lg px-3 py-2 text-sm"
          placeholder="To date"
        />

        {/* Reset */}
        {activeFilterCount > 0 && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <X className="w-4 h-4" />
            Clear ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Status filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400" />
        {ALL_STATUSES.map((status) => {
          const config = STATUS_CONFIG[status];
          const isActive = selectedStatuses.includes(status);
          return (
            <button
              key={status}
              onClick={() => toggleStatus(status)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                isActive
                  ? `${config.bgColor} ${config.color} ring-2 ring-offset-1 ring-current`
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isActive ? config.dotColor : 'bg-gray-400'}`} />
              {config.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

---

## 7. Data Table Component

```typescript
// components/modules/pipeline/PipelineTable.tsx
'use client';

import Link from 'next/link';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { format } from 'date-fns';
import type { LoanApplication } from '@/types/pipeline.types';
import { StatusBadge } from './StatusBadge';
import { LoanRowActions } from './LoanRowActions';
import { useAuthStore } from '@/stores/auth.store';
import { hasRole } from '@/lib/permissions';
import { ROLES } from '@/config/constants';

interface PipelineTableProps {
  loans: LoanApplication[];
  isLoading: boolean;
  sort: string;
  onSortChange: (sort: string) => void;
}

interface Column {
  key: string;
  label: string;
  sortable: boolean;
  sortField?: string;
  className?: string;
  /** Roles that can see this column. Empty = all roles */
  visibleTo?: string[];
}

const COLUMNS: Column[] = [
  { key: 'borrower', label: 'Borrower', sortable: false },
  { key: 'propertyAddress', label: 'Property', sortable: false },
  { key: 'amount', label: 'Amount', sortable: true, sortField: 'amount', className: 'text-right' },
  { key: 'status', label: 'Status', sortable: true, sortField: 'status' },
  { key: 'source', label: 'Source', sortable: false,
    visibleTo: [ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.LOAN_OFFICER_RETAIL, ROLES.LOAN_OFFICER_TPO] },
  { key: 'assignedOfficer', label: 'Loan Officer', sortable: false,
    visibleTo: [ROLES.ADMIN, ROLES.BRANCH_MANAGER] },
  { key: 'milestones', label: 'Progress', sortable: false },
  { key: 'createdAt', label: 'Created', sortable: true, sortField: 'createdAt' },
  { key: 'actions', label: '', sortable: false },
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getMilestoneProgress(milestones: LoanApplication['milestones']): {
  completed: number;
  total: number;
  percent: number;
} {
  const total = milestones.length;
  const completed = milestones.filter((m) => m.status === 'completed').length;
  return { completed, total, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
}

export function PipelineTable({ loans, isLoading, sort, onSortChange }: PipelineTableProps) {
  const user = useAuthStore((s) => s.user);

  // Filter columns based on user role
  const visibleColumns = COLUMNS.filter((col) => {
    if (!col.visibleTo || col.visibleTo.length === 0) return true;
    return hasRole(user, col.visibleTo);
  });

  const getSortDirection = (field: string): 'asc' | 'desc' | null => {
    if (sort === field) return 'asc';
    if (sort === `-${field}`) return 'desc';
    return null;
  };

  const handleSort = (field: string) => {
    const current = getSortDirection(field);
    if (current === null || current === 'asc') {
      onSortChange(`-${field}`); // desc
    } else {
      onSortChange(field); // asc
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    const dir = getSortDirection(field);
    if (dir === 'asc') return <ArrowUp className="w-4 h-4" />;
    if (dir === 'desc') return <ArrowDown className="w-4 h-4" />;
    return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
  };

  if (isLoading) {
    return (
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {visibleColumns.map((col) => (
                <th key={col.key} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-t">
                {visibleColumns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (loans.length === 0) {
    return (
      <div className="bg-white border rounded-lg p-12 text-center">
        <p className="text-gray-500">No loans found matching your filters.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    col.sortable ? 'cursor-pointer hover:bg-gray-100 select-none' : ''
                  } ${col.className || ''}`}
                  onClick={() => col.sortable && col.sortField && handleSort(col.sortField)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && col.sortField && <SortIcon field={col.sortField} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loans.map((loan) => (
              <LoanRow key={loan._id} loan={loan} visibleColumns={visibleColumns} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LoanRow({ loan, visibleColumns }: { loan: LoanApplication; visibleColumns: Column[] }) {
  const progress = getMilestoneProgress(loan.milestones);

  const renderCell = (col: Column) => {
    switch (col.key) {
      case 'borrower':
        return (
          <div>
            <Link
              href={`/loans/${loan._id}`}
              className="font-medium text-blue-600 hover:text-blue-800"
            >
              {loan.borrower.name}
            </Link>
            <p className="text-xs text-gray-500">{loan.borrower.email}</p>
          </div>
        );

      case 'propertyAddress':
        return (
          <span className="text-sm text-gray-700 truncate max-w-[200px] block">
            {loan.propertyAddress || '—'}
          </span>
        );

      case 'amount':
        return (
          <span className="text-sm font-medium text-right block">
            {formatCurrency(loan.amount)}
          </span>
        );

      case 'status':
        return <StatusBadge status={loan.status} />;

      case 'source':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 uppercase">
            {loan.source}
          </span>
        );

      case 'assignedOfficer':
        return (
          <span className="text-sm text-gray-700">
            {loan.assignedOfficer?.name || '—'}
          </span>
        );

      case 'milestones':
        return (
          <div className="flex items-center gap-2">
            <div className="w-24 bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">
              {progress.completed}/{progress.total}
            </span>
          </div>
        );

      case 'createdAt':
        return (
          <span className="text-sm text-gray-500">
            {format(new Date(loan.createdAt), 'MMM d, yyyy')}
          </span>
        );

      case 'actions':
        return <LoanRowActions loan={loan} />;

      default:
        return null;
    }
  };

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      {visibleColumns.map((col) => (
        <td key={col.key} className={`px-4 py-3 whitespace-nowrap ${col.className || ''}`}>
          {renderCell(col)}
        </td>
      ))}
    </tr>
  );
}
```

---

## 8. Status Badge Component

```typescript
// components/modules/pipeline/StatusBadge.tsx

import type { LoanStatus } from '@/types/pipeline.types';
import { STATUS_CONFIG } from '@/types/pipeline.types';

interface StatusBadgeProps {
  status: LoanStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  if (!config) return <span>{status}</span>;

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${config.bgColor} ${config.color} ${sizeClasses}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
      {config.label}
    </span>
  );
}
```

### Status Color Reference

| Status | Dot | Background | Text |
|---|---|---|---|
| Application | `bg-blue-500` | `bg-blue-50` | `text-blue-700` |
| Processing | `bg-yellow-500` | `bg-yellow-50` | `text-yellow-700` |
| Underwriting | `bg-purple-500` | `bg-purple-50` | `text-purple-700` |
| Closing | `bg-orange-500` | `bg-orange-50` | `text-orange-700` |
| Funded | `bg-green-500` | `bg-green-50` | `text-green-700` |

---

## 9. Pipeline Stats Summary

Displays count cards for each status across the top of the pipeline.

```typescript
// components/modules/pipeline/PipelineStats.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { loanService } from '@/services/loan.service';
import { ALL_STATUSES, STATUS_CONFIG } from '@/types/pipeline.types';
import type { LoanStatus } from '@/types/pipeline.types';

interface PipelineStatsProps {
  currentStatus?: string;
  onStatusClick: (status: string) => void;
}

export function PipelineStats({ currentStatus, onStatusClick }: PipelineStatsProps) {
  // Fetch counts for each status using individual queries (lightweight)
  // Alternative: create a dedicated /loans/stats endpoint on the backend
  const { data: allLoans } = useQuery({
    queryKey: ['loans', 'stats'],
    queryFn: () => loanService.list({ limit: 1 }).then((r) => r.data),
  });

  const statusQueries = ALL_STATUSES.map((status) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useQuery({
      queryKey: ['loans', 'count', status],
      queryFn: () => loanService.list({ status, limit: 1 }).then((r) => r.data.total),
    })
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {ALL_STATUSES.map((status, index) => {
        const config = STATUS_CONFIG[status];
        const count = statusQueries[index].data ?? 0;
        const isActive = currentStatus === status;

        return (
          <button
            key={status}
            onClick={() => onStatusClick(status)}
            className={`flex flex-col items-start p-4 rounded-lg border transition-all ${
              isActive
                ? `${config.bgColor} border-current ${config.color} ring-2 ring-offset-1`
                : 'bg-white hover:shadow-md'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${config.dotColor}`} />
              <span className="text-sm font-medium">{config.label}</span>
            </div>
            <span className="text-2xl font-bold mt-1">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
```

> **Performance Note:** The stats component makes 5 small queries (one per status, `limit=1`) to get counts. For better performance at scale, consider adding a dedicated `GET /api/v1/loans/stats` backend endpoint that returns `{ application: 12, processing: 8, ... }` in a single query using MongoDB `$facet` aggregation.

---

## 10. Pagination Component

```typescript
// components/ui/Pagination.tsx
'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

export function Pagination({ page, totalPages, limit, total, onPageChange, onLimitChange }: PaginationProps) {
  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  // Generate page numbers with ellipsis
  const getPageNumbers = (): (number | '...')[] => {
    const pages: (number | '...')[] = [];
    const delta = 2;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }

    return pages;
  };

  return (
    <div className="flex items-center justify-between px-2">
      {/* Info */}
      <div className="text-sm text-gray-500">
        Showing {startItem}–{endItem} of {total}
      </div>

      {/* Page controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {getPageNumbers().map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-gray-400">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`w-8 h-8 rounded-lg text-sm font-medium ${
                p === page
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Page size */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Per page:</span>
        <select
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          className="border rounded px-2 py-1 text-sm"
        >
          {[10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
```

---

## 11. Row Actions

```typescript
// components/modules/pipeline/LoanRowActions.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { MoreHorizontal, Eye, ArrowRight, FileText, ExternalLink } from 'lucide-react';
import type { LoanApplication, LoanStatus } from '@/types/pipeline.types';
import { ALL_STATUSES, STATUS_CONFIG } from '@/types/pipeline.types';
import { useUpdateLoanStatus } from '@/hooks/useLoans';
import { useAuthStore } from '@/stores/auth.store';
import { hasRole } from '@/lib/permissions';
import { ROLES } from '@/config/constants';

interface LoanRowActionsProps {
  loan: LoanApplication;
}

export function LoanRowActions({ loan }: LoanRowActionsProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const user = useAuthStore((s) => s.user);
  const updateStatus = useUpdateLoanStatus();

  const canUpdateStatus = hasRole(user, [ROLES.ADMIN, ROLES.LOAN_OFFICER_RETAIL, ROLES.LOAN_OFFICER_TPO]);

  // Get the next logical status in the pipeline
  const currentIdx = ALL_STATUSES.indexOf(loan.status);
  const nextStatus: LoanStatus | null =
    currentIdx >= 0 && currentIdx < ALL_STATUSES.length - 1 ? ALL_STATUSES[currentIdx + 1] : null;

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleAdvanceStatus = () => {
    if (!nextStatus) return;
    updateStatus.mutate({ id: loan._id, status: nextStatus });
    setOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1 rounded-lg hover:bg-gray-100"
      >
        <MoreHorizontal className="w-4 h-4 text-gray-500" />
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-48 bg-white border rounded-lg shadow-lg py-1">
          {/* View details */}
          <Link
            href={`/loans/${loan._id}`}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={() => setOpen(false)}
          >
            <Eye className="w-4 h-4" />
            View Details
          </Link>

          {/* View documents */}
          <Link
            href={`/loans/${loan._id}?tab=documents`}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={() => setOpen(false)}
          >
            <FileText className="w-4 h-4" />
            Documents
          </Link>

          {/* Advance to next status */}
          {canUpdateStatus && nextStatus && (
            <>
              <hr className="my-1" />
              <button
                onClick={handleAdvanceStatus}
                disabled={updateStatus.isPending}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-blue-600 hover:bg-blue-50"
              >
                <ArrowRight className="w-4 h-4" />
                Move to {STATUS_CONFIG[nextStatus].label}
              </button>
            </>
          )}

          {/* Encompass link */}
          {loan.encompassLoanId && (
            <button
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setOpen(false)}
            >
              <ExternalLink className="w-4 h-4" />
              View in Encompass
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## 12. Role-Based Visibility

Different roles see different columns and actions in the pipeline:

### Column Visibility

| Column | Admin | Branch Mgr | LO Retail | LO TPO | Broker | Borrower |
|---|---|---|---|---|---|---|
| Borrower | Yes | Yes | Yes | Yes | Yes | Yes |
| Property | Yes | Yes | Yes | Yes | Yes | Yes |
| Amount | Yes | Yes | Yes | Yes | Yes | Yes |
| Status | Yes | Yes | Yes | Yes | Yes | Yes |
| Source | Yes | Yes | Yes | Yes | - | - |
| Loan Officer | Yes | Yes | - | - | - | - |
| Progress | Yes | Yes | Yes | Yes | Yes | Yes |
| Created | Yes | Yes | Yes | Yes | Yes | Yes |
| Actions | Full | Full | Own loans | Own loans | View only | View only |

### Action Visibility

| Action | Required Role |
|---|---|
| View Details | All |
| View Documents | All |
| Move to Next Status | Admin, LO Retail, LO TPO |
| View in Encompass | All (visible only if `encompassLoanId` exists) |

### Implementation

Column visibility is controlled by the `visibleTo` property on each column definition in `PipelineTable.tsx`. The `hasRole` helper from `@/lib/permissions` filters columns at render time.

```typescript
// Example: Only admin and branch managers see the LO column
{
  key: 'assignedOfficer',
  label: 'Loan Officer',
  sortable: false,
  visibleTo: ['admin', 'branch_manager'],
}
```

---

## 13. Complete File Structure

```
src/
├── app/(dashboard)/pipeline/
│   └── page.tsx                          # Pipeline page entry point
├── components/
│   ├── modules/pipeline/
│   │   ├── PipelineContent.tsx           # Main pipeline orchestrator
│   │   ├── PipelineFilterBar.tsx         # Search + filter controls
│   │   ├── PipelineTable.tsx             # Data table with sorting
│   │   ├── PipelineStats.tsx             # Status count cards
│   │   ├── StatusBadge.tsx               # Color-coded status pill
│   │   └── LoanRowActions.tsx            # Per-row dropdown actions
│   └── ui/
│       └── Pagination.tsx                # Reusable pagination controls
├── hooks/
│   ├── useLoans.ts                       # React Query hooks for loans
│   └── usePipelineFilters.ts             # URL-synced filter state
├── services/
│   └── loan.service.ts                   # Axios API calls
└── types/
    └── pipeline.types.ts                 # All pipeline TypeScript types
```

---

## 14. Encompass Pipeline Integration

The backend provides a direct pass-through to the ICE Encompass `loanPipeline` API, allowing the frontend to query and display loans directly from Encompass LOS with filtering, sorting, and local link status.

### 14.1 API Endpoint

```
GET /api/v1/encompass/pipeline
```

**Auth:** Bearer token, requires LO, Branch Manager, or Admin role.

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `loanFolder` | string | — | Encompass folder (e.g. "My Pipeline") |
| `status` | string | — | Comma-separated Encompass statuses (e.g. "Processing,Underwriting") |
| `loanOfficer` | string | — | LO name (contains match) |
| `borrowerName` | string | — | Borrower first or last name (contains match) |
| `dateFrom` | string (ISO) | — | Application date >= |
| `dateTo` | string (ISO) | — | Application date <= |
| `start` | int | `0` | Pagination offset |
| `limit` | int | `25` | Page size (max 100) |
| `sortField` | string | `Fields.4002` | Encompass field ID to sort by |
| `sortOrder` | string | `desc` | `asc` or `desc` |

**Common Encompass Field IDs for sorting:**

| Field ID | Description |
|---|---|
| `Fields.4002` | Last modified date |
| `Fields.4000` | Current milestone/status |
| `Fields.11` | Loan amount |
| `Fields.317` | Application date |
| `Fields.1393` | Estimated closing date |

**Response:**

```json
{
  "data": [
    {
      "loanGuid": "abc-123-def-456",
      "loanNumber": "100234",
      "borrowerName": "John Smith",
      "loanAmount": 350000,
      "propertyAddress": "789 Home St",
      "propertyCity": "Scottsdale",
      "propertyState": "AZ",
      "propertyZip": "85251",
      "fullPropertyAddress": "789 Home St, Scottsdale, AZ, 85251",
      "status": "Processing",
      "loanOfficerName": "Jane LO",
      "loanOfficerId": "officer-guid",
      "interestRate": 6.5,
      "applicationDate": "2024-03-15",
      "estimatedClosingDate": "2024-06-15",
      "rateLockExpiration": "2024-04-15",
      "lastModified": "2024-03-25T12:00:00.000Z",
      "loanFolder": "My Pipeline",
      "loanPurpose": "Purchase",
      "loanProgram": "Conv 30 Yr Fixed",
      "isLinkedLocally": true,
      "localLoanId": "64abc123...",
      "localStatus": "processing"
    }
  ],
  "total": 25,
  "start": 0,
  "limit": 25
}
```

### 14.2 TypeScript Types

```typescript
// types/encompass-pipeline.types.ts

export interface EncompassPipelineLoan {
  loanGuid: string;
  loanNumber: string;
  borrowerName: string | null;
  loanAmount: number;
  propertyAddress: string | null;
  propertyCity: string | null;
  propertyState: string | null;
  propertyZip: string | null;
  fullPropertyAddress: string | null;
  status: string;
  loanOfficerName: string | null;
  loanOfficerId: string | null;
  interestRate: number | null;
  applicationDate: string | null;
  estimatedClosingDate: string | null;
  rateLockExpiration: string | null;
  lastModified: string | null;
  loanFolder: string | null;
  loanPurpose: string | null;
  loanProgram: string | null;
  isLinkedLocally: boolean;
  localLoanId: string | null;
  localStatus: string | null;
}

export interface EncompassPipelineFilters {
  loanFolder?: string;
  status?: string;
  loanOfficer?: string;
  borrowerName?: string;
  dateFrom?: string;
  dateTo?: string;
  start: number;
  limit: number;
  sortField: string;
  sortOrder: 'asc' | 'desc';
}

export interface EncompassPipelineResponse {
  data: EncompassPipelineLoan[];
  total: number;
  start: number;
  limit: number;
}
```

### 14.3 Service & Hook

```typescript
// services/encompass-pipeline.service.ts
import { apiClient } from '@/lib/api-client';
import type { EncompassPipelineFilters, EncompassPipelineResponse } from '@/types/encompass-pipeline.types';

export const encompassPipelineService = {
  query: (params: Partial<EncompassPipelineFilters>) => {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== '' && v !== null)
    );
    return apiClient.get<EncompassPipelineResponse>('/encompass/pipeline', { params: cleanParams });
  },
};

// hooks/useEncompassPipeline.ts
import { useQuery } from '@tanstack/react-query';
import { encompassPipelineService } from '@/services/encompass-pipeline.service';
import type { EncompassPipelineFilters } from '@/types/encompass-pipeline.types';

export function useEncompassPipeline(filters: Partial<EncompassPipelineFilters>) {
  return useQuery({
    queryKey: ['encompass-pipeline', filters],
    queryFn: () => encompassPipelineService.query(filters).then((r) => r.data),
    placeholderData: (prev) => prev,
  });
}
```

### 14.4 Encompass Pipeline Page

```typescript
// app/(dashboard)/encompass-pipeline/page.tsx
'use client';

import { useState } from 'react';
import { useEncompassPipeline } from '@/hooks/useEncompassPipeline';
import { Link2, ExternalLink, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import type { EncompassPipelineFilters, EncompassPipelineLoan } from '@/types/encompass-pipeline.types';

const DEFAULT_FILTERS: EncompassPipelineFilters = {
  start: 0,
  limit: 25,
  sortField: 'Fields.4002',
  sortOrder: 'desc',
};

export default function EncompassPipelinePage() {
  const [filters, setFilters] = useState<EncompassPipelineFilters>(DEFAULT_FILTERS);
  const [search, setSearch] = useState('');
  const { data, isLoading, isError } = useEncompassPipeline(filters);

  const updateFilter = (updates: Partial<EncompassPipelineFilters>) => {
    setFilters((prev) => ({ ...prev, start: 0, ...updates }));
  };

  const handleSearch = () => {
    updateFilter({ borrowerName: search || undefined });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Encompass Pipeline</h1>
        <span className="text-sm text-gray-500">
          {data ? `${data.total} loans` : ''}
        </span>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-lg p-4 flex items-center gap-4 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search borrower name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
          />
        </div>

        {/* Status */}
        <select
          value={filters.status || ''}
          onChange={(e) => updateFilter({ status: e.target.value || undefined })}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="Started">Started</option>
          <option value="Processing">Processing</option>
          <option value="Submittal">Submittal</option>
          <option value="Underwriting">Underwriting</option>
          <option value="Cond. Approval">Cond. Approval</option>
          <option value="Clear to Close">Clear to Close</option>
          <option value="Closing">Closing</option>
          <option value="Funded">Funded</option>
        </select>

        {/* Loan Officer */}
        <input
          type="text"
          placeholder="Loan Officer..."
          value={filters.loanOfficer || ''}
          onChange={(e) => updateFilter({ loanOfficer: e.target.value || undefined })}
          className="border rounded-lg px-3 py-2 text-sm w-40"
        />

        {/* Date range */}
        <input
          type="date"
          value={filters.dateFrom || ''}
          onChange={(e) => updateFilter({ dateFrom: e.target.value || undefined })}
          className="border rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={filters.dateTo || ''}
          onChange={(e) => updateFilter({ dateTo: e.target.value || undefined })}
          className="border rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {/* Error */}
      {isError && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          Failed to query Encompass pipeline. Check connection status.
        </div>
      )}

      {/* Table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Loan #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Borrower</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Property</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Loan Officer</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Est. Closing</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Linked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data?.data.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                    No loans found in Encompass matching your filters.
                  </td>
                </tr>
              ) : (
                data?.data.map((loan) => (
                  <EncompassLoanRow key={loan.loanGuid} loan={loan} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {data && data.total >= data.limit && (
        <div className="flex items-center justify-between px-2">
          <span className="text-sm text-gray-500">
            Showing {data.start + 1}–{data.start + data.data.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={data.start === 0}
              onClick={() => updateFilter({ start: Math.max(0, data.start - data.limit) })}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={data.data.length < data.limit}
              onClick={() => updateFilter({ start: data.start + data.limit })}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EncompassLoanRow({ loan }: { loan: EncompassPipelineLoan }) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 text-sm font-medium">{loan.loanNumber || '—'}</td>
      <td className="px-4 py-3 text-sm">{loan.borrowerName || '—'}</td>
      <td className="px-4 py-3 text-sm text-gray-700 max-w-[200px] truncate">
        {loan.fullPropertyAddress || '—'}
      </td>
      <td className="px-4 py-3 text-sm font-medium text-right">
        {loan.loanAmount ? formatCurrency(loan.loanAmount) : '—'}
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
          {loan.status || '—'}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">{loan.loanOfficerName || '—'}</td>
      <td className="px-4 py-3 text-sm text-right">
        {loan.interestRate ? `${loan.interestRate}%` : '—'}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">{loan.estimatedClosingDate || '—'}</td>
      <td className="px-4 py-3">
        {loan.isLinkedLocally ? (
          <a
            href={`/loans/${loan.localLoanId}`}
            className="inline-flex items-center gap-1 text-green-600 text-xs font-medium"
          >
            <Link2 className="w-3 h-3" />
            Linked
          </a>
        ) : (
          <span className="inline-flex items-center gap-1 text-gray-400 text-xs">
            <ExternalLink className="w-3 h-3" />
            Not linked
          </span>
        )}
      </td>
    </tr>
  );
}
```

### 14.5 File Structure (Encompass Pipeline additions)

```
src/
├── app/(dashboard)/encompass-pipeline/
│   └── page.tsx                                # Encompass pipeline page
├── hooks/
│   └── useEncompassPipeline.ts                 # React Query hook
├── services/
│   └── encompass-pipeline.service.ts           # API service
└── types/
    └── encompass-pipeline.types.ts             # TypeScript types
```

---

## Related Documentation

- [NEXTJS_FRONTEND_DEVELOPMENT_GUIDE.md](./NEXTJS_FRONTEND_DEVELOPMENT_GUIDE.md) — Project setup, auth, API client
- [API_REFERENCE.md](./API_REFERENCE.md) — Full API reference
- [TYPESCRIPT_TYPES.md](./TYPESCRIPT_TYPES.md) — All shared type definitions
- [FRONTEND_ROLES_CAPABILITIES.md](./FRONTEND_ROLES_CAPABILITIES.md) — RBAC/CBAC implementation
