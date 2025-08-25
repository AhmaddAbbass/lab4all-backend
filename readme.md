# Lab4All Backend (Serverless + AWS Cognito)

Backend for **Lab4All**, a virtual-lab platform for schools.
Built with **TypeScript**, **Serverless Framework**, **AWS Lambda**, **DynamoDB**, and **Cognito**.

---

## ✨ Features

* **Auth (Cognito):** signup, confirm, login, profile (JWT claims).
* **Schools:** register (instructor-only), list/search, get by id.
* **Classrooms:** create (instructor), join (student via code), list my classes, list members, leave/delete, kick.
* **Clean data model:** DynamoDB tables for `schools`, `classrooms`, `memberships` (+ GSIs).
* **Production-ready bits:** Zod validation, conditional writes, atomic membership transactions, serverless-offline.

> Instructors can sign up **without** a school. After login they register their school; backend binds the school to their account.

---

## 🧱 Architecture (quick)

* **Lambda handlers** in `src/handlers/*`
* **DynamoDB** tables:

  * `schools` (GSIs: `countryCityName-index`, `countryName-index`)
  * `classrooms` (GSI: `joinCode-index`)
  * `memberships` (bi-directional edges)
* **Cognito User Pool** with custom attrs:

  * `custom:role`, `custom:grade`, `custom:schoolId`, `custom:school`

---

## 📦 Project Structure

```
src/
  index.ts                     # exports all handlers for serverless.yml

  handlers/
    auth/
      signup.ts                # POST /auth/register
      confirm.ts               # POST /auth/confirm
      login.ts                 # POST /auth/login
      profile.ts               # GET  /auth/profile
    classroom/
      create.ts                # POST   /classroom/create
      join.ts                  # POST   /classroom/join
      getClassrooms.ts         # GET    /classroom/list
      getMembers.ts            # POST   /classroom/members
      leave.ts                 # DELETE /classroom/membership
      kick.ts                  # POST   /classroom/kick
    school/
      register.ts              # POST /school/register
      list.ts                  # GET  /schools
      get.ts                   # GET  /schools/{schoolId}

  schemas/                     # zod models
  utils/
    database/                  # dynamo accessors (all table names via env)
    other/                     # helpers (e.g., generateJoinCode, toSlug)
    userpool/                  # Cognito admin helpers
```

---

## 🔐 Environments

In `serverless.yml`, set:

```yml
provider:
  environment:
    # Cognito (use your real IDs)
    USER_POOL_ID: us-east-1_XXXXXXXXX
    CLIENT_ID:    xxxxxxxxxxxxxxxxxxxxxxxx

    # Dynamo tables
    CLASSROOMS_TABLE: classrooms
    MEMBERSHIPS_TABLE: memberships
    SCHOOLS_TABLE: schools

    # Optional: enforce school on student signup
    STRICT_SCHOOL_SIGNUP: 'true'
```

> Make sure your AWS CLI profile/credentials target the intended account/region (`us-east-1`).

---

## 🧰 Prerequisites

* Node 18+
* AWS CLI v2 (`aws sts get-caller-identity` should work)
* Serverless Framework (`npx serverless --version`)
* A Cognito User Pool + App Client (IDs placed in `serverless.yml`)
* DynamoDB tables created in **us-east-1** (see “Bootstrap DynamoDB” below)

---

## 🚀 Local Development

```bash
# install
npm ci

# build TypeScript → dist/
npm run build

# run offline (http://localhost:3000/dev)
npx serverless offline
```

**Quick sanity check (public route):**

```bash
curl http://localhost:3000/dev/schools
```

---

## 📡 Deploy to AWS

```bash
# build
npm run build

# deploy the whole stack
npx serverless deploy --stage dev --region us-east-1

# get the live base url
npx serverless info --stage dev --region us-east-1
# → https://XXXX.execute-api.us-east-1.amazonaws.com/dev
```

**Logs & fast redeploy**

```bash
# tail logs for a function
npx serverless logs -f signup -t

# update a single function quickly
npx serverless deploy function -f signup
```

---

## 🗃️ Bootstrap DynamoDB (CLI)

> Use **one** of these (PowerShell or bash). These create 3 tables with required GSIs.

### PowerShell (Windows)

```powershell
$env:AWS_REGION = "us-east-1"

# Clean up existing (ignore if not found)
$tables = @("classrooms","memberships","schools")
foreach ($t in $tables) {
  if (aws dynamodb list-tables --query "contains(TableNames, '$t')" --output text | Select-String True) {
    Write-Host "Deleting $t..."
    aws dynamodb delete-table --table-name $t | Out-Null
    aws dynamodb wait table-not-exists --table-name $t
  } else { Write-Host "$t not found (ok)" }
}

# Create classrooms with GSI joinCode-index
@'
[
  {
    "IndexName": "joinCode-index",
    "KeySchema": [ { "AttributeName": "joinCode", "KeyType": "HASH" } ],
    "Projection": { "ProjectionType": "ALL" }
  }
]
'@ | Set-Content -NoNewline gsi-classrooms.json

aws dynamodb create-table `
  --table-name classrooms `
  --attribute-definitions AttributeName=classroomID,AttributeType=S AttributeName=joinCode,AttributeType=S `
  --key-schema AttributeName=classroomID,KeyType=HASH `
  --billing-mode PAY_PER_REQUEST `
  --global-secondary-indexes file://gsi-classrooms.json | Out-Null
aws dynamodb wait table-exists --table-name classrooms

# memberships (PK/SK)
aws dynamodb create-table `
  --table-name memberships `
  --attribute-definitions AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S `
  --key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE `
  --billing-mode PAY_PER_REQUEST | Out-Null
aws dynamodb wait table-exists --table-name memberships

# schools with browse/search GSIs
@'
[
  {
    "IndexName": "countryCityName-index",
    "KeySchema": [
      { "AttributeName": "ccCity",   "KeyType": "HASH" },
      { "AttributeName": "nameSlug", "KeyType": "RANGE" }
    ],
    "Projection": { "ProjectionType": "ALL" }
  },
  {
    "IndexName": "countryName-index",
    "KeySchema": [
      { "AttributeName": "countryCode", "KeyType": "HASH" },
      { "AttributeName": "nameSlug",    "KeyType": "RANGE" }
    ],
    "Projection": { "ProjectionType": "ALL" }
  }
]
'@ | Set-Content -NoNewline gsi-schools.json

aws dynamodb create-table `
  --table-name schools `
  --attribute-definitions `
    AttributeName=schoolId,AttributeType=S `
    AttributeName=ccCity,AttributeType=S `
    AttributeName=nameSlug,AttributeType=S `
    AttributeName=countryCode,AttributeType=S `
  --key-schema AttributeName=schoolId,KeyType=HASH `
  --billing-mode PAY_PER_REQUEST `
  --global-secondary-indexes file://gsi-schools.json | Out-Null
aws dynamodb wait table-exists --table-name schools

Write-Host "`nTables ready:"
aws dynamodb list-tables --output table
```

### Bash (macOS/Linux)

```bash
export AWS_REGION=us-east-1

for t in classrooms memberships schools; do
  aws dynamodb delete-table --table-name "$t" >/dev/null 2>&1 || true
  aws dynamodb wait table-not-exists --table-name "$t" >/dev/null 2>&1 || true
done

cat > gsi-classrooms.json <<'JSON'
[
  {
    "IndexName": "joinCode-index",
    "KeySchema": [ { "AttributeName": "joinCode", "KeyType": "HASH" } ],
    "Projection": { "ProjectionType": "ALL" }
  }
]
JSON

aws dynamodb create-table \
  --table-name classrooms \
  --attribute-definitions AttributeName=classroomID,AttributeType=S AttributeName=joinCode,AttributeType=S \
  --key-schema AttributeName=classroomID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes file://gsi-classrooms.json >/dev/null
aws dynamodb wait table-exists --table-name classrooms

aws dynamodb create-table \
  --table-name memberships \
  --attribute-definitions AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S \
  --key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST >/dev/null
aws dynamodb wait table-exists --table-name memberships

cat > gsi-schools.json <<'JSON'
[
  {
    "IndexName": "countryCityName-index",
    "KeySchema": [
      { "AttributeName": "ccCity",   "KeyType": "HASH" },
      { "AttributeName": "nameSlug", "KeyType": "RANGE" }
    ],
    "Projection": { "ProjectionType": "ALL" }
  },
  {
    "IndexName": "countryName-index",
    "KeySchema": [
      { "AttributeName": "countryCode", "KeyType": "HASH" },
      { "AttributeName": "nameSlug",    "KeyType": "RANGE" }
    ],
    "Projection": { "ProjectionType": "ALL" }
  }
]
JSON

aws dynamodb create-table \
  --table-name schools \
  --attribute-definitions \
    AttributeName=schoolId,AttributeType=S \
    AttributeName=ccCity,AttributeType=S \
    AttributeName=nameSlug,AttributeType=S \
    AttributeName=countryCode,AttributeType=S \
  --key-schema AttributeName=schoolId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes file://gsi-schools.json >/dev/null
aws dynamodb wait table-exists --table-name schools

aws dynamodb list-tables
```

---

## 🧪 How to test

Use **`api.md`** (step-by-step, copy-paste JSON) and **`everything.md`** (full feature docs).
The high-level flow:

1. **Auth – Instructor**: `/auth/register` → `/auth/confirm` → `/auth/login`
2. **Schools**: `/school/register` (binds to instructor) → `/schools` (list/search)
3. **Classrooms**: `/classroom/create` (get `joinCode`)
4. **Auth – Student**: sign up & confirm → login
5. **Join class**: `/classroom/join` with `joinCode`
6. **Explore**: `/classroom/list`, `/classroom/members`, leave/kick

All protected routes require:

```
Authorization: Bearer <IdToken>
```

---

## 🛡️ Security & Validation

* API Gateway **Cognito Authorizer** on protected routes.
* Zod input validation on all mutating endpoints.
* Conditional writes (`attribute_not_exists`) to prevent overwrites.
* Atomic membership writes via DynamoDB **TransactWrite**.

---

## 🧯 Troubleshooting

* **401 on protected routes** → ensure you pass **IdToken** (not AccessToken).
* **Instructor can’t create classroom** → they need a `custom:schoolId`. Call `/school/register`, then **re-login** to refresh the token.
* **/schools empty** → you haven’t registered any schools yet.
* **Dynamo errors** → confirm tables & GSIs exist **in us-east-1** and names match `serverless.yml` envs.

---

## 📄 License

MIT (or your choice).

---

If you want CloudFormation-managed tables per stage (instead of manual CLI creation), say the word and I’ll wire `resources:` into `serverless.yml` with staged table names.
