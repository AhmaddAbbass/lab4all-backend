
# Lab4All Backend (Serverless + AWS Cognito)

This is the backend for **Lab4All**, a virtual lab platform for under-resourced classrooms.  
Built with **TypeScript**, **Serverless Framework**, and **AWS Cognito** for secure, scalable auth.

---

## 🔧 Tech Stack

- **Serverless Framework** with AWS Lambda
- **TypeScript**
- **AWS Cognito** for authentication
- **Zod** for schema validation
- **serverless-offline** for local testing

---

## 📂 Project Structure

```

src/
├── handlers/
│   ├── signup.ts       # User registration (with Cognito)
│   ├── login.ts        # Login, returns access token
│   ├── confirm.ts      # Confirm user via verification code
│   └── profile.ts      # Protected route (needs token)
├── index.ts            # Export handlers for Serverless

````

---

## 🚀 Usage

### Local development

```bash
npx tsc
npx serverless offline
````

Test endpoints:

* `POST /auth/register`
* `POST /auth/login`
* `POST /auth/confirm`
* `GET  /auth/profile` (needs Authorization header)

---

