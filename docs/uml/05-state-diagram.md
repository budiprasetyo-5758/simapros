# State Diagram

Diagram ini menggambarkan transisi status dalam sistem SIMAPROS.

## 1. Status Proyek (Project Status)

```mermaid
stateDiagram-v2
    [*] --> pending : User submit proposal
    
    pending --> approved : Admin approve
    pending --> rejected : Admin reject
    pending --> revision : Admin request revision
    
    revision --> pending : User submit ulang
    
    approved --> active : Executor assigned & mulai kerja
    approved --> pending_creation : Menunggu task dibuat
    
    pending_creation --> active : Tasks generated
    
    active --> [*] : Project completed
    
    rejected --> [*] : End
    
    note right of pending
        Menunggu evaluasi
        dari Super Admin
    end note
    
    note right of revision
        User perlu memperbaiki
        proposal sesuai catatan
    end note
    
    note right of approved
        Siap untuk eksekusi
        perlu assign executor
    end note
    
    note right of active
        Proyek sedang berjalan
        tasks dalam progress
    end note
```

### Penjelasan Status Proyek

| Status | Deskripsi | Aksi Selanjutnya |
|--------|-----------|------------------|
| `pending` | Proposal baru diajukan | Admin evaluasi & approve/reject/revision |
| `revision` | Perlu perbaikan | User perbaiki & submit ulang |
| `approved` | Disetujui | Assign executor, generate tasks |
| `pending_creation` | Menunggu task | Generate AI tasks |
| `active` | Sedang berjalan | Execute tasks, update progress |
| `rejected` | Ditolak | End state |

## 2. Status Task (Task Status)

```mermaid
stateDiagram-v2
    [*] --> not_started : Task created
    
    not_started --> in_progress : Executor mulai kerja
    not_started --> pending : Menunggu approval
    
    pending --> not_started : Request rejected
    pending --> in_progress : Request approved
    
    in_progress --> completed : Progress 100%
    in_progress --> pending : Request perubahan
    
    completed --> in_progress : Reopen (jika perlu revisi)
    completed --> [*] : Task done
    
    note right of not_started
        Task belum dimulai
        Executor belum assign
    end note
    
    note right of in_progress
        Executor mengerjakan
        Submit daily reports
    end note
    
    note right of pending
        Ada request edit
        menunggu approval
    end note
    
    note right of completed
        Task selesai
        Progress 100%
    end note
```

### Penjelasan Status Task

| Status | Deskripsi | Aksi Selanjutnya |
|--------|-----------|------------------|
| `not_started` | Belum dimulai | Mulai kerjakan |
| `in_progress` | Sedang dikerjakan | Submit daily report, update progress |
| `pending` | Menunggu approval | Admin approve/reject |
| `completed` | Selesai | Archive atau reopen jika perlu |

## 3. Status Request (Edit Request Status)

```mermaid
stateDiagram-v2
    [*] --> pending : Request created
    
    pending --> approved : Admin approve
    pending --> rejected : Admin reject
    
    approved --> [*] : Changes applied
    rejected --> [*] : No changes
    
    note right of pending
        Menunggu review
        Super Admin
    end note
    
    note right of approved
        Perubahan diterapkan
        ke data asli
    end note
    
    note right of rejected
        Perubahan ditolak
        dengan catatan admin
    end note
```

### Tipe Request

```mermaid
stateDiagram-v2
    state "Request Types" as types {
        [*] --> TaskEditRequest
        [*] --> ProjectEditRequest
        [*] --> UnitKerjaChangeRequest
        
        TaskEditRequest : Perubahan task Gantt
        ProjectEditRequest : Perubahan data proyek
        UnitKerjaChangeRequest : Perubahan unit kerja user
    }
```

## 4. Lifecycle Proyek (Project Stage)

```mermaid
stateDiagram-v2
    [*] --> planning : Project approved
    
    planning --> execution : Planning selesai
    execution --> evaluation : Execution selesai
    evaluation --> followup : Evaluation selesai
    followup --> [*] : Project closed
    
    state planning {
        [*] --> define_scope
        define_scope --> create_tasks
        create_tasks --> assign_resources
        assign_resources --> [*]
    }
    
    state execution {
        [*] --> work_on_tasks
        work_on_tasks --> submit_reports
        submit_reports --> update_progress
        update_progress --> work_on_tasks : Lanjut task
        update_progress --> [*] : Semua task done
    }
    
    state evaluation {
        [*] --> review_results
        review_results --> document_lessons
        document_lessons --> [*]
    }
    
    state followup {
        [*] --> implement_improvements
        implement_improvements --> close_project
        close_project --> [*]
    }
```

### Penjelasan Stage Proyek

| Stage | Deskripsi | Aktivitas Utama |
|-------|-----------|-----------------|
| `planning` | Perencanaan | Define scope, create tasks, assign resources |
| `execution` | Pelaksanaan | Work on tasks, submit daily reports |
| `evaluation` | Evaluasi | Review results, document lessons learned |
| `followup` | Tindak Lanjut | Implement improvements, close project |

## 5. Status Notifikasi

```mermaid
stateDiagram-v2
    [*] --> created : Notification sent
    
    created --> unread : Delivered to user
    unread --> read : User clicks notification
    read --> [*] : Archived
    
    note right of unread
        Tampil di badge
        notification count
    end note
    
    note right of read
        Sudah dibaca
        tidak tampil di badge
    end note
```

## 6. User Profile Completion

```mermaid
stateDiagram-v2
    [*] --> incomplete : User register
    
    incomplete --> select_unit : Fill profile form
    
    select_unit --> completed : Submit profile
    
    completed --> unit_change_pending : Request unit change
    
    unit_change_pending --> completed : Request approved
    unit_change_pending --> completed : Request rejected
    
    completed --> [*]
    
    note right of incomplete
        profile_completed: false
        Redirect ke Edit Profile
    end note
    
    note right of completed
        profile_completed: true
        Akses penuh ke sistem
    end note
    
    note right of unit_change_pending
        Unit kerja locked
        Menunggu approval
    end note
```

## 7. Daily Report to Progress

```mermaid
stateDiagram-v2
    [*] --> no_reports : Task created
    
    no_reports --> has_reports : First report submitted
    
    has_reports --> ai_calculating : Report triggers AI
    
    ai_calculating --> progress_updated : AI returns progress
    
    progress_updated --> has_reports : More reports
    progress_updated --> task_complete : Progress 100%
    
    task_complete --> [*]
    
    state ai_calculating {
        [*] --> fetch_history
        fetch_history --> analyze
        analyze --> calculate
        calculate --> [*]
    }
```
