# 🧾 What is `serverless.yml`?

In Serverless Framework projects written in **TypeScript or JavaScript**, the `serverless.yml` file is **the heart of your backend configuration**.

Think of it like your **deployment control panel** — it tells AWS:

* what services/functions you’re deploying (like `signup`, `login`, `getOrders`, etc.)
* how each function should be triggered (e.g. via HTTP or schedule)
* what environment variables, permissions, regions, and plugins to use
* how to build and package the code (e.g. TypeScript compilation with `esbuild`)

Every feature you build — from a simple login endpoint to a full-blown order management system — gets **registered and wired up** through `serverless.yml`.

---

# 🧱 `serverless.yml` Skeleton (with explanations)

```yaml
service: my-service-name         # 💡 Logical name of your backend (used in AWS stack naming)

frameworkVersion: '3'            # (optional) Lock Serverless Framework version

provider:                        # 🌍 Cloud provider + runtime + env config
  name: aws                      # Provider: AWS
  runtime: nodejs18.x            # Node.js version for your Lambdas
  region: us-east-1              # AWS region to deploy to
  stage: dev                     # Stage/environment name (dev, prod, etc.)
  environment:                   # 🌱 Injected into all Lambda envs
    USER_POOL_ID: xxx
    CLIENT_ID: yyy

  iam:                           # (optional) Specific IAM permissions (if not using full Admin)
    role:
      statements:
        - Effect: Allow
          Action:
            - dynamodb:PutItem
            - s3:GetObject
          Resource: "*"

functions:                       # ⚙️ Declare your Lambda functions
  signup:
    handler: dist/handlers/signup.signupHandler
    events:
      - http:                    # Trigger via HTTP (API Gateway)
          path: auth/signup
          method: post
          cors: true

  login:
    handler: dist/handlers/login.loginHandler
    events:
      - http:
          path: auth/login
          method: post
          cors: true

  profile:
    handler: dist/handlers/profile.profileHandler
    events:
      - http:
          path: auth/profile
          method: get
          cors: true
          authorizer:            # ✅ Protect this route using Cognito JWT
            type: COGNITO_USER_POOLS
            userPoolArn: arn:aws:cognito-idp:us-east-1:${self:provider.environment.USER_POOL_ID}

plugins:                         # 🔌 Extend functionality
  - serverless-esbuild           # Compiles TypeScript
  - serverless-offline           # Local dev/testing

custom:                          # ⚙️ Plugin config (esbuild, offline, dotenv, etc.)
  esbuild:
    bundle: true
    minify: false
    sourcemap: true
    target: node18
    platform: node
    concurrency: 10

  serverless-offline:
    httpPort: 3000

package:                         # 📦 (optional) Control bundling behavior
  individually: true
  exclude:
    - test/**
    - .gitignore
```

---

## 🧠 TL;DR: What each part means

| Section     | Purpose                                                   |
| ----------- | --------------------------------------------------------- |
| `service`   | Gives your backend a logical name                         |
| `provider`  | Tells Serverless where/how to deploy + global config      |
| `functions` | Lists all your Lambda endpoints and how they’re triggered |
| `plugins`   | Adds tooling like `esbuild` or local development mode     |
| `custom`    | Configure how those plugins behave                        |
| `package`   | Fine-tune what gets included/excluded when deploying      |



Great question, Ahmad. Let’s break down **why GPT gave you this exact `serverless.yml`**, line by line, based on what **you’re trying to build**: a **Cognito-authenticated backend** for Lab4All, using **Serverless Framework** with **TypeScript Lambdas**.

---

### 🔧 1. `service: lab4all-auth`

This names your backend stack. It will prefix your deployed resources in AWS like:

```
lab4all-auth-dev-signup
lab4all-auth-dev-login
...
```

---

### 🌍 2. `provider: ...`

This section configures your AWS Lambda environment:

```yaml
provider:
  name: aws
  runtime: nodejs18.x         # You’re writing handlers in Node.js (compiled from TS)
  region: us-east-1           # Where your Lambdas will live (must match your Cognito region)
  environment:                # These will be injected into ALL handlers
    USER_POOL_ID: ...
    CLIENT_ID: ...
```

🧠 So now, your handlers can do:

```ts
process.env.USER_POOL_ID
```

— to securely refer to your Cognito pool and client.

---

### ⚙️ 3. `functions: ...`

You defined 3 key features so far:

| Function Name | Trigger               | AWS Resource                              | Purpose                                  |
| ------------- | --------------------- | ----------------------------------------- | ---------------------------------------- |
| `signup`      | `POST /auth/register` | Lambda + API Gateway                      | Registers a user in Cognito              |
| `login`       | `POST /auth/login`    | Lambda + API Gateway                      | Authenticates user, returns tokens       |
| `profile`     | `GET /auth/profile`   | Lambda + API Gateway + Cognito authorizer | Protected endpoint that reads JWT claims |

So GPT wrote:

```yaml
functions:
  signup:
    handler: dist/handlers/signup.signupHandler
    events:
      - http:
          path: auth/register
          method: post
          cors: true
```

✅ That maps the **signup endpoint** to a TypeScript file that will be built into `dist/handlers/signup.js` and exposed via **API Gateway**.

---

### 🛡️ 4. `authorizer: COGNITO_USER_POOLS`

This line:

```yaml
authorizer:
  type: COGNITO_USER_POOLS
  userPoolArn: arn:aws:cognito-idp:us-east-1:${self:provider.environment.USER_POOL_ID}
```

means that:

* the `/auth/profile` endpoint is **protected**,
* API Gateway will **verify the AccessToken** (JWT) **before** calling your Lambda,
* and will inject claims (like `email`, `sub`, etc.) into the request context.

This saves you the trouble of doing manual JWT verification inside the function.

---

### 🧩 5. `plugins: ...`

```yaml
plugins:
  - serverless-esbuild     # Compiles your TypeScript to JavaScript
  - serverless-offline     # Lets you run your API locally at http://localhost:3000
```

These two make your dev experience smooth:

* You can run `npx serverless offline` to simulate API Gateway + Lambda locally.
* You don’t have to precompile TypeScript—esbuild handles that when you deploy or test.

---

### 🧠 Summary

GPT gave you that exact `serverless.yml` because:

* You’re doing **Cognito-based auth**, so it injected the pool/client IDs.
* You have 3 endpoints (`signup`, `login`, `profile`), so it mapped them to handlers.
* You want `profile` to be protected, so it added the **Cognito Authorizer**.
* You’re using TypeScript, so it added `esbuild`.
* You want to test locally, so it added `serverless-offline`.

Let me know when you’re ready to:

* Add more functions (like `createClassroom`)
* Move to deploying it to AWS (`npx serverless deploy`)
* Or write the handlers themselves

We’re cookin’ 🔥
