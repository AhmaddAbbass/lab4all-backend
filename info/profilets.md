

## 🧠 What does `profile.ts` do?

It’s a **GET endpoint** that shows the user their own profile — but **only if** they’re authenticated.

No token? 🚫
Bad token? 🚫
Valid token? ✅ You get JSON of your own info from Cognito.

---

## 🔐 How does it work?

The magic is here:

```ts
const claims = (event.requestContext.authorizer as any)?.claims;
```

This:

* Accesses the **JWT claims** decoded by **API Gateway + Cognito Authorizer**.
* That’s the payload of the token sent in the `Authorization` header (like `Bearer eyJ...`).

---

## 🔍 What are “claims”?

Claims = identity info inside the JWT token:

| Claim key       | Value (example)                             |
| --------------- | ------------------------------------------- |
| `sub`           | Cognito's internal user ID                  |
| `email`         | [ahmad@school.edu](mailto:ahmad@school.edu) |
| `custom:role`   | student / instructor                        |
| `custom:school` | AUB                                         |
| `custom:grade`  | 11                                          |

---

## ✅ Flow

```
Frontend: GET /auth/profile
  ↓
Sends: Authorization: Bearer <token>
  ↓
API Gateway checks token with Cognito
  ↓
If valid:
    → Adds claims to event.requestContext.authorizer.claims
    → Triggers profileHandler()
  ↓
Handler reads those claims and returns them as JSON
```

---

## 🤯 Wait — Where did `Authorization` get handled?

You **didn't handle it manually**! This line in `serverless.yml` did it:

```yaml
authorizer:
  type: COGNITO_USER_POOLS
  userPoolArn: arn:aws:cognito-idp:us-east-1:${self:provider.environment.USER_POOL_ID}
```

This tells AWS:

> "Yo Gateway, don’t even trigger the Lambda unless Cognito confirms this token is legit."

---

## 🧠 Why this is good:

* ✅ No manual JWT verification
* ✅ Claims are auto-decoded for you
* ✅ You can access both **standard** and **custom** user data securely
* ✅ No DB query needed — it’s all inside the token!

---

## TL;DR

* `signup.ts`: user registers → stored in Cognito
* `login.ts`: user logs in → gets JWT tokens
* `profile.ts`: user sends token → you return info from token
* `serverless.yml`: glues all this together with routing + auth config

