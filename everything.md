# 1) Database Schema Overview

## Tables (DynamoDB)

* **`schools`** — Registry of schools users can select.
  **Keys/fields:**
  `schoolId (PK)`, `name`, `countryCode (ISO-2)`, `city`, `nameSlug`, `citySlug`, `ccCity` (derived `COUNTRY#citySlug`), `createdAt`, `createdBy`, `gpk` (constant `"SCHOOL"`).
  **GSIs:**

  * `countryCityName-index`: **PK** `ccCity`, **SK** `nameSlug` (browse schools in a city, alphabetically).
  * `countryName-index`: **PK** `countryCode`, **SK** `nameSlug` (typeahead search by name within a country).
  * `globalName-index`: **PK** `gpk` (= `"SCHOOL"`), **SK** `nameSlug` (list **all** schools alphabetically, no filters).

* **`classrooms`** — One item per classroom.
  **Keys/fields:**
  `classroomID (PK)`, `classroomName`, `schoolId`, `school` (denormalized name), `createdAt`, `teacherId`, `teacherName`, `joinCode`.
  **GSI:**

  * `joinCode-index`: **PK** `joinCode` (look up class by code).

* **`memberships`** — Bipartite graph connecting users ↔ classes (two rows per membership).
  **Keys/fields:**
  `PK`, `SK`, `role ('student'|'instructor')`, `joinedAt`.
  **Patterns:**

  * `PK = USER#<sub>`,     `SK = CLASSROOM#<classroomID>`
  * `PK = CLASSROOM#<id>`, `SK = USER#<sub>`

## Identity (Cognito User Pool)

* Custom attributes stored on users and exposed in JWT **claims**:

  * `custom:role` (`student` | `instructor`)
  * `custom:grade`
  * `custom:schoolId` (canonical)
  * `custom:school` (display name convenience)

## Relationships

* **School 1—*many* classrooms**: `classrooms.schoolId → schools.schoolId`.
* **User *—* Classroom (via `memberships`)**: edges written both ways for fast queries.

---

# 2) User Roles & Permissions

* **Student**

  * Sign up (must select a registered school), log in, view profile.
  * Join classrooms (only if same `schoolId`).
  * List own classrooms.
  * View members of a classroom they belong to.
  * Leave a classroom.

* **Instructor**

  * Everything a student can do.
  * Can sign up **with or without** a school. If no school, register one later.
  * Register schools (and get auto-bound to them).
  * Create classrooms (**requires** `custom:schoolId` on their account).
  * Kick students from their classrooms.
  * Delete a classroom **only if** no students remain (via “leave” flow).

> No “admin” routes exist in this repo (could be added later).

---

# 3) Authentication & Authorization

* **Signup**: `POST /auth/register` writes a Cognito user with standard + custom attributes.

  * **Students** must provide a valid `schoolId`. The UI typically resolves this by querying `/schools` by **name**, then passing the selected `schoolId`.
  * **Instructors** may sign up **without** a school; response includes a note to register one later.
* **Confirm**: `POST /auth/confirm` with the emailed/SMS code.
* **Login**: `POST /auth/login` returns Cognito tokens (`IdToken`, `AccessToken`, `RefreshToken`). If an instructor has no `custom:schoolId`, response includes `needsSchoolRegistration: true` + a note.
* **Protected routes**: API Gateway **Cognito Authorizer** validates `Authorization: Bearer <IdToken>` and injects **claims** into `event.requestContext.authorizer.claims`.
* **Claims used**: `sub`, `email`, `given_name`, `family_name`, `custom:role`, `custom:grade`, `custom:schoolId`, `custom:school`.

---

# 4) Routes (grouped by feature)

## Auth

### Instructor/Student can sign up — `POST /auth/register`

**What it does:** Creates a new user; stores role, grade, and (if provided/valid) school in custom attributes.

**Requirements (body):**

* Always: `email`, `password`, `firstName`, `lastName`, `role ('student'|'instructor')`, `grade`
* **Students**: must include a valid `schoolId` (selected by name in UI, but sent as `schoolId`)
* **Instructors**: `schoolId` optional

**Process Flow:**

1. Validate with Zod.
2. If `schoolId` present → validate via `getSchoolById()`.
3. Students require a valid school; instructors may proceed without.
4. Call Cognito `signUp` with attributes (include school attrs only if resolved).

**Success:**
`200 { message: "Signup successful. Please confirm your account.", needsSchoolRegistration?: true, note?: string }`

**Errors:**
`400 INVALID_INPUT` · `400 INVALID_SCHOOL_ID` (student) · `409 EMAIL_ALREADY_REGISTERED` · `400 WEAK_PASSWORD`

**UI Hint:**
School **picker by name** powered by `/schools`; submit `schoolId`.

---

### Instructor/Student can confirm account — `POST /auth/confirm`

**What it does:** Confirms account using the verification code.

**Requirements (body):** `email`, `code` (6 chars)

**Flow:** Validate → Cognito `confirmSignUp` → success message.

**Success:** `200 { message: "Account confirmed successfully" }`
**Errors:** `400 INVALID_INPUT` · `400 Confirmation failed`

---

### Instructor/Student can log in — `POST /auth/login`

**What it does:** Authenticates and returns tokens; flags instructors without a school.

**Requirements (body):** `email`, `password`

**Flow:** Validate → Cognito `initiateAuth` → return tokens; decode `IdToken` to add `needsSchoolRegistration` if instructor lacks `schoolId`.

**Success:**
`200 { IdToken, AccessToken, RefreshToken, ExpiresIn, TokenType, needsSchoolRegistration?: true, note?: string }`

**Errors:**
`400 INVALID_INPUT` · `401 INVALID_CREDENTIALS` · `403 USER_NOT_CONFIRMED` · `403 PASSWORD_RESET_REQUIRED` · `404 USER_NOT_FOUND`

---

### Instructor/Student can view profile — `GET /auth/profile`

**What it does:** Returns profile from JWT claims.

**Requirements:** `Authorization: Bearer <IdToken>`

**Flow:** Read `claims` from authorizer → return selected fields.

**Success:**
`200 { userId, email, firstName, lastName, role, grade, schoolId, schoolName }`
**Errors:** `401 Unauthorized`

---

## Schools

### Instructor can register a school — `POST /school/register`

**What it does:** Creates a school and **auto-binds** the instructor’s account to it.

**Requirements:** Bearer token (instructor)
**Body:** `name`, `countryCode (ISO-2)`, `city`, `schoolId?` (optional; slug from name if omitted)

**Flow:**
Validate → derive `nameSlug`, `citySlug`, `ccCity`, `gpk="SCHOOL"` → `putSchool()` (conditional create) → **AdminUpdateUserAttributes** to set instructor’s `custom:schoolId` & `custom:school`.

**Success:**
`201 { schoolId, name, countryCode, city, boundToUser: true, note: "…re-login to refresh token" }`
*(If binding fails: `boundToUser: false` + helpful note, school still created.)*

**Errors:** `401` · `403 INSTRUCTOR_ONLY` · `409 SCHOOL_ID_ALREADY_EXISTS` · `400 INVALID_INPUT`

**UI Hint:**
After success, prompt logout/login to refresh claims.

---

### Anyone can list/search schools — `GET /schools`

**What it does:** Returns schools for selection in signup.

**Modes (query params):**

* **No params:** list **all** schools alphabetically (via `globalName-index`), supports `limit`, `nextToken`.
* **Search:** `?q=<namePrefix>&countryCode=<CC>`
* **Browse:** `?countryCode=<CC>&city=<City>`
  All modes: optional `limit`, `nextToken` for pagination.

**Flow:**
No params → query `globalName-index` (`gpk="SCHOOL"`).
Search → `searchByName()` (GSI `countryName-index`).
Browse → `queryByCountryCity()` (GSI `countryCityName-index`).

**Success:**
`200 { schools: [...], nextToken?: string }`
**Errors:** `400` (bad combo) · `500`

**UI Hint:**
Typeahead (search) + filters (country/city). Show **names**; store `schoolId`.

---

### Anyone can fetch a specific school — `GET /schools/{schoolId}`

**What it does:** Returns one school’s details.

**Flow:** Path `schoolId` → `getSchoolById()`.

**Success:** `200 { schoolId, name, countryCode, city, ... }`
**Errors:** `400` (missing) · `404` (not found)

---

## Classrooms

### Instructor can create a classroom — `POST /classroom/create`

**What it does:** Creates a class attached to the instructor’s school and enrolls the instructor.

**Requirements:** Bearer token (instructor)
**Body:** `classroomName`

**Flow:**
Check role → read `schoolId` from claims & verify via `getSchoolById()` → build record with UUID + joinCode → validate with `ClassroomSchema` → `insertClassroomRecord()` → `putMembershipBothWays()` for instructor membership.

**Success:**
`201 { message: "Classroom created", classroomID, joinCode }`
**Errors:** `401/403` · `400` (no school on account / validation) · `500`

---

### Student can join a classroom — `POST /classroom/join`

**What it does:** Enrolls current user by **join code** (same school only).

**Requirements:** Bearer token
**Body:** `joinCode`

**Flow:**
Validate → `getClassroomByJoinCode()` → verify `claims['custom:schoolId'] === classroom.schoolId` → check existing edge via `getMembershipRecord()` → `putMembershipBothWays()`.

**Success:** `200 { message: "Successfully joined classroom" }`
**Errors:** `401` · `403` (invalid code / different school) · `409` (already joined)

---

### Any authenticated user can list their classrooms — `GET /classroom/list`

**What it does:** Returns classrooms the user belongs to (both roles).

**Flow:**
`getClassroomIDsForUser()` (by `PK=USER#sub`) → fetch each via `getClassroomByID()` → strip `teacherId` from response.

**Success:** `200 [ ...classrooms... ]`
**Errors:** `401` · `500`

---

### Member can view classroom members — `POST /classroom/members`

**What it does:** Returns student profiles for a classroom.

**Body:** `classroomID`
**Flow:**
`getStudentIDsByClassroom()` → for each id, `fetchStudentInfo()` from Cognito → return normalized list.

**Success:**
`200 { members: [ { id, email, firstName, lastName, school, schoolId?, grade, role }, ... ] }`
**Errors:** `401` · `400` · `500`

---

### Student/Instructor can leave or delete a classroom — `DELETE /classroom/membership`

**Body:** `classroomID`
**Flow:**
Read `getMembershipRecord(USER#me, CLASSROOM#id)` →

* If **student**: `removeMembershipBothWays()` → `200 Left classroom`
* If **instructor**: if students exist (`getStudentIDsByClassroom()`), `409`; else `deleteClassroomWithMembership()` → `200 Classroom deleted`.

**Errors:** `401` · `400` · `404` · `409` · `500`

---

### Instructor can kick a student — `POST /classroom/kick`

**Body:** `classroomID`, `studentId`
**Flow:**
Verify requester is instructor in that class → verify target is student member → `removeMembershipBothWays(studentId, classroomID)`.

**Success:** `200 { message: 'Student removed' }`
**Errors:** `401` · `403 INSTRUCTOR_ONLY` · `404 STUDENT_NOT_FOUND` · `500`

---

# 5) Special Middleware / Validation

* **Cognito Authorizer**: attached to protected routes in `serverless.yml`; injects `claims`.
* **Zod Validation**: used across handlers (`signup`, `confirm`, `login`, `schools`, `create`, `join`).
* **DynamoDB transactions**:

  * `putMembershipBothWays()` writes both membership edges atomically.
  * `removeMembershipBothWays()` and `deleteClassroomWithMembership()` handle deletions atomically.
* **Conditional writes**:

  * `insertClassroomRecord()` → `attribute_not_exists(classroomID)`
  * `insertMembershipRecord()` → `attribute_not_exists(PK) AND attribute_not_exists(SK)`
  * `putSchool()` → `attribute_not_exists(schoolId)`

> Deployment tip: ensure IAM allows the three school GSIs, including **`schools/index/globalName-index`**.

---

# 6) Overall System Flow Summary

1. **Instructor onboarding**
   Instructors may sign up **without** a school. After confirming & logging in, they register a school (`POST /school/register`). The backend creates the school and **auto-binds** it to their account (re-login refreshes tokens).

2. **Student onboarding**
   Students search/browse schools by **name** using `/schools`, then sign up by sending the selected **`schoolId`** to `/auth/register`.

3. **Authorization**
   Protected endpoints require the **IdToken**; the authorizer verifies and injects **claims** for handlers to use.

4. **Classroom lifecycle**
   Instructors with a bound `schoolId` create classes; students join via **join code** if `schoolId` matches.

5. **Membership graph**
   The `memberships` table backs listing classes per user and members per class; mutations (join/leave/kick/delete) keep edges consistent atomically.

6. **Profiles**
   Member details are fetched from **Cognito**. The profile endpoint echoes the current user’s JWT claim fields.
