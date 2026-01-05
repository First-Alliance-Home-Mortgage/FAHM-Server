# FAHM Mobile Backend API Guide

Design reference for building a Node.js (Express) + MongoDB backend that supports the FAHM Mobile role journeys.

---

## 1. Project Structure

```
backend/
├─ src/
│  ├─ config/
│  │  ├─ env.ts
│  │  └─ db.ts
│  ├─ middleware/
│  │  ├─ auth.ts
│  │  ├─ roleGuard.ts
│  │  ├─ permissions.ts
│  │  └─ errorHandler.ts
│  ├─ modules/
│  │  ├─ auth/
│  │  │  ├─ auth.controller.ts
│  │  │  ├─ auth.routes.ts
│  │  │  └─ auth.service.ts
│  │  ├─ users/
│  │  │  ├─ user.model.ts
│  │  │  ├─ user.controller.ts
│  │  │  ├─ user.routes.ts
│  │  │  └─ user.service.ts
│  │  ├─ loans/
│  │  │  ├─ loan.model.ts
│  │  │  ├─ loan.controller.ts
│  │  │  ├─ loan.routes.ts
│  │  │  └─ loan.service.ts
│  │  ├─ documents/
│  │  │  ├─ document.model.ts
│  │  │  ├─ document.controller.ts
│  │  │  ├─ document.routes.ts
│  │  │  └─ document.service.ts
│  │  ├─ pipeline/
│  │  │  ├─ pipeline.controller.ts
│  │  │  ├─ pipeline.routes.ts
│  │  │  └─ pipeline.service.ts
│  │  ├─ referrals/
│  │  │  ├─ referral.model.ts
│  │  │  ├─ referral.controller.ts
│  │  │  ├─ referral.routes.ts
│  │  │  └─ referral.service.ts
│  │  ├─ rates/
│  │  │  ├─ rateSheet.model.ts
│  │  │  ├─ rates.controller.ts
│  │  │  ├─ rates.routes.ts
│  │  │  └─ rates.service.ts
│  │  ├─ notifications/
│  │  │  ├─ notification.model.ts
│  │  │  ├─ notification.controller.ts
│  │  │  ├─ notification.routes.ts
│  │  │  └─ notification.service.ts
│  │  └─ analytics/
│  │     ├─ analytics.controller.ts
│  │     ├─ analytics.routes.ts
│  │     └─ analytics.service.ts
│  ├─ utils/
│  │  ├─ logger.ts
│  │  ├─ asyncHandler.ts
│  │  └─ permissions.ts
│  ├─ app.ts
│  └─ server.ts
├─ package.json
├─ tsconfig.json
└─ .env
```

---

## 2. Environment & Config

```
PORT=8080
NODE_ENV=development
MONGO_URI=mongodb+srv://...
JWT_SECRET=super-secret
JWT_EXPIRATION=1d
REFRESH_TOKEN_EXPIRATION=30d
AWS_BUCKET=...
RATE_ENGINE_URL=https://pricing.example.com
```

- `config/env.ts`: loads and validates env vars (use `zod` or `joi`).
- `config/db.ts`: initializes Mongoose connection and exports connection instance.

---

## 3. Domain Modeling (MongoDB + Mongoose)

### 3.1 User Model (`user.model.ts`)
Supports all 7 roles from the mobile app.

```ts
export type Role =
  | 'borrower'
  | 'loan_officer_tpo'
  | 'loan_officer_retail'
  | 'broker'
  | 'branch_manager'
  | 'realtor'
  | 'admin';

const UserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: roles, required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  licenseNumber: String,
  status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
  preferences: {
    notifications: { email: Boolean, push: Boolean },
    theme: { type: String, enum: ['light', 'dark'], default: 'light' },
  },
}, { timestamps: true });
```

### 3.2 Loan Model (`loan.model.ts`)
Aligns with borrower, LO, broker, realtor journeys.

```ts
const LoanSchema = new Schema({
  loanNumber: { type: String, unique: true },
  borrower: {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    contactInfo: {
      email: String,
      phone: String,
      address: String,
    },
    employment: {
      employer: String,
      position: String,
      annualIncome: Number,
    },
  },
  property: {
    address: String,
    purchasePrice: Number,
    occupancy: { type: String, enum: ['primary', 'secondary', 'investment'] },
  },
  loanDetails: {
    amount: Number,
    termMonths: Number,
    interestRate: Number,
    product: {
      type: String,
      enum: ['30yr_fixed', '15yr_fixed', '5_1_arm', '7_1_arm', 'fha', 'va', 'jumbo'],
    },
    lock: {
      rate: Number,
      apr: Number,
      lockDate: Date,
      expirationDate: Date,
      status: { type: String, enum: ['none', 'locked', 'expired'], default: 'none' },
    },
  },
  status: {
    stage: {
      type: String,
      enum: ['prospect', 'application', 'processing', 'underwriting', 'conditions', 'clear_to_close', 'funded', 'withdrawn'],
      default: 'prospect',
    },
    milestoneHistory: [
      {
        stage: String,
        description: String,
        date: Date,
        actor: { type: Schema.Types.ObjectId, ref: 'User' },
      },
    ],
    assignedTo: {
      loanOfficer: { type: Schema.Types.ObjectId, ref: 'User' },
      processor: { type: Schema.Types.ObjectId, ref: 'User' },
      branchManager: { type: Schema.Types.ObjectId, ref: 'User' },
    },
  },
  documents: [
    {
      documentId: { type: Schema.Types.ObjectId, ref: 'Document' },
      status: { type: String, enum: ['pending', 'received', 'rejected'], default: 'pending' },
    },
  ],
  brokerSubmission: {
    brokerId: { type: Schema.Types.ObjectId, ref: 'User' },
    compensation: Number,
    submissionDate: Date,
    notes: String,
  },
}, { timestamps: true });
```

### 3.3 Document Model (`document.model.ts`)
Supports scanner, upload flows.

```ts
const DocumentSchema = new Schema({
  loanId: { type: Schema.Types.ObjectId, ref: 'Loan', required: true },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['paystub', 'w2', 'bank_statement', 'tax_return', 'id', 'other'], required: true },
  name: String,
  storage: {
    provider: { type: String, enum: ['s3', 'gcs', 'azure'], default: 's3' },
    key: String,
    url: String,
  },
  status: { type: String, enum: ['pending_review', 'accepted', 'rejected'], default: 'pending_review' },
  reviewerId: { type: Schema.Types.ObjectId, ref: 'User' },
  rejectionReason: String,
  metadata: {
    uploadedFrom: { type: String, enum: ['mobile', 'web', 'api'] },
    source: { type: String, enum: ['scanner', 'upload', 'email'] },
  },
}, { timestamps: true });
```

### 3.4 Referral Model (`referral.model.ts`)
For realtor → LO, broker submissions.

```ts
const ReferralSchema = new Schema({
  referrerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  referralType: { type: String, enum: ['realtor', 'broker'], required: true },
  client: {
    name: String,
    email: String,
    phone: String,
    propertyAddress: String,
    budget: Number,
  },
  preferredLoanOfficer: { type: Schema.Types.ObjectId, ref: 'User' },
  status: {
    type: String,
    enum: ['submitted', 'contacted', 'preapproved', 'application', 'approved', 'funded', 'declined'],
    default: 'submitted',
  },
  relatedLoanId: { type: Schema.Types.ObjectId, ref: 'Loan' },
  notes: [{
    message: String,
    authorId: { type: Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });
```

### 3.5 Rate Sheet Model (`rateSheet.model.ts`)
Handles broker/realtor rate tab data.

```ts
const RateSheetSchema = new Schema({
  productId: { type: String, required: true, unique: true },
  name: String,
  baseRate: Number,
  apr: Number,
  points: Number,
  monthlyPayment: Number,
  lockPeriodDays: Number,
  changeBps: Number,
  lastUpdated: { type: Date, default: Date.now },
  eligibility: {
    minCreditScore: Number,
    maxLtv: Number,
    occupancy: [String],
  },
  channel: { type: String, enum: ['retail', 'wholesale'], required: true },
}, { timestamps: true });
```

### 3.6 Notification Model (`notification.model.ts`)
Supports push in app.

```ts
const NotificationSchema = new Schema({
  recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['document', 'pipeline', 'rate', 'system'] },
  title: String,
  message: String,
  metadata: Schema.Types.Mixed,
  read: { type: Boolean, default: false },
  readAt: Date,
}, { timestamps: true });
```

---

## 4. Authentication & Authorization

### 4.1 Auth Flow
1. **Login** (`POST /api/auth/login`)
   - Input: email, password
   - Validates credentials, returns access + refresh tokens
   - Access token (JWT) contains `sub`, `role`, `permissions`
   - Refresh token stored in Mongo (revokable)
2. **Refresh** (`POST /api/auth/refresh`)
   - Validates refresh token, issues new access token
3. **Logout** (`POST /api/auth/logout`)
   - Revokes refresh token by ID

### 4.2 Middleware Stack

```ts
app.use(cors());
app.use(helmet());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestId());
```

**Auth Pipeline per request**:
1. `authMiddleware`: verifies JWT, attaches `req.user`
2. `roleGuard(allowedRoles)`: ensures role is allowed
3. `permissions(requiredCaps)`: fine-grained permission check

Example usage:

```ts
router.get('/loans/:id', auth(), roleGuard(['loan_officer_retail', 'loan_officer_tpo', 'branch_manager', 'admin']), permissions(['view_loan']), controller.getLoanById);
```

---

## 5. Routes & Controllers

### 5.1 Auth Routes (`/api/auth`)
- `POST /login`
- `POST /refresh`
- `POST /logout`
- `POST /register` (admin-only)

### 5.2 User Routes (`/api/users`)
- `GET /me` – current user profile
- `PATCH /me/preferences` – update theme/notification settings
- `GET /` – list users (admin, branch manager)
- `POST /` – create user (admin)
- `PATCH /:id` – update user and role
- `DELETE /:id` – deactivate user

### 5.3 Loan Routes (`/api/loans`)
Aligned with borrower + LO journeys.

- `GET /` – filtered list (supports query by status, role-based scopes)
- `GET /pipeline` – aggregated pipeline metrics for LOs/Managers
- `GET /:id` – loan details (permission aware)
- `POST /` – create new loan (LO/borrower)
- `PATCH /:id` – general loan updates
- `POST /:id/assign` – assign LO/processor
- `POST /:id/status` – update stage/milestone
- `POST /:id/lock` – execute rate lock
- `GET /:id/history` – timeline

### 5.4 Document Routes (`/api/documents`)
Fulfill borrower upload, LO review flows.

- `POST /upload-url` – get signed URL for uploads
- `POST /` – create document entry after upload
- `GET /loan/:loanId` – list docs for loan (role filtered)
- `GET /:id` – get document metadata
- `PATCH /:id/status` – accept/reject document (LO/processor)
- `POST /:id/rerequest` – request updated doc, sends notification

### 5.5 Pipeline Routes (`/api/pipeline`)
- `GET /summary` – metrics by role
- `GET /loans` – paginated pipeline view
- `GET /tasks` – action items

### 5.6 Referral Routes (`/api/referrals`)
For realtors/brokers.

- `POST /` – create referral
- `GET /` – list own referrals
- `GET /:id` – referral detail
- `PATCH /:id/status` – update status (LO/Manager)
- `POST /:id/notes` – add note

### 5.7 Rates Routes (`/api/rates`)
- `GET /current` – latest rate sheet (filtered by role/channel)
- `POST /refresh` – pull from external engine (admin)
- `GET /history` – rate changes
- `POST /alerts` – create rate alert for user

### 5.8 Notification Routes (`/api/notifications`)
- `GET /` – list user notifications
- `PATCH /:id/read` – mark read
- `POST /test` – send test notification (admin)

### 5.9 Analytics & Reporting (`/api/analytics`)
- `GET /branch` – branch performance (manager)
- `GET /team` – LO leaderboard
- `GET /compliance` – outstanding items
- `POST /export` – export CSV/PDF

---

## 6. Controllers & Services Pattern

Each module follows `controller -> service -> model` layering:

1. **Controller**: HTTP request handling, validation, response shaping.
2. **Service**: Business logic, orchestrates multiple models.
3. **Model**: Mongoose interactions.

Example (Loan Controller snippet):

```ts
export const createLoan = asyncHandler(async (req, res) => {
  const payload = loanSchema.parse(req.body); // zod validation
  const loan = await loanService.createLoan({
    payload,
    createdBy: req.user.id,
  });
  res.status(201).json(loan);
});
```

Service example:

```ts
export async function createLoan({ payload, createdBy }: CreateLoanInput) {
  const loanNumber = await sequenceService.next('loan');
  const loan = await LoanModel.create({
    ...payload,
    loanNumber,
    'status.milestoneHistory': [{ stage: 'application', date: new Date(), actor: createdBy }],
  });
  eventBus.publish('loan.created', loan);
  return loan;
}
```

---

## 7. Middleware Details

### 7.1 `auth.ts`
- Extracts Bearer token
- Verifies JWT using `JWT_SECRET`
- Attaches `req.user = { id, role, permissions }`
- Handles token expiration, invalid signatures

### 7.2 `roleGuard.ts`
- Accepts array of allowed roles
- Checks `req.user.role`
- Returns 403 if not allowed

### 7.3 `permissions.ts`
- Accepts capability list (same as front-end `usePermissions`)
- Example caps: `view_loan`, `edit_loan`, `manage_users`
- Maps roles to caps (must match FE mapping)

### 7.4 `errorHandler.ts`
- Centralized error formatter
- Handles `zod` validation errors, Mongoose errors, custom errors
- Example output:

```json
{
  "error": {
    "message": "Validation failed",
    "details": [
      { "field": "loanAmount", "message": "loanAmount must be > 0" }
    ],
    "requestId": "..."
  }
}
```

### 7.5 `requestContext` (optional)
- Adds `req.context = { requestId, userAgent, ... }`
- Useful for logging/tracing

---

## 8. Platform Events & Notifications

- Use lightweight event bus (e.g., `node:events`, `bullmq`, or `rabbitmq`).
- Events: `loan.created`, `loan.statusChanged`, `document.uploaded`, `rate.locked`, `referral.created`.
- Notification service listens and creates Notification documents + push via FCM/OneSignal.

Example event payload:

```json
{
  "event": "document.uploaded",
  "loanId": "...",
  "documentId": "...",
  "uploadedBy": "userId",
  "type": "paystub"
}
```

---

## 9. Alignment with Role Journeys

| Role | Key APIs | Notes |
|------|----------|-------|
| Borrower | `/api/loans`, `/api/documents`, `/api/notifications` | Submit docs, view status, receive alerts |
| Loan Officer (Retail) | `/api/loans`, `/api/pipeline`, `/api/documents`, `/api/rates` | Manage pipeline, lock rates |
| Loan Officer (TPO) | `/api/referrals`, `/api/loans?channel=wholesale`, `/api/documents` | Review broker submissions |
| Broker | `/api/referrals`, `/api/loans`, `/api/rates?channel=wholesale` | Submit loans, monitor status |
| Branch Manager | `/api/pipeline/summary`, `/api/analytics/branch`, `/api/users` | Team oversight |
| Realtor | `/api/referrals`, `/api/rates` | Refer clients, track status |
| Admin | `/api/users`, `/api/integrations`, `/api/analytics`, `/api/notifications` | System control |

---

## 10. Testing Strategy

- Use `jest` + `supertest` for HTTP tests.
- Mock Mongo with `mongodb-memory-server`.
- Use factories for models (see `fishery` or custom).
- Integration tests for critical flows:
  - Borrower uploads document → LO review
  - Broker submits loan → TPO review → Branch manager view
  - Rate lock process
  - Referral lifecycle

Example test skeleton:

```ts
describe('Loan API', () => {
  it('creates loan for borrower', async () => {
    const token = await authTestHelper.login('borrower');
    const res = await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${token}`)
      .send(mockLoanPayload);
    expect(res.status).toBe(201);
  });
});
```

---

## 11. Deployment Considerations

- Use Docker container with multi-stage build (`node:20-alpine`).
- Environment-specific configs (dev/stage/prod).
- Use `pm2` or `node --watch` in dev.
- Observability: integrate with Datadog/New Relic or OpenTelemetry.
- Backup strategy for MongoDB (daily snapshots).
- Secrets management via AWS Secrets Manager/Azure Key Vault.

---

## 12. Future Enhancements

1. **GraphQL Gateway** for mobile to reduce round trips.
2. **Role-based webhooks** for third-party integrations (e.g., realtor CRM).
3. **Event sourcing** for audit logs.
4. **Fine-grained document permissions** (per doc type).
5. **Workflow engine** for milestone automation.

---

## 13. Setup & Scripts

### 13.1 Dependencies

```
npm init -y
npm install express mongoose zod jsonwebtoken bcryptjs cors helmet morgan uuid
npm install aws-sdk axios multer multer-s3
npm install dotenv pino pino-pretty dayjs cls-hooked
npm install http-errors rate-limiter-flexible

npm install -D typescript ts-node-dev @types/express @types/node @types/jsonwebtoken @types/bcryptjs @types/cors @types/morgan jest ts-jest @types/jest supertest @types/supertest eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier
```

### 13.2 package.json Scripts

```
"scripts": {
  "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
  "build": "tsc -p tsconfig.json",
  "start": "node dist/server.js",
  "lint": "eslint 'src/**/*.{ts,tsx}'",
  "format": "prettier --write 'src/**/*.ts'",
  "test": "jest --runInBand",
  "test:watch": "jest --watch",
  "seed": "ts-node ./scripts/seed.ts"
}
```

### 13.3 Recommended Tooling
- **ts-node-dev** for fast reloads.
- **Jest + Supertest** for endpoint tests.
- **ESLint + Prettier** to mirror Expo project standards.
- **Husky + lint-staged** (optional) for pre-commit checks.

---

## 14. Sample Implementation Snippets

### 14.1 `server.ts`

```ts
import { createServer } from 'http';
import app from './app';
import { connectDb } from './config/db';
import { env } from './config/env';
import logger from './utils/logger';

async function bootstrap() {
  await connectDb();
  const server = createServer(app);
  server.listen(env.PORT, () => {
    logger.info(`API listening on port ${env.PORT}`);
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
```

### 14.2 `app.ts`

```ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { requestContext } from './middleware/requestContext';

const app = express();

app.use(cors());
app.use(helmet());
app.use(morgan('combined'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestContext());

app.use('/api', routes);
app.use(errorHandler);

export default app;
```

### 14.3 Router Aggregator (`src/routes/index.ts`)

```ts
import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import userRoutes from '../modules/users/user.routes';
import loanRoutes from '../modules/loans/loan.routes';
import documentRoutes from '../modules/documents/document.routes';
import pipelineRoutes from '../modules/pipeline/pipeline.routes';
import referralRoutes from '../modules/referrals/referral.routes';
import rateRoutes from '../modules/rates/rates.routes';
import notificationRoutes from '../modules/notifications/notification.routes';
import analyticsRoutes from '../modules/analytics/analytics.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/loans', loanRoutes);
router.use('/documents', documentRoutes);
router.use('/pipeline', pipelineRoutes);
router.use('/referrals', referralRoutes);
router.use('/rates', rateRoutes);
router.use('/notifications', notificationRoutes);
router.use('/analytics', analyticsRoutes);

export default router;
```

### 14.4 Module Example (Loans)

**Routes**
```ts
const router = Router();
router.use(auth());

router.get('/', permissions(['view_loan']), loanController.listLoans);
router.post('/', roleGuard(['loan_officer_retail', 'loan_officer_tpo', 'borrower']), permissions(['create_loan']), loanController.createLoan);
router.get('/:id', permissions(['view_loan']), loanController.getLoanById);
router.post('/:id/status', permissions(['edit_loan']), loanController.updateLoanStatus);
router.post('/:id/lock', roleGuard(['loan_officer_retail']), permissions(['lock_rate']), loanController.lockLoanRate);

export default router;
```

**Controller**
```ts
export const updateLoanStatus = asyncHandler(async (req, res) => {
  const data = statusSchema.parse(req.body);
  const result = await loanService.updateStatus({
    loanId: req.params.id,
    ...data,
    actorId: req.user.id,
  });
  res.json(result);
});
```

**Service**
```ts
export async function updateStatus({ loanId, stage, note, actorId }: UpdateStatusInput) {
  const loan = await LoanModel.findById(loanId);
  if (!loan) throw new NotFound('Loan not found');

  loan.status.stage = stage;
  loan.status.milestoneHistory.push({ stage, description: note, date: new Date(), actor: actorId });
  await loan.save();

  eventBus.publish('loan.statusChanged', { loanId, stage, actorId });
  return loan;
}
```

### 14.5 Middleware Snippets

```ts
// auth.ts
export const auth = () => async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(new Unauthorized('Missing token'));
  try {
    const token = header.slice(7);
    req.user = jwt.verify(token, env.JWT_SECRET);
    return next();
  } catch (err) {
    return next(new Unauthorized('Invalid token'));
  }
};

// roleGuard.ts
export const roleGuard = (roles: Role[]) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new Forbidden('Role not allowed'));
  }
  return next();
};

// permissions.ts
export const permissions = (required: Capability[]) => (req, res, next) => {
  const caps = roleToCapabilities[req.user.role] || [];
  const hasAll = required.every((cap) => caps.includes(cap));
  return hasAll ? next() : next(new Forbidden('Insufficient permissions'));
};
```

### 14.6 Validation Layer Example

```ts
import { z } from 'zod';

export const createLoanSchema = z.object({
  borrowerId: z.string().uuid(),
  amount: z.number().min(50000),
  termMonths: z.enum(['180', '240', '360']).transform(Number),
  product: z.enum(['30yr_fixed', '15yr_fixed', '5_1_arm', '7_1_arm', 'fha', 'va', 'jumbo']),
  property: z.object({
    address: z.string(),
    purchasePrice: z.number().positive(),
    occupancy: z.enum(['primary', 'secondary', 'investment']),
  }),
});

export type CreateLoanInput = z.infer<typeof createLoanSchema>;
```

---

## 15. API Contract Examples

### 15.1 Create Loan (Borrower/LO)

**Request** `POST /api/loans`
```json
{
  "borrowerId": "64df...",
  "amount": 450000,
  "termMonths": 360,
  "product": "30yr_fixed",
  "property": {
    "address": "123 Maple St, Seattle, WA",
    "purchasePrice": 520000,
    "occupancy": "primary"
  }
}
```

**Response**
```json
{
  "id": "65ab...",
  "loanNumber": "L-20252345",
  "status": { "stage": "application" },
  "loanDetails": { "amount": 450000, "product": "30yr_fixed" },
  "borrower": { "userId": "64df..." },
  "createdAt": "2025-12-23T15:22:01.230Z"
}
```

### 15.2 Update Document Status (LO)

**Request** `PATCH /api/documents/{id}/status`
```json
{
  "status": "accepted",
  "note": "Looks good"
}
```

**Response**
```json
{
  "id": "doc_123",
  "status": "accepted",
  "reviewerId": "user_lo",
  "reviewedAt": "2025-12-23T16:00:00.000Z"
}
```

### 15.3 Create Referral (Realtor)

**Request** `POST /api/referrals`
```json
{
  "referralType": "realtor",
  "client": {
    "name": "Maya Chen",
    "email": "maya@example.com",
    "phone": "+1-555-111-2222",
    "propertyAddress": "89 Pine Ave",
    "budget": 750000
  },
  "preferredLoanOfficer": "lo_789"
}
```

**Response**
```json
{
  "id": "ref_321",
  "status": "submitted",
  "referralType": "realtor",
  "client": { "name": "Maya Chen" },
  "createdAt": "2025-12-23T10:45:00.000Z"
}
```

### 15.4 Rates Sheet (Broker/Realtor)

**Request** `GET /api/rates/current?channel=wholesale`

**Response**
```json
{
  "lastUpdated": "2025-12-23T09:30:00.000Z",
  "products": [
    {
      "productId": "30yr-fixed",
      "name": "30-Year Fixed",
      "baseRate": 6.125,
      "apr": 6.287,
      "points": 0.25,
      "monthlyPayment": 2730.42,
      "lockPeriodDays": 45,
      "changeBps": -12
    }
  ]
}
```

### 15.5 Pipeline Summary (Branch Manager)

**Request** `GET /api/pipeline/summary?branchId=xyz`

**Response**
```json
{
  "totals": {
    "loans": 84,
    "volume": 65400000,
    "fundedMtd": 18000000
  },
  "byStage": [
    { "stage": "processing", "count": 22 },
    { "stage": "underwriting", "count": 18 },
    { "stage": "clear_to_close", "count": 12 }
  ],
  "atRisk": [
    { "loanId": "L-1023", "daysInStage": 19, "assignedTo": "lo_55" }
  ]
}
```

---

## 16. Data Seeding & Fixtures

1. **Seed Script (`scripts/seed.ts`)**
   - Creates default admin user
   - Inserts sample borrowers, LOs, brokers, realtors
   - Populates rate sheet with baseline products
   - Seeds sample loans per stage for pipeline dashboards
   - Adds referral samples for realtor/broker testing

2. **Using Factories**
   - Define `makeUser`, `makeLoan`, `makeDocument` helpers leveraging `faker`
   - Supports testing + local dev parity with ROLE_JOURNEYS scenarios

3. **Migration Strategy**
   - Use `migrate-mongo` or versioned seed scripts to evolve schemas
   - Keep changelog in `docs/db-migrations.md`

4. **Sample Command**
```
NODE_ENV=development ts-node ./scripts/seed.ts
```

---

## 17. Observability & Ops

- **Logging**: Use `pino` with redact rules for PII (SSN, income).
- **Tracing**: Adopt OpenTelemetry; propagate `traceparent` header from mobile app.
- **Metrics**: Expose `/metrics` for Prometheus (request latency, DB ops, queue depth).
- **Health Checks**: Implement `/healthz` (app) and `/readyz` (DB connectivity).
- **Rate Limiting**: Apply `rate-limiter-flexible` on auth + upload endpoints.
- **Security**: Enable TLS termination, strict CORS, content security headers, audit logging.

---

**Last Updated**: December 23, 2025
