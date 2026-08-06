# Plan: Production-Ready PurpSpace

**Objective:** Desktop app bisa dipakai user lain (bukan cuma dev machine) + website deploy gratis dengan kualitas AAA.

**Root cause credential gap:** Desktop app sekarang hardcode `SUPABASE_SERVICE_ROLE_KEY` di `.env.local` → user lain tidak punya file ini → app boot tapi API gagal semua. Service role key adalah anti-pattern untuk client app (bypass RLS).

---

## §1. Desktop App Credential Model (BREAKING)

**Current:** API routes pakai `createServerClient()` → `SUPABASE_SERVICE_ROLE_KEY` → bypass RLS.

**Target:** API routes pakai Clerk session JWT → Supabase verify JWT via JWKS → enforce RLS.

### 1.1 Switch Supabase Client

**File:** `src/lib/supabase/server.ts`

**Before:**
```ts
export function createServerClient() {
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
```

**After:**
```ts
import { auth } from "@clerk/nextjs/server"

export async function createServerClient() {
  const { getToken } = await auth()
  const token = await getToken({ template: "supabase" })
  
  if (!token) throw new Error("Unauthorized")
  
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
      auth: { autoRefreshToken: false, persistSession: false },
    }
  )
}
```

**Impact:** Semua API route yang call `createServerClient()` sekarang pakai JWT, bukan service key.

### 1.2 Remove Service Key Requirement

**Files to update:**
- `electron/env.ts` — remove `SUPABASE_SERVICE_ROLE_KEY` dari expected vars
- `.env.example` — remove service key, keep anon key only

**Required env vars after migration:**
```bash
# Public (safe to bundle)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Private (must stay in %APPDATA%/.env.local)
CLERK_SECRET_KEY=sk_test_...
ENCRYPTION_KEY=<64-char hex>
GITHUB_CLIENT_ID=Ov23li...
GITHUB_CLIENT_SECRET=<secret>
```

**Why anon key is safe:** RLS enforces access control, anon key hanya credentials untuk connect.

---

## §2. Supabase RLS Migration

**Current state:** Semua table punya RLS enabled tapi policy kosong → service key bypass RLS.

**Target:** Add JWT-based policies untuk enforce ownership.

### 2.1 Configure Clerk JWT Template

**Location:** Clerk Dashboard → JWT Templates → Create "supabase" template

**Claims:**
```json
{
  "sub": "{{user.id}}"
}
```

**Lifetime:** 3600s (1 hour, matches Clerk session)

### 2.2 Add Supabase Authentication Provider

**Location:** Supabase Dashboard → Authentication → Providers → Add Clerk

**Settings:**
- Clerk domain: `<your-clerk-domain>.clerk.accounts.dev`
- JWKS URL: Auto-detected dari domain

**Result:** Supabase sekarang verify Clerk JWTs via JWKS.

### 2.3 Write RLS Policies

**Pattern:** `auth.jwt() ->> 'sub'` untuk extract `clerk_user_id` dari JWT.

**Example — `workspaces_purpspace`:**
```sql
-- SELECT: user hanya bisa baca workspace milik sendiri
CREATE POLICY "Users can read own workspaces"
  ON workspaces_purpspace
  FOR SELECT
  USING (clerk_user_id = (auth.jwt() ->> 'sub'));

-- INSERT: user hanya bisa create workspace dengan user_id sendiri
CREATE POLICY "Users can create own workspaces"
  ON workspaces_purpspace
  FOR INSERT
  WITH CHECK (clerk_user_id = (auth.jwt() ->> 'sub'));

-- UPDATE: user hanya bisa update workspace milik sendiri
CREATE POLICY "Users can update own workspaces"
  ON workspaces_purpspace
  FOR UPDATE
  USING (clerk_user_id = (auth.jwt() ->> 'sub'))
  WITH CHECK (clerk_user_id = (auth.jwt() ->> 'sub'));

-- DELETE: user hanya bisa delete workspace milik sendiri
CREATE POLICY "Users can delete own workspaces"
  ON workspaces_purpspace
  FOR DELETE
  USING (clerk_user_id = (auth.jwt() ->> 'sub'));
```

**Apply to all tables:**
- `workspaces_purpspace`
- `panes_purpspace` (via `workspace_id` FK + JOIN)
- `env_vars_purpspace` (via `workspace_id` FK + JOIN)
- `github_connections_purpspace` (direct `clerk_user_id`)

**Panes/env indirect policy pattern:**
```sql
-- SELECT panes: user bisa baca pane jika owns workspace
CREATE POLICY "Users can read panes in own workspaces"
  ON panes_purpspace
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspaces_purpspace
      WHERE workspaces_purpspace.id = panes_purpspace.workspace_id
        AND workspaces_purpspace.clerk_user_id = (auth.jwt() ->> 'sub')
    )
  );
```

### 2.4 Test RLS Enforcement

**Verification steps:**
1. Create workspace via desktop app (authenticated)
2. Try read workspace via psql with anon key → should fail (no JWT)
3. Try read workspace via API with valid session → should succeed
4. Try read OTHER user's workspace → should return empty (filtered by RLS)

---

## §3. Hosting Strategy

### 3.1 Website Hosting: Cloudflare Pages

**Why NOT Vercel Hobby:**
- TOS restricts to "non-commercial, personal use only"
- PurpSpace has paid tiers (Rp24.999 Basic, Rp49.999 Pro) → commercial product
- Using Hobby = TOS violation

**Why Cloudflare Pages:**
- Free tier explicitly allows commercial use
- 500 builds/month, unlimited bandwidth
- Next.js 16 support via `@opennext/cloudflare` adapter
- Custom domain support (required for Clerk production)

**Setup:**
1. `cd purpspace-webapp`
2. `npm install --save-dev @opennext/cloudflare wrangler`
3. Add `wrangler.toml`:
```toml
name = "purpspace-webapp"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = ".vercel/output/static"

[[pages_plugins]]
binding = "ASSETS"
```
4. Update `package.json`:
```json
"scripts": {
  "build": "next build",
  "build:cloudflare": "next build && npx @opennext/cloudflare",
  "deploy": "npm run build:cloudflare && wrangler pages deploy"
}
```
5. Connect GitHub repo via Cloudflare dashboard → auto-deploy on push to `master`

**Initial domain:** `purpspace-webapp.pages.dev` (free subdomain)

**Custom domain (later):** `purpspace.com` via Cloudflare DNS (Rp150k/year di Niagahoster)

### 3.2 Installer Distribution: GitHub Releases

**Why GitHub Releases:**
- Free for public repos (`RadityaWirayudha/AiNgeSpace`)
- No file size limit
- CDN-backed download
- `electron-updater` native support (auto-update built-in)

**Setup:**
1. Tag release: `git tag v0.1.0 && git push origin v0.1.0`
2. Create GitHub Release via web UI or `gh` CLI
3. Upload `dist/PurpSpace-Setup-0.1.0-x64.exe` sebagai asset

**Auto-update integration (future):**
- `electron-updater` checks `https://github.com/RadityaWirayudha/AiNgeSpace/releases/latest`
- Download delta jika ada update
- ~3 API requests per check (rate limit: 60/hour unauthenticated, 5000/hour authenticated)

### 3.3 Website Download Button Update

**Current:** `DOWNLOAD_URL = "/unduhan/PurpSpace-Setup-0.1.0-x64.exe"`

**After GitHub Releases:**
```ts
// src/content/site.ts
const VERSI = "0.1.0"
export const DOWNLOAD_URL = `https://github.com/RadityaWirayudha/AiNgeSpace/releases/download/v${VERSI}/PurpSpace-Setup-${VERSI}-x64.exe`
```

**Remove local sync:** Delete `scripts/sync-unduhan.mjs` + `public/unduhan/` + `unduhan:sync` script.

---

## §4. Clerk Production Instance

**Current:** Dev instance (`*.clerk.accounts.dev`)
- 100 user cap
- No custom domain
- Test credentials only

**Target:** Production instance
- Unlimited users (billed after free tier)
- Custom domain required (`auth.purpspace.com`)

**Migration steps:**
1. Buy domain: `purpspace.com` (Rp150k/year via Cloudflare Registrar atau Niagahoster)
2. Clerk Dashboard → Create Production Instance
3. Configure CNAME: `auth.purpspace.com` → `<instance-id>.clerk.accounts.com`
4. Update env vars:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` → production publishable key
   - `CLERK_SECRET_KEY` → production secret key
5. Rebuild + redeploy desktop app dengan production keys

**Consequence:** Existing dev users di Clerk test instance tidak ter-migrate otomatis → perlu re-signup di production instance.

---

## §5. Quality Review Checklist

### 5.1 Security

- [ ] `SUPABASE_SERVICE_ROLE_KEY` removed dari codebase
- [ ] RLS policies tested untuk prevent unauthorized access
- [ ] `ENCRYPTION_KEY` tidak bundled di installer (verify `electron-builder.yml`)
- [ ] Anon key di installer (safe, RLS enforces access)
- [ ] GitHub Client Secret tidak bundled (verify)

### 5.2 Desktop App

- [ ] Fresh install tanpa `.env.local` → auth flow works
- [ ] Desktop auth via browser → deep link → session created
- [ ] Workspace CRUD operations dengan RLS
- [ ] Saved workspace restore
- [ ] Terminal spawn + PTY works
- [ ] GitHub OAuth flow (PurpCommit feature)
- [ ] Env var encryption/decryption

### 5.3 Website

- [ ] Landing page loads di Cloudflare Pages
- [ ] Download button → GitHub Releases asset
- [ ] `/mulai` flow (step 1-3) berfungsi
- [ ] Pricing content accurate (Basic Rp24.999, Pro Rp49.999)
- [ ] Responsive design (mobile + desktop)
- [ ] SEO meta tags

### 5.4 Infrastructure

- [ ] Supabase free tier limits documented (500MB DB, 50K MAU)
- [ ] Cloudflare Pages build succeeds
- [ ] GitHub Releases asset <2GB (current: ~150MB)
- [ ] Clerk production instance configured
- [ ] Custom domain DNS records propagated

### 5.5 User Experience

- [ ] Installer size acceptable (<200MB)
- [ ] Install to `%LOCALAPPDATA%\Programs\PurpSpace`
- [ ] Desktop shortcut + Start Menu entry created
- [ ] First launch → browser opens untuk auth
- [ ] Auth callback → app shows dashboard
- [ ] Trial flow: 12 hari free Basic tier (NOT IMPLEMENTED YET — see §6)

---

## §6. Out of Scope (Deferred)

**Trial + payment flow:**
- User story: "Download → 12 hari free Basic → upgrade to Pro"
- Stripe Indonesia = invite-only, IDR only, bank transfer (VA) only
- Xendit/Midtrans as alternative
- Subscription state tracking di Supabase
- Trial expiry enforcement
- **Decision:** Build MVP dulu dengan auth only, payment later

**Auto-update:**
- `electron-updater` integration
- Check GitHub Releases on app launch
- Download + apply delta updates
- **Decision:** Manual download untuk v0.1.0, auto-update di v0.2.0

**Custom domain:**
- `purpspace.com` purchase + DNS setup
- Cloudflare Pages custom domain
- Clerk production instance CNAME
- **Decision:** Use free subdomains first (`*.pages.dev` + `*.clerk.accounts.dev`), buy domain when ready to launch publicly

---

## §7. Execution Order

**Phase 1: Desktop App RLS Migration** (CRITICAL PATH)
1. Configure Clerk JWT template "supabase"
2. Add Clerk provider di Supabase dashboard
3. Write + test RLS policies untuk all tables
4. Update `src/lib/supabase/server.ts` untuk pakai JWT
5. Remove `SUPABASE_SERVICE_ROLE_KEY` requirement
6. Test: fresh install → auth → CRUD operations

**Phase 2: Hosting Setup**
7. Add `@opennext/cloudflare` + `wrangler.toml` ke `purpspace-webapp`
8. Connect GitHub repo ke Cloudflare Pages
9. Deploy website → verify landing page + download button
10. Create GitHub Release v0.1.0
11. Upload installer asset ke release
12. Update `site.ts` download URL ke GitHub Releases

**Phase 3: Quality Review**
13. Run checklist §5.1-5.4
14. Document known issues + deferred scope (§6)
15. Tag milestone: "Production-Ready MVP"

**Phase 4: Production Launch (Optional — requires custom domain)**
16. Purchase `purpspace.com`
17. Setup Cloudflare DNS
18. Create Clerk production instance
19. Rebuild app dengan production credentials
20. Announce launch

---

## §8. Risk Assessment

**HIGH RISK:**
- RLS policy bug → data leak antara users
  - **Mitigation:** Test dengan 2 Clerk accounts, verify isolation
- JWT template misconfigured → auth failures
  - **Mitigation:** Follow Supabase-Clerk integration guide exactly
- Cloudflare Next.js adapter incompatibility
  - **Mitigation:** Test build locally before deploy

**MEDIUM RISK:**
- Clerk dev → production migration loses existing users
  - **Mitigation:** Acceptable untuk MVP (only dev has tested so far)
- Supabase free tier 7-day inactivity pause
  - **Mitigation:** Document pausing behavior, reactivate via dashboard
- GitHub Releases bandwidth limit (public repos = unlimited, tapi Fair Use Policy applies)
  - **Mitigation:** Monitor download traffic, migrate to CDN jika abuse detected

**LOW RISK:**
- electron-builder exclude pattern drops required files
  - **Mitigation:** Verify `ls -a dist/win-unpacked/resources/app-next` shows `.next` + `node_modules`
- Deep link `purpspace://` not registered di fresh install
  - **Mitigation:** NSIS installer already registers protocol (verify via Registry Editor)

---

## §9. Success Criteria

**Desktop app:**
- [ ] User lain (bukan dev) bisa download installer dari GitHub Releases
- [ ] Install → launch → browser auth → dashboard muncul
- [ ] User A tidak bisa akses workspace milik User B (RLS enforced)
- [ ] Semua 5 fitur utama berfungsi: Grid Terminals, Saved Workspaces, PurpCommit, PurpExplorer, Env Vars

**Website:**
- [ ] Accessible via `purpspace-webapp.pages.dev`
- [ ] Download button → installer (hosted di GitHub Releases)
- [ ] `/mulai` flow complete (step 1-3)
- [ ] Pricing page accurate

**Infrastructure:**
- [ ] Zero monthly cost (Cloudflare free + Supabase free + GitHub free)
- [ ] Commercial use compliant (NOT Vercel Hobby)
- [ ] Build + deploy automated via GitHub Actions (optional)

---

## §10. Estimates

**Phase 1 (RLS Migration):** 4-6 hours
- Clerk JWT template: 30 min
- Supabase RLS policies: 2 hours (write + test)
- `server.ts` refactor: 1 hour
- End-to-end test: 1-2 hours

**Phase 2 (Hosting Setup):** 2-3 hours
- Cloudflare setup: 1 hour
- GitHub Releases: 30 min
- Website deploy + verify: 1 hour

**Phase 3 (Quality Review):** 2-4 hours
- Security checklist: 1 hour
- Feature testing: 2 hours
- Documentation: 1 hour

**Total: 8-13 hours** untuk production-ready MVP (tanpa custom domain + payment integration).
