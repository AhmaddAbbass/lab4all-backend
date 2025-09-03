# Lab4All Backend (Serverless • TypeScript)

**Status:** Deployed. Local dev supported via `serverless-offline`.
**Free Mode:** Implemented as an MVP/PoC in the backend — **works** but still needs broader testing and full FE integration.

---

## What is Lab4All?

Lebanese schools face a persistent gap between science curricula and the resources to teach them: decades of underfunding, the recent economic collapse, and supply-chain volatility have left many labs incomplete, unsafe, or effectively non-functional. Teachers often default to demonstrations while students watch, which erodes hands-on skills and curiosity—especially in public schools.

**Lab4All** turns every student’s laptop into a personal lab bench. In a 3D modeled environment (Babylon.js), teachers can demonstrate an experiment while students run the same steps on their own devices, repeat variations, and actually _practice_ the procedure—without the cost, risk, or scheduling bottlenecks of physical labs.

Core capabilities today:

- **Role-based accounts** (teacher/student) with the right permissions.
- **Classrooms**: teachers create a class and share a **join code** (rotatable anytime); students join with that code.
- **Announcements hub**: teachers post announcements with files; students see current and past notices in one place. _(Pin/unpin is on the roadmap.)_
- **Teacher demos + student practice**: mirror a live demo and let each student run their own copy in parallel.
- **Student-owned runs**: students create their own experiments (visible to the student by default), try variations, and repeat.
- **Saved timelines**: each run is stored as a concise timeline of actions and outcomes (revisitable later and storable in S3).
- **Current prototype**: a 3D **titration** built with Babylon.js where students add quantities, observe immediate feedback, and save the run.

**Free Mode** — a _UI-first_ chemistry sandbox driven by an LLM. The model returns **minimal diffs** (“post-actions”) the UI can merge directly—pH changes, gas bubbles, precipitate flags, instrument readings—so scenes update instantly without a heavy chemistry engine. The backend meters a **per-class LLM quota** based on prompt/completion token costs to keep usage predictable.

## Stack

- **API**: API Gateway (HTTP) → AWS Lambda (Node.js 22, TypeScript → `dist/`) via Serverless Framework
- **Auth**: Amazon Cognito (IdToken, claims: `sub`, `email`, `custom:role`, `custom:schoolId`, `custom:grade`)
- **Data**: DynamoDB (`classrooms`, `memberships`, `schools`, `announcements`, `experiments`, **`llm_usage`**)
- **Files**: S3 (`ANNOUNCEMENTS_BUCKET`, `EXPERIMENTS_BUCKET`)
- **Secrets**: AWS Secrets Manager (OpenAI key)
- **Local Dev**: `serverless-offline`

---

## Quick Start (Local)

**Prereqs**

- Node.js ≥ 18
- AWS CLI configured
- Serverless Framework (`npm i -g serverless`) — or use `npx serverless …`

**Run**

```bash
git clone <your-repo-url>
cd lab4all-backend
npm install
npm run build
npx serverless offline
# => API at http://localhost:3000
```

## Environment Variables

Set in `serverless.yml` (or your CI/CD secrets):

```
# Cognito
USER_POOL_ID
CLIENT_ID

# DynamoDB tables
CLASSROOMS_TABLE
MEMBERSHIPS_TABLE
SCHOOLS_TABLE
ANNOUNCEMENTS_TABLE
EXPERIMENTS_TABLE
LLM_USAGE_TABLE            # e.g., "llm_usage"

# S3
ANNOUNCEMENTS_BUCKET
EXPERIMENTS_BUCKET

# Behavior
STRICT_SCHOOL_SIGNUP       # "true" | "false"
SIGNED_URL_TTL             # seconds, e.g., "600"

# Free Mode / LLM
LLM_MODEL_ID               # e.g., "gpt-4o-mini"
LLM_SECRET_ARN             # Secrets Manager ARN; JSON must contain { "OPENAI_API_KEY": "sk-..." }
CLASS_QUOTA_CENTS_DEFAULT  # e.g., "500" => $5/month per classroom by default
TOKENS_IN_PRICE_MICROUSD   # µUSD per prompt token (e.g., "5")
TOKENS_OUT_PRICE_MICROUSD  # µUSD per completion token (e.g., "15")
```

---

## Project Layout

```
src/
  index.ts

  handlers/
    announcements/{create,fetch}.ts
    auth/{confirm,login,profile,signup}.ts
    classroom/{create,getClassrooms,getMembers,join,kick,leave,refreshjc}.ts
    experiments/{create,delete,finish,info,list,log,toggleVisibility}.ts
    free/step.ts
    school/{get,list,register}.ts

  schemas/
    {classroom,membership,school}.ts
    announcements/{AnnCreateSchema,AnnFetchQuery,AnnFetchSchema,AnnItem,AnnResponse,FileMetaSchema}.ts
    experiments/{ExpCreateSchema,ExpItem,ExpLogInputSchema}.ts
    free/{action,environment,postAction,setup,stepio,timeline,valueUnit}.ts

  utils/
    database/... (dynamo helpers)
    s3/{s3announcements,s3experiments}.ts
    userpool/fetchStudentInfo.ts
    free/llm.ts      # LLM call + prompt + parsing + token metering
    headers/defaults.ts
    other/{files,generateJoinCode,toSlug}.ts
```

---

## Data Model (DynamoDB)

- **classrooms**: `classroomID` (PK), `classroomName`, `schoolId`, `teacherId`, `joinCode`, _(optional)_ `llmQuotaCents`
  GSI: `joinCode-index`
- **memberships**: edges stored both ways
  `PK="USER#<sub>"`, `SK="CLASSROOM#<classroomID>"` and `PK="CLASSROOM#<classroomID>"`, `SK="USER#<sub>"`
- **schools**: directory & indexes for name/country/city search
- **announcements**: `PK="CLASS#<classId>"`, `SK="ANNOUNCEMENT#<createdAt>#<announcementId>"`
- **experiments**: `PK="CLASS#<classId>"`, `SK="EXP#<createdAtISO>#<uuid>"`
  S3 key: `class/<classId>/experiment/<experimentId>/info.txt`
- **llm_usage** (NEW): monthly per-class counters
  `PK="CLASS#<classroomId>"`, `SK="MO#<YYYY-MM>"`, fields: `requests`, `tokensIn`, `tokensOut`, `costMicroUSD`

---

## Buckets & Keys

- **Announcements**
  `announcements/class/<classId>/ann/<announcementId>/body.<ext>`
  `announcements/class/<classId>/ann/<announcementId>/files/<uuid>_<safeName>`
- **Experiments**
  `class/<classId>/experiment/<experimentId>/info.txt`
  _(Optional Free Mode artifact: `timeline.json` can follow same location pattern.)_

---

## Free Mode (MVP)

**What it does**

- FE sends an **action** (e.g., “add 20 mL HCl to Beaker1”), the **current environment snapshot**, and a **history** array.
- BE calls the LLM and returns:

  - a **minimal `postAction` diff** to merge,
  - **`uiEvents`** (e.g., `updatePHMeter`, `spawnGasBubbles`),
  - token usage (`tokensIn`, `tokensOut`) and `quotaExceeded` if relevant.

- BE charges the class’s monthly LLM **quota** (µUSD from token counts).

**Principles**

- **UI-first**, plausible effects (no full stoichiometry).
- **Clamp safety**: `pH ∈ [0,14]`, non-negative volumes, finite numbers.
- **Deterministic shape**: don’t invent containers/tools; only update what exists.

---

## Why Free Mode is exciting

- **Zero-friction lab play**: students can _try things_ without heavy chemistry engines.
- **Deterministic UI contract**: backend returns **diffs** + **uiEvents**, so the FE can update visuals instantly.
- **Cost-aware**: per-class quota prevents surprise bills; token metering is transparent on every response.
- **Extensible**: new actions or visual effects are schema-driven — no DB migration needed.

---

---

# API Reference — Postman-style

> **Auth header for protected routes**: `Authorization: Bearer <IdToken>` > **Naming note:** Prefer **`classroomId`** on request surfaces (DB keeps `classroomID`). Some legacy routes accept `classID`.

---

## 1) Auth

### POST `/auth/register` _(Public)_

**Request body**

```json
{
  "email": "teacher@example.com",
  "password": "P@ssw0rd!",
  "firstName": "Rana",
  "lastName": "Mansour",
  "role": "student",
  "grade": "11",
  "schoolId": "aub",
  "schoolName": "AUB",
  "countryCode": "LB",
  "city": "Beirut"
}
```

**200 — Success**

```json
{
  "message": "Signup successful. Please confirm your account.",
  "needsSchoolRegistration": true,
  "note": "If instructor without schoolId, you may need to register a school."
}
```

**Common errors**: `409 EMAIL_ALREADY_REGISTERED`, `400 INVALID_INPUT|INVALID_SCHOOL_ID|SCHOOL_AMBIGUOUS_OR_NOT_FOUND`

---

### POST `/auth/confirm` _(Public)_

**Request body**

```json
{ "email": "teacher@example.com", "code": "123456" }
```

**200**

```json
{ "message": "Account confirmed successfully" }
```

---

### POST `/auth/login` _(Public)_

**Request body**

```json
{ "email": "teacher@example.com", "password": "P@ssw0rd!" }
```

**200 — (Cognito result shape)**

```json
{
  "AuthenticationResult": {
    "IdToken": "eyJraWQiOi...",
    "AccessToken": "eyJraWQiOi...",
    "RefreshToken": "def...",
    "ExpiresIn": 3600,
    "TokenType": "Bearer"
  },
  "needsSchoolRegistration": false
}
```

**Errors**: `401 INVALID_CREDENTIALS`, `403 USER_NOT_CONFIRMED|PASSWORD_RESET_REQUIRED`, `404 USER_NOT_FOUND`

---

### GET `/auth/profile` _(Bearer)_

**Response**

```json
{
  "userId": "cognito-sub",
  "email": "teacher@example.com",
  "firstName": "Rana",
  "lastName": "Mansour",
  "role": "instructor",
  "grade": null,
  "schoolId": "aub",
  "schoolName": "American University of Beirut"
}
```

---

## 2) Schools

### GET `/schools` _(Public)_

**Query param variants**

- Global alphabetical: _(no params)_
- Typeahead: `?q=academy`
- Country: `?countryCode=LB`
- Country + q: `?countryCode=LB&q=academy`
- Country + city: `?countryCode=LB&city=beirut`

**200**

```json
{
  "schools": [
    { "schoolId": "aub", "name": "AUB", "countryCode": "LB", "city": "Beirut" }
  ],
  "nextToken": null
}
```

---

### GET `/schools/{schoolId}` _(Public)_

**200**

```json
{
  "schoolId": "aub",
  "name": "American University of Beirut",
  "countryCode": "LB",
  "city": "Beirut"
}
```

**404** if not found.

---

### POST `/school/register` _(Instructor only)_

**Request body**

```json
{
  "name": "AUB",
  "countryCode": "LB",
  "city": "Beirut",
  "schoolId": "aub"
}
```

**201**

```json
{
  "schoolId": "aub",
  "name": "AUB",
  "countryCode": "LB",
  "city": "Beirut",
  "boundToUser": true,
  "note": "Cognito custom:schoolId set."
}
```

**409** `SCHOOL_ID_ALREADY_EXISTS`

---

## 3) Classroom

### POST `/classroom/create` _(Instructor)_

**Request body**

```json
{ "classroomName": "Chemistry 11A" }
```

**201**

```json
{
  "message": "Classroom created",
  "classroomID": "cls_123",
  "joinCode": "K7Q3ZP"
}
```

---

### GET `/classroom/list` _(Bearer)_

**200**

```json
{
  "classrooms": [
    {
      "classroomID": "cls_123",
      "classroomName": "Chemistry 11A",
      "schoolId": "aub",
      "school": "American University of Beirut",
      "createdAt": "2025-08-28T13:22:11.620Z",
      "teacherName": "Rana M."
    }
  ]
}
```

---

### POST `/classroom/members` _(Bearer)_

**Request body**

```json
{ "classroomID": "cls_123" }
```

**200**

```json
{
  "members": [
    {
      "userId": "u1",
      "firstName": "Ali",
      "lastName": "Slim",
      "role": "student"
    }
  ]
}
```

---

### POST `/classroom/join` _(Bearer)_

**Request body**

```json
{ "joinCode": "K7Q3ZP" }
```

**200**

```json
{ "message": "Successfully joined classroom" }
```

**403** `CANT_JOIN_DIFFERENT_SCHOOL` • **409** if already joined.

---

### POST `/classroom/kick` _(Instructor member)_

**Request body**

```json
{ "classroomID": "cls_123", "studentId": "u1-sub" }
```

**200**

```json
{ "message": "Student removed" }
```

---

### DELETE `/classroom/membership` _(Bearer)_

**Request body**

```json
{ "classroomID": "cls_123" }
```

**200 (student)**

```json
{ "message": "Left classroom" }
```

**200 (instructor; no students)**

```json
{ "message": "Classroom deleted" }
```

---

### POST `/classroom/refreshjc` _(Owner)_

> **Note:** request uses `classId` (lower-cased “d”) in legacy code.
> **Request body**

```json
{ "classId": "cls_123" }
```

**200**

```json
{ "joinCode": "NEWC0D" }
```

---

## 4) Announcements

### POST `/announcements/create` _(Instructor member)_

**Request body**

```json
{
  "classroomId": "cls_123",
  "filesMeta": [
    {
      "role": "body",
      "filename": "announcement.md",
      "contentType": "text/markdown"
    },
    {
      "role": "attachment",
      "filename": "lab-guide.pdf",
      "contentType": "application/pdf"
    }
  ]
}
```

**201**

```json
{
  "announcementId": "ann_abc",
  "createdAt": "2025-08-26T18:45:11.022Z",
  "uploadUrls": [
    { "role": "body", "filename": "announcement.md", "url": "https://..." },
    { "role": "attachment", "filename": "lab-guide.pdf", "url": "https://..." }
  ]
}
```

---

### GET `/announcements/fetch` _(Bearer)_

**Query params (current)**: `classID=cls_123&k=10&cursor=<opaque>`
**Recommended**: `classroomId=cls_123` (migration in next patch)

**200**

```json
{
  "announcements": [
    {
      "announcementId": "ann_abc",
      "createdAt": "2025-08-26T18:45:11.022Z",
      "authorId": "teacher-sub",
      "kind": "teacher",
      "pinned": false,
      "files": [
        {
          "role": "body",
          "filename": "announcement.md",
          "url": "https://presigned...",
          "expiresAt": "2025-09-03T12:32:00Z"
        }
      ]
    }
  ],
  "nextCursor": null
}
```

> **Privacy note:** membership check to be enforced in the next patch.

---

## 5) Experiments

### POST `/experiments/create` _(Bearer — ensure membership)_

**Request body**

```json
{
  "classId": "cls_123",
  "prototypeId": "titration-x3458",
  "title": "Acid–Base Titration"
}
```

**201**

```json
{ "experimentId": "EXP#2025-09-03T10:10:10.100Z#c02f63" }
```

---

### POST `/experiments/log` _(Owner)_

**Request body**

```json
{ "classId": "cls_123", "experimentId": "EXP#...#..." }
```

**200**

```json
{
  "message": "After you upload, call experiments/finish",
  "uploadUrl": "https://presigned-put...",
  "key": "class/cls_123/experiment/EXP#...#.../info.txt"
}
```

---

### POST `/experiments/finish` _(Owner)_

**Request body**

```json
{ "classId": "cls_123", "experimentId": "EXP#...#..." }
```

**200**

```json
{ "success": true }
```

---

### POST `/experiments/info` _(Bearer — restrict to owner/teacher)_

**Request body**

```json
{ "classId": "cls_123", "experimentId": "EXP#...#..." }
```

**200**

```json
{ "url": "https://presigned-get..." }
```

---

### GET `/experiments/list` _(Bearer — ensure membership)_

**Query params**: `classId=cls_123&k=10&cursor=<opaque>`
**200**

```json
{
  "experiments": [
    {
      "experimentId": "EXP#...#...",
      "classId": "cls_123",
      "userId": "USER#student-sub",
      "createdAt": "2025-09-02T10:00:00Z",
      "pending": false,
      "hiddenByTeacher": false,
      "hiddenByOwner": false,
      "s3Key": "class/cls_123/experiment/EXP#...#.../info.txt"
    }
  ],
  "nextCursor": null
}
```

---

### DELETE `/experiments/delete` _(Owner)_

**Request body**

```json
{ "classId": "cls_123", "experimentId": "EXP#...#..." }
```

**200**

```json
{ "success": true, "message": "Experiment deleted" }
```

---

### POST `/experiments/togglehide` _(Owner/Instructor — ensure membership)_

**Request body**

```json
{ "classId": "cls_123", "experimentId": "EXP#...#..." }
```

**200**

```json
{ "success": true }
```

> **Bugfix note:** pass the **computed role** (“teacher” vs “student”) to the toggle util.

---

## 6) Free Mode

### POST `/free/step` _(Bearer — membership + quota)_

**Request body**

```json
{
  "classroomId": "cls_123",
  "env": {
    "id": "Beaker1",
    "type": "Beaker",
    "properties": { "pH": 7, "temperature": { "value": 25, "unit": "°C" } },
    "contents": {
      "liquids": { "Water": { "volume": { "value": 500, "unit": "mL" } } },
      "solids": {},
      "aqueous": {}
    },
    "attachedTools": ["pHmeter1"]
  },
  "action": {
    "type": "add",
    "material": "HCl",
    "amount": { "value": 20, "unit": "mL" },
    "target": "Beaker1"
  },
  "history": []
}
```

**200**

```json
{
  "postAction": {
    "environment": {
      "id": "Beaker1",
      "properties": { "pH": 3 },
      "contents": {
        "aqueous": {
          "H+": { "concentration": { "value": 0.1, "unit": "M" } },
          "Cl-": { "concentration": { "value": 0.1, "unit": "M" } }
        }
      }
    },
    "tools": { "pHmeter1": { "reading": 3 } },
    "uiEvents": [
      {
        "path": "properties.pH",
        "effect": "updatePHMeter",
        "payload": { "reading": 3 }
      }
    ]
  },
  "uiEvents": [
    {
      "path": "properties.pH",
      "effect": "updatePHMeter",
      "payload": { "reading": 3 }
    }
  ],
  "tokensIn": 180,
  "tokensOut": 42,
  "quotaExceeded": false
}
```

**402 — QUOTA_EXCEEDED**

```json
{
  "error": "QUOTA_EXCEEDED",
  "quotaExceeded": true,
  "usage": {
    "costMicroUSD": 4980000,
    "quotaMicroUSD": 5000000,
    "month": "MO#2025-09"
  }
}
```

---

# Schemas (Zod) — Reference (JSON Shapes)

> **Note:** These describe FE/BE contracts. Minor field renames may appear during normalization to **`classroomId`** on request surfaces.

## A) Free Mode

### `free/valueUnit.ts`

```json
{
  "value": 25,
  "unit": "°C"
}
```

### `free/environment.ts` — **Environment**

```json
{
  "id": "Beaker1",
  "type": "Beaker",
  "properties": {
    "pH": 7,
    "temperature": { "value": 25, "unit": "°C" },
    "instants": { "gas": { "CO2": false } }
  },
  "contents": {
    "liquids": {
      "Water": { "volume": { "value": 500, "unit": "mL" } }
    },
    "solids": {},
    "aqueous": {}
  },
  "attachedTools": ["pHmeter1"]
}
```

### `free/action.ts` — **Action (discriminated union)**

```json
{
  "type": "add",
  "material": "HCl",
  "amount": { "value": 20, "unit": "mL" },
  "target": "Beaker1"
}
```

```json
{ "type": "heat", "target": "Beaker1", "delta": { "value": 10, "unit": "°C" } }
```

```json
{
  "type": "stir",
  "target": "Beaker1",
  "duration": { "value": 10, "unit": "s" }
}
```

### `free/postAction.ts` — **PostAction (minimal diff)**

```json
{
  "environment": { "id": "Beaker1", "properties": { "pH": 3 } },
  "tools": { "pHmeter1": { "reading": 3 } },
  "uiEvents": [
    {
      "path": "properties.pH",
      "effect": "updatePHMeter",
      "payload": { "reading": 3 }
    }
  ]
}
```

### `free/stepio.ts`

**StepRequest**

```json
{
  "classroomId": "cls_123",
  "env": { "...": "Environment" },
  "action": { "...": "Action" },
  "history": [
    {
      "action": { "...": "Action" },
      "result": { "...": "PostAction" },
      "timestamp": "2025-09-03T10:00:00Z"
    }
  ]
}
```

**StepResponse**

```json
{
  "postAction": { "...": "PostAction" },
  "uiEvents": [{ "...": "UIEvent" }],
  "tokensIn": 0,
  "tokensOut": 0,
  "quotaExceeded": false
}
```

### `free/setup.ts` — **Setup**

```json
{
  "materials": {
    "HCl": { "stock": { "concentration": { "value": 0.1, "unit": "M" } } },
    "NaCl": { "stock": {} }
  },
  "tools": ["pHmeter1", "Thermometer1"],
  "environments": [{ "...": "Environment" }]
}
```

### `free/timeline.ts` — **Timeline**

```json
{
  "setup": { "...": "Setup" },
  "environments": { "Beaker1": { "...": "Environment" } },
  "history": [{ "action": {}, "result": {}, "timestamp": "..." }]
}
```

---

## B) Announcements

### `announcements/FileMetaSchema.ts`

```json
{
  "role": "body",
  "filename": "announcement.md",
  "contentType": "text/markdown"
}
```

### `announcements/AnnCreateSchema.ts`

```json
{
  "classroomId": "cls_123",
  "filesMeta": [{ "...": "FileMeta" }]
}
```

### `announcements/AnnFetchQuery.ts` (GET query) & `AnnFetchSchema.ts` (alt)

```json
{ "classID": "cls_123", "k": 10, "cursor": "opaque" }
```

_(Recommended new surface: `{ "classroomId": "cls_123", "k": 10, "cursor": "..." }`)_

### `announcements/AnnItem.ts`

```json
{
  "announcementId": "ann_abc",
  "classId": "cls_123",
  "createdAt": "iso",
  "authorId": "teacher-sub",
  "kind": "teacher",
  "pinned": false,
  "files": [
    {
      "role": "body",
      "key": "announcements/.../body.md",
      "filename": "announcement.md",
      "contentType": "text/markdown"
    }
  ]
}
```

### `announcements/AnnResponse.ts`

```json
{
  "announcements": [{ "...": "AnnItem with presigned GET urls" }],
  "nextCursor": null
}
```

---

## C) Experiments

### `experiments/ExpCreateSchema.ts`

```json
{
  "classId": "cls_123",
  "prototypeId": "titration-x3458",
  "title": "Acid–Base Titration",
  "mode": "free"
}
```

### `experiments/ExpItem.ts`

```json
{
  "classId": "cls_123",
  "experimentId": "EXP#...#...",
  "createdAt": "iso",
  "userId": "USER#sub",
  "ownerRole": "student",
  "pending": false,
  "hiddenByTeacher": false,
  "hiddenByOwner": false,
  "s3Key": "class/cls_123/experiment/EXP#...#.../info.txt"
}
```

### `experiments/ExpLogInputSchema.ts`

```json
{ "classId": "cls_123", "experimentId": "EXP#...#..." }
```

---

## D) Core

### `schemas/classroom.ts` — **Classroom**

```json
{
  "classroomID": "cls_123",
  "classroomName": "Chemistry 11A",
  "schoolId": "aub",
  "school": "American University of Beirut",
  "createdAt": "iso",
  "teacherId": "sub",
  "teacherName": "Rana M.",
  "joinCode": "K7Q3ZP",
  "llmQuotaCents": 500
}
```

### `schemas/membership.ts` — **Membership edges**

```json
{
  "PK": "CLASSROOM#cls_123",
  "SK": "USER#u1",
  "role": "student",
  "joinedAt": "iso"
}
```

### `schemas/school.ts` — **School**

```json
{
  "schoolId": "aub",
  "name": "AUB",
  "countryCode": "LB",
  "city": "Beirut",
  "nameSlug": "aub",
  "citySlug": "beirut",
  "gpk": "SCHOOL",
  "ccCity": "LB#beirut",
  "createdAt": "iso",
  "createdBy": "sub"
}
```

---

## Security model

- Cognito IdToken → handlers read claims via API Gateway authorizer.
- School boundary enforced at `/classroom/join`.
- Membership is checked for most mutations; strengthen on:

  - `/announcements/fetch` (add check),
  - `/experiments/{create,list,info,togglehide}` (ensure check).

- Free Mode uses a **monthly** per-class budget:

  - **Pre-check**: block if `costMicroUSD >= quota`.
  - **Post-update**: atomic `ADD` counters (`requests`, `tokensIn`, `tokensOut`, `costMicroUSD`).
  - Responds with `quotaExceeded: true` when the current step crosses the limit.

- OpenAI API key is read from **Secrets Manager** (`LLM_SECRET_ARN`).

---

## IAM notes

- **S3**: Allow `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` for both `${ANNOUNCEMENTS_BUCKET}/*` and `${EXPERIMENTS_BUCKET}/*`.
- **DynamoDB**: Allow `GetItem`, `PutItem`, `UpdateItem`, `Query`, `DeleteItem` on all listed tables; **include** `llm_usage`.
- **Secrets Manager**: Allow `secretsmanager:GetSecretValue` on `${LLM_SECRET_ARN}`.

## Known gaps / Next steps

- Enforce classroom membership for **announcement fetch** and some **experiment** routes.
- Fix `togglehide` to pass the computed role (“teacher” vs “student”).
- Normalize request inputs to **`classroomId`** everywhere (DB remains `classroomID`).
- Basic rate limiting & size caps; structured logs/metrics; pin/unpin announcements.
- Frontend integration for Free Mode merge rules and UI event handling.
