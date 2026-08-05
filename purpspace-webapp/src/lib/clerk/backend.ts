/**
 * Klien Clerk — SISI SERVER SAJA.
 *
 * Website memakai `@clerk/backend`, bukan `@clerk/nextjs`. Bedanya penting:
 * tidak ada `ClerkProvider`, tidak ada middleware, dan tidak ada sesi Clerk di
 * browser pengunjung. Website memang tidak butuh — satu-satunya hal yang ia
 * lakukan terhadap Clerk adalah membuat akun dari route handler. Sesi yang
 * sebenarnya baru terbentuk nanti, di aplikasi desktop, lewat alur
 * `/desktop-auth` milik `purpspace-electron`.
 *
 * Instance Clerk-nya harus yang SAMA dengan aplikasi desktop — kalau tidak,
 * email yang didaftarkan di sini tidak akan bisa dipakai login di sana, dan
 * mendaftar jadi tidak ada gunanya.
 */
import { createClerkClient } from "@clerk/backend"

export const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
})
