# BIZZ DEAL Backend Requirements

Project: **BIZZ DEAL – Your Success Is Our Deal**  
Document Type: Backend requirements for Antigravity / AI coding agent  
Version: 1.0

---

## 1. Goal

Build the backend API for **BIZZ DEAL**, a platform connecting:

- **Admin**
- **Member / Entrepreneur**
- **Customer**

The backend must support authentication, member/customer management, business listings, offers, vouchers, wallet, referrals, chat, meetings, notifications, analytics, reports, and audit logs.

The implementation should be clean, modular, secure, and production-ready enough for a real MVP.

---

## 2. Preferred Tech Stack

Use the following stack unless explicitly changed:

| Area | Requirement |
|---|---|
| Backend Framework | **NestJS** |
| Language | **TypeScript** |
| Database | **PostgreSQL** |
| ORM | **TypeORM** or Prisma, but keep one consistently |
| Auth | JWT + refresh tokens + OTP verification (**MSG91** third party) |
| File Storage | AWS S3 or Cloudinary abstraction |
| Push Notifications | Firebase Cloud Messaging |
| Realtime | Socket.IO / WebSocket |
| Validation | Zod Validation |
| API Style | REST APIs |
| Documentation | Swagger/OpenAPI |

Do not mix frameworks. Prefer NestJS modules, services, controllers, DTOs, guards, interceptors, and entities.

---

## 3. User Roles

The system has three main roles:

### Admin

Admin can manage the full platform:

- Members
- Customers
- Businesses
- Offers
- Deals
- Vouchers
- Meetings
- Notifications
- Reports
- Analytics
- Audit logs

### Member / Entrepreneur

Member can:

- Register and manage profile
- Create business profile
- Create/edit/delete offers
- Create deals
- Track referrals
- Track voucher performance
- View wallet/savings analytics
- Use chat and meetings

### Customer

Customer can:

- Register and login
- Search businesses
- View offers/deals
- Receive/redeem vouchers
- Track wallet/savings
- Use chat and meetings if enabled
- Receive notifications

---

## 4. Core Backend Modules

Create these backend modules:

1. Authentication Module
2. User Module
3. Business Module
4. Offer / Deal Module
5. Voucher Module
6. Wallet Module
7. Referral Module
8. Chat Module
9. Meeting Module
10. Notification Module
11. Analytics Module
12. Report Module
13. Audit Log Module
14. File Upload Module

Keep every module independent and organized.

Recommended NestJS structure:

```txt
src/
  main.ts
  app.module.ts
  config/
  common/
    decorators/
    filters/
    guards/
    interceptors/
    pipes/
    utils/
  database/
    migrations/
    seeds/
  modules/
    auth/
    users/
    businesses/
    offers/
    vouchers/
    wallet/
    referrals/
    chat/
    meetings/
    notifications/
    analytics/
    reports/
    audit-logs/
    files/
```

---

## 5. Authentication Requirements

Authentication must support:

- User login
- User logout
- Member registration
- Customer registration
- OTP send
- OTP verification
- Forgot PIN
- Reset PIN
- Access token refresh
- Role-based access control

### Auth APIs

```http
POST /auth/login
POST /auth/register-member
POST /auth/register-customer
POST /auth/send-otp
POST /auth/verify-otp
POST /auth/forgot-pin
POST /auth/reset-pin
POST /auth/logout
POST /auth/refresh-token
```

### Login Request

```json
{
  "phoneNumber": "string",
  "pin": "string"
}
```

### Auth Rules

- Store PIN/password securely using hashing.
- Never store plain PIN/password.
- Use JWT access tokens.
- Use refresh tokens stored securely in DB.
- Use **MSG91** third-party service for sending and verifying OTPs.
- OTP must expire after a configured duration.
- OTP verification attempts must be limited.
- Logout should invalidate refresh token/session.
- Block suspended users from login.

---

## 6. User Management Requirements

Admin must be able to:

- View all members
- View all customers
- Approve members
- Reject members
- Suspend members
- Delete members
- Manage customer accounts

Users must be able to:

- View own profile
- Update own profile

### User APIs

```http
GET /users/members
GET /users/customers
GET /users/profile
PUT /users/profile
PUT /users/approve-member
PUT /users/reject-member
PUT /users/suspend-member
DELETE /users/member
```

### User Rules

- Admin-only APIs must use admin guard.
- Profile APIs must use authenticated user context.
- Do not allow customers to access member-only actions.
- Do not allow members to access admin actions.

---

## 7. Business Directory Requirements

The business directory must support:

- Business listing
- Business details
- Business search
- Filter by category
- Featured businesses

### Business APIs

```http
GET /businesses
GET /business/:id
GET /business/search
GET /business/category
GET /business/featured
POST /business
PUT /business/:id
DELETE /business/:id
```

### Business Rules

- Only approved members can create or manage businesses.
- A member should only edit their own business unless admin.
- Business search should support pagination.
- Business listing should support filters.
- Featured businesses should be controlled by admin.

---

## 8. Deals and Offers Requirements

Members must be able to:

- Create offer
- Edit offer
- Delete offer
- Create deals

Admins must be able to:

- Approve offers
- Reject offers

### Offer APIs

```http
POST /offers
PUT /offers/:id
DELETE /offers/:id
GET /offers
GET /offers/:id
PUT /offers/approve
PUT /offers/reject
```

### Offer Rules

- Offers created by members should be pending by default.
- Only approved offers should be visible to customers.
- Admin can approve/reject offers.
- Offer expiry date must be supported.
- Offer status must be tracked.

Recommended offer statuses:

```txt
PENDING
APPROVED
REJECTED
EXPIRED
INACTIVE
```

---

## 9. Voucher Requirements

Voucher module must support:

- Issue voucher
- Redeem voucher
- Voucher tracking
- Voucher history
- Customer voucher list

### Voucher APIs

```http
POST /voucher/issue
POST /voucher/redeem
GET /voucher/history
GET /voucher/details
GET /voucher/customer
```

### Voucher Rules

- Vouchers must have unique codes.
- Voucher redemption must be protected against duplicate redemption.
- Voucher should have status tracking.
- Voucher should store customer, offer, business, and member relationship.
- Voucher redemption should update wallet/savings if applicable.

Recommended voucher statuses:

```txt
ISSUED
REDEEMED
EXPIRED
CANCELLED
```

Future enhancement: QR voucher redemption.

---

## 10. Wallet Requirements

Wallet module must support:

- Wallet balance
- Transaction history
- Savings history
- Credit wallet
- Debit wallet

### Wallet APIs

```http
GET /wallet/balance
GET /wallet/history
GET /wallet/savings
POST /wallet/credit
POST /wallet/debit
```

### Wallet Rules

- Wallet transactions must be immutable.
- Never update transaction history directly.
- Balance should be derived safely or updated inside DB transaction.
- Credit/debit actions must create wallet transaction records.
- Admin/system-only APIs must be protected.

Recommended transaction types:

```txt
CREDIT
DEBIT
SAVING
VOUCHER_REDEEM
ADJUSTMENT
```

---

## 11. Referral Requirements

Referral module must support:

- Create referrals
- Update referral status
- Track conversion
- Referral list
- Referral details
- Referral analytics

### Referral APIs

```http
POST /referral
PUT /referral/status
GET /referral/list
GET /referral/details
GET /referral/analytics
```

### Referral Rules

- Referral should track referrer and referred user/customer.
- Referral status must be stored.
- Conversion should be tracked when referred user completes required action.

Recommended referral statuses:

```txt
PENDING
CONVERTED
REJECTED
EXPIRED
```

---

## 12. Chat Requirements

Realtime chat must support:

- One-to-one chat
- Image sharing
- File sharing
- Voice notes
- Message history

Use Socket.IO / WebSocket for realtime communication.

### Chat APIs

```http
GET /chat/list
GET /chat/messages
POST /chat/send
POST /chat/upload
```

### Chat Rules

- Store conversations and messages in DB.
- Store file URLs, not raw files, in DB.
- Validate message sender and receiver.
- Users should only read conversations they belong to.
- Use pagination for message history.

---

## 13. Meeting Requirements

Meetings module must support:

- Create meeting
- Update meeting
- Delete meeting
- Schedule events
- Attendance tracking
- Meeting list
- Meeting details

### Meeting APIs

```http
POST /meeting
PUT /meeting
DELETE /meeting
GET /meeting/list
GET /meeting/details
```

### Meeting Rules

- Meeting must have title, date/time, organizer, attendees, and status.
- Attendance tracking should store attendee status.
- Organizer/admin should manage meeting changes.

Recommended meeting statuses:

```txt
SCHEDULED
COMPLETED
CANCELLED
```

Recommended attendee statuses:

```txt
INVITED
ACCEPTED
REJECTED
ATTENDED
MISSED
```

---

## 14. Notification Requirements

Notification module must support:

- Push notifications
- Notification list
- Mark as read
- Delete notification

Use Firebase Cloud Messaging for push notifications.

### Notification APIs

```http
POST /notification/send
GET /notification/list
PUT /notification/read
DELETE /notification
```

### Notification Rules

- Store notifications in DB.
- Push notification sending should be separated from DB notification creation.
- Users should only see their own notifications.
- Support read/unread status.
- Store FCM tokens in user devices table.

---

## 15. Analytics Requirements

Analytics module must support:

### Admin Analytics

- Total members
- Active members
- Total customers
- Total vouchers
- Revenue analytics

### Member Analytics

- Business growth
- Referral count
- Offer performance

### Customer Analytics

- Wallet analytics
- Savings analytics

### Analytics APIs

```http
GET /analytics/admin
GET /analytics/member
GET /analytics/customer
```

### Analytics Rules

- Admin analytics must be admin-only.
- Member analytics should be scoped to the logged-in member.
- Customer analytics should be scoped to the logged-in customer.
- Use efficient aggregate queries.
- Avoid loading all rows into memory for analytics.

---

## 16. Reports Requirements

Reports module should support platform-level and module-level reports.

Initial reports:

- Members report
- Customers report
- Offers report
- Vouchers report
- Wallet transactions report
- Referrals report
- Meetings report

Reports can be implemented after the core MVP APIs.

---

## 17. Audit Log Requirements

Audit logs are required for security and admin traceability.

Track important actions such as:

- Login
- Logout
- Member approval
- Member rejection
- Member suspension
- Offer approval
- Offer rejection
- Voucher issue
- Voucher redeem
- Wallet credit/debit
- Admin changes

### Audit Log Rules

- Store actor user ID.
- Store action name.
- Store entity type and entity ID.
- Store old value/new value when useful.
- Store IP address and user agent if available.
- Audit logs should not be editable by normal APIs.

---

## 18. Database Tables

Use these tables for the MVP database design:

| # | Table | Purpose |
|---:|---|---|
| 1 | users | Common account table for admin, member, and customer |
| 2 | member_profiles | Extra member/entrepreneur details |
| 3 | customer_profiles | Extra customer details |
| 4 | businesses | Business directory listings |
| 5 | business_categories | Categories for businesses |
| 6 | offers | Deals/offers created by members |
| 7 | vouchers | Issued and redeemed vouchers |
| 8 | wallets | Wallet balance per user/customer |
| 9 | wallet_transactions | Credit, debit, savings, and voucher-related transactions |
| 10 | referrals | Referral tracking |
| 11 | notifications | In-app notification records |
| 12 | otps | OTP verification records |
| 13 | audit_logs | Security and admin action tracking |
| 14 | file_uploads | Uploaded images/files/voice-note metadata |
| 15 | chat_conversations | Chat conversation records |
| 16 | chat_messages | Chat message records |
| 17 | meetings | Meeting/event records |
| 18 | meeting_attendees | Meeting attendance records |
| 19 | refresh_tokens | JWT refresh token/session handling |
| 20 | user_devices | FCM tokens for push notifications |

---

## 19. Security Requirements

The backend must include:

- JWT authentication
- Refresh token handling
- Role-based access control
- Secure PIN/password hashing
- OTP verification
- Secure APIs
- Audit logs
- Rate limiting
- HTTPS enforcement in production
- Request validation
- Input sanitization
- Proper CORS configuration
- Environment-based secrets

### Security Rules

- Never hardcode secrets.
- Never return password/PIN hashes in API responses.
- Never expose refresh tokens in logs.
- Validate all request DTOs.
- Use guards for protected routes.
- Use role guards for admin/member/customer separation.
- Use rate limiting for auth and OTP APIs.

---

## 20. API Response Format

Use a consistent API response format.

### Success Response

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {}
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error message",
  "error": "ERROR_CODE"
}
```

### Pagination Response

```json
{
  "success": true,
  "message": "Data fetched successfully",
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

---

## 21. Coding Rules for Antigravity

Follow these rules while generating code:

1. Use clean NestJS module structure.
2. Keep controllers thin.
3. Put business logic in services.
4. Use DTOs for request validation.
5. Use entities/models for database tables.
6. Use guards for authentication and authorization.
7. Use decorators for current user and roles.
8. Use proper error handling.
9. Use database transactions for wallet, voucher redemption, and critical updates.
10. Use pagination for list APIs.
11. Use environment variables for configuration.
12. Do not create unnecessary abstractions.
13. Do not over-engineer the MVP.
14. Do not add payment gateway unless explicitly requested.
15. Do not add subscription payments in MVP unless explicitly requested.
16. Keep code readable and maintainable.
17. Add Swagger decorators where useful.
18. Add comments only where the logic is not obvious.
19. Avoid duplicate logic.
20. Prefer reusable common helpers for response format, pagination, and auth.

---

## 22. Implementation Order

Build in this order:

### Phase 1: Foundation

1. NestJS project setup
2. PostgreSQL connection
3. Environment config
4. Common response format
5. Global validation pipe
6. Swagger setup
7. Base entities

### Phase 2: Auth and Users

1. Users table/entity
2. Member/customer profiles
3. Register member
4. Register customer
5. Login
6. JWT auth guard
7. Role guard
8. OTP send/verify
9. Refresh token
10. Logout

### Phase 3: Business and Offers

1. Business categories
2. Business CRUD
3. Business search/filter
4. Offer CRUD
5. Offer approval/rejection
6. Featured businesses

### Phase 4: Vouchers and Wallet

1. Voucher issue
2. Voucher redeem
3. Voucher history
4. Wallet balance
5. Wallet transactions
6. Savings history

### Phase 5: Referrals and Notifications

1. Referral create/list/status
2. Referral analytics
3. Notification create/list/read/delete
4. FCM user device token support

### Phase 6: Chat and Meetings

1. Chat conversations
2. Chat messages
3. File upload for chat
4. Socket.IO events
5. Meetings CRUD
6. Meeting attendees
7. Attendance tracking

### Phase 7: Analytics, Reports, Audit Logs

1. Admin analytics
2. Member analytics
3. Customer analytics
4. Reports
5. Audit logs

---

## 23. Future Enhancements

Do not implement these in the first MVP unless asked:

- QR voucher redemption
- Revenue tracking
- Member ranking
- Advanced analytics
- Subscription payments
- Payment gateway integration

Design the database and services so these can be added later without major rewrites.

---

## 24. Acceptance Criteria

The backend is acceptable when:

- Project runs locally without errors.
- Database migrations/entities are complete.
- Auth APIs work with JWT.
- Role-based access works.
- Admin can manage members/customers.
- Members can manage businesses/offers.
- Customers can view businesses/offers.
- Vouchers can be issued and redeemed safely.
- Wallet transactions are recorded correctly.
- Referral tracking works.
- Notifications are stored and readable.
- Chat and meeting tables are ready.
- APIs follow consistent response format.
- Swagger documentation is available.
- Sensitive data is not exposed in responses.
- Basic error handling is implemented.

---

## 25. Important MVP Reminder

Keep the first version simple.

Build the required backend modules, but avoid unnecessary complexity. The goal is to create a clean MVP backend that can grow later.
