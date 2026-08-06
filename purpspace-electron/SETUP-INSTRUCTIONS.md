# Setup Instructions: RLS Migration untuk Production

Dokumen ini berisi langkah-langkah manual yang harus dilakukan di Clerk Dashboard dan Supabase Dashboard untuk menyelesaikan migrasi autentikasi dari service-role-key ke JWT-based RLS.

---

## Prerequisites

- Akun Clerk (current: dev instance `*.clerk.accounts.dev`)
- Akun Supabase (current project: `ucneqextloynzymzxygi.supabase.co`)
- Akses ke kedua dashboard

---

## Step 1: Configure Supabase untuk Clerk Third-Party Auth

**Lokasi:** Supabase Dashboard → Authentication → Third-party Auth

1. Buka [Supabase Dashboard](https://supabase.com/dashboard)
2. Pilih project `ucneqextloynzymzxygi`
3. Sidebar: **Authentication** → **Third-party Auth**
4. Klik **Add Provider** → cari **Clerk**
5. Masukkan **Clerk Domain**: `new-bluegill-38.clerk.accounts.dev` (atau domain Clerk instance lu yang sekarang aktif)
   - Domain ini bisa dicek di Clerk Dashboard → Settings → General
6. Klik **Save**

**What happens:** Supabase sekarang akan verifikasi Clerk session JWTs menggunakan Clerk's JWKS endpoint (`https://<clerk-domain>/.well-known/jwks.json`). Tidak perlu JWT template lagi — native integration sudah handle semua.

---

## Step 2: Run RLS Policies di Supabase

**Lokasi:** Supabase Dashboard → SQL Editor

1. Di sidebar Supabase, klik **SQL Editor**
2. Klik **New Query**
3. Copy-paste seluruh isi file `supabase/rls-policies.sql` ke query editor
4. Klik **Run** (atau Ctrl+Enter)

**Expected output:**
```
Success. No rows returned.
```

**Verification:** Jalankan query berikut untuk confirm 16 policies ter-create:
```sql
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN (
  'workspaces_purpspace',
  'panes_purpspace',
  'env_vars_purpspace',
  'github_connections_purpspace'
)
ORDER BY tablename, cmd;
```

Harus muncul 16 rows (4 policies per table).

---

## Step 3: Update `.env.local` di %APPDATA%

**Lokasi:** `%APPDATA%\PurpSpace\.env.local` (Windows) atau `~/.config/PurpSpace/.env.local` (jika pakai Linux/macOS nanti)

1. Buka file `.env.local` di `%APPDATA%\PurpSpace\` (buat folder kalau belum ada)
2. **Remove** baris ini:
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```
3. **Keep** semua env vars lainnya:
   ```bash
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_SUPABASE_URL=https://ucneqextloynzymzxygi.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
   ENCRYPTION_KEY=<64-char-hex>
   GITHUB_CLIENT_ID=Ov23li...
   GITHUB_CLIENT_SECRET=<secret>
   ```

**Why:** `SUPABASE_SERVICE_ROLE_KEY` sekarang tidak dipakai lagi. Anon key + Clerk JWT sudah cukup, dan RLS enforce access control.

**Important:** Setelah ini, **JANGAN bundle** service role key ke installer. File `.env.local` tidak pernah di-commit atau di-bundle (sudah ada di `.gitignore` dan `electron-builder.yml`).

---

## Step 4: Test RLS Enforcement

**Prerequisite:** Steps 1-3 sudah selesai.

1. **Test 1: Auth flow works**
   ```bash
   cd purpspace-electron
   npm run dev:desktop
   ```
   - App harus buka browser untuk sign-in via Clerk
   - Setelah auth, dashboard muncul

2. **Test 2: Workspace CRUD**
   - Create workspace → harus berhasil
   - List workspaces → hanya muncul workspace milik lu sendiri
   - Delete workspace → berhasil

3. **Test 3: Multi-user isolation (butuh 2 Clerk accounts)**
   - Sign in sebagai User A, create workspace "Test A"
   - Sign out, sign in sebagai User B
   - List workspaces → workspace "Test A" TIDAK muncul (karena RLS filter)
   - Coba akses workspace ID milik User A via API → harus return 404 atau empty

**Expected:** Semua test pass. Kalau ada error, check:
- Clerk third-party auth di Supabase configured dengan domain yang benar
- RLS policies ter-create (16 policies total)
- `.env.local` tidak ada `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 5 (Optional): Migrate ke Clerk Production Instance

**Current state:** Dev instance (`new-bluegill-38.clerk.accounts.dev`) — limited to 100 users.

**Production instance requirements:**
- Custom domain (e.g., `auth.purpspace.com`)
- CNAME record: `auth.purpspace.com` → `<production-instance>.clerk.accounts.com`
- Update `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` dan `CLERK_SECRET_KEY` di `.env.local`
- Rebuild + redeploy desktop app dengan production keys

**⚠️ Caveat:** Existing users di dev instance TIDAK ter-migrate otomatis. Mereka harus re-signup di production instance.

**Decision:** Skip this untuk MVP. Pakai dev instance dulu sampai siap launch publicly.

---

## Step 6: Rebuild Installer (Opsional — untuk testing)

Setelah Steps 1-3 selesai, **installer yang sudah ada masih bisa jalan** (karena perubahan hanya di code, bukan di env vars yang di-bundle).

Tapi kalau mau rebuild untuk testing:

```bash
cd purpspace-electron
npm run build:desktop
```

**Output:** `dist/PurpSpace-Setup-0.1.0-x64.exe`

**Test:** Install di mesin lain (atau VM) → app harus prompt auth via browser → setelah auth, dashboard works.

---

## Common Issues

### Issue 1: API calls return 401 Unauthorized
**Cause:** Clerk session JWT tidak valid atau Supabase belum configured untuk verify Clerk JWTs.

**Fix:**
1. Check Clerk domain di Supabase → Authentication → Third-party Auth
2. Verify domain exact match dengan Clerk dashboard

### Issue 2: RLS policies tidak apply, user bisa lihat data user lain
**Cause:** RLS policies belum di-run, atau ada typo di `clerk_user_id` column name.

**Fix:**
1. Jalankan verification query (lihat Step 2)
2. Check `clerk_user_id` column exists di semua tables (harus type `text`, bukan `uuid`)

### Issue 3: `getToken()` returns null
**Cause:** User belum authenticated via Clerk.

**Fix:**
1. Confirm auth flow works (browser opens → sign in → redirect back to app)
2. Check Clerk session di browser DevTools → Application → Cookies

### Issue 4: TypeError di API routes
**Cause:** Old code masih pakai synchronous `createServerClient()`.

**Fix:**
1. Run `npm run typecheck` untuk catch semua type errors
2. All routes should use `const { supabase, userId } = await createAuthedClient()`

---

## Rollback Plan (Jika Ada Masalah)

Kalau after migration ada critical bug, rollback cepat dengan:

1. **Git revert** commit yang introduce RLS migration:
   ```bash
   git log --oneline | head -5  # cari commit hash
   git revert <commit-hash>
   ```

2. **Restore service-role-key usage** di `src/lib/supabase/server.ts`:
   ```ts
   export function createServerClient() {
     return createClient<Database>(
       process.env.NEXT_PUBLIC_SUPABASE_URL!,
       process.env.SUPABASE_SERVICE_ROLE_KEY!,
       { auth: { autoRefreshToken: false, persistSession: false } }
     )
   }
   ```

3. **Drop RLS policies** di Supabase:
   ```sql
   DROP POLICY IF EXISTS "Users can read own workspaces" ON workspaces_purpspace;
   -- (repeat untuk 16 policies)
   ```

4. **Rebuild installer** dengan rollback code.

**Note:** Rollback hanya untuk emergency. Target: fix forward, bukan rollback.

---

## Success Criteria

✅ Supabase configured dengan Clerk third-party auth  
✅ 16 RLS policies active di database  
✅ Desktop app works untuk authenticated users  
✅ Multi-user isolation enforced (User A tidak bisa akses data User B)  
✅ No more `SUPABASE_SERVICE_ROLE_KEY` di codebase atau `.env.local`  
✅ TypeScript typecheck passes  

Kalau semua ✅, **Phase 1 (RLS Migration) selesai**. Next: Phase 2 (Cloudflare Pages setup untuk website).
