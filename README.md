# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
## Lingkungan Beta

Untuk testing fungsional tersedia project Supabase beta (`blitdxwxaztjaujxfrfe`). Jalankan `npm run dev:beta` (memuat `.env.beta`), login dengan akun hasil import snapshot production (password semua akun: `Simapros2026!`). Limitasi: email eksternal tidak terkirim, Google OAuth/Calendar tidak aktif. Setup ulang database beta, aturan `--project-ref` eksplisit, dan workflow beta-first: lihat bagian "Lingkungan Beta" di `replit.md`.

## Penilaian Prioritas Proyek (SOP/HTO/001/2026)

Penilaian prioritas mengikuti SOP Filtrasi, Panduan Probing, dan Penilaian
Prioritas Proyek Transformasi & IT — metode `HTO-SOP-2026.1`:

- **Tahap 1 — Filtrasi Mandatory.** Tiga pertanyaan YES/NO (regulasi,
  akreditasi/BPJS, risiko kritis). Satu YES berarti Priority 0 / Fast Track dan
  skoring Tahap 2 dilewati. Setiap YES wajib menyertakan dasar tertulis.
- **Tahap 2 — Pembobotan K1–K5 skala 1–10** dengan bobot 20/20/25/20/15.
  Rubriknya berbentuk pita (1–3 / 4–6 / 7–8 / 9–10); penilai memilih kalimat
  pita lebih dulu, lalu nilai persisnya. Bukti wajib mulai skor 7.
- **Gate finansial (SOP 5.2).** Skor K3 ≤ 3 membuat proyek berstatus GATED
  (Under Review/Pending) sampai ada justifikasi ulang atau diskresi Direksi.
- **Sesi Probing (SOP 5.3).** Usulan yang belum jelas tidak boleh ditolak
  langsung. Kalkulator hanya menghasilkan `mandatory`, `queued`, atau `gated` —
  penundaan dan penolakan selalu keputusan manusia dengan alasan wajib.
- **Urutan Master Queue** ditentukan Total Skor Akhir, bukan Priority Index.
  Effort tetap direkam untuk label kuadran, perencanaan kapasitas, dan usulan
  jadwal, tetapi tidak menggeser peringkat.
- **Penilaian ulang** diizinkan dan menghasilkan revisi baru; snapshot lama
  tetap tersimpan sebagai riwayat.

Layar terkait: `/approval` (evaluasi) dan `/master-queue` (peringkat terkini).
Ritme mingguan SOP Bab 9 dijalankan manual oleh HTO di luar sistem.

Sebelum memakai fitur ini pada database yang sudah ada, jalankan SQL berikut
secara berurutan melalui Supabase SQL Editor:

1. `supabase/_batch6_priority_gate.sql` bagian enum terlebih dahulu, commit,
   kemudian bagian sisanya sesuai petunjuk di file.
2. `supabase/_batch7_effort_quadrant.sql`.
3. `supabase/_batch8_tier2_priority_assessment.sql`.
4. `supabase/_batch9_sop2026_priority.sql` — lihat
   `supabase/APPLY_SOP2026_PRIORITY.md`.

Batch 8 menambahkan tabel snapshot, RPC atomik, RLS, dan guard agar kolom
prioritas legacy tidak dapat menimpa penilaian yang telah ditetapkan. Batch 9
menambahkan metode SOP 2026, mengizinkan penilaian ulang, dan mencabut hak
EXECUTE RPC metode lama.

### Metode lama (`HTO-T2-1.0`)

Snapshot yang dibuat dengan metode lama (7 kriteria K1–K7 skala 1–5, 8
eligibility gate yang mem-veto, ambang GO/Conditional/Defer/No-Go) **tidak
pernah dihitung ulang** dan tetap ditampilkan pada skalanya sendiri. `src/lib/priorityScoring.ts`
dipertahankan sebagai renderer snapshot itu serta rumah registry label bersama.
Agar proyek lama ikut diperingkat dengan aturan SOP, nilai ulang proyeknya.

