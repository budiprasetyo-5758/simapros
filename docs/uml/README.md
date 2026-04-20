# Dokumentasi UML SIMAPROS

Sistem Manajemen Proyek Strategis (SIMAPROS) - Dokumentasi Diagram UML

## Daftar Diagram

| No | File | Deskripsi |
|----|------|-----------|
| 1 | [01-entity-relationship-diagram.md](./01-entity-relationship-diagram.md) | Struktur database dan relasi antar tabel |
| 2 | [02-use-case-diagram.md](./02-use-case-diagram.md) | Interaksi aktor dengan sistem |
| 3 | [03-sequence-diagram.md](./03-sequence-diagram.md) | Alur proses utama sistem |
| 4 | [04-class-diagram.md](./04-class-diagram.md) | Struktur kode frontend |
| 5 | [05-state-diagram.md](./05-state-diagram.md) | Status proyek dan task |
| 6 | [06-component-diagram.md](./06-component-diagram.md) | Arsitektur komponen sistem |
| 7 | [07-activity-diagram.md](./07-activity-diagram.md) | Alur aktivitas bisnis |

## Cara Menggunakan

### Render di GitHub
Upload file ke repository GitHub - diagram Mermaid akan otomatis di-render.

### Render di VS Code
Install extension "Markdown Preview Mermaid Support" atau "Mermaid Markdown Syntax Highlighting".

### Render Online
Copy isi diagram ke [mermaid.live](https://mermaid.live) untuk melihat dan export sebagai gambar.

## Teknologi yang Digunakan

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS
- **Backend**: Lovable Cloud (Supabase)
- **Database**: PostgreSQL dengan RLS
- **AI Integration**: Lovable AI Gateway

## Aktor Sistem

| Aktor | Deskripsi |
|-------|-----------|
| User | Pengguna umum yang dapat submit proposal proyek |
| Project Executor | Pelaksana proyek yang mengelola task |
| Super Admin | Administrator dengan akses penuh ke sistem |

---

*Dokumentasi ini dibuat secara otomatis dari analisis kode SIMAPROS*
