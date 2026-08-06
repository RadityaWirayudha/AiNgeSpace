# Deployment Guide: PurpSpace Production

Dokumen ini adalah roadmap lengkap untuk deploy PurpSpace ke production dengan:
- Desktop app bisa dipakai semua orang (bukan cuma dev machine)
- Website gratis via Cloudflare Workers
- Installer distribution via GitHub Releases
- Zero monthly cost

---

## Prerequisites

- Akun Cloudflare (sign up gratis di https://dash.cloudflare.com/sign-up)
- GitHub repo `RadityaWirayudha/AiNgeSpace` (already exists, public)
- Sudah menyelesaikan **SETUP-INSTRUCTIONS.md** (RLS migration untuk desktop app)

---

## Part 1: GitHub Release (Installer Distribution)

### 1.1 Build Installer Desktop App

```bash
cd purpspace-electron
npm run build:desktop
```

**Output:** `dist/PurpSpace-Setup-0.1.0-x64.exe` (~180 MB)

**Verify installer quality:**
```bash
ls -lh dist/PurpSpace-Setup-0.1.0-x64.exe
# Harus ~180 MB. Kalau < 50 MB, ada yang salah (node_modules atau .next tidak masuk).

# Check isi installer:
ls -a dist/win-unpacked/resources/app-next/
# MUST show: .next/ dan node_modules/
```

### 1.2 Create GitHub Release

**Via GitHub Web UI:**
1. Buka https://github.com/RadityaWirayudha/AiNgeSpace/releases/new
2. **Tag version:** `v0.1.0` (harus ada prefix `v`)
3. **Release title:** `PurpSpace v0.1.0 — First Public Release`
4. **Description:**
   ```markdown
   ## What's New
   - Multi-pane terminal workspace
   - Saved workspaces with one-click restore
   - PurpCommit: GitHub integration with AI commit messages
   - PurpExplorer: file browser in-app
   - Environment variable management per workspace

   ## Download
   - Windows 10/11 (x64): `PurpSpace-Setup-0.1.0-x64.exe`

   ## Installation
   1. Download the installer
   2. Run `PurpSpace-Setup-0.1.0-x64.exe`
   3. Follow installation wizard (installs to `%LOCALAPPDATA%\Programs\PurpSpace`)
   4. Launch PurpSpace from Start Menu or desktop shortcut
   5. Browser will open for Clerk authentication
   6. After auth, the app dashboard appears

   ## System Requirements
   - Windows 10 (1809+) or Windows 11
   - 4 GB RAM minimum
   - 500 MB disk space
   ```
5. **Upload installer:** Drag `PurpSpace-Setup-0.1.0-x64.exe` ke area "Attach binaries"
6. Klik **Publish release**

**Via `gh` CLI (alternative):**
```bash
cd purpspace-electron
gh release create v0.1.0 \
  --title "PurpSpace v0.1.0 — First Public Release" \
  --notes "See https://github.com/RadityaWirayudha/AiNgeSpace/releases/tag/v0.1.0" \
  dist/PurpSpace-Setup-0.1.0-x64.exe
```

**Verification:**
- Visit https://github.com/RadityaWirayudha/AiNgeSpace/releases/tag/v0.1.0
- Download link should be: `https://github.com/RadityaWirayudha/AiNgeSpace/releases/download/v0.1.0/PurpSpace-Setup-0.1.0-x64.exe`
- Try downloading — should start download ~180 MB file

---

## Part 2: Cloudflare Workers (Website Deployment)

### 2.1 Login to Cloudflare

```bash
cd purpspace-webapp
npx wrangler login
```

Browser akan buka untuk authorize. Setelah selesai, terminal akan confirm "Successfully logged in."

### 2.2 Set Environment Variables (Secrets)

Cloudflare Workers butuh 3 secrets:

```bash
npx wrangler secret put CLERK_SECRET_KEY
# Paste value dari .env.local: sk_test_...

npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# Paste value dari .env.local: eyJhbGci...

npx wrangler secret put NEXT_PUBLIC_SUPABASE_URL
# Paste: https://ucneqextloynzymzxygi.supabase.co
```

**Why these are secrets:**
- `CLERK_SECRET_KEY` — kalau bocor, orang bisa create/delete users
- `SUPABASE_SERVICE_ROLE_KEY` — bypass RLS, full database access
- `NEXT_PUBLIC_SUPABASE_URL` — technically public, tapi set sebagai secret untuk konsistensi

**Non-secret env vars (optional):**
Kalau ada env var yang BOLEH public (e.g., `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`), set via `wrangler.jsonc`:
```jsonc
{
  "vars": {
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY": "pk_test_..."
  }
}
```

Tapi untuk landing page + registration flow, semua env vars yang dibutuhkan sudah di-cover via secrets.

### 2.3 Deploy to Cloudflare Workers

```bash
npm run deploy
```

**What happens:**
1. `next build` — compile Next.js app
2. `opennextjs-cloudflare build` — transform build untuk Cloudflare runtime
3. `opennextjs-cloudflare deploy` — upload ke Cloudflare

**Output:**
```
✨ Deployment complete!
🌐 https://purpspace-webapp.radityawirayudha.workers.dev
```

**Custom subdomain (optional):**
Default subdomain adalah `{name}.{username}.workers.dev`. Kalau mau custom:
1. Cloudflare Dashboard → Workers & Pages → purpspace-webapp → Settings → Domains & Routes
2. Add custom route (butuh domain di Cloudflare)

### 2.4 Test Deployed Website

1. Buka https://purpspace-webapp.radityawirayudha.workers.dev (atau URL yang diberikan)
2. **Test landing page:** harus muncul hero + pricing
3. **Test download button:** klik "Unduh PurpSpace"
   - Harus redirect ke GitHub Releases URL
   - Download harus start (~180 MB)
4. **Test `/mulai` flow:**
   - Klik "Mulai Gratis"
   - Step 1: enter email + password + checkbox
   - Step 2: pilih plan (Basic atau Pro)
   - Step 3: konfirmasi → harus POST ke `/api/daftar`
   - Step 4: "Unduhan dimulai" → download button works

**Expected behavior:**
- Landing page loads < 1s
- Download button → GitHub Releases (tidak 404)
- Registration flow creates Clerk account + Supabase subscription
- All pages responsive (mobile + desktop)

---

## Part 3: Verification & Smoke Test

### 3.1 End-to-End Test (Fresh User Journey)

**Scenario:** User yang belum pernah pakai PurpSpace.

1. **User discovers website**
   - Visit https://purpspace-webapp.radityawirayudha.workers.dev
   - Landing page loads, pricing visible

2. **User registers**
   - Klik "Mulai Gratis"
   - Enter email `test@example.com` + password + agree S&K
   - Pilih plan "Basic (Gratis 12 hari)"
   - Konfirmasi
   - Registration succeeds → cookie set → "Download PurpSpace" button muncul

3. **User downloads installer**
   - Klik download button
   - `PurpSpace-Setup-0.1.0-x64.exe` downloads dari GitHub Releases

4. **User installs app**
   - Run installer
   - Install to `%LOCALAPPDATA%\Programs\PurpSpace`
   - Desktop shortcut + Start Menu entry created

5. **User launches app**
   - Double-click PurpSpace
   - Browser opens → Clerk sign-in page
   - Sign in with `test@example.com` (dari step 2)
   - Browser closes → app shows dashboard

6. **User creates workspace**
   - Click "New Workspace"
   - Pick folder `C:\Users\test\Documents`
   - Workspace created → terminal grid muncul

7. **User restarts app**
   - Close app
   - Re-launch dari Start Menu
   - **Expected:** workspace masih ada (saved to Supabase)
   - **Expected:** terminal tidak otomatis spawn (behaviour sesuai Basic plan: reset on close)

**Success criteria:**
✅ Website loads  
✅ Registration works  
✅ Download from GitHub Releases succeeds  
✅ Installer works  
✅ Desktop app authenticates via Clerk  
✅ Workspace CRUD via Supabase + RLS enforced  

### 3.2 Multi-User Isolation Test

**Scenario:** Verify RLS policies enforce per-user data isolation.

1. **User A:**
   - Register + download + install + launch
   - Create workspace "Project A"
   - Workspace ID: note down (e.g., from network tab)

2. **User B (different machine or incognito):**
   - Register different email
   - Launch app
   - **Expected:** User B does NOT see "Project A" in workspace list
   - Try to fetch User A's workspace via direct API call (if possible):
     ```bash
     curl https://localhost:3000/api/workspaces/{workspace-id-of-user-a}
     ```
     **Expected:** 404 atau empty (RLS blocks access)

**Success criteria:**
✅ User A cannot see User B's workspaces  
✅ User B cannot see User A's workspaces  
✅ API calls respect RLS (no cross-user data leak)  

---

## Part 4: Monitoring & Cost Tracking

### 4.1 Cloudflare Workers Analytics

**Location:** Cloudflare Dashboard → Workers & Pages → purpspace-webapp → Analytics

**Metrics to watch:**
- **Requests:** harus < 100k/day (free tier limit)
- **CPU time:** harus avg < 10ms per request
- **Errors:** harus < 1% error rate

**Free tier limits:**
- 100,000 requests/day
- No bandwidth limit
- 10ms CPU time per request avg

**What happens if exceed:** Cloudflare will ask you to upgrade to Workers Paid ($5/mo for 10M requests).

### 4.2 Supabase Usage

**Location:** Supabase Dashboard → Settings → Usage

**Metrics:**
- **Database size:** < 500 MB (free tier)
- **Monthly Active Users (MAU):** < 50k (free tier)
- **API requests:** unlimited on free tier

**7-day inactivity pause:** Kalau database idle 7 hari, Supabase akan pause project. Reactivate via dashboard (takes ~1 min).

### 4.3 GitHub Releases Bandwidth

**Free tier:** Unlimited bandwidth for public repos.

**Fair Use Policy:** GitHub reserves right to throttle kalau traffic "excessive" (biasanya > 1 TB/month atau botnet activity). For normal usage (hundreds of downloads/day), tidak akan kena limit.

**Monitoring:** GitHub doesn't provide download stats API for Releases. Use Cloudflare Workers analytics (referrer header) to estimate download traffic from website.

---

## Part 5: Post-Launch Checklist

### Immediately After Deploy

- [ ] Website accessible at Cloudflare Workers URL
- [ ] Download button → GitHub Releases (not 404)
- [ ] Registration flow works (creates Clerk user + Supabase subscription)
- [ ] Installer download succeeds (GitHub Release asset exists)
- [ ] Desktop app authenticates via Clerk → dashboard loads
- [ ] Workspace CRUD works (RLS enforces isolation)

### Within 24 Hours

- [ ] Monitor Cloudflare analytics (error rate < 1%)
- [ ] Check Supabase logs (no RLS policy violations)
- [ ] Test from 2-3 different machines/accounts
- [ ] Verify email deliverability (Clerk sends verification emails)
- [ ] Check Clerk Dashboard for new signups

### Within 1 Week

- [ ] Review Cloudflare Workers request volume (should be < 10k/day for landing page traffic)
- [ ] Confirm no Supabase free tier violations (DB size, MAU)
- [ ] Check GitHub Release download count (via GitHub API or manual tracking)
- [ ] Gather user feedback (installation issues, auth problems, bugs)

---

## Common Issues & Fixes

### Issue: Website shows "Application error" after deploy

**Cause:** Environment variables missing atau salah.

**Fix:**
```bash
npx wrangler secret list
# Harus show: CLERK_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL
```
Re-run `npx wrangler secret put <key>` untuk yang missing.

### Issue: Download button → 404

**Cause:** GitHub Release belum dibuat atau tag salah.

**Fix:**
1. Verify release exists: https://github.com/RadityaWirayudha/AiNgeSpace/releases/tag/v0.1.0
2. Check exact filename matches `DOWNLOAD_FILE` di `site.ts`

### Issue: Registration fails with "Unauthorized"

**Cause:** `CLERK_SECRET_KEY` salah atau expired.

**Fix:**
1. Clerk Dashboard → API Keys
2. Copy `Secret Key` yang aktif
3. `npx wrangler secret put CLERK_SECRET_KEY`

### Issue: Desktop app "Cannot connect to database"

**Cause:** User's `%APPDATA%/PurpSpace/.env.local` missing atau incomplete.

**Fix (for users):**
1. Create `C:\Users\<username>\AppData\Roaming\PurpSpace\.env.local`
2. Add required env vars (see SETUP-INSTRUCTIONS.md)

**For fresh installs:** Installer should include `.env.local` with public keys only (anon key, Clerk publishable key). Private keys (secret key, service role key) should NOT be in installer.

---

## Rollback Plan

### If critical bug discovered post-deploy:

**Website rollback:**
```bash
cd purpspace-webapp
npx wrangler rollback
```
This reverts to previous deployment.

**Desktop app rollback:**
- Cannot "unpublish" GitHub Release (users already downloaded)
- Instead: create hotfix release `v0.1.1`
- Update `site.ts` VERSI to `0.1.1`
- Redeploy website

**Database rollback:**
- Supabase free tier doesn't have point-in-time recovery
- If RLS policies broke: run `DROP POLICY ...` SQL to remove bad policies
- Then re-run correct policies from `supabase/rls-policies.sql`

---

## Next Steps (Future Enhancements)

### Custom Domain (Optional, ~Rp 150k/year)

1. Buy domain `purpspace.com` via Cloudflare Registrar atau Niagahoster
2. Add domain to Cloudflare Workers:
   - Dashboard → Workers → purpspace-webapp → Settings → Custom Domains
   - Add `purpspace.com` + `www.purpspace.com`
3. Update Clerk production instance:
   - Requires custom domain for production (cannot use `*.workers.dev`)
   - Create production Clerk instance
   - Set domain: `auth.purpspace.com`
   - Update env vars with production keys
   - Rebuild + redeploy desktop app

### Auto-Update (electron-updater)

1. Add `electron-updater` to `purpspace-electron`
2. Configure `autoUpdater` in `electron/main.ts`:
   ```ts
   autoUpdater.setFeedURL({
     provider: 'github',
     owner: 'RadityaWirayudha',
     repo: 'AiNgeSpace',
   })
   autoUpdater.checkForUpdatesAndNotify()
   ```
3. On app launch, check GitHub Releases for newer version
4. Download + apply delta update in background
5. Prompt user to restart when update ready

**Cost:** Free (GitHub Releases API: 60 req/hr unauthenticated, 5000 req/hr authenticated).

### Payment Integration (Stripe/Xendit)

- Stripe Indonesia = invite-only (as of Aug 2026)
- Alternative: Xendit atau Midtrans (IDR only, bank transfer VA)
- Add `/api/checkout` endpoint in webapp
- On trial expiry, redirect to payment page
- Update `subscriptions_purpspace.status` to `active` after payment

---

## Success Metrics (First Month)

**Target KPIs:**

- **Website visitors:** 100-500/month (organic + word of mouth)
- **Signups:** 10-50 registrations/month (10% conversion)
- **Downloads:** 10-50 installs/month (100% of signups download)
- **DAU:** 5-20 daily active users (users who launch app)
- **Retention:** 30% D7 retention (users still active after 7 days)

**Infrastructure:**

- **Cloudflare requests:** < 10k/day (well under 100k free limit)
- **Supabase DB size:** < 10 MB (far from 500 MB limit)
- **GitHub bandwidth:** < 10 GB/month (50 downloads × 180 MB)

**Total monthly cost:** Rp 0 (all free tiers).

---

## Conclusion

Setelah menyelesaikan semua steps di atas:

✅ Desktop app bisa dipakai siapa saja (not just dev machine)  
✅ Installer di-distribute via GitHub Releases (gratis, unlimited bandwidth)  
✅ Website deployed di Cloudflare Workers (gratis, commercial use allowed)  
✅ RLS enforced → user A tidak bisa akses data user B  
✅ Zero monthly cost (Cloudflare + Supabase + GitHub all free tier)  

**You're production-ready.** 🚀
