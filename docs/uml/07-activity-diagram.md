# Activity Diagram

Diagram ini menggambarkan alur aktivitas bisnis dalam sistem SIMAPROS.

## 1. Alur Submit dan Approval Proyek

```mermaid
flowchart TD
    Start([Start]) --> A[User login ke sistem]
    A --> B[Buka halaman Submit Project]
    B --> C[Isi form proposal proyek]
    C --> D{Form valid?}
    D -->|Tidak| E[Tampilkan error validasi]
    E --> C
    D -->|Ya| F[Submit proposal]
    F --> G[Simpan ke database<br/>status: pending]
    G --> H[Notifikasi ke Super Admin]
    
    H --> I[Super Admin buka Approval Queue]
    I --> J[Review proposal]
    J --> K{Evaluasi}
    
    K -->|Lengkap| L[Set Urgency & Impact]
    L --> M[Hitung Priority dari matrix]
    M --> N{Keputusan}
    
    K -->|Kurang| O[Request revision]
    O --> P[Update status: revision]
    P --> Q[Notifikasi ke User]
    Q --> R[User perbaiki proposal]
    R --> F
    
    N -->|Approve| S[Update status: approved]
    S --> T[Set priority hasil matrix]
    T --> U[Notifikasi ke User]
    U --> V[Assign Project Executor]
    V --> W[Update status: active]
    W --> End1([End - Project Active])
    
    N -->|Reject| X[Update status: rejected]
    X --> Y[Tambah catatan penolakan]
    Y --> Z[Notifikasi ke User]
    Z --> End2([End - Project Rejected])
```

## 2. Alur Generate AI Tasks

```mermaid
flowchart TD
    Start([Start]) --> A[Executor buka Project Detail]
    A --> B{Ada tasks?}
    
    B -->|Ya| C[Tampilkan Gantt Chart]
    B -->|Tidak| D[Tampilkan opsi generate]
    
    D --> E[Klik Generate AI Tasks]
    E --> F[Tampilkan dialog konfirmasi]
    F --> G{Konfirmasi?}
    
    G -->|Tidak| H[Batal]
    H --> D
    
    G -->|Ya| I[Panggil Edge Function]
    I --> J[Edge Function fetch project data]
    J --> K[Kirim ke Lovable AI]
    K --> L[AI generate task suggestions]
    L --> M[Stream response ke frontend]
    M --> N[Tampilkan suggestions]
    
    N --> O{Review tasks}
    O -->|Edit| P[Modify task details]
    P --> O
    O -->|Confirm| Q[Batch insert tasks]
    Q --> R[Simpan ke gantt_tasks]
    R --> C
    
    C --> End([End])
```

## 3. Alur Perubahan Unit Kerja

```mermaid
flowchart TD
    Start([Start]) --> A[User buka Edit Profile]
    A --> B{Sudah punya unit kerja?}
    
    B -->|Tidak| C[Tampilkan dropdown pilih unit]
    C --> D[User pilih unit kerja]
    D --> E[Simpan ke profile]
    E --> F[profile_completed = true]
    F --> End1([End - Profile Complete])
    
    B -->|Ya| G[Tampilkan unit kerja saat ini<br/>field locked]
    G --> H[Tampilkan tombol Request Change]
    H --> I[User klik Request Change]
    I --> J[Tampilkan form request]
    J --> K[User pilih unit baru + isi alasan]
    K --> L[Submit request]
    L --> M[Simpan ke unit_kerja_change_requests]
    M --> N[Notifikasi ke Super Admin]
    N --> O[Status: Menunggu persetujuan]
    
    O --> P[Super Admin buka Unit Kerja Requests]
    P --> Q[Review request]
    Q --> R{Keputusan}
    
    R -->|Approve| S[Update request status: approved]
    S --> T[Update profile.unit_kerja_id]
    T --> U[Notifikasi ke User: Disetujui]
    U --> End2([End - Unit Changed])
    
    R -->|Reject| V[Update request status: rejected]
    V --> W[Tambah catatan penolakan]
    W --> X[Notifikasi ke User: Ditolak]
    X --> End3([End - Request Rejected])
```

## 4. Alur Daily Report & AI Progress

```mermaid
flowchart TD
    Start([Start]) --> A[Executor buka task detail]
    A --> B[Klik Submit Daily Report]
    B --> C[Isi form laporan]
    
    subgraph "Form Daily Report"
        C --> D[Deskripsi pekerjaan]
        D --> E[Pencapaian hari ini]
        E --> F[Kendala yang dihadapi]
        F --> G[Upload attachment opsional]
    end
    
    G --> H[Submit report]
    H --> I[Simpan ke daily_reports]
    I --> J[Trigger Edge Function]
    
    subgraph "AI Progress Calculation"
        J --> K[Fetch task info]
        K --> L[Fetch semua reports untuk task ini]
        L --> M[Kirim ke Lovable AI]
        M --> N[AI analisis progress]
        N --> O[Return progress % + reasoning]
    end
    
    O --> P[Update gantt_tasks.ai_progress]
    P --> Q{Ada progress_override?}
    
    Q -->|Ya| R[Gunakan progress_override]
    Q -->|Tidak| S[Gunakan ai_progress]
    
    R --> T[Tampilkan progress di Gantt]
    S --> T
    
    T --> U{Progress 100%?}
    U -->|Ya| V[Update status: completed]
    U -->|Tidak| W[Status tetap: in_progress]
    
    V --> End1([End - Task Complete])
    W --> End2([End - Continue Work])
```

## 5. Alur Generate Weekly Report

```mermaid
flowchart TD
    Start([Start]) --> A[Super Admin buka Weekly Report]
    A --> B[Fetch daftar kategori proyek]
    B --> C[Tampilkan filter kategori]
    C --> D[Admin pilih kategori]
    D --> E[Klik Generate Report]
    
    E --> F[Panggil Edge Function]
    
    subgraph "Edge Function Processing"
        F --> G[Fetch projects sesuai filter]
        G --> H[Fetch tasks untuk setiap project]
        H --> I[Hitung statistik]
        
        subgraph "Statistik"
            I --> I1[Total projects]
            I --> I2[Total tasks]
            I --> I3[Completed tasks]
            I --> I4[In progress tasks]
            I --> I5[Average progress]
        end
        
        I1 & I2 & I3 & I4 & I5 --> J[Compose prompt untuk AI]
        J --> K[Kirim ke Lovable AI]
        K --> L[AI generate report dengan tabel]
    end
    
    L --> M[Stream response ke frontend]
    M --> N[Render Markdown + tabel]
    N --> O[Tampilkan report lengkap]
    
    O --> P{Download PDF?}
    P -->|Ya| Q[html2canvas capture]
    Q --> R[jsPDF create pages]
    R --> S[Add header & footer tiap page]
    S --> T[Download PDF file]
    T --> End1([End])
    
    P -->|Tidak| End2([End])
```

## 6. Alur Task Edit Request

```mermaid
flowchart TD
    Start([Start]) --> A[Executor buka Project Detail]
    A --> B[Lihat task di Gantt Chart]
    B --> C[Klik task untuk edit]
    C --> D{User adalah Super Admin?}
    
    D -->|Ya| E[Edit langsung]
    E --> F[Simpan perubahan]
    F --> End1([End - Direct Edit])
    
    D -->|Tidak| G[Tampilkan form request edit]
    G --> H[Isi perubahan yang diinginkan]
    H --> I[Submit request]
    I --> J[Simpan ke gantt_task_edit_requests]
    J --> K[Notifikasi ke Super Admin]
    K --> L[Status: pending]
    
    L --> M[Super Admin buka Edit Requests Queue]
    M --> N[Review request]
    N --> O[Bandingkan current vs proposed]
    O --> P{Keputusan}
    
    P -->|Approve| Q[Update request status: approved]
    Q --> R[Apply changes ke gantt_tasks]
    R --> S[Notifikasi ke Requester: Approved]
    S --> End2([End - Changes Applied])
    
    P -->|Reject| T[Update request status: rejected]
    T --> U[Tambah catatan penolakan]
    U --> V[Notifikasi ke Requester: Rejected]
    V --> End3([End - Request Rejected])
```

## 7. Alur Assign Project Executor

```mermaid
flowchart TD
    Start([Start]) --> A[Super Admin buka Project Detail]
    A --> B[Klik Assign Executor]
    B --> C[Fetch daftar user dengan role project_executor]
    C --> D[Tampilkan dialog assignment]
    D --> E[Admin pilih executor]
    E --> F[Confirm assignment]
    F --> G[Simpan ke project_assignments]
    G --> H[Notifikasi ke Executor]
    H --> I[Executor dapat akses project]
    I --> End([End])
```

## 8. Alur Notification Flow

```mermaid
flowchart TD
    Start([Event Trigger]) --> A{Tipe Event}
    
    A -->|Proposal Approved| B[Create notification]
    A -->|Proposal Rejected| C[Create notification]
    A -->|Proposal Revision| D[Create notification]
    A -->|Task Deadline| E[Create notification]
    A -->|Edit Request Approved| F[Create notification]
    A -->|Edit Request Rejected| G[Create notification]
    A -->|Unit Change Approved| H[Create notification]
    A -->|Unit Change Rejected| I[Create notification]
    
    B & C & D & E & F & G & H & I --> J[Simpan ke notifications table]
    J --> K[Check notification_preferences]
    K --> L{Email enabled?}
    
    L -->|Ya| M[Trigger email notification]
    M --> N[Send via Edge Function]
    N --> O[Email terkirim]
    
    L -->|Tidak| P[Skip email]
    
    O & P --> Q[Update badge count di UI]
    Q --> R[User lihat di NotificationDropdown]
    R --> S[User klik notification]
    S --> T[Mark as read]
    T --> U[Navigate ke link terkait]
    U --> End([End])
```
