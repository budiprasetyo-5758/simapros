# Sequence Diagram

Diagram ini menggambarkan alur proses utama dalam sistem SIMAPROS.

## 1. Submit & Approval Proyek

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Frontend as React App
    participant Supabase as Lovable Cloud
    participant DB as PostgreSQL
    actor Admin as Super Admin

    User->>Frontend: Isi form proposal proyek
    Frontend->>Frontend: Validasi input
    Frontend->>Supabase: Insert project (status: pending)
    Supabase->>DB: INSERT INTO projects
    DB-->>Supabase: Success
    Supabase-->>Frontend: Project created
    Frontend-->>User: Tampilkan konfirmasi

    Note over Admin: Super Admin membuka Approval Queue
    
    Admin->>Frontend: Buka halaman Approval
    Frontend->>Supabase: Fetch pending projects
    Supabase->>DB: SELECT * FROM projects WHERE status='pending'
    DB-->>Supabase: Projects list
    Supabase-->>Frontend: Return projects
    Frontend-->>Admin: Tampilkan daftar proposal

    Admin->>Frontend: Klik "Evaluasi" pada proyek
    Frontend-->>Admin: Tampilkan dialog evaluasi
    Admin->>Frontend: Set Urgency & Impact
    Frontend->>Frontend: Hitung Priority dari matrix
    Admin->>Frontend: Klik "Approve"
    Frontend->>Supabase: Update project (status: approved, priority)
    Supabase->>DB: UPDATE projects SET status='approved', priority=?
    DB-->>Supabase: Success
    
    Supabase->>DB: INSERT INTO notifications (user_id, type='approved')
    DB-->>Supabase: Notification created
    
    Supabase-->>Frontend: Success
    Frontend-->>Admin: Tampilkan konfirmasi
    Frontend-->>User: Notifikasi: Proposal disetujui
```

## 2. Generate AI Tasks

```mermaid
sequenceDiagram
    autonumber
    actor Executor as Project Executor
    participant Frontend as React App
    participant Supabase as Lovable Cloud
    participant EdgeFn as Edge Function
    participant AI as Lovable AI Gateway
    participant DB as PostgreSQL

    Executor->>Frontend: Buka halaman Project Detail
    Frontend->>Supabase: Fetch project & tasks
    Supabase->>DB: SELECT project, gantt_tasks
    DB-->>Supabase: Project data
    Supabase-->>Frontend: Return data
    Frontend-->>Executor: Tampilkan project (belum ada task)

    Executor->>Frontend: Klik "Generate AI Tasks"
    Frontend-->>Executor: Tampilkan dialog konfirmasi
    Executor->>Frontend: Konfirmasi generate
    
    Frontend->>Supabase: Call edge function
    Supabase->>EdgeFn: generate-task-suggestions
    EdgeFn->>AI: POST /v1/chat/completions
    Note right of AI: Model: gemini-3-flash-preview
    AI-->>EdgeFn: Stream response (task suggestions)
    EdgeFn-->>Supabase: Return suggestions
    Supabase-->>Frontend: Stream task suggestions
    Frontend-->>Executor: Tampilkan suggestions

    Executor->>Frontend: Review & confirm tasks
    Frontend->>Supabase: Batch insert tasks
    Supabase->>DB: INSERT INTO gantt_tasks (multiple)
    DB-->>Supabase: Tasks created
    Supabase-->>Frontend: Success
    Frontend-->>Executor: Tampilkan Gantt Chart dengan tasks
```

## 3. Submit Daily Report & AI Progress

```mermaid
sequenceDiagram
    autonumber
    actor Executor as Project Executor
    participant Frontend as React App
    participant Supabase as Lovable Cloud
    participant EdgeFn as Edge Function
    participant AI as Lovable AI Gateway
    participant DB as PostgreSQL

    Executor->>Frontend: Buka task detail
    Frontend-->>Executor: Tampilkan form daily report
    
    Executor->>Frontend: Isi laporan harian
    Note right of Executor: - Deskripsi pekerjaan<br/>- Pencapaian<br/>- Kendala
    
    Frontend->>Supabase: Insert daily_report
    Supabase->>DB: INSERT INTO daily_reports
    DB-->>Supabase: Report saved

    Supabase->>EdgeFn: Trigger calculate-task-progress
    EdgeFn->>DB: Fetch task & all reports
    DB-->>EdgeFn: Task data + reports history
    
    EdgeFn->>AI: POST /v1/chat/completions
    Note right of AI: Analyze reports,<br/>calculate progress %
    AI-->>EdgeFn: {progress: 75, reasoning: "..."}
    
    EdgeFn->>DB: UPDATE gantt_tasks SET ai_progress=75
    DB-->>EdgeFn: Updated
    EdgeFn-->>Supabase: Progress updated
    
    Supabase-->>Frontend: Success with new progress
    Frontend-->>Executor: Tampilkan progress terupdate
```

## 4. Request Perubahan Unit Kerja

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Frontend as React App
    participant Supabase as Lovable Cloud
    participant DB as PostgreSQL
    actor Admin as Super Admin

    User->>Frontend: Buka halaman Edit Profile
    Frontend->>Supabase: Fetch profile & unit_kerja
    Supabase->>DB: SELECT profile, unit_kerja
    DB-->>Supabase: Data
    Supabase-->>Frontend: Return data
    Frontend-->>User: Tampilkan profil (unit kerja locked)

    User->>Frontend: Klik "Request Perubahan Unit Kerja"
    Frontend-->>User: Tampilkan form request
    User->>Frontend: Pilih unit baru + isi alasan
    Frontend->>Supabase: Insert change request
    Supabase->>DB: INSERT INTO unit_kerja_change_requests
    DB-->>Supabase: Request created
    
    Supabase->>DB: INSERT INTO notifications (admin, type='unit_change_request')
    DB-->>Supabase: Notification created
    
    Supabase-->>Frontend: Success
    Frontend-->>User: Tampilkan "Menunggu persetujuan"

    Note over Admin: Super Admin membuka Unit Kerja Requests
    
    Admin->>Frontend: Buka halaman requests
    Frontend->>Supabase: Fetch pending requests
    Supabase->>DB: SELECT * FROM unit_kerja_change_requests WHERE status='pending'
    DB-->>Supabase: Requests list
    Supabase-->>Frontend: Return requests
    Frontend-->>Admin: Tampilkan daftar request

    Admin->>Frontend: Approve request
    Frontend->>Supabase: Update request + profile
    Supabase->>DB: UPDATE unit_kerja_change_requests SET status='approved'
    Supabase->>DB: UPDATE profiles SET unit_kerja_id = new_id
    DB-->>Supabase: Updated
    
    Supabase->>DB: INSERT INTO notifications (user, type='unit_change_approved')
    DB-->>Supabase: Notification created
    
    Supabase-->>Frontend: Success
    Frontend-->>Admin: Tampilkan konfirmasi
    Frontend-->>User: Notifikasi: Perubahan disetujui
```

## 5. Generate Weekly Report

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Super Admin
    participant Frontend as React App
    participant Supabase as Lovable Cloud
    participant EdgeFn as Edge Function
    participant AI as Lovable AI Gateway
    participant DB as PostgreSQL

    Admin->>Frontend: Buka halaman Weekly Report
    Frontend->>Supabase: Fetch master_proyek list
    Supabase->>DB: SELECT * FROM master_proyek
    DB-->>Supabase: Categories
    Supabase-->>Frontend: Return categories
    Frontend-->>Admin: Tampilkan filter kategori

    Admin->>Frontend: Pilih kategori + klik Generate
    Frontend->>Supabase: Call edge function
    Supabase->>EdgeFn: generate-weekly-report
    
    EdgeFn->>DB: Fetch projects & tasks
    DB-->>EdgeFn: Project data with tasks
    
    EdgeFn->>EdgeFn: Calculate statistics
    Note right of EdgeFn: - Total projects<br/>- Task completion %<br/>- Overdue tasks
    
    EdgeFn->>AI: POST /v1/chat/completions (stream)
    Note right of AI: Generate report<br/>with comparison table
    
    loop Streaming
        AI-->>EdgeFn: Chunk of report
        EdgeFn-->>Frontend: Stream chunk
        Frontend-->>Admin: Render markdown incrementally
    end
    
    Admin->>Frontend: Klik "Download PDF"
    Frontend->>Frontend: html2canvas + jsPDF
    Frontend->>Frontend: Paginate content
    Frontend-->>Admin: Download PDF file
```

## 6. Task Edit Request Flow

```mermaid
sequenceDiagram
    autonumber
    actor Executor as Project Executor
    participant Frontend as React App
    participant Supabase as Lovable Cloud
    participant DB as PostgreSQL
    actor Admin as Super Admin

    Executor->>Frontend: Request edit task
    Frontend-->>Executor: Tampilkan form perubahan
    Executor->>Frontend: Isi perubahan yang diinginkan
    Frontend->>Supabase: Insert edit request
    Supabase->>DB: INSERT INTO gantt_task_edit_requests
    DB-->>Supabase: Request created
    Supabase-->>Frontend: Success
    Frontend-->>Executor: Menunggu persetujuan

    Admin->>Frontend: Buka Edit Requests Queue
    Frontend->>Supabase: Fetch pending requests
    Supabase->>DB: SELECT * FROM gantt_task_edit_requests WHERE status='pending'
    DB-->>Supabase: Requests
    Supabase-->>Frontend: Return requests
    Frontend-->>Admin: Tampilkan daftar request

    alt Approve
        Admin->>Frontend: Approve request
        Frontend->>Supabase: Update request + apply changes
        Supabase->>DB: UPDATE request SET status='approved'
        Supabase->>DB: UPDATE gantt_tasks SET [proposed changes]
        DB-->>Supabase: Updated
        Supabase-->>Frontend: Success
        Frontend-->>Executor: Notifikasi: Perubahan disetujui
    else Reject
        Admin->>Frontend: Reject request + note
        Frontend->>Supabase: Update request
        Supabase->>DB: UPDATE request SET status='rejected', admin_note=?
        DB-->>Supabase: Updated
        Supabase-->>Frontend: Success
        Frontend-->>Executor: Notifikasi: Perubahan ditolak
    end
```
