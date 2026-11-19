# RUANG FAKTA — Creator Studio

Fondasi aplikasi dashboard untuk mengelola produksi konten channel YouTube RUANG FAKTA.

## Stack
- React + Vite
- Supabase (Postgres dan Auth, disiapkan untuk integrasi)
- Lucide icons

## Menjalankan secara lokal
1. Install Node.js versi 20.19+ atau 22.12+.
2. Jalankan `npm install`.
3. Salin `.env.example` menjadi `.env.local`.
4. Isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` dari Supabase Project Settings → API.
5. Jalankan `npm run dev`.

Tanpa kredensial Supabase, dashboard tampil dalam mode preview dengan data contoh. Jangan pernah memasukkan service_role key ke frontend.

## Build
`npm run build`

## Modul awal
- Ringkasan studio
- Daftar ide dan naskah video
- Kategori konten
- Status produksi dan jadwal
- Integrasi database Supabase (fondasi client tersedia)

## Database
Skema awal disimpan di `supabase/schema.sql`. Semua tabel publik mengaktifkan RLS. Data produksi hanya dapat diakses oleh pemilik yang sedang login.