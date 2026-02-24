# Mobile App: Dynamic Menus, Screen Content & Real-Time Updates

> Implementation guide for the FAHM mobile app's server-driven UI system.
> Covers: dynamic menus, CMS screens, feature flags, persona views, and WebSocket content updates.

---

## Architecture Overview

```
+------------------+     +------------------+     +-------------------+
|   Mobile App     |     |   REST API       |     |   MongoDB         |
|                  |     |                  |     |                   |
|  Menus           | <-- |  /menus          | <-- |  Menu             |
|  Screens         | <-- |  /cms/screens    | <-- |  Screen           |
|  Feature Flags   | <-- |  /cms/flags      | <-- |  FeatureFlag      |
|  Nav Configs     | <-- |  /cms/nav        | <-- |  NavigationConfig |
|  Persona Views   | <-- |  /persona-views  | <-- |  PersonaView      |
|  Menu Config     | <-- |  /menu-config    | <-- |  MenuConfig       |
|                  |     |                  |     |                   |
|  WebSocket       | <-- |  /ws/content     |     |                   |
+------------------+     +------------------+     +-------------------+
```

The app uses three layers of server-driven UI:

| Layer | Purpose | Controls |
|-------|---------|----------|
| **Menus** | Tab bar, drawer, stack navigation | Which screens appear, order, visibility, role access |
| **CMS Screens** | Screen content and layout | Component tree, publish status, navigation metadata |
| **Persona Views** | Per-user dashboard customization | Widgets, layout, filters, data visibility, preferences |

---

## 1. Dynamic Menus

### Menu Model

Each menu item is a document in the `menus` collection:

```typescript
interface Role {
  _id: string;
  name: string;        // e.g., "admin", "branch manager"
  slug: string;        // e.g., "admin", "branch_manager"
}

interface Menu {
  _id: string;
  alias: string;       // Unique identifier (e.g., "pipeline", "my-loan")
  slug: string;        // URL-friendly key (e.g., "pipeline", "my-loans")
  label: string;       // Display text (e.g., "Pipeline")
  icon: string;        // MaterialIcons name (e.g., "list", "home", "chat")
  route: string;       // Expo Router path (e.g., "/(app)/(drawer)/(tabs)/pipeline")
  type: 'drawer' | 'tab' | 'stack';   // Navigation type
  order: number;       // Sort position within type (0-based)
  visible: boolean;    // Show/hide toggle
  override: boolean;   // Whether admin has overridden defaults
  roles: Role[];       // Populated Role objects (ObjectId refs to Role collection)
  content: any | null; // Optional embedded content payload
  analytics: {
    views?: number;
    uniqueUsers?: number;
    lastAccessed?: string;
  };
  createdAt: string;
  updatedAt: string;
}
```

> **Note:** The `roles` field is stored as an array of `ObjectId` references to the `Role` collection.
> All GET endpoints return populated role objects (`{ _id, name, slug }`).
> POST/PUT endpoints accept either **Role ObjectIds** or **role slugs** (auto-resolved to ObjectIds server-side).

### Menu API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/menus` | Authenticated | Get all menus (sorted by type, order) |
| GET | `/api/v1/menus/grouped` | Authenticated | Get menus grouped by type |
| GET | `/api/v1/menus/:id` | Authenticated | Get menu by MongoDB ID |
| GET | `/api/v1/menus/alias/:alias` | Authenticated | Get menu by alias |
| GET | `/api/v1/menus/roles` | Admin | Get all available roles (`{ _id, name, slug }[]`) |
| GET | `/api/v1/menus/versions` | Admin | Get menu version history |
| POST | `/api/v1/menus` | Admin | Create a new menu |
| PUT | `/api/v1/menus/:id` | Admin | Update a menu |
| PATCH | `/api/v1/menus/:id/visibility` | Admin | Toggle menu visibility |
| DELETE | `/api/v1/menus/:id` | Admin | Delete a menu |
| POST | `/api/v1/menus/reset` | Admin | Reset all menus to seed defaults |
| POST | `/api/v1/menus/restore/:version` | Admin | Restore a previous version |

### GET /menus Response

```json
[
  {
    "_id": "65a1b2c3d4e5f6...",
    "alias": "pipeline",
    "slug": "pipeline",
    "label": "Pipeline",
    "icon": "list",
    "route": "/(app)/(drawer)/(tabs)/pipeline",
    "type": "tab",
    "order": 4,
    "visible": true,
    "override": false,
    "roles": [
      { "_id": "67a1...", "name": "admin", "slug": "admin" },
      { "_id": "67a2...", "name": "loan officer tpo", "slug": "loan_officer_tpo" },
      { "_id": "67a3...", "name": "loan officer retail", "slug": "loan_officer_retail" },
      { "_id": "67a4...", "name": "branch manager", "slug": "branch_manager" }
    ],
    "content": null,
    "analytics": {},
    "createdAt": "2026-02-24T00:00:00.000Z",
    "updatedAt": "2026-02-24T00:00:00.000Z"
  }
]
```

### POST/PUT /menus Request Body (roles)

When creating or updating a menu, the `roles` field accepts either **ObjectIds** or **role slugs**:

```json
// Using role slugs (auto-resolved to ObjectIds)
{
  "alias": "pipeline",
  "roles": ["admin", "loan_officer_tpo", "loan_officer_retail", "branch_manager"],
  ...
}

// Using ObjectIds directly
{
  "alias": "pipeline",
  "roles": ["67a1b2c3d4e5f6...", "67a2b3c4d5e6f7..."],
  ...
}
```

### GET /menus/grouped Response

```json
{
  "drawer": [],
  "tab": [
    { "alias": "index", "label": "Home", "icon": "home", "type": "tab", "order": 1, ... },
    { "alias": "messages", "label": "Messages", "icon": "chat", "type": "tab", "order": 2, ... },
    { "alias": "pipeline", "label": "Pipeline", "icon": "list", "type": "tab", "order": 4, ... }
  ],
  "stack": [
    { "alias": "about", "label": "About", "icon": "info", "type": "stack", "order": 11, ... },
    { "alias": "profile", "label": "Profile", "icon": "person", "type": "stack", "order": 43, ... }
  ]
}
```

### Default Tab Configuration

| Order | Alias | Label | Icon | Roles |
|-------|-------|-------|------|-------|
| 1 | `index` | Home | `home` | ALL |
| 2 | `messages` | Messages | `chat` | ALL |
| 3 | `my-loan` | My Loans | `description` | borrower |
| 4 | `pipeline` | Pipeline | `list` | admin, LO retail, LO TPO, branch_manager |
| 5 | `rates` | Rates | `trending-up` | admin, broker, realtor |
| 6 | `calculators` | Calculators | `assignment` | ALL |
| 7 | `new-application` | New Loan | `add-box` | admin, LO retail, LO TPO |
| 8 | `refer` | Refer | `person-add` | broker, realtor |
| 9 | `scanner` | Scanner | `camera-alt` | borrower |
| 10 | `more` | More | `more-horiz` | ALL |

### Mobile Implementation: Menu Filtering

```typescript
// hooks/useMenus.ts
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface GroupedMenus {
  drawer: Menu[];
  tab: Menu[];
  stack: Menu[];
}

export function useMenus() {
  const { user, token } = useAuth();
  const [menus, setMenus] = useState<GroupedMenus>({ drawer: [], tab: [], stack: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !user) return;

    fetch('https://fahm-server.onrender.com/api/v1/menus/grouped', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        // Filter by role + visibility on the client
        // roles is now an array of populated Role objects
        const userRoleSlug = user.role.slug;
        const filter = (items: Menu[]) =>
          items
            .filter((m) => m.visible && m.roles.some((r) => r.slug === userRoleSlug))
            .sort((a, b) => a.order - b.order);

        setMenus({
          drawer: filter(data.drawer || []),
          tab: filter(data.tab || []),
          stack: filter(data.stack || []),
        });
      })
      .finally(() => setLoading(false));
  }, [token, user]);

  return { menus, loading };
}
```

### Dynamic Tab Bar (Expo Router)

```typescript
// app/(app)/(drawer)/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useMenus } from '@/hooks/useMenus';

export default function TabLayout() {
  const { menus, loading } = useMenus();

  if (loading) return null;

  return (
    <Tabs>
      {menus.tab.map((menu) => (
        <Tabs.Screen
          key={menu.alias}
          name={menu.slug}
          options={{
            title: menu.label,
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name={menu.icon as any} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
```

### Menu Versioning

Every admin mutation (create, update, delete, reset, restore) creates a `MenuVersion` document:

```typescript
interface MenuVersion {
  _id: string;
  version: number;     // Auto-incrementing
  menus: Menu[];       // Snapshot of all menus at this version (roles stored as ObjectIds)
  createdBy: string;   // User ID of admin who made the change
  createdAt: string;
  comment: string;     // e.g., "System reset", "Restored from version 3"
}
```

> **Note:** Version snapshots store `roles` as raw ObjectIds (not populated objects) for clean storage.
> When restoring a version, the server automatically handles legacy snapshots that stored roles as string slugs.

Admins can view history with `GET /menus/versions` and restore any previous version with `POST /menus/restore/:version`.

---

## 2. CMS Screens

CMS screens define server-driven screen content with a component tree model.

### Screen Model

```typescript
interface Screen {
  _id: string;
  slug: string;                  // Unique (e.g., "dashboard")
  title: string;                 // Display title
  route: string;                 // Route path (e.g., "/dashboard")
  navigation: {
    type: 'drawer' | 'tab' | 'stack' | 'modal';
    icon?: string;
    order?: number;
  };
  roles: string[];               // Which roles can view this screen
  tenant_scope: string[];        // Multi-tenant scoping (e.g., ["global"])
  components: ScreenComponent[]; // Ordered component tree
  status: 'draft' | 'published'; // Publish workflow
  version: number;               // Incremented on publish
  createdAt: string;
  updatedAt: string;
}

interface ScreenComponent {
  type: string;                  // Component type (e.g., "text", "button", "card")
  props: Record<string, any>;   // Arbitrary props for the component
}
```

### Screen API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/cms/screens` | Authenticated | List all screens |
| GET | `/api/v1/cms/screens/:slug` | Authenticated | Get screen by slug |
| GET | `/api/v1/cms/screens/dashboard` | Authenticated | Get persona-filtered dashboard data |
| POST | `/api/v1/cms/screens` | Admin | Create a new screen |
| PATCH | `/api/v1/cms/screens/:slug` | Admin | Update screen content |
| POST | `/api/v1/cms/screens/:slug/publish` | Admin | Publish a draft screen (increments version) |

### GET /cms/screens/:slug Response

```json
{
  "_id": "65a1b2c3d4e5f6...",
  "slug": "dashboard",
  "title": "Dashboard",
  "route": "/dashboard",
  "navigation": { "type": "tab", "icon": "home", "order": 1 },
  "roles": ["admin", "borrower"],
  "tenant_scope": ["global"],
  "components": [
    { "type": "text", "props": { "value": "Welcome!" } }
  ],
  "status": "published",
  "version": 2
}
```

### Mobile Implementation: Rendering CMS Components

```typescript
// components/cms/CmsRenderer.tsx
import { View, Text, TouchableOpacity } from 'react-native';

interface CmsComponent {
  type: string;
  props: Record<string, any>;
}

const componentMap: Record<string, React.FC<any>> = {
  text: ({ value, style }) => <Text style={style}>{value}</Text>,
  button: ({ label, onPress }) => (
    <TouchableOpacity onPress={onPress}>
      <Text>{label}</Text>
    </TouchableOpacity>
  ),
  card: ({ title, children }) => (
    <View style={{ padding: 16, borderRadius: 8, backgroundColor: '#fff' }}>
      <Text style={{ fontWeight: 'bold' }}>{title}</Text>
      {children}
    </View>
  ),
  // Add more component types as registered in the component registry
};

export function CmsRenderer({ components }: { components: CmsComponent[] }) {
  return (
    <View>
      {components.map((comp, i) => {
        const Component = componentMap[comp.type];
        if (!Component) return null;
        return <Component key={i} {...comp.props} />;
      })}
    </View>
  );
}

// Usage in a screen:
export function CmsScreen({ slug }: { slug: string }) {
  const { token } = useAuth();
  const [screen, setScreen] = useState<Screen | null>(null);

  useEffect(() => {
    fetch(`https://fahm-server.onrender.com/api/v1/cms/screens/${slug}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(setScreen);
  }, [slug]);

  if (!screen) return null;
  return <CmsRenderer components={screen.components} />;
}
```

---

## 3. Navigation Configs

Navigation configs define the ordered screen layout per role and navigation type.

### NavigationConfig Model

```typescript
interface NavigationConfig {
  _id: string;
  type: 'drawer' | 'tab' | 'stack' | 'modal';  // Navigation type
  role: string;                                   // Role slug
  items: {
    screen_slug: string;  // References Screen.slug
    order: number;
  }[];
  createdAt: string;
  updatedAt: string;
}
```

Unique index on `(type, role)` -- one config per role per navigation type.

### Navigation Config API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/cms/navigation-configs` | Authenticated | List all configs |
| PUT | `/api/v1/cms/navigation-configs` | Admin | Upsert configs array |

### PUT Body Example

```json
[
  {
    "type": "drawer",
    "role": "admin",
    "items": [
      { "screen_slug": "dashboard", "order": 1 },
      { "screen_slug": "user-management", "order": 2 },
      { "screen_slug": "settings", "order": 3 }
    ]
  },
  {
    "type": "tab",
    "role": "borrower",
    "items": [
      { "screen_slug": "dashboard", "order": 1 },
      { "screen_slug": "my-loans", "order": 2 },
      { "screen_slug": "documents", "order": 3 }
    ]
  }
]
```

---

## 4. Feature Flags

Feature flags control feature availability by role and app version.

### FeatureFlag Model

```typescript
interface FeatureFlag {
  _id: string;
  key: string;              // Unique key (e.g., "new_ui", "dark_mode")
  enabled: boolean;         // Global on/off
  roles: string[];          // If non-empty, only these roles see the feature
  min_app_version?: string; // Minimum app version required (e.g., "1.2.0")
  createdAt: string;
  updatedAt: string;
}
```

### Feature Flag API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/cms/feature-flags` | Authenticated | List all flags |
| PUT | `/api/v1/cms/feature-flags` | Admin | Upsert flags array |
| PATCH | `/api/v1/cms/feature-flags/:key` | Admin | Toggle a flag's enabled state |

### GET Response

```json
[
  {
    "_id": "65a1...",
    "key": "new_ui",
    "enabled": true,
    "roles": ["admin"],
    "min_app_version": "1.0.0"
  }
]
```

### Mobile Implementation: Feature Flag Hook

```typescript
// hooks/useFeatureFlags.ts
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Constants from 'expo-constants';
import { compareVersions } from '@/utils/version';

interface FeatureFlag {
  key: string;
  enabled: boolean;
  roles: string[];
  min_app_version?: string;
}

export function useFeatureFlags() {
  const { token, user } = useAuth();
  const [flags, setFlags] = useState<FeatureFlag[]>([]);

  useEffect(() => {
    if (!token) return;
    fetch('https://fahm-server.onrender.com/api/v1/cms/feature-flags', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(setFlags);
  }, [token]);

  const isEnabled = (key: string): boolean => {
    const flag = flags.find((f) => f.key === key);
    if (!flag || !flag.enabled) return false;

    // Role check: if roles array is non-empty, user must match
    if (flag.roles.length > 0 && !flag.roles.includes(user?.role?.slug || '')) {
      return false;
    }

    // Version check
    if (flag.min_app_version) {
      const appVersion = Constants.expoConfig?.version || '0.0.0';
      if (compareVersions(appVersion, flag.min_app_version) < 0) return false;
    }

    return true;
  };

  return { flags, isEnabled };
}

// Usage:
function MyScreen() {
  const { isEnabled } = useFeatureFlags();

  return (
    <View>
      {isEnabled('new_ui') && <NewUIComponent />}
      {isEnabled('dark_mode') && <DarkModeToggle />}
    </View>
  );
}
```

---

## 5. Component Registry

The component registry defines which component types are available for CMS screens.

### ComponentRegistryItem Model

```typescript
interface ComponentRegistryItem {
  _id: string;
  type: string;                        // Component type name (e.g., "button", "text", "card")
  allowed_props: Record<string, any>;  // Schema of allowed props
  allowed_actions: string[];           // e.g., ["navigate", "api_call"]
  supports_actions: boolean;           // Whether the component can trigger actions
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}
```

### API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/cms/component-registry` | Authenticated | List registered components |

### Response

```json
[
  {
    "type": "button",
    "allowed_props": { "label": { "type": "string", "required": true } },
    "allowed_actions": ["navigate", "api_call"],
    "supports_actions": true,
    "status": "active"
  }
]
```

Use this registry to validate CMS screen components and build a dynamic renderer.

---

## 6. Persona Views (Per-User Dashboard Customization)

Each user gets a `PersonaView` document that controls their dashboard layout, widgets, notification preferences, data visibility, and branding.

### PersonaView Model

```typescript
interface PersonaView {
  _id: string;
  user: string;          // User ObjectId (unique per user)
  role: RoleSlug;
  viewConfiguration: {
    dashboard: {
      layout: 'grid' | 'list' | 'cards' | 'compact';
      widgets: Widget[];
      defaultFilters: {
        dateRange?: string;
        status?: string[];
        loanType?: string[];
        source?: string[];
      };
    };
    navigation: {
      homeView: 'dashboard' | 'pipeline' | 'loans' | 'documents' | 'messages';
      pinnedItems: PinnedItem[];
      hiddenMenuItems: string[];  // Menu aliases to hide
    };
    notifications: {
      pushEnabled: boolean;
      emailEnabled: boolean;
      smsEnabled: boolean;
      categories: {
        milestones: boolean;
        documents: boolean;
        messages: boolean;
        rates: boolean;
        marketing: boolean;
      };
      quietHours: {
        enabled: boolean;
        startTime?: string;
        endTime?: string;
        timezone?: string;
      };
    };
    dataVisibility: {
      showCreditScore: boolean;      // Borrower
      showLoanAmount: boolean;       // Borrower
      showInterestRate: boolean;     // Borrower
      showDocuments: boolean;        // Borrower
      showPipeline: boolean;         // LO
      showPerformanceMetrics: boolean; // LO
      showTeamData: boolean;         // LO / BM
      showReferralStats: boolean;    // Realtor
      showCommissionInfo: boolean;   // Realtor
      showBranchMetrics: boolean;    // BM
      showRegionalData: boolean;     // BM
    };
    preferences: {
      theme: 'light' | 'dark' | 'auto';
      language: string;      // Default: "en"
      dateFormat: string;    // Default: "MM/DD/YYYY"
      currencyFormat: string; // Default: "USD"
      timezone: string;      // Default: "America/Los_Angeles"
    };
    branding: {
      logo?: string;
      primaryColor?: string;
      secondaryColor?: string;
      partnerName?: string;
      partnerLogo?: string;
    };
  };
  lastUpdated: string;
  isDefault: boolean;
}

interface Widget {
  widgetId: string;
  title: string;
  enabled: boolean;
  order: number;
  size: 'small' | 'medium' | 'large' | 'full';
  refreshInterval?: number;  // Seconds
  settings?: Record<string, any>;
}

interface PinnedItem {
  type: string;
  label: string;
  route: string;
  order: number;
}
```

### Persona View API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/persona-views/me` | Authenticated | Get current user's view (auto-creates default) |
| PATCH | `/api/v1/persona-views/me` | Authenticated | Update view configuration (merge) |
| POST | `/api/v1/persona-views/me/reset` | Authenticated | Reset to role defaults |
| GET | `/api/v1/persona-views/dashboard` | Authenticated | Get role-specific dashboard data |

### Default Widget Configurations by Role

**Borrower** (layout: `cards`)
| Widget | Title | Size |
|--------|-------|------|
| `loan-status` | My Loan Status | large |
| `milestones` | Progress Tracker | large |
| `documents` | My Documents | medium |
| `messages` | Messages | medium |
| `contacts` | My Team | small |

**Loan Officer** (layout: `grid`)
| Widget | Title | Size |
|--------|-------|------|
| `pipeline` | My Pipeline | large |
| `performance` | Performance Metrics | medium |
| `pending-actions` | Pending Actions | medium |
| `rate-sheet` | Today's Rates | small |

**Realtor** (layout: `cards`)
| Widget | Title | Size |
|--------|-------|------|
| `referrals` | My Referrals | large |
| `active-loans` | Active Loans | medium |
| `referral-stats` | Referral Performance | medium |

**Branch Manager** (layout: `grid`)
| Widget | Title | Size |
|--------|-------|------|
| `branch-performance` | Branch Performance | large |
| `team-pipeline` | Team Pipeline | large |
| `leaderboard` | Leaderboard | medium |

**Admin / Broker**: Falls back to borrower defaults.

### Dashboard Data Endpoint

`GET /persona-views/dashboard` returns role-specific data:

| Role | Response Key | Data |
|------|-------------|------|
| `borrower` | `myLoans` | Loans, documents, stats (totalLoans, activeLoans, documentsUploaded) |
| `loan_officer_retail` / `loan_officer_tpo` | `pipeline` | Loans with filters, stats (totalPipeline, totalVolume, byStatus) |
| `realtor` | `referrals` | Consent-based loans, stats (activeReferrals, closedLoans, totalVolume) |
| `broker` | `submissions` | Broker loans, stats (submissions, approved, inProcess, totalVolume) |
| `branch_manager` | `branch` | Team loans, stats (totalPipeline, totalVolume, teamSize, byLO), teamMembers |
| `admin` | `overview` | All loans, stats (totalUsers, totalLoans, activeLoans, totalVolume) |

### Mobile Implementation: Persona View Hook

```typescript
// hooks/usePersonaView.ts
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const API = 'https://fahm-server.onrender.com/api/v1';

export function usePersonaView() {
  const { token } = useAuth();
  const [view, setView] = useState<PersonaView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/persona-views/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setView(data.data.view))
      .finally(() => setLoading(false));
  }, [token]);

  const updateView = async (patch: Partial<ViewConfiguration>) => {
    const res = await fetch(`${API}/persona-views/me`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ viewConfiguration: patch }),
    });
    const data = await res.json();
    setView(data.data.view);
  };

  const resetToDefault = async () => {
    const res = await fetch(`${API}/persona-views/me/reset`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setView(data.data.view);
  };

  return { view, loading, updateView, resetToDefault };
}
```

---

## 7. Menu Config (Key-Value Store)

A simple key-value store for arbitrary menu configuration. Separate from the Menu collection.

### API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/menu-config` | Authenticated | Get menu config value |
| PUT | `/api/v1/menu-config` | Admin | Update menu config |

### Default Seed Data

```json
{
  "mainMenu": [
    { "label": "Home", "path": "/", "icon": "home" },
    { "label": "Loans", "path": "/loans", "icon": "dollar-sign" },
    { "label": "Documents", "path": "/documents", "icon": "file" },
    { "label": "Notifications", "path": "/notifications", "icon": "bell" }
  ],
  "sidebarMenu": [
    { "label": "Settings", "path": "/settings", "icon": "settings" },
    { "label": "Help", "path": "/help", "icon": "help-circle" }
  ]
}
```

---

## 8. Real-Time Content Updates (WebSocket)

When an admin changes menus, screens, or content, a WebSocket broadcast notifies all connected clients to refresh their data.

### WebSocket Connection

```
ws://fahm-server.onrender.com/ws/content?token=<JWT>
```

- Requires valid JWT token as query parameter
- Server sends heartbeat pings every 30 seconds
- Auto-reconnect on disconnect

### Event Types

| Event Type | Triggered By | Payload |
|-----------|-------------|---------|
| `menu_updated` | Menu create/update/delete/reset/restore | `{ type, timestamp }` |
| `screen_updated` | Screen create/update/publish | `{ type, screenId, alias, timestamp }` |
| `content_updated` | Generic content mutation | `{ type, timestamp }` |

### Admin Broadcast Endpoints (REST)

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/content-updates/notify` | `{ type, screenId?, alias?, roles? }` | Broadcast any event, optionally target roles |
| POST | `/api/v1/content-updates/screen-updated` | `{ screenId?, alias? }` | Broadcast screen update |
| POST | `/api/v1/content-updates/menu-updated` | (none) | Broadcast menu update |
| GET | `/api/v1/content-updates/status` | -- | Get connected client count |

### Mobile Implementation: WebSocket Hook

```typescript
// hooks/useContentUpdates.ts
import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

type EventType = 'menu_updated' | 'screen_updated' | 'content_updated';

interface ContentEvent {
  type: EventType;
  screenId?: string;
  alias?: string;
  timestamp: number;
}

export function useContentUpdates(onEvent: (event: ContentEvent) => void) {
  const { token } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    if (!token) return;

    const ws = new WebSocket(
      `wss://fahm-server.onrender.com/ws/content?token=${token}`
    );

    ws.onopen = () => console.log('[WS] Connected');

    ws.onmessage = (event) => {
      try {
        const data: ContentEvent = JSON.parse(event.data);
        onEvent(data);
      } catch {}
    };

    ws.onclose = () => {
      // Auto-reconnect after 5 seconds
      reconnectTimer.current = setTimeout(connect, 5000);
    };

    ws.onerror = () => ws.close();

    wsRef.current = ws;
  }, [token, onEvent]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);
}

// Usage: auto-refresh menus when admin changes them
function App() {
  const queryClient = useQueryClient();

  useContentUpdates((event) => {
    switch (event.type) {
      case 'menu_updated':
        queryClient.invalidateQueries(['menus']);
        break;
      case 'screen_updated':
        queryClient.invalidateQueries(['screens', event.alias]);
        break;
      case 'content_updated':
        queryClient.invalidateQueries(['cms']);
        break;
    }
  });
}
```

---

## 9. Putting It All Together: App Initialization Flow

```
1. User opens app
   |
2. Login -> POST /auth/login
   |  Returns: token, refreshToken, user (with role + capabilities)
   |
3. Fetch menus -> GET /menus/grouped
   |  Roles returned as populated objects: { _id, name, slug }
   |  Filter by menu.roles.some(r => r.slug === user.role.slug) + visible
   |  Build tab bar, drawer, stack navigation
   |
4. Fetch feature flags -> GET /cms/feature-flags
   |  Evaluate by role + app version
   |
5. Fetch persona view -> GET /persona-views/me
   |  Apply dashboard layout, widgets, preferences
   |
6. Connect WebSocket -> ws://.../ws/content?token=...
   |  Listen for menu_updated, screen_updated, content_updated
   |
7. User navigates to a CMS screen
   |  Fetch -> GET /cms/screens/:slug
   |  Render components via CmsRenderer
   |
8. Admin changes menus/screens in CMS admin panel
   |  WebSocket broadcast -> all connected clients
   |  Mobile app auto-refreshes affected data
```

---

## 10. Seeding Order

```bash
node scripts/seedCapabilities.js    # 1. Capabilities
node scripts/seedRoles.js           # 2. Roles
node scripts/seedUsers.js           # 3. Users
node scripts/seedMenus.js           # 4. Menus (tabs, stack screens)
node scripts/seedMenuConfig.js      # 5. Menu config (key-value)
node scripts/seedCms.js             # 6. CMS screens, nav configs, flags, components
```

---

## 11. TypeScript Types (Complete)

```typescript
// types/cms.ts

export interface Role {
  _id: string;
  name: string;
  slug: string;
}

export interface Menu {
  _id: string;
  alias: string;
  slug: string;
  label: string;
  icon: string;
  route: string;
  type: 'drawer' | 'tab' | 'stack';
  order: number;
  visible: boolean;
  override: boolean;
  roles: Role[];        // Populated Role objects from ObjectId refs
  content: any | null;
  analytics: {
    views?: number;
    uniqueUsers?: number;
    lastAccessed?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface GroupedMenus {
  drawer: Menu[];
  tab: Menu[];
  stack: Menu[];
}

export interface Screen {
  _id: string;
  slug: string;
  title: string;
  route: string;
  navigation: {
    type: 'drawer' | 'tab' | 'stack' | 'modal';
    icon?: string;
    order?: number;
  };
  roles: string[];
  tenant_scope: string[];
  components: ScreenComponent[];
  status: 'draft' | 'published';
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScreenComponent {
  type: string;
  props: Record<string, any>;
}

export interface NavigationConfig {
  _id: string;
  type: 'drawer' | 'tab' | 'stack' | 'modal';
  role: string;
  items: { screen_slug: string; order: number }[];
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

export interface Widget {
  widgetId: string;
  title: string;
  enabled: boolean;
  order: number;
  size: 'small' | 'medium' | 'large' | 'full';
  refreshInterval?: number;
  settings?: Record<string, any>;
}

export interface PersonaView {
  _id: string;
  user: string;
  role: string;
  viewConfiguration: ViewConfiguration;
  lastUpdated: string;
  isDefault: boolean;
}

export interface ViewConfiguration {
  dashboard: {
    layout: 'grid' | 'list' | 'cards' | 'compact';
    widgets: Widget[];
    defaultFilters: {
      dateRange?: string;
      status?: string[];
      loanType?: string[];
      source?: string[];
    };
  };
  navigation: {
    homeView: 'dashboard' | 'pipeline' | 'loans' | 'documents' | 'messages';
    pinnedItems: { type: string; label: string; route: string; order: number }[];
    hiddenMenuItems: string[];
  };
  notifications: {
    pushEnabled: boolean;
    emailEnabled: boolean;
    smsEnabled: boolean;
    categories: {
      milestones: boolean;
      documents: boolean;
      messages: boolean;
      rates: boolean;
      marketing: boolean;
    };
    quietHours: {
      enabled: boolean;
      startTime?: string;
      endTime?: string;
      timezone?: string;
    };
  };
  dataVisibility: Record<string, boolean>;
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    dateFormat: string;
    currencyFormat: string;
    timezone: string;
  };
  branding: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
    partnerName?: string;
    partnerLogo?: string;
  };
}

export interface MenuVersion {
  _id: string;
  version: number;
  menus: Menu[];        // Roles stored as ObjectIds in snapshots (not populated)
  createdBy: string;
  createdAt: string;
  comment: string;
}

// Helper: check if user's role matches a menu's roles
export function userCanSeeMenu(menu: Menu, userRoleSlug: string): boolean {
  return menu.visible && menu.roles.some((r) => r.slug === userRoleSlug);
}

export interface ContentEvent {
  type: 'menu_updated' | 'screen_updated' | 'content_updated';
  screenId?: string;
  alias?: string;
  timestamp: number;
}
```
