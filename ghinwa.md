alright, here’s a super practical “copy-this-structure” guide for a React + TS + Vite app that talks to your serverless API — with specific file names, what each contains, and how to dodge CORS in dev.

---

# 0) Create the app

```bash
npm create vite@latest my-ui -- --template react-ts
cd my-ui
npm i

# libs I strongly recommend
npm i react-router-dom @tanstack/react-query react-hook-form zod axios
npm i -D @types/node
```

---

# 1) Project layout (what each file/folder is for)

```
my-ui/
├─ .env.local                # VITE_API_BASE_URL, VITE_USE_PROXY etc (not committed)
├─ vite.config.ts            # dev proxy to avoid CORS
├─ src/
│  ├─ api.ts                 # HTTP client + endpoints (login, profile, schools…)
│  ├─ App.tsx                # Router + React Query provider + app shell
│  ├─ types.ts               # Shared TS types (TokenSet, UserProfile, School, etc.)
│  ├─ hooks/
│  │   └─ useAuth.ts         # Minimal auth store (tokens + helpers)
│  ├─ components/
│  │   ├─ LoginForm.tsx      # Example form using RHF + zod → api.login()
│  │   ├─ Protected.tsx      # Route guard (checks token)
│  │   └─ Spinner.tsx        # tiny loading indicator
│  └─ pages/
│      ├─ Home.tsx           # hello page
│      ├─ Profile.tsx        # calls api.getProfile()
│      ├─ Schools.tsx        # calls api.listSchools()
│      └─ Classrooms.tsx     # create/join/list examples
```

> You can rename pages/components however you want; the key is: **api.ts** centralizes network calls, **useAuth.ts** centralizes tokens, **vite.config.ts** handles the dev proxy.

---

# 2) `vite.config.ts` (DEV CORS escape hatch)

Use a proxy so the browser never hits the cross-origin domain directly in dev.

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Example:
// - Backend base: https://xxxx.execute-api.us-east-1.amazonaws.com
// - Stage: /dev
// We’ll call /api/* in the UI, Vite forwards to backend + rewrites to /dev/*

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
        // if target already includes the stage (/dev), keepRewrite false or adjust
        rewrite: (path) => path.replace(/^\/api/, '/dev'),
      },
    },
  },
})
```

**How to use:**

* In dev, call `fetch('/api/auth/login')` (not the full API Gateway URL).
* Vite forwards to your backend and rewrites `/api/*` → `/dev/*`.
* No browser CORS dialog, no preflight pain.

> In production, don’t use the proxy. Call the full API base (CORS is already `cors: true` on your lambdas). See env setup next.

---

# 3) Environment variables

Create `.env.local` in the project root:

```env
# For PROD builds (and local if you prefer full URL):
VITE_API_BASE_URL=https://4wqwppx8z6.execute-api.us-east-1.amazonaws.com/dev

# When running `npm run dev`, you can use the proxy instead:
VITE_USE_PROXY=true
VITE_PROXY_TARGET=http://localhost:3000  # serverless-offline default
```

> All Vite env vars **must** start with `VITE_`. Access via `import.meta.env.VITE_…`.

---

# 4) `src/api.ts` (one client, all endpoints)

* Reads base URL from env.
* Uses proxy in dev if `VITE_USE_PROXY === 'true'`.
* Automatically attaches `Authorization: Bearer <IdToken>` if present.
* Exposes small, typed functions per endpoint.

```ts
// src/api.ts
import axios from 'axios'
import type { TokenSet, UserProfile, School, Classroom } from './types'
import { getIdToken } from './hooks/useAuth'

const useProxy = import.meta.env.VITE_USE_PROXY === 'true'
const BASE = useProxy ? '/api' : (import.meta.env.VITE_API_BASE_URL || '')

const client = axios.create({
  baseURL: BASE,
  timeout: 15000,
})

client.interceptors.request.use((config) => {
  const token = getIdToken()
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export async function login(email: string, password: string): Promise<TokenSet> {
  const { data } = await client.post('/auth/login', { email, password })
  return data
}

export async function signup(payload: {
  email: string; password: string; firstName: string; lastName: string;
  role: 'student'|'instructor'; grade: string; schoolId?: string;
}) {
  const { data } = await client.post('/auth/register', payload)
  return data
}

export async function confirm(email: string, code: string) {
  const { data } = await client.post('/auth/confirm', { email, code })
  return data
}

export async function getProfile(): Promise<UserProfile> {
  const { data } = await client.get('/auth/profile')
  return data
}

export async function listSchools(params?: {
  q?: string; countryCode?: string; city?: string; limit?: number; nextToken?: string;
}): Promise<{ schools: School[]; nextToken?: string | null }> {
  const { data } = await client.get('/schools', { params })
  return data
}

export async function registerSchool(body: {
  name: string; countryCode: string; city: string; schoolId?: string;
}) {
  const { data } = await client.post('/school/register', body)
  return data
}

export async function createClassroom(classroomName: string) {
  const { data } = await client.post('/classroom/create', { classroomName })
  return data
}

export async function joinClassroom(joinCode: string) {
  const { data } = await client.post('/classroom/join', { joinCode })
  return data
}

export async function listMyClassrooms(): Promise<Classroom[]> {
  const { data } = await client.get('/classroom/list')
  return data
}

export async function getMembers(classroomID: string) {
  const { data } = await client.post('/classroom/members', { classroomID })
  return data
}

export async function kickStudent(classroomID: string, studentId: string) {
  const { data } = await client.post('/classroom/kick', { classroomID, studentId })
  return data
}

export async function leaveOrDelete(classroomID: string) {
  const { data } = await client.delete('/classroom/membership', {
    data: { classroomID },
  })
  return data
}
```

---

# 5) `src/types.ts` (shared types)

```ts
// src/types.ts
export type TokenSet = {
  IdToken?: string
  AccessToken?: string
  RefreshToken?: string
  ExpiresIn?: number
  TokenType?: string
  needsSchoolRegistration?: boolean
  note?: string
}

export type UserProfile = {
  userId: string
  email: string
  firstName?: string
  lastName?: string
  role: 'student'|'instructor'
  grade?: string
  schoolId?: string
  schoolName?: string
}

export type School = {
  schoolId: string
  name: string
  countryCode?: string
  city?: string
}

export type Classroom = {
  classroomID: string
  classroomName: string
  schoolId: string
  school: string
  createdAt: string
  teacherName: string
  joinCode?: string
}
```

---

# 6) `src/hooks/useAuth.ts` (super small auth store)

```ts
// src/hooks/useAuth.ts
import { useEffect, useState } from 'react'
import type { TokenSet } from '../types'

const KEY = 'lab4all_tokens'

export function getIdToken(): string | null {
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  try { return JSON.parse(raw).IdToken || null } catch { return null }
}

export function useAuth() {
  const [tokens, setTokens] = useState<TokenSet | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem(KEY)
    if (raw) setTokens(JSON.parse(raw))
  }, [])

  function set(t: TokenSet | null) {
    setTokens(t)
    if (t) localStorage.setItem(KEY, JSON.stringify(t))
    else localStorage.removeItem(KEY)
  }

  function logout() { set(null) }

  return { tokens, setTokens: set, logout, isAuthed: !!tokens?.IdToken }
}
```

---

# 7) `src/App.tsx` (router + query client)

```tsx
// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from './hooks/useAuth'

// pages (create simple components for these)
import Home from './pages/Home'
import Profile from './pages/Profile'
import Schools from './pages/Schools'
import Classrooms from './pages/Classrooms'
import LoginForm from './components/LoginForm'

const qc = new QueryClient()

function Protected({ children }: { children: React.ReactNode }) {
  const { isAuthed } = useAuth()
  if (!isAuthed) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginForm />} />
          <Route path="/schools" element={<Schools />} />
          <Route
            path="/profile"
            element={
              <Protected>
                <Profile />
              </Protected>
            }
          />
          <Route
            path="/classrooms"
            element={
              <Protected>
                <Classrooms />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
```

---

# 8) `src/components/LoginForm.tsx` (tiny example)

```tsx
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import * as api from '../api'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

type FormData = z.infer<typeof schema>

export default function LoginForm() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) })
  const { setTokens } = useAuth()
  const nav = useNavigate()

  const onSubmit = async (values: FormData) => {
    const tokens = await api.login(values.email, values.password)
    setTokens(tokens)
    nav('/profile')
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ maxWidth: 360 }}>
      <h2>Login</h2>
      <input placeholder="Email" {...register('email')} />
      {errors.email?.message && <small>{errors.email.message}</small>}
      <input placeholder="Password" type="password" {...register('password')} />
      {errors.password?.message && <small>{errors.password.message}</small>}
      <button disabled={isSubmitting} type="submit">Sign in</button>
    </form>
  )
}
```

---

# 9) Running in dev & prod

**Dev (proxy on, no CORS pain):**

```bash
# .env.local
VITE_USE_PROXY=true
VITE_PROXY_TARGET=http://localhost:3000
# start both:
# - serverless offline (on 3000)
# - vite dev
npm run dev
```

Call `/api/...` from the UI; Vite forwards → backend `/dev/...`.

**Prod (no proxy):**

```env
# .env.production or build-time env
VITE_USE_PROXY=false
VITE_API_BASE_URL=https://<api-id>.execute-api.us-east-1.amazonaws.com/dev
```

Now your `api.ts` uses the full base URL.

**CORS notes (server):**

* Your Serverless functions already have `cors: true`. That emits `Access-Control-Allow-Origin: *` by default.
* If you ever scope origins, remember to include `Authorization` in `Access-Control-Allow-Headers`.

---

# 10) Scripts (package.json)

Add (if not already):

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "echo \"add eslint later\""
  }
}
```

---

that’s it. this gives your friend a **clear file-by-file plan**: where the API code lives (`api.ts`), how to hold tokens (`useAuth.ts`), how to wire routing and React Query (`App.tsx`), where UI bits go (`components/`, `pages/`), and exactly **how to avoid CORS** in dev using the **Vite proxy**.
