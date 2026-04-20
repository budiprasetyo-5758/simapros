# Use Case Diagram

Diagram ini menggambarkan interaksi antara aktor dengan sistem SIMAPROS.

---

## 👤 User (Pengguna Umum)

```mermaid
graph TD
    User((👤 User))
    
    subgraph Akun["🔐 Manajemen Akun"]
        direction TB
        A1[Login/Register]
        A2[Update Profil]
        A3[Pilih Unit Kerja]
        A4[Request Ubah Unit Kerja]
        A5[Atur Notifikasi]
    end
    
    subgraph Proyek["📋 Proposal Proyek"]
        direction TB
        P1[Submit Proposal]
        P2[Lihat Status Proposal]
        P3[Lihat Notifikasi]
    end
    
    User --> Akun
    User --> Proyek
    
    A1 --> A2
    A2 --> A3
    A3 --> A4
    A4 --> A5
    
    P1 --> P2
    P2 --> P3

    classDef actor fill:#e1f5fe,stroke:#01579b
    classDef akun fill:#fff3e0,stroke:#e65100
    classDef proyek fill:#e8f5e9,stroke:#2e7d32
    
    class User actor
    class A1,A2,A3,A4,A5 akun
    class P1,P2,P3 proyek
```

| Use Case | Deskripsi | Prekondisi |
|----------|-----------|------------|
| Login/Register | Masuk atau daftar akun baru | - |
| Update Profil | Mengubah data profil | Sudah login |
| Pilih Unit Kerja | Memilih unit kerja pertama kali | Profil belum lengkap |
| Request Ubah Unit Kerja | Mengajukan perubahan unit kerja | Sudah punya unit kerja |
| Submit Proposal | Mengajukan proposal proyek baru | Sudah login |
| Lihat Status | Melihat status proposal yang diajukan | Punya proposal |

---

## 🔧 Project Executor

```mermaid
graph TD
    Executor((🔧 Executor))
    
    subgraph View["👁️ Lihat Proyek"]
        direction TB
        V1[Lihat Assigned Projects]
        V2[Lihat Gantt Chart]
        V3[Lihat Dashboard]
    end
    
    subgraph Task["📝 Kelola Task"]
        direction TB
        T1[Generate AI Tasks]
        T2[Tambah/Edit Task]
        T3[Update Progress]
        T4[Request Edit Task]
    end
    
    subgraph Report["📊 Laporan"]
        direction TB
        R1[Submit Daily Report]
        R2[Lihat Notifikasi]
    end
    
    Executor --> View
    Executor --> Task
    Executor --> Report
    
    V1 --> V2
    V2 --> V3
    
    T1 --> T2
    T2 --> T3
    T3 --> T4
    
    R1 --> R2

    classDef actor fill:#e1f5fe,stroke:#01579b
    classDef view fill:#f3e5f5,stroke:#7b1fa2
    classDef task fill:#fff8e1,stroke:#f57f17
    classDef report fill:#e0f2f1,stroke:#00695c
    
    class Executor actor
    class V1,V2,V3 view
    class T1,T2,T3,T4 task
    class R1,R2 report
```

| Use Case | Deskripsi | Prekondisi |
|----------|-----------|------------|
| Lihat Assigned Projects | Melihat proyek yang ditugaskan | Di-assign ke proyek |
| Lihat Gantt Chart | Melihat timeline task proyek | Punya akses proyek |
| Generate AI Tasks | Membuat task otomatis dengan AI | Proyek approved |
| Update Progress | Memperbarui progress task | Task assigned |
| Submit Daily Report | Membuat laporan harian | Task dalam progress |

---

## 👑 Super Admin

```mermaid
graph TD
    Admin((👑 Admin))
    
    subgraph Approval["✅ Approval"]
        direction TB
        AP1[Review Proposals]
        AP2[Evaluasi & Set Priority]
        AP3[Approve/Reject]
        AP4[Assign Executor]
        AP5[Review Edit Requests]
    end
    
    subgraph Laporan["📈 Laporan"]
        direction TB
        L1[Lihat Dashboard]
        L2[Generate Weekly Report]
        L3[Download PDF]
        L4[Lihat Notifikasi]
    end
    
    subgraph Master["⚙️ Master Data"]
        direction TB
        M1[Kelola Unit Kerja]
        M2[Kelola Kategori Proyek]
        M3[Kelola Users & Roles]
        M4[Review Unit Kerja Requests]
    end
    
    Admin --> Approval
    Admin --> Laporan
    Admin --> Master
    
    AP1 --> AP2
    AP2 --> AP3
    AP3 --> AP4
    AP4 --> AP5
    
    L1 --> L2
    L2 --> L3
    L3 --> L4
    
    M1 --> M2
    M2 --> M3
    M3 --> M4

    classDef actor fill:#ffebee,stroke:#c62828
    classDef approval fill:#e3f2fd,stroke:#1565c0
    classDef laporan fill:#f1f8e9,stroke:#558b2f
    classDef master fill:#fce4ec,stroke:#ad1457
    
    class Admin actor
    class AP1,AP2,AP3,AP4,AP5 approval
    class L1,L2,L3,L4 laporan
    class M1,M2,M3,M4 master
```

| Use Case | Deskripsi | Prekondisi |
|----------|-----------|------------|
| Review Proposals | Meninjau proposal masuk | Ada proposal pending |
| Set Priority Matrix | Menentukan urgency & impact | Saat evaluasi proposal |
| Approve/Reject | Menyetujui atau menolak proposal | Sudah dievaluasi |
| Assign Executor | Menugaskan pelaksana proyek | Proyek approved |
| Review Requests | Meninjau permintaan perubahan | Ada request pending |
| Generate Report | Membuat laporan mingguan AI | Ada proyek aktif |
| Kelola Master Data | CRUD unit kerja & kategori | - |
| Kelola Users | Mengatur role pengguna | - |

---

## 📊 Diagram Ringkasan Sistem

```mermaid
graph TD
    subgraph Actors["Aktor"]
        direction TB
        U((👤 User))
        E((🔧 Executor))
        A((👑 Admin))
    end
    
    subgraph System["SIMAPROS"]
        direction TB
        
        subgraph Auth["Autentikasi"]
            Login[Login/Register]
            Profile[Kelola Profil]
        end
        
        subgraph Project["Proyek"]
            Submit[Submit Proposal]
            Review[Review & Approve]
            Manage[Kelola Proyek]
        end
        
        subgraph Tasks["Task"]
            AI[AI Generate]
            Progress[Update Progress]
            Report[Daily Report]
        end
        
        subgraph Admin["Administrasi"]
            Master[Master Data]
            Users[User Management]
            Weekly[Weekly Report]
        end
    end
    
    U --> Auth
    U --> Submit
    
    E --> Auth
    E --> Manage
    E --> Tasks
    
    A --> Auth
    A --> Review
    A --> Admin

    classDef user fill:#e1f5fe,stroke:#01579b
    classDef executor fill:#fff3e0,stroke:#e65100
    classDef admin fill:#ffebee,stroke:#c62828
    
    class U user
    class E executor
    class A admin
```

---

## 🔄 Alur Detail: Approval Proyek

```mermaid
graph TD
    A[👤 User Submit Proposal]
    B{Status: Pending}
    C[👑 Admin Review]
    D{Evaluasi Lengkap?}
    E[Set Priority Matrix]
    F[Request Revision]
    G[Set Urgency & Impact]
    H{Keputusan}
    I[✅ Approved]
    J[❌ Rejected]
    K[🔄 Revision]
    L[User Perbaiki]
    M[Assign Executor]
    N[Status: Active]
    
    A --> B
    B --> C
    C --> D
    D -->|Ya| E
    D -->|Tidak| F
    E --> G
    G --> H
    H -->|Approve| I
    H -->|Reject| J
    F --> K
    K --> L
    L --> B
    I --> M
    M --> N

    classDef start fill:#c8e6c9,stroke:#2e7d32
    classDef process fill:#e3f2fd,stroke:#1565c0
    classDef decision fill:#fff9c4,stroke:#f9a825
    classDef success fill:#a5d6a7,stroke:#388e3c
    classDef error fill:#ef9a9a,stroke:#c62828
    classDef warning fill:#ffcc80,stroke:#ef6c00
    
    class A start
    class C,E,G,M process
    class D,H decision
    class I,N success
    class J error
    class F,K,L warning
```

---

## 🔄 Alur Detail: Task Management

```mermaid
graph TD
    A[Proyek Approved]
    B{Generate Tasks?}
    C[🤖 AI Generation]
    D[✍️ Manual Input]
    E[AI Suggestions]
    F[Review & Confirm]
    G[Tasks Created]
    H[🔧 Executor Work]
    I[Submit Daily Report]
    J[🤖 AI Calculate Progress]
    K[Update Task Progress]
    L{Task Selesai?}
    M[✅ Completed]
    
    A --> B
    B -->|AI| C
    B -->|Manual| D
    C --> E
    E --> F
    F --> G
    D --> G
    G --> H
    H --> I
    I --> J
    J --> K
    K --> L
    L -->|Ya| M
    L -->|Tidak| H

    classDef start fill:#c8e6c9,stroke:#2e7d32
    classDef ai fill:#e1bee7,stroke:#7b1fa2
    classDef manual fill:#b3e5fc,stroke:#0277bd
    classDef process fill:#fff9c4,stroke:#f9a825
    classDef success fill:#a5d6a7,stroke:#388e3c
    
    class A start
    class C,E,J ai
    class D,F,G,H,I,K manual
    class B,L process
    class M success
```
