Below is the **FULL updated README** with:

* Slice 1 kept fully (unchanged content preserved).
* Slice 1 file explanations expanded (“Scenario: how the files dance together”).
* Added **Slice 2 – Classroom Creation** section (user story, acceptance, data model, new files, manual test sequence, AWS mapping).
* Nothing removed; only additions + deeper detail where you requested.

Copy–paste this whole thing over your existing `README.md`.

---

# Lab4All Backend – Slice 1 (Auth Skeleton) & Slice 2 (Classroom Creation)

> **Status:** *Local only (no AWS yet).* This README documents the **incremental backend build** derived from *Samer’s user stories*—auth first, then classroom creation.
> We will **grow this file slice‑by‑slice** (Join classroom → List classrooms → Sessions → Experiments → Realtime → Offline). Each slice adds its own section plus AWS mapping (how local code later maps to Cognito, DynamoDB, AppSync, etc.).

---

## 0. High‑Level Goal (Why We Started This Way)

We deliberately avoided AWS at the start to remove friction and build momentum. A tiny Express + JSON file implementation lets us:

| Benefit                                     | Why It Matters Later (AWS)                                                    |
| ------------------------------------------- | ----------------------------------------------------------------------------- |
| Rapid iteration (seconds to test)           | We stabilize request/response contracts **before** wiring AppSync/Cognito.    |
| Clear module seams (`db`, `auth`, `routes`) | Each seam becomes a swap point (File → DynamoDB, Local JWT → Cognito tokens). |
| Minimal cognitive load                      | Confidence now; layer complexity later without panic.                         |
| Early validation of data shapes             | Prevents expensive Dynamo table redesign later.                               |

> **Core Principle:** *Treat local implementation as a stub that preserves interfaces.* When we cut to AWS, we swap **implementation**, not **contracts**.

---

## 1. Current User Story (Slice 1 – Auth)

**Story (from Samer’s list, refined):**
*As a new user I can register with email/password + role (student / instructor) and then log in to obtain a JWT so subsequent requests know my identity & role.*

**Acceptance Implemented:**

* Unique email constraint (case insensitive).
* Password min length 8.
* Roles restricted: `student` | `instructor`.
* Registration returns sanitized user (no password).
* Login returns 1‑hour JWT with `sub` + `role` claims.
* Data persisted in `data/users.json`.

**Deferred (intentional):** Email verification, password reset, rate limiting, refresh tokens, social sign‑in, audit logging.

---

## 2. Project Directory (Slice 1 + Slice 2)

```
lab4all-backend/
  package.json
  tsconfig.json
  data/
    users.json
    classrooms.json          # (Slice 2)
  src/
    index.ts
    config.ts
    db.ts
    models.ts
    auth/
      hash.ts
      jwt.ts
    middleware/
      errorHandler.ts
      authUser.ts            # (Slice 2 – JWT auth middleware)
    routes/
      auth.ts
      classrooms.ts          # (Slice 2 – classroom create endpoint)
    repos/
      classroomRepo.ts       # (Slice 2)
    util/
      id.ts                  # (Slice 2 – id & code generators)
```

> **No extra domains** (e.g. `services/`) until a user story demands them.

---

## 3. File‑by‑File (Slice 1 Core) – Deep Explanations

For each: **What / Why / AWS Future / When to Touch / Example**

### 3.1 `package.json`

* **What:** Project manifest (deps + scripts).
* **Why:** Central location for runtime libs (`express`, `bcryptjs`, `jsonwebtoken`, `zod`) and dev tools (`ts-node-dev`).
* **AWS Future:** Add deployment scripts (`serverless deploy`), lint/test commands in CI. Possibly `@aws-sdk/client-dynamodb`, `amazon-cognito-identity-js`.
* **Touch When:** Adding libs or build tooling.
* **Example:** `npm run dev` starts hot‑reload server.

### 3.2 `tsconfig.json`

* **What:** Strict TypeScript config, CommonJS modules.
* **Why:** Predictable compilation and early type error surfacing.
* **AWS Future:** Add `paths` when codebase grows (e.g., `"@models/*": ["src/models/*"]`).
* **Touch When:** Need path mapping or adjust target.

### 3.3 `data/users.json`

* **What:** Flat JSON array of user objects.
* **Why:** Simplest persistence during early iteration.
* **AWS Future:** Becomes DynamoDB entries (`PK=USER#<id> SK=META`).
* **Touch When:** Add temporary fields (e.g., `school`) you will later migrate.

### 3.4 `src/index.ts`

* **What:** Express bootstrap: body parser, route mounts, health check, global error handler.
* **Why:** Single, minimal entry to isolate environment setup.
* **AWS Future:** In AWS/AppSync shift, this shrinks (GraphQL resolvers & Lambda pipeline). Could remain for local dev mode or health/metrics.
* **Touch When:** Add global middleware (CORS, logging).

### 3.5 `src/config.ts`

* **What:** Central config for things like `JWT_SECRET`, user file location.
* **Why:** Prevent config scattering; one place to change.
* **AWS Future:** Will hold env vars for `DYNAMO_TABLE`, `COGNITO_POOL_ID`, `REGION`. JWT secret removed when Cognito supplies tokens.
* **Touch When:** Adding new environment toggles (feature flags).

### 3.6 `src/models.ts`

* **What:** Type interfaces — currently `User` and now (Slice 2) `Classroom`.
* **Why:** Shared contract ensures compile‑time safety across repos/routes.
* **AWS Future:** Add `Membership`, `Session`, `Experiment` types; possibly split into domain sub-files.
* **Touch When:** Evolving schema for new slices.

### 3.7 `src/db.ts`

* **What:** File persistence wrapper for users (load/save). API: `findByEmail`, `create`.
* **Why:** **Isolation**: Higher layers never know if underlying storage changes (file → Dynamo).
* **AWS Future:** Replace file logic with DynamoDB operations; preserve method signatures.
* **Touch When:** Need additional user queries (e.g., `getById`, `listAll`).

### 3.8 `src/auth/hash.ts`

* **What:** Bcrypt hashing & verification.
* **Why:** Centralize crypto decisions; easy algorithm upgrade.
* **AWS Future:** Obsolete when Cognito does password auth — may remain for local fallback.
* **Touch When:** Adjust cost factor or algorithm.

### 3.9 `src/auth/jwt.ts`

* **What:** Local signing of JWT with `sub` & `role`, 1h expiry.
* **Why:** Simulates identity service to unblock development.
* **AWS Future:** Replaced by a *verify* helper for Cognito tokens (no signing).
* **Touch When:** Add claims (e.g., `schoolId`).

### 3.10 `src/routes/auth.ts`

* **What:** Registration + login endpoints with `zod` validation.
* **Why:** Defines external contract early; shapes reused in AppSync later (GraphQL input types).
* **AWS Future:** Might shrink to bridging endpoints or tests only; main auth flows via Cognito.
* **Touch When:** Add email verification or password reset endpoints.

### 3.11 `src/middleware/errorHandler.ts`

* **What:** Uniform error response (500 safety net).
* **Why:** Consistent error JSON; avoids repeated try/catch code.
* **AWS Future:** Augment with structured logs (JSON), request IDs, metrics hooks.
* **Touch When:** Integrate logging library or differentiate error types.

---

## 3.12 Scenario: **How Slice 1 Files Work Together (Request Walkthrough)**

**Register Flow Example:**

1. Client `POST /auth/register` → Express `index.ts` routes to `auth.ts`.
2. `auth.ts` uses `express.json()` body (set in `index.ts`) & validates via `zod`.
3. Calls `userRepo.findByEmail` (inside `db.ts`) → loads `data/users.json`.
4. On uniqueness pass, calls `hashPassword` (from `hash.ts`) → bcrypt hash generated.
5. Repo `create()` writes new user to file.
6. Route returns sanitized user JSON.
7. Any error surfaces to `errorHandler.ts` for standardized response.

**Login Flow:** Similar but after validation -> `findByEmail` -> `verifyPassword` -> `signUser` (from `jwt.ts`) -> returns token.

**Key Separation:**
Routes know *what* they want (user existence, hash, sign). Repos/crypto modules know *how*. This ensures easy AWS swaps.

---

## 4. API Contracts (Slice 1)

### Register (`POST /auth/register`)

Request:

```json
{ "email": "alice@example.com", "password": "Secret123", "role": "student" }
```

201:

```json
{ "id": "<uuid>", "email": "alice@example.com", "role": "student" }
```

409:

```json
{ "error": "EMAIL_EXISTS" }
```

### Login (`POST /auth/login`)

Request:

```json
{ "email": "alice@example.com", "password": "Secret123" }
```

200:

```json
{ "token": "<jwt>", "user": { "id": "<uuid>", "email": "alice@example.com", "role": "student" } }
```

401:

```json
{ "error": "INVALID_CREDENTIALS" }
```

---

## 5. Local Dev Workflow (Auth)

| Action       | Command                  | Result              |
| ------------ | ------------------------ | ------------------- |
| Install deps | `npm install`            | Dependencies ready  |
| Run dev      | `npm run dev`            | Server on `:3000`   |
| Health check | `GET /health`            | `{ ok: true }`      |
| Register     | `POST /auth/register`    | User stored in JSON |
| Login        | `POST /auth/login`       | JWT issued          |
| Reset state  | Delete `data/users.json` | Clean slate         |

---

## 6. Security Notes (Current Limitations – Auth)

| Area             | Current        | Risk                | Planned Upgrade                |
| ---------------- | -------------- | ------------------- | ------------------------------ |
| Password storage | bcrypt cost=10 | Acceptable dev      | Cognito SRP flow               |
| JWT secret       | Hardcoded      | Token spoof in prod | Remove (use Cognito)           |
| Rate limiting    | None           | Brute force         | API Gateway / WAF / middleware |
| Verification     | None           | Throwaway accounts  | Cognito email confirm          |
| Logging          | Console        | Hard to trace       | Structured JSON logs + IDs     |

---

## 7. AWS Migration Mapping (Slice 1)

| Local Component             | Future AWS Service             | Swap Strategy                              | Code Impact            |
| --------------------------- | ------------------------------ | ------------------------------------------ | ---------------------- |
| `data/users.json` + `db.ts` | DynamoDB                       | Replace FS ops with Dynamo calls           | Only inside `db.ts`    |
| `/auth/register` custom     | Cognito SignUp                 | Use AWS SDK `signUp` & configure user pool | Route logic shrinks    |
| `/auth/login` custom        | Cognito InitiateAuth           | Exchange credentials for tokens            | Route logic shrinks    |
| `auth/jwt.ts` signer        | Cognito token verify           | Replace sign with verify utility           | Call sites unchanged   |
| Manual role field           | Cognito Groups / custom claims | Assign group post‑signUp                   | Role extraction helper |

---

## 8. Changelog

| Date   | Change                     | Notes                                 |
| ------ | -------------------------- | ------------------------------------- |
| (init) | Auth slice scaffold        | Local JSON persistence                |
| (now)  | Slice 2 classroom addition | Classroom creation endpoint + storage |

---

## 9. Future Section Placeholders

* `## Join Classroom Slice (Slice 3)` *(TBD)*
* `## List My Classrooms Slice` *(TBD)*
* `## Session & Experiment Slice` *(TBD)*
* `## Realtime / Subscription Slice` *(TBD)*
* `## Offline & Sync Strategy` *(TBD)*
* `## Analytics & Telemetry` *(TBD)*

---

## 10. FAQ (Slice 1)

**Why not start with Cognito?** We’d be battling config while still unsure about request shapes. Local first → contract certainty.
**Will we throw this code away?** We’ll refactor implementation, not interfaces.
**Why no refresh tokens?** Complexity without value now; Cognito will handle refresh.

---

## Slice 1 – Verification Test Suite (Must Pass Before Slice 2)

> **Goal:** Repeatable manual script proving Auth slice meets all acceptance criteria. Run after any auth refactor. Record outputs or screenshots. Only start **Slice 2 (Classroom)** when every step is ✓.

### A. Quick Result Matrix

| Step | Purpose               | Expected                                      | Result (✓/✗) | Notes |
| ---- | --------------------- | --------------------------------------------- | ------------ | ----- |
| 1    | Clean state           | `users.json` = `[]`                           |              |       |
| 2    | Server boots          | Console shows `Server running...`             |              |       |
| 3    | Health check          | `{ "ok": true }`                              |              |       |
| 4    | Register instructor   | 201 JSON (id,email,role=instructor)           |              |       |
| 5    | Register student      | 201 JSON (role=student)                       |              |       |
| 6    | Duplicate email       | 409 `{ "error":"EMAIL_EXISTS" }`              |              |       |
| 7    | Invalid password      | 400 (Zod error)                               |              |       |
| 8    | Invalid role          | 400 (Zod error)                               |              |       |
| 9    | Login student         | 200 JSON w/ `token` & user                    |              |       |
| 10   | Wrong password login  | 401 `INVALID_CREDENTIALS`                     |              |       |
| 11   | JWT decode payload    | Has `sub`, correct `role`, `exp - iat ≈ 3600` |              |       |
| 12   | Data file inspection  | 2 users; hashes start `$2`                    |              |       |
| 13   | No plaintext password | No `password` field present                   |              |       |
| 14   | Security sanity       | Secret not committed (later)                  |              |       |

### B. Preconditions

* Server running `http://localhost:3000`
* `data/users.json` = `[]`
* Tools: PowerShell (`Invoke-RestMethod`) OR `curl.exe` OR VS Code REST Client.

### C. Command Script (PowerShell)

```powershell
# 1. Health
Invoke-RestMethod http://localhost:3000/health

# 2. Register instructor
Invoke-RestMethod -Method POST -Uri http://localhost:3000/auth/register `
  -ContentType 'application/json' `
  -Body '{"email":"teach1@example.com","password":"Secret123","role":"instructor"}'

# 3. Register student
Invoke-RestMethod -Method POST -Uri http://localhost:3000/auth/register `
  -ContentType 'application/json' `
  -Body '{"email":"stud1@example.com","password":"Secret123","role":"student"}'

# 4. Duplicate student (expect 409)
try {
  Invoke-RestMethod -Method POST -Uri http://localhost:3000/auth/register `
    -ContentType 'application/json' `
    -Body '{"email":"stud1@example.com","password":"Secret123","role":"student"}'
} catch { $_.Exception.Response.StatusCode.Value__ }

# 5. Invalid password (expect 400)
try {
  Invoke-RestMethod -Method POST -Uri http://localhost:3000/auth/register `
    -ContentType 'application/json' `
    -Body '{"email":"short@example.com","password":"abc","role":"student"}'
} catch { $_.Exception.Response.StatusCode.Value__ }

# 6. Invalid role (expect 400)
try {
  Invoke-RestMethod -Method POST -Uri http://localhost:3000/auth/register `
    -ContentType 'application/json' `
    -Body '{"email":"badrole@example.com","password":"Secret123","role":"teacher"}'
} catch { $_.Exception.Response.StatusCode.Value__ }

# 7. Login student
$login = Invoke-RestMethod -Method POST -Uri http://localhost:3000/auth/login `
  -ContentType 'application/json' `
  -Body '{"email":"stud1@example.com","password":"Secret123"}'
$login
$token = $login.token

# 8. Wrong password
try {
  Invoke-RestMethod -Method POST -Uri http://localhost:3000/auth/login `
    -ContentType 'application/json' `
    -Body '{"email":"stud1@example.com","password":"WrongPass"}'
} catch { $_.Exception.Response.StatusCode.Value__ }

# 9. Decode JWT (header + payload)
$parts = $token.Split('.')
function Decode-Part($p) {
  $pad = $p + ('=' * ((4 - $p.Length % 4) % 4))
  [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($pad.Replace('-','+').Replace('_','/')))
}
$headerJson  = Decode-Part $parts[0]
$payloadJson = Decode-Part $parts[1]
$headerJson
$payloadJson
```

### D. Expected Output Patterns

| Step             | Key Output Pattern                                         |
| ---------------- | ---------------------------------------------------------- |
| Register         | `{ "id": "<uuid>", "email": "...", "role": "instructor" }` |
| Duplicate        | HTTP 409 + `EMAIL_EXISTS`                                  |
| Invalid password | HTTP 400 (validation error JSON)                           |
| Login            | JSON with `token` (`header.payload.signature`)             |
| Decode payload   | `{"sub":"<uuid>","role":"student","iat":...,"exp":...}`    |
| users.json       | Two objects with `passwordHash` `$2a$` or `$2b$`           |

### E. Pass Criteria

All matrix rows ✓ and decoded JWT shows `exp - iat ≈ 3600`.

### F. Troubleshooting Quick Table

| Symptom            | Likely Cause          | Fix                               |
| ------------------ | --------------------- | --------------------------------- |
| 500 on register    | Syntax / invalid JSON | Check server logs                 |
| 401 on valid login | Wrong password/email  | Inspect `users.json`              |
| Token empty        | Wrong variable usage  | Re-run login, print `$login`      |
| Password visible   | Bug in repo           | Ensure only `passwordHash` stored |

> Once all ✓ → Proceed to Slice 2 classroom creation tests.

---

# Slice 2 – Classroom Creation

> **Scope:** ONLY creating classrooms (instructor role). No joining, no listing yet.

## 1. User Story

*As an instructor I create a classroom and receive a join code so students can later join.*

## 2. Acceptance Criteria

| #   | Criterion                                                         |
| --- | ----------------------------------------------------------------- |
| AC1 | Endpoint `POST /classrooms` `{ "name": "<string>" }`.             |
| AC2 | Requires valid JWT with `role="instructor"` (403 if not).         |
| AC3 | `name` required, min 3 characters.                                |
| AC4 | Response 201: `{ classroomId, name, joinCode, createdAt }`.       |
| AC5 | `joinCode` length 6 uppercase alphanumeric (collision protected). |
| AC6 | Duplicate names allowed (different IDs).                          |
| AC7 | Data persists in `data/classrooms.json`.                          |

**Deferred:** Listing, joining, student view, soft delete/archiving, teacher display name.

## 3. Data Model (Local)

File: `data/classrooms.json`
Structure (array of objects):

```json
{
  "classroomId": "uuid",
  "name": "Chemistry 101",
  "joinCode": "Q7H2LP",
  "teacherId": "<instructor user id>",
  "createdAt": "2025-07-18T20:15:00.000Z"
}
```

## 4. New / Updated Files (Slice 2)

| File                         | Purpose                                                   |
| ---------------------------- | --------------------------------------------------------- |
| `data/classrooms.json`       | Stores classroom records locally.                         |
| `src/models.ts`              | Adds `Classroom` interface.                               |
| `src/util/id.ts`             | UUID + 6-char join code generator.                        |
| `src/repos/classroomRepo.ts` | Encapsulates classroom persistence & collision avoidance. |
| `src/middleware/authUser.ts` | Middleware to decode & verify JWT (attaches `req.user`).  |
| `src/routes/classrooms.ts`   | Route to create classroom (auth + validation).            |
| `src/index.ts`               | Mounts `/classrooms` route.                               |

## 5. Request / Response (Slice 2)

### Create Classroom (`POST /classrooms`)

Headers: `Authorization: Bearer <instructor JWT>`
Body:

```json
{ "name": "Chemistry 101" }
```

201:

```json
{
  "classroomId": "<uuid>",
  "name": "Chemistry 101",
  "joinCode": "ABC7K2",
  "createdAt": "2025-07-18T20:15:00.000Z"
}
```

403 (student token):

```json
{ "error": "FORBIDDEN_ROLE" }
```

400 (invalid name):

```json
{ "error": "VALIDATION_ERROR", "details": { ... } }
```

401 (no/invalid token):

```json
{ "error": "NO_TOKEN" }
```

## 6. Manual Test Sequence (Slice 2)

Assumes Slice 1 verification passed & you have both roles.

| Step | Purpose                | Command (PowerShell)        | Expect      |
| ---- | ---------------------- | --------------------------- | ----------- |
| 1    | Instructor login       | (Reuse Slice 1 login)       | 200 + token |
| 2    | Create classroom       | `POST /classrooms`          | 201 JSON    |
| 3    | Student login          | (Reuse Slice 1 login)       | 200 + token |
| 4    | Student create attempt | `POST /classrooms`          | 403         |
| 5    | Invalid name           | `name: "Hi"`                | 400         |
| 6    | Inspect file           | Open `data/classrooms.json` | Entry saved |

**Sample Commands:**

```powershell
# Instructor login
$ilogin = Invoke-RestMethod -Method POST -Uri http://localhost:3000/auth/login -ContentType 'application/json' -Body '{"email":"teach1@example.com","password":"Secret123"}'
$itoken = $ilogin.token

# Create classroom
Invoke-RestMethod -Method POST -Uri http://localhost:3000/classrooms `
  -Headers @{ Authorization = "Bearer $itoken" } `
  -ContentType 'application/json' `
  -Body '{"name":"Chemistry 201"}'

# Student login
$slogin = Invoke-RestMethod -Method POST -Uri http://localhost:3000/auth/login -ContentType 'application/json' -Body '{"email":"stud1@example.com","password":"Secret123"}'
$stoken = $slogin.token

# Student create (should 403)
Invoke-RestMethod -Method POST -Uri http://localhost:3000/classrooms `
  -Headers @{ Authorization = "Bearer $stoken" } `
  -ContentType 'application/json' `
  -Body '{"name":"Should Fail"}'

# Invalid name (length <3)
Invoke-RestMethod -Method POST -Uri http://localhost:3000/classrooms `
  -Headers @{ Authorization = "Bearer $itoken" } `
  -ContentType 'application/json' `
  -Body '{"name":"Hi"}'
```

## 7. Slice 2 Ready Checklist

| Item                                  | ✓ |
| ------------------------------------- | - |
| Instructor create success (201)       |   |
| Student blocked (403)                 |   |
| Validation error for short name (400) |   |
| Data persisted                        |   |
| joinCode length = 6 & unique          |   |
| No sensitive data leaked              |   |

## 8. Scenario: How Slice 2 Adds to Slice 1 Flow

1. Instructor logs in (Slice 1 auth).
2. Client stores JWT.
3. Client sends `POST /classrooms` with `Authorization` header → `authUser` middleware validates token (Slice 2).
4. `classrooms.ts` validates body, checks `req.user.role`.
5. `classroomRepo.create` writes record & returns object.
6. Response includes join code for future slice (Join Classroom).
7. All other auth / user functionality remains unchanged.

**Separation Maintained:** Classroom logic lives in repo + route; user storage untouched.

## 9. AWS Migration Mapping (Slice 2)

| Local Component                        | AWS Target                                              | Migration Plan                                      | Impact                              |
| -------------------------------------- | ------------------------------------------------------- | --------------------------------------------------- | ----------------------------------- |
| `classrooms.json`                      | DynamoDB                                                | Write items: `PK=CLASS#<id>` `SK=META`              | Replace inside `classroomRepo` only |
| `joinCode` uniqueness (in-memory loop) | DynamoDB conditional put / GSI on `joinCode` (optional) | Add conditional expression (`attribute_not_exists`) | Slight repo change                  |
| `authUser` (local JWT verify)          | Cognito JWT verify                                      | Decode & validate signature (no logic change)       | Middleware logic updates            |
| `POST /classrooms` REST                | AppSync Mutation `createClassroom`                      | Map GraphQL args to same fields                     | Replace route with resolver         |

**Important:** We haven’t locked index design yet; we’re intentionally simple to avoid over‑engineering.

## 10. Next Slice Preview (Slice 3 – Join Classroom)

Will add:

* Membership concept (student joins using `joinCode`).
* Data structure: membership entries (maybe new `memberships.json` or reuse single table later).
* Endpoint: `POST /classrooms/join` or `POST /students/:id/join-classroom` (we’ll decide).
* Validation: code exists, not already a member.

(Details TBD in next section.)

---

## 11. Immediate Actions After Slice 2

1. Run manual tests & fill Slice 2 checklist.
2. Commit with message: `slice2: classroom creation`.
3. Open a short **DECISIONS** note: `joinCode length=6 uppercase; duplicate names allowed`.
4. Request: “Give me Slice 3 section” when ready.

---

## 12. Roadmap Snapshot (So Far)

| Slice                | Done?  | Core Outcome                              |
| -------------------- | ------ | ----------------------------------------- |
| 1 Auth               | ✅      | Users can register/login (local JWT).     |
| 2 Classroom Create   | ✅      | Instructors create classroom + join code. |
| 3 Join Classroom     | (next) | Students join; membership persisted.      |
| 4 List My Classrooms | —      | Fetch classrooms for current user.        |
| 5 Start Session      | —      | Minimal experiment session state.         |
| 6 Update Session     | —      | Mutations + optimistic approach.          |
| 7 End Session        | —      | Summary artifacts.                        |
| 8 Realtime Base      | —      | Move to polling → subscription later.     |

---

**End of current README (Slices 1 & 2).**

---

Let me know when you finish Slice 2 tests and want the **Slice 3 – Join Classroom** section.
Below is the **Slice 3 – Join Classroom** markdown chunk. Copy/paste it **after** the Slice 2 section in your `README.md`. (Kept concise; mirrors Slice 1 style but lighter.)

---

## Slice 3 – Join Classroom

**User Story:** *As a student I enter a classroom join code so I become a member and can later access its experiments.*

### 1. Acceptance Criteria

| #   | Criterion                                                                                           |
| --- | --------------------------------------------------------------------------------------------------- |
| AC1 | `POST /classrooms/join` body `{ "code": "<joinCode>" }`.                                            |
| AC2 | Requires JWT with `role="student"` (403 if not).                                                    |
| AC3 | Invalid format (not 6 chars) → 400 `VALIDATION_ERROR`.                                              |
| AC4 | Nonexistent code → 404 `INVALID_CODE`.                                                              |
| AC5 | First join → create membership; respond 200 `{ classroomId, name, joinedAt, alreadyMember:false }`. |
| AC6 | Rejoining same class → 200 `{ ... alreadyMember:true }` (idempotent).                               |
| AC7 | Exactly one membership record stored per (studentId, classroomId).                                  |
| AC8 | Instructor token using join → 403 `FORBIDDEN_ROLE`.                                                 |
| AC9 | (Deferred) Active/inactive classroom check.                                                         |

### 2. Data Additions

**File:** `data/memberships.json`
**Record:** `{ "studentId", "classroomId", "joinedAt" }`

> *Why separate file?* Keeps relationship layer isolated; mirrors future Dynamo pattern (membership items separate from classroom items).

### 3. Model & Repos (New / Updated)

| File                                  | Purpose (brief)                                                       |
| ------------------------------------- | --------------------------------------------------------------------- |
| `src/models.ts` (append)              | Adds `Membership` interface.                                          |
| `src/repos/membershipRepo.ts`         | Load/save membership records; idempotent `create` (returns existing). |
| `src/repos/classroomRepo.ts` (update) | Adds `findByJoinCode(code)` to locate classroom by join code.         |
| `data/memberships.json`               | Flat storage array for memberships.                                   |

### 4. Route (Update)

`src/routes/classrooms.ts` adds:

```
POST /classrooms/join
  Auth: Bearer <student token>
  Body: { "code": "ABC123" }
  Responses:
    200 { classroomId, name, joinedAt, alreadyMember: false|true }
    400 VALIDATION_ERROR
    401 NO_USER
    403 FORBIDDEN_ROLE
    404 INVALID_CODE
```

**Flow Summary:**
Auth middleware → validate body → `findByJoinCode` → membership lookup → create (if missing) → return membership snapshot with `alreadyMember`.

### 5. Manual Test Script (PowerShell)

```powershell
# Student login
$slogin = Invoke-RestMethod -Method POST -Uri http://localhost:3000/auth/login `
  -ContentType 'application/json' -Body '{"email":"stud1@example.com","password":"Secret123"}'
$stoken = $slogin.token

# Use actual joinCode from classroom creation (Slice 2)
$code = "ABC123"

# First join
Invoke-RestMethod -Method POST -Uri http://localhost:3000/classrooms/join `
  -Headers @{ Authorization = "Bearer $stoken" } -ContentType 'application/json' `
  -Body ("{`"code`":`"$code`"}")

# Second join (idempotent)
Invoke-RestMethod -Method POST -Uri http://localhost:3000/classrooms/join `
  -Headers @{ Authorization = "Bearer $stoken" } -ContentType 'application/json' `
  -Body ("{`"code`":`"$code`"}")

# Invalid length
Invoke-RestMethod -Method POST -Uri http://localhost:3000/classrooms/join `
  -Headers @{ Authorization = "Bearer $stoken" } -ContentType 'application/json' `
  -Body '{"code":"XYZ"}'

# Nonexistent code (must be 6 chars)
Invoke-RestMethod -Method POST -Uri http://localhost:3000/classrooms/join `
  -Headers @{ Authorization = "Bearer $stoken" } -ContentType 'application/json' `
  -Body '{"code":"ZZZZZZ"}'
```

### 6. Slice 3 Checklist

| Item                                     | ✓ |
| ---------------------------------------- | - |
| First join 200 `alreadyMember:false`     |   |
| Second join 200 `alreadyMember:true`     |   |
| Invalid length → 400                     |   |
| Wrong code → 404                         |   |
| Instructor blocked (403)                 |   |
| `memberships.json` shows one record only |   |

### 7. AWS Mapping (Forward Plan)

| Local Concept                  | Future Dynamo / AppSync                                                                                                           |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `memberships.json`             | Items: `PK=CLASS#<classId> SK=STUDENT#<studentId>` (optional reverse `PK=USER#<studentId> SK=CLASS#<classId>` for quick listing). |
| Code lookup (`findByJoinCode`) | Either GSI on `joinCode` or separate lookup item `PK=JOINCODE#<code> SK=CLASS#<id>`.                                              |
| Idempotent join logic          | Dynamo conditional put (`attribute_not_exists`) or just detect existing item.                                                     |
| `alreadyMember` flag           | Derived in resolver (check `GetItem` result).                                                                                     |

### 8. Constraints & Open Questions

| Topic                    | Current Decision                    | Revisit Later?                      |
| ------------------------ | ----------------------------------- | ----------------------------------- |
| Join code uniqueness     | Enforced on classroom creation only | Add uniqueness item / GSI           |
| Reverse membership items | Not stored (local)                  | Likely add for fast “my classrooms” |
| Inactive classrooms      | Not implemented                     | Add `isActive` flag field           |

### 9. Next Slice Preview (Slice 4 – List My Classrooms)

Will gather memberships + classrooms to return student’s classroom list (and optionally teacher’s list). Decision pending: compute via join vs maintain reverse membership items.

---
## 12. Roadmap Snapshot (So Far)

| Slice                | Done?  | Core Outcome                              |
| -------------------- | ------ | ----------------------------------------- |
| 1 Auth               | ✅      | Users can register/login (local JWT).     |
| 2 Classroom Create   | ✅      | Instructors create classroom + join code. |
| 3 Join Classroom     | ✅ | Students join; membership persisted.      |
| 4 List My Classrooms | —      | Fetch classrooms for current user.        |
| 5 Start Session      | —      | Minimal experiment session state.         |
| 6 Update Session     | —      | Mutations + optimistic approach.          |
| 7 End Session        | —      | Summary artifacts.                        |
| 8 Realtime Base      | —      | Move to polling → subscription later.     |

---
