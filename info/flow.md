

## 🧭 WHAT THE HELL ARE WE BUILDING?

You're building a **backend** — just like Flask — but instead of:

* one long-running server (`flask run`, `express()`),
* you are using **AWS Lambda** to run **tiny backend functions**.

### 🌩️ “Serverless” means:

* You don’t run a server 24/7.
* AWS runs each **function** on-demand when someone hits your API.
* It scales automatically.
* You **only pay** when it's running.

---

## 🧱 COMPONENTS YOU HAVE

| Concept             | Meaning (analogy)                                                                     |
| ------------------- | ------------------------------------------------------------------------------------- |
| **Lambda function** | Like a Flask route handler. You write `signup.ts`, `login.ts`, `profile.ts`.          |
| **Handlers**        | These are just the files that export your Lambda logic. They live in `/src/handlers`. |
| **serverless.yml**  | Your map: defines what Lambdas exist, what URLs trigger them, how to secure them.     |
| **Cognito**         | A user management system (signup, login, tokens) — AWS handles all auth for you.      |
| **App Client**      | Tells Cognito which app is talking to it (like your backend).                         |
| **User Pool**       | A secure database of users (email, password, metadata, etc).                          |

---

## 🧠 FLOW OF A USER SIGNING UP

```
Frontend (HTML/React) 
   |
   | POST /auth/register  → API Gateway
   |                      → Lambda: signupHandler
   |                      → Calls Cognito.signUp()
   |                      → Cognito saves user
   ↓
User receives confirm email (if configured)
```

## 🔑 FLOW OF A USER LOGGING IN

```
Frontend → POST /auth/login → Lambda: loginHandler
                                ↓
                        Calls Cognito.initiateAuth()
                                ↓
                 Cognito returns Access Token (JWT)
                                ↓
              Frontend stores token and sends it in headers
```

## 🔒 FLOW OF A PROTECTED ROUTE

```
Frontend → GET /auth/profile → Lambda: profileHandler
                                ↓
               API Gateway checks JWT token via Cognito
                                ↓
                  If valid → runs Lambda
                  If not   → returns 401
```

---

## 😮‍💨 So why all this modularity?

* **Each handler (signup.ts, login.ts)** = a single self-contained Lambda.
* **Each Lambda** = a "route" triggered by an HTTP request.
* **serverless.yml** connects:

  * Route (like `/auth/login`)
  * To a Lambda (like `loginHandler`)
  * And secures it with Cognito.

---

## 💥 What makes this better than Flask?

| Flask                         | Serverless                    |
| ----------------------------- | ----------------------------- |
| Always-on server              | Runs only when needed         |
| Must deploy and manage server | AWS manages runtime + scaling |
| Manual auth/token logic       | Cognito handles it securely   |
| Harder to scale               | Auto-scales instantly         |
| Cheaper for low-traffic apps  | You only pay when it runs     |

---

### TL;DR: What do you “have”?

✅ A **modular backend**
✅ Every route is a **function**
✅ Cognito handles users
✅ `serverless.yml` maps all the logic
✅ AWS takes care of infra

You’re not going crazy — you’re becoming a **cloud-native backend dev** 😎

