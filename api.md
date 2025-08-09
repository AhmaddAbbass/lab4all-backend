
# API Testing Guide

## 1) Database Tables Overview

**schools**

* **Stores:** selectable schools for signup
* **Required:** `schoolId`, `name`, `countryCode`, `city`, `nameSlug`, `citySlug`, `ccCity`, `createdAt`, `createdBy`, `gpk`

  * `gpk` is a constant `"SCHOOL"` (enables global alphabetical listing)
* **Relations:** `classrooms.schoolId → schools.schoolId`

**classrooms**

* **Stores:** each classroom
* **Required:** `classroomID`, `classroomName`, `schoolId`, `school`, `createdAt`, `teacherId`, `teacherName`, `joinCode`
* **Relations:** belongs to a `schoolId`; members via `memberships`

**memberships** (bi-directional edges)

* **Stores:** user↔class links (two rows per membership)
* **Required:** `PK`, `SK`, `role ('student'|'instructor')`, `joinedAt`
* **Relations:** `USER#<sub> → CLASSROOM#<classroomID>` and `CLASSROOM#<classroomID> → USER#<sub>`

> Start with an **instructor signup (no school needed)** → register a school → create class → student flow.

---

## 2) Simple Route Testing (timeline)

### Route: POST /auth/register  (Instructor – no school yet)

**What it does:** Sign up an **instructor** without a school.
**Method:** POST — **Authorization:** Not required
**Body expects:**

```json
{
  "email": "inst@example.com",
  "password": "Password!1",
  "firstName": "Mona",
  "lastName": "Ahmad",
  "role": "instructor",
  "grade": "N/A"
}
```

**Example Output:**

```json
{
  "message": "Signup successful. Please confirm your account.",
  "needsSchoolRegistration": true,
  "note": "After confirming your account, please register your school so students can join."
}
```

**Now you have:** Pending instructor; confirm next.

---

### Route: POST /auth/confirm

**What it does:** Confirms the new instructor with code.
**Method:** POST — **Authorization:** Not required
**Body expects:**

```json
{ "email": "inst@example.com", "code": "123456" }
```

**Example Output:**

```json
{ "message": "Account confirmed successfully" }
```

**Now you have:** Confirmed instructor who can log in.

---

### Route: POST /auth/login

**What it does:** Logs in instructor and returns tokens.
**Method:** POST — **Authorization:** Not required
**Body expects:**

```json
{ "email": "inst@example.com", "password": "Password!1" }
```

**Example Output:**

```json
{
  "IdToken": "eyJraWQiOi...",
  "AccessToken": "eyJraWQiOi...",
  "RefreshToken": "eyJjdHkiOi...",
  "ExpiresIn": 3600,
  "TokenType": "Bearer",
  "needsSchoolRegistration": true,
  "note": "Welcome! Please register your school so students can join."
}
```

**Now you have:** `IdToken` for protected routes.

---

### Route: POST /school/register

**What it does:** Registers a school (instructor only) and auto-binds the instructor to it.
**Method:** POST — **Authorization:** Bearer token required
**Body expects:**

```json
{
  "name": "International College Beirut",
  "countryCode": "LB",
  "city": "Beirut",
  "schoolId": "international-college-beirut"
}
```

**Example Output:**

```json
{
  "schoolId": "international-college-beirut",
  "name": "International College Beirut",
  "countryCode": "LB",
  "city": "Beirut",
  "boundToUser": true,
  "note": "School registered and linked to your account. Please sign out and sign in again to refresh your token."
}
```

**Now you have:** A school to select by **name** (UI) / `schoolId` (backend).

---

### Route: GET /schools  (no params)

**What it does:** Lists **all schools alphabetically** (paginated).
**Method:** GET — **Authorization:** Not required
**Body expects:** *(none)*
**Example Output:**

```json
{
  "schools": [
    { "schoolId": "international-college-beirut", "name": "International College Beirut", "countryCode": "LB", "city": "Beirut" }
  ],
  "nextToken": null
}
```

**Now you have:** Global list for simple pickers.

---

### Route: GET /schools?countryCode=LB&city=Beirut

**What it does:** Searches schools by name prefix **within a country**.
**Method:** GET — **Authorization:** Not required
**Body expects:** *(none)*
**Example Output:**

```json
{
  "schools": [
    { "schoolId": "beirut-high-school", "name": "Beirut High School", "countryCode": "LB", "city": "Beirut" }
  ],
  "nextToken": null
}
```

**Now you have:** Typeahead results for UI.

---

### Route: GET /schools?countryCode=LB\&city=Beirut

**What it does:** Lists schools in a **city** (alphabetical).
**Method:** GET — **Authorization:** Not required
**Body expects:** *(none)*
**Example Output:**

```json
{
  "schools": [
    { "schoolId": "international-college-beirut", "name": "International College Beirut" },
    { "schoolId": "beirut-high-school", "name": "Beirut High School" }
  ]
}
```

**Now you have:** Browse list for selection.

---

### Route: GET /schools/{schoolId}

**What it does:** Fetches one school by ID.
**Method:** GET — **Authorization:** Not required
**Body expects:** *(none)*
**Example Output:**

```json
{
  "schoolId": "international-college-beirut",
  "name": "International College Beirut",
  "countryCode": "LB",
  "city": "Beirut"
}
```

**Now you have:** Single school details.

---

### Route: POST /classroom/create

**What it does:** Creates a classroom (instructor only).
**Method:** POST — **Authorization:** Bearer token required
**Body expects:**

```json
{ "classroomName": "Physics 101" }
```

**Example Output:**

```json
{
  "message": "Classroom created",
  "classroomID": "a7f5b8a0-0d3b-4b61-8e2b-1f5b7b1e3c9a",
  "joinCode": "AB1724520412731"
}
```

**Now you have:** A classroom + join code to share.

---

### Route: POST /auth/register  (Student – using `schoolId`)

**What it does:** Sign up a **student** for the school (must send `schoolId`).
**Method:** POST — **Authorization:** Not required
**Body expects:**

```json
{
  "email": "student@example.com",
  "password": "Password!1",
  "firstName": "Ali",
  "lastName": "Khan",
  "role": "student",
  "grade": "11",
  "schoolId": "international-college-beirut"
}
```

**Example Output:**

```json
{ "message": "Signup successful. Please confirm your account." }
```

**Now you have:** Pending student needing confirmation.

---

### Route: POST /auth/confirm  (Student)

**What it does:** Confirms the student account.
**Method:** POST — **Authorization:** Not required
**Body expects:**

```json
{ "email": "student@example.com", "code": "123456" }
```

**Example Output:**

```json
{ "message": "Account confirmed successfully" }
```

**Now you have:** Confirmed student.

---

### Route: POST /auth/login  (Student)

**What it does:** Logs in the student.
**Method:** POST — **Authorization:** Not required
**Body expects:**

```json
{ "email": "student@example.com", "password": "Password!1" }
```

**Example Output:**

```json
{ "IdToken": "eyJraWQiOi...", "AccessToken": "eyJraWQiOi..." }
```

**Now you have:** Student token to join class.

---

### Route: POST /classroom/join

**What it does:** Student joins a class using join code (same school only).
**Method:** POST — **Authorization:** Bearer token required (student)
**Body expects:**

```json
{ "joinCode": "AB1724520412731" }
```

**Example Output:**

```json
{ "message": "Successfully joined classroom" }
```

**Now you have:** Student enrolled in the class.

---

### Route: GET /classroom/list  (Instructor)

**What it does:** Lists classes for the current user.
**Method:** GET — **Authorization:** Bearer token required
**Body expects:** *(none)*
**Example Output:**

```json
[
  {
    "classroomID": "a7f5b8a0-0d3b-4b61-8e2b-1f5b7b1e3c9a",
    "classroomName": "Physics 101",
    "schoolId": "international-college-beirut",
    "school": "International College Beirut",
    "createdAt": "2025-08-01T09:15:30.150Z",
    "teacherName": "Mona Ahmad",
    "joinCode": "AB1724520412731"
  }
]
```

**Now you have:** Instructor’s class list.

---

### Route: GET /classroom/list  (Student)

**What it does:** Lists classes for the student.
**Method:** GET — **Authorization:** Bearer token required
**Body expects:** *(none)*
**Example Output:**

```json
[
  {
    "classroomID": "a7f5b8a0-0d3b-4b61-8e2b-1f5b7b1e3c9a",
    "classroomName": "Physics 101",
    "schoolId": "international-college-beirut",
    "school": "International College Beirut",
    "createdAt": "2025-08-01T09:15:30.150Z",
    "teacherName": "Mona Ahmad"
  }
]
```

**Now you have:** Student’s class list.

---

### Route: POST /classroom/members

**What it does:** Lists student members of a classroom.
**Method:** POST — **Authorization:** Bearer token required
**Body expects:**

```json
{ "classroomID": "a7f5b8a0-0d3b-4b61-8e2b-1f5b7b1e3c9a" }
```

**Example Output:**

```json
{
  "members": [
    {
      "id": "user-sub",
      "email": "student@example.com",
      "firstName": "Ali",
      "lastName": "Khan",
      "school": "International College Beirut",
      "schoolId": "international-college-beirut",
      "grade": "11",
      "role": "student"
    }
  ]
}
```

**Now you have:** Visible roster.

---

### Route: POST /classroom/kick

**What it does:** Instructor removes a student from the class.
**Method:** POST — **Authorization:** Bearer token required (instructor)
**Body expects:**

```json
{ "classroomID": "a7f5b8a0-0d3b-4b61-8e2b-1f5b7b1e3c9a", "studentId": "user-sub" }
```

**Example Output:**

```json
{ "message": "Student removed" }
```

**Now you have:** Member removed; class updated.

---

### Route: DELETE /classroom/membership  (Student)

**What it does:** Student leaves the class.
**Method:** DELETE — **Authorization:** Bearer token required (student)
**Body expects:**

```json
{ "classroomID": "a7f5b8a0-0d3b-4b61-8e2b-1f5b7b1e3c9a" }
```

**Example Output:**

```json
{ "message": "Left classroom" }
```

**Now you have:** Student no longer in class.

---

### Route: DELETE /classroom/membership  (Instructor)

**What it does:** Instructor leaves; if no students, deletes the class.
**Method:** DELETE — **Authorization:** Bearer token required (instructor)
**Body expects:**

```json
{ "classroomID": "a7f5b8a0-0d3b-4b61-8e2b-1f5b7b1e3c9a" }
```

**Example Output:**

```json
{ "message": "Classroom deleted" }
```

**Now you have:** Class deleted (only if empty).

---

That’s it—ordered, simple, and ready to test step-by-step.
