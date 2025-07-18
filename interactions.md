
# 1. Layer Cake Overview

| Layer                                      | What Lives Here                                                            | Files                                                                |
| ------------------------------------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Entry / Server**                         | Starts Express, mounts routers, global middlewares                         | `src/index.ts`                                                       |
| **Middleware**                             | Cross‑cut concerns (auth, errors)                                          | `middleware/authUser.ts`, `middleware/errorHandler.ts`               |
| **Routes (Controllers)**                   | HTTP endpoints: parse request, validate, invoke repo logic, shape response | `routes/auth.ts`, `routes/classrooms.ts`                             |
| **Validation**                             | Input schema rules                                                         | `zod` usage inside route files                                       |
| **Auth Utilities**                         | Hashing + JWT signing/verification                                         | `auth/hash.ts`, `auth/jwt.ts`                                        |
| **Repositories (Persistence Abstraction)** | Load/save domain objects without callers knowing storage details           | `db.ts` (users), `repos/classroomRepo.ts`, `repos/membershipRepo.ts` |
| **Models (Contracts)**                     | TypeScript interfaces for data shapes                                      | `models.ts`                                                          |
| **Utilities**                              | ID + join code generation                                                  | `util/id.ts`                                                         |
| **Data Store (Dev Mode)**                  | Flat JSON “tables”                                                         | `data/users.json`, `data/classrooms.json`, `data/memberships.json`   |

Later, only the **Repository Implementations + Auth** swap to AWS services. Everything else (routes, validation, models) can stay nearly identical.

---

# 2. The Data Shapes You Manage

| Entity     | Purpose                                     | Key Fields                                                  | File               |
| ---------- | ------------------------------------------- | ----------------------------------------------------------- | ------------------ |
| User       | Identity + role                             | `id`, `email`, `passwordHash`, `role`, `createdAt`          | `users.json`       |
| Classroom  | Teacher‑owned container students join       | `classroomId`, `name`, `joinCode`, `teacherId`, `createdAt` | `classrooms.json`  |
| Membership | Relationship (student belongs to classroom) | `studentId`, `classroomId`, `joinedAt`                      | `memberships.json` |

**Important Separation:** A *classroom* doesn’t store an array of students → avoids giant objects and mimics future DynamoDB “one item per relationship” pattern.

---

# 3. File‑By‑File “Why It Exists” (Concise)

### `src/index.ts`

* Creates the Express app.
* Adds JSON body parser.
* Mounts `/auth` and `/classrooms`.
* Adds `/health` endpoint.
* Attaches error handler last.

> *If we migrated to Lambda/AppSync, this file becomes the “local dev harness” only.*

### `src/config.ts`

* One place for constants (e.g., `JWT_SECRET`, file paths).
* Future home for environment variables (Dynamo table name, region, etc.).

### `src/models.ts`

* Type definitions (`User`, `Classroom`, `Membership`).
* Keeps routes and repos using the *same* shapes. Refactors become safer.

### `src/db.ts`

* Minimal user “repository”.
* Hides *file IO* behind simple functions (`findByEmail`, `create`).
* Swap point: replace internals with Dynamo calls without touching routes.

### `src/auth/hash.ts`

* Wraps bcrypt hashing and comparison.
* You can upgrade algorithm / cost factor in one file.

### `src/auth/jwt.ts`

* Local dev token creation (signs `sub` + `role`).
* When Cognito arrives: this becomes a *verify* helper only.

### `src/middleware/authUser.ts`

* Reads `Authorization: Bearer <token>`.
* Verifies token → attaches `req.user = { userId, role }`.
* Centralizes auth logic so each protected route doesn’t repeat it.

### `src/middleware/errorHandler.ts`

* Catches thrown/unhandled errors → uniform JSON response.
* Easy future enhancement: add request IDs, structured logs.

### `src/util/id.ts`

* Generates classroom IDs (UUID) and join codes (6 chars).
* Encapsulating code logic simplifies later changes (e.g., length 8, add checksum).

### `src/repos/classroomRepo.ts`

* Encapsulates CRUD for classrooms. Methods:

  * `create(name, teacherId)` – ensures unique `joinCode`.
  * `findByJoinCode(code)` – used when students join.
  * `findById` – future utility.
  * `listByTeacher(teacherId)` – used in Slice 4.
  * `listByIds(ids[])` – used for student classroom listing.
* Only place that touches `classrooms.json`.

### `src/repos/membershipRepo.ts`

* Creates or finds membership (idempotent).
* Lists memberships by student.
* Only place that touches `memberships.json`.

### `src/routes/auth.ts`

* Defines `/auth/register` + `/auth/login`.
* Validates payload with zod.
* Uses user repo + hash + jwt utilities.
* Never manipulates files directly.

### `src/routes/classrooms.ts`

* Protected by `authUser` middleware (`router.use(authUser)`).
* Endpoints:

  * `POST /classrooms` (instructor create).
  * `POST /classrooms/join` (student join, idempotent).
  * `GET /classrooms/mine` (role‑based listing).
* Uses repos; never directly reads JSON.

### `data/*.json`

* Temporary development persistence. Each file = a “mini table”.
* You can manually inspect or wipe to reset state.

---

# 4. Typical Request Flows

### 4.1 Register User

1. Client → `POST /auth/register`.
2. `auth.ts` validates → checks uniqueness via `db.ts`.
3. Hash password (`hash.ts`) → save.
4. Return sanitized user (no passwordHash).

### 4.2 Login

1. Client → `POST /auth/login`.
2. Lookup user → verify password → sign token (`jwt.ts`).
3. Return `{ token, user }`.

### 4.3 Instructor Creates Classroom

1. Client sends `POST /classrooms` with `Authorization`.
2. `authUser` extracts & verifies token → sets `req.user`.
3. Route checks role = instructor.
4. Validates payload, calls `classroomRepo.create`.
5. Returns classroom metadata + `joinCode`.

### 4.4 Student Joins Classroom

1. Student token → `POST /classrooms/join { code }`.
2. Route verifies role = student.
3. Looks up classroom by joinCode.
4. Uses `membershipRepo.find/create` (idempotent logic).
5. Returns membership info (`alreadyMember` flag).

### 4.5 List My Classrooms

* **Student path:**

  1. `GET /classrooms/mine`
  2. `membershipRepo.listByStudent` → list of classroomIds.
  3. `classroomRepo.listByIds` → classroom records.
  4. Combine with `joinedAt`.
* **Instructor path:**

  1. `classroomRepo.listByTeacher`.
  2. Return with `joinCode` (students never see joinCode here).

---

# 5. Why This Structure Makes AWS Migration Easy

| Current Concern    | Local Implementation      | AWS Replacement                                       | Who Changes Code?          |
| ------------------ | ------------------------- | ----------------------------------------------------- | -------------------------- |
| User storage       | `db.ts` file IO           | DynamoDB (`GetItem/PutItem`)                          | Only inside repo           |
| Classroom storage  | `classroomRepo` file IO   | DynamoDB items (`PK=CLASS#...`)                       | Only repo file             |
| Membership storage | `membershipRepo` file IO  | DynamoDB items (`PK=CLASS#... STUDENT#...`) + reverse | Only repo file             |
| Auth tokens        | `jwt.ts` custom sign      | Cognito tokens (verify only)                          | Swap `jwt.ts` + middleware |
| Endpoints          | Express REST              | AppSync GraphQL resolvers                             | Routes replaced / mapped   |
| Validation         | zod in routes             | Keep using (in resolvers)                             | Same code reused           |
| Roles              | `role` claim in local JWT | Cognito group claim                                   | Middleware adapts          |

**Seams already exist**: You don’t entangle storage logic with HTTP logic → easy swaps.

---

# 6. Idempotency & Constraints

| Operation        | Guarantee               | How Implemented                    |
| ---------------- | ----------------------- | ---------------------------------- |
| Register         | Unique email            | Lookup before create               |
| Create classroom | Unique joinCode         | While-loop against existing codes  |
| Join classroom   | No duplicate membership | Repo returns existing membership   |
| List mine        | No duplicates           | Based on unique membership records |

> In Dynamo later, `joinCode` uniqueness can be enforced with a conditional put or a separate “join code index” item.

---

# 7. Current Limitations (You Know But Can Explain)

| Area                | Limitation                   | Future Fix                               |
| ------------------- | ---------------------------- | ---------------------------------------- |
| Security            | Hardcoded JWT secret         | Env var → Cognito                        |
| Validation          | Minimal (no email normalize) | Normalize & enforce lowercase            |
| Data Integrity      | File writes not atomic       | Dynamo conditional writes                |
| Performance         | Full file read per request   | Dynamo targeted queries                  |
| Listing Scalability | In-memory filter             | Dynamo query patterns / GSIs             |
| Error Format        | Basic                        | Structured error codes, logging metadata |

---

# 8. Mental Model Summary (TL;DR)

> *“We have a layered Express backend: routes handle validation and call repositories. Repositories abstract persistence over flat JSON files for users, classrooms, and memberships. Auth uses bcrypt + JWT; middleware injects user identity so routes can enforce roles. Each user story added only the minimal new files—auth (Slice 1), classroom creation (Slice 2), join (Slice 3), list (Slice 4)—while keeping boundaries clean. This lets us later swap file-based repos to DynamoDB and local JWT to Cognito with minimal code churn.”*

If you can say that confidently, you understand it.

---

