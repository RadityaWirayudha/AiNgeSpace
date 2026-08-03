# Supabase + Clerk + Electron Knowledge

> Panduan arsitektur penggunaan Clerk Authentication, Supabase Database, dan Electron Desktop Application.

---

# Tujuan

Dokumen ini menjelaskan bagaimana membangun aplikasi desktop menggunakan Electron dengan:

- Clerk sebagai Authentication Provider
- Supabase sebagai Database Backend
- Electron sebagai Desktop Runtime

Pendekatan ini memungkinkan aplikasi tetap aman, scalable, dan mudah dikembangkan ketika nantinya didistribusikan kepada pengguna lain.

---

# Arsitektur

```
                    +----------------------+
                    |      Electron        |
                    |                      |
                    | React / Next.js UI   |
                    +----------+-----------+
                               |
                               |
                        Clerk Authentication
                               |
                      Login / Register / OAuth
                               |
                               |
                         JWT Access Token
                               |
                               ▼
                     Supabase PostgreSQL
                     Row Level Security
                     Storage
                     Realtime
                     Edge Functions
```

---

# Tanggung Jawab Setiap Komponen

## Electron

Electron bertugas menjalankan aplikasi desktop.

Contohnya:

- File System
- Workspace
- Terminal
- Git
- Docker
- Child Process
- Native Module
- Local Cache

Electron tidak bertugas sebagai database.

---

## Clerk

Clerk hanya menangani autentikasi.

Contohnya:

- Login
- Register
- Google Login
- GitHub Login
- Discord Login
- Session Management
- User Management
- Password Reset
- Multi Factor Authentication

Clerk menjadi satu-satunya sumber identitas pengguna.

---

## Supabase

Supabase hanya menangani backend data.

Contohnya:

- PostgreSQL
- Storage
- Realtime
- Edge Functions
- Row Level Security (RLS)

Supabase tidak menangani proses login apabila menggunakan Clerk.

---

# Alur Login

```
User

↓

Electron App

↓

Clerk Login

↓

Google / GitHub / Email

↓

Clerk Authentication

↓

JWT

↓

Supabase

↓

Row Level Security

↓

Database
```

# Environment Variable

Contoh:

```
SUPABASE_URL=https://xxxxx.supabase.co

SUPABASE_ANON_KEY=xxxxxxxxxxxxx

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_xxxxxxxxx
```

Untuk backend (jika ada):

```
CLERK_SECRET_KEY=sk_xxxxxxxxx
```

---

# Apakah SUPABASE_ANON_KEY Aman?

Ya.

Anon Key memang dirancang untuk digunakan pada aplikasi client.

Baik:

- Web
- React
- Electron
- Flutter
- Android
- iOS

semuanya menggunakan Anon Key.

---

# Yang Tidak Boleh Berada di Client

Jangan pernah menyimpan:

```
SUPABASE_SERVICE_ROLE_KEY
```

atau

```
Database Password
```

atau

```
CLERK_SECRET_KEY
```

di dalam aplikasi Electron.

Karena siapa pun dapat melakukan reverse engineering terhadap aplikasi yang telah dibuild.

---

# Distribusi Aplikasi

Ketika aplikasi di-build menjadi:

```
PurpSpace.exe
```

atau

```
PurpSpace.dmg
```

atau

```
PurpSpace.AppImage
```

maka kemungkinan besar pengguna dapat melihat:

- SUPABASE_URL
- SUPABASE_ANON_KEY
- Clerk Publishable Key

Hal tersebut normal.

Yang harus tetap dirahasiakan adalah seluruh secret key.

---

# Komunikasi Antar Komponen

```
Renderer

↓

IPC

↓

Electron Main Process

↓

Filesystem
Terminal
Docker
Git
```

Sedangkan komunikasi database:

```
Renderer

↓

Supabase JS SDK

↓

HTTPS

↓

Supabase
```

---

# Kapan Menggunakan IPC?

Gunakan IPC apabila ingin:

- Membaca file
- Menulis file
- Menjalankan Git
- Menjalankan Docker
- Membuka Terminal
- Menjalankan Child Process

Renderer tidak sebaiknya mengakses sistem operasi secara langsung.

---

# Kapan Renderer Langsung Mengakses Supabase?

Renderer dapat langsung mengakses Supabase apabila:

- Login telah selesai
- Mengambil data
- Menyimpan data
- Upload Storage
- Download Storage
- Realtime Subscription

---

# Best Practice

✅ Gunakan Clerk sebagai Authentication Provider

✅ Gunakan Supabase sebagai Database

✅ Gunakan Row Level Security

✅ Gunakan Clerk User ID sebagai user_id

✅ Simpan Source Code di lokal

✅ Simpan Metadata di Supabase

✅ Gunakan IPC untuk operasi sistem

✅ Pisahkan UI dan Business Logic

✅ Jangan pernah menyimpan Secret Key di client

---

# Ringkasan Arsitektur

```
                   USER
                     │
                     ▼
              Electron Desktop
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
   Clerk Authentication      Electron Main
        │                    (Filesystem,
        │                     Docker,
        │                     Git,
        ▼                     Terminal)
   JWT Access Token
        │
        ▼
     Supabase
        │
 ┌──────┼─────────────┐
 │      │             │
 ▼      ▼             ▼
Database Storage   Realtime
```

---

# Kesimpulan

Gunakan Clerk sebagai sistem autentikasi utama.

Gunakan Supabase sebagai backend database.

Gunakan Electron untuk seluruh akses terhadap sistem operasi.

Dengan pembagian tanggung jawab tersebut:

- autentikasi menjadi lebih sederhana,
- database tetap aman melalui Row Level Security,
- source code tetap berada di komputer pengguna,
- aplikasi siap dikembangkan maupun didistribusikan ke pengguna lain tanpa mengekspos kredensial sensitif.

Arsitektur ini bersifat modular, mudah dipelihara, dan cocok untuk aplikasi desktop modern seperti IDE, AI Workspace, maupun Developer Tools.