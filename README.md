# News API - Eskalate Backend Assessment

A production-ready RESTful API for a news platform where **Authors** publish content and **Readers** consume it, with an analytics engine for engagement tracking.

## 🛠 Technology Stack

| Layer          | Technology           | Rationale                                   |
| -------------- | -------------------- | ------------------------------------------- |
| **Runtime**    | Node.js + TypeScript | Type safety, modern JS features             |
| **Framework**  | Express.js           | Minimal, fast, industry standard            |
| **Database**   | PostgreSQL           | Robust relational database                  |
| **ORM**        | Prisma               | Type-safe queries, easy migrations          |
| **Auth**       | JWT + bcrypt         | Stateless auth with salted password hashing |
| **Validation** | Zod                  | Schema-based validation with TS inference   |
| **Job Queue**  | Redis + BullMQ       | Reliable, distributed job processing        |
| **Testing**    | Jest + Supertest     | Fast unit tests with HTTP assertions        |

## 📋 Prerequisites

- **Node.js** >= 18.x
- **PostgreSQL** >= 13.x
- **Redis** >= 6.x (for BullMQ job queue)

## 🚀 Setup & Run

### 1. Clone & Install

```bash
git clone <repo-url>
cd news-api
npm install
```

### 2. Environment Variables

Copy the example env file and configure:

```bash
cp .env.example .env
```

| Variable         | Description                  | Default                                                  |
| ---------------- | ---------------------------- | -------------------------------------------------------- |
| `DATABASE_URL`   | PostgreSQL connection string | `postgresql://postgres:password@localhost:5432/news_api` |
| `JWT_SECRET`     | Secret key for JWT signing   | `your-super-secret-jwt-key`                              |
| `JWT_EXPIRES_IN` | JWT token expiration         | `24h`                                                    |
| `PORT`           | Server port                  | `3000`                                                   |
| `REDIS_URL`      | Redis connection string      | `redis://localhost:6379`                                 |
| `NODE_ENV`       | Environment mode             | `development`                                            |

### 3. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

# (Optional) Open Prisma Studio to inspect data
npx prisma studio
```

### 4. Run the Server

```bash
# Development (with hot reload)
npm run dev

# Production
npm run build
npm start
```

### 5. Run Tests

```bash
npm test
```

## 📡 API Endpoints

### Authentication

| Method | Endpoint           | Description         | Auth |
| ------ | ------------------ | ------------------- | ---- |
| POST   | `/api/auth/signup` | Register new user   | None |
| POST   | `/api/auth/login`  | Login & receive JWT | None |

### Articles

| Method | Endpoint            | Description                            | Auth           |
| ------ | ------------------- | -------------------------------------- | -------------- |
| GET    | `/api/articles`     | Public news feed (filtered, paginated) | Optional       |
| GET    | `/api/articles/:id` | Read article (tracks reads)            | Optional       |
| GET    | `/api/articles/me`  | Author's own articles                  | Author         |
| POST   | `/api/articles`     | Create article                         | Author         |
| PUT    | `/api/articles/:id` | Update article                         | Author (owner) |
| DELETE | `/api/articles/:id` | Soft delete article                    | Author (owner) |

### Analytics

| Method | Endpoint                | Description                  | Auth   |
| ------ | ----------------------- | ---------------------------- | ------ |
| GET    | `/api/author/dashboard` | Author performance dashboard | Author |

### Query Parameters (GET /api/articles)

- `category` – Exact match filter (e.g., `?category=Tech`)
- `author` – Partial name match (e.g., `?author=John`)
- `q` – Keyword search in title (e.g., `?q=breaking`)
- `page` – Page number (default: 1)
- `pageSize` – Items per page (default: 10)

## 🏗 Architecture & Design Decisions

### Project Structure

```
src/
├── config/          # Environment & database configuration
├── controllers/     # Request handlers (thin layer)
├── services/        # Business logic (testable)
├── middleware/       # Auth, RBAC, validation, error handling
├── routes/          # Express route definitions
├── validators/      # Zod validation schemas
├── jobs/            # BullMQ analytics aggregation job
├── utils/           # Response builders
└── server.ts        # Application entry point
```

### Key Design Decisions

1. **Soft Delete**: Articles are never physically deleted. `DELETE` sets `deletedAt` timestamp; all public queries filter `deletedAt = null`.

2. **Non-blocking Read Tracking**: `ReadLog` entries are created fire-and-forget (no `await`), so article retrieval response time is unaffected.

3. **Read Rate Limiting**: An in-memory Map tracks the last read timestamp per user+article. Reads within 10 seconds are deduplicated to prevent view count inflation.

4. **Analytics Aggregation**: BullMQ processes a daily cron job (midnight GMT) that aggregates `ReadLog` entries into `DailyAnalytics` via upsert.

5. **RBAC Middleware**: Role-based access control with `authenticate`, `optionalAuth`, and `authorizeRole` middleware for clean, declarative route protection.

6. **Graceful Redis Fallback**: If Redis is unavailable, the API still works — only the job queue is disabled with a warning.

## 🔐 Security

- **Password Hashing**: bcrypt with 12 salt rounds
- **JWT**: Contains `sub` (userId) and `role` claims, 24h expiry
- **Strong Password Policy**: 8+ chars, uppercase, lowercase, digit, special character
- **Input Validation**: Centralized Zod schemas for all request bodies
- **Error Handling**: Standardized responses, no stack traces leaked in production
- **RBAC**: Author-only and Reader-only route guards

## 📊 Response Format

### Base Response

```json
{
  "Success": true,
  "Message": "Operation successful",
  "Object": { "...": "..." },
  "Errors": null
}
```

### Paginated Response

```json
{
  "Success": true,
  "Message": "Items retrieved",
  "Object": [],
  "PageNumber": 1,
  "PageSize": 10,
  "TotalSize": 25,
  "Errors": null
}
```
