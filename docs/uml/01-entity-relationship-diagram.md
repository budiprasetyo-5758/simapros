# Entity Relationship Diagram (ERD)

Diagram ini menggambarkan struktur database SIMAPROS dan relasi antar tabel.

## Diagram

```mermaid
erDiagram
    profiles {
        uuid id PK
        string name
        string email
        string whatsapp
        string gmail
        uuid unit_kerja_id FK
        boolean profile_completed
        timestamp created_at
        timestamp updated_at
    }
    
    user_roles {
        uuid id PK
        uuid user_id FK
        enum role "admin|user|super_admin|project_executor"
    }
    
    unit_kerja {
        uuid id PK
        string name
        string description
        timestamp created_at
        timestamp updated_at
    }
    
    master_proyek {
        uuid id PK
        string name
        string description
        timestamp created_at
        timestamp updated_at
    }
    
    projects {
        uuid id PK
        string title
        string description
        string unit
        uuid requester_id FK
        string requester_name
        enum status "pending|approved|rejected|revision|active|pending_creation"
        enum priority "low|medium|high|urgent"
        string impact
        string urgency
        string admin_note
        enum project_stage "planning|execution|evaluation|followup"
        json stage_notes
        date start_date
        date end_date
        uuid master_proyek_id FK
        string attachment_url
        boolean update_requested
        timestamp created_at
        timestamp updated_at
    }
    
    gantt_tasks {
        uuid id PK
        uuid project_id FK
        string name
        string description
        string pic
        date start_date
        date end_date
        integer progress
        integer progress_override
        integer ai_progress
        string ai_progress_reasoning
        enum status "not_started|in_progress|completed|pending"
        string wbs_number
        string monev
        string phase
        uuid parent_task_id FK
        timestamp created_at
    }
    
    project_assignments {
        uuid id PK
        uuid project_id FK
        uuid user_id FK
        uuid assigned_by FK
        timestamp created_at
    }
    
    daily_reports {
        uuid id PK
        uuid project_id FK
        uuid task_id FK
        uuid reporter_id FK
        string description
        string achievements
        string challenges
        integer ai_calculated_progress
        string ai_reasoning
        string attachment_url
        date report_date
        timestamp created_at
        timestamp updated_at
    }
    
    notifications {
        uuid id PK
        uuid user_id FK
        string title
        string message
        string type
        string link
        json metadata
        boolean is_read
        timestamp created_at
    }
    
    notification_preferences {
        uuid id PK
        uuid user_id FK
        boolean email_proposal_approved
        boolean email_proposal_rejected
        boolean email_proposal_revision
        boolean email_deadline_warning
        boolean email_task_overdue
        boolean email_edit_request_approved
        boolean email_edit_request_rejected
        timestamp created_at
        timestamp updated_at
    }
    
    unit_kerja_change_requests {
        uuid id PK
        uuid user_id FK
        uuid current_unit_kerja_id FK
        uuid requested_unit_kerja_id FK
        string reason
        enum status "pending|approved|rejected"
        string admin_note
        uuid reviewed_by FK
        timestamp reviewed_at
        timestamp created_at
        timestamp updated_at
    }
    
    project_edit_requests {
        uuid id PK
        uuid project_id FK
        uuid requester_id FK
        string proposed_title
        string proposed_description
        date proposed_start_date
        date proposed_end_date
        enum status "pending|approved|rejected"
        string admin_note
        uuid reviewed_by FK
        timestamp reviewed_at
        timestamp created_at
        timestamp updated_at
    }
    
    gantt_task_edit_requests {
        uuid id PK
        uuid project_id FK
        uuid task_id FK
        uuid requester_id FK
        string proposed_name
        string proposed_description
        string proposed_pic
        date proposed_start_date
        date proposed_end_date
        integer proposed_progress
        string proposed_status
        string proposed_wbs_number
        string proposed_monev
        string proposed_phase
        boolean is_new_task
        boolean is_delete_request
        enum status "pending|approved|rejected"
        string admin_note
        uuid reviewed_by FK
        timestamp reviewed_at
        timestamp created_at
        timestamp updated_at
    }
    
    project_update_requests {
        uuid id PK
        uuid project_id FK
        uuid requester_id FK
        string request_type
        json pending_changes
        enum status "pending|approved|rejected"
        string admin_note
        uuid reviewed_by FK
        timestamp reviewed_at
        timestamp created_at
        timestamp updated_at
    }
    
    project_update_logs {
        uuid id PK
        uuid project_id FK
        uuid update_request_id FK
        uuid changed_by FK
        uuid approved_by FK
        string change_type
        json old_data
        json new_data
        timestamp created_at
    }

    %% Relationships
    profiles ||--o| unit_kerja : "belongs to"
    profiles ||--o{ user_roles : "has"
    profiles ||--o{ projects : "submits"
    profiles ||--o{ project_assignments : "assigned to"
    profiles ||--o{ notifications : "receives"
    profiles ||--o| notification_preferences : "has"
    profiles ||--o{ unit_kerja_change_requests : "requests"
    
    projects ||--o| master_proyek : "categorized by"
    projects ||--o{ gantt_tasks : "contains"
    projects ||--o{ project_assignments : "has"
    projects ||--o{ daily_reports : "has"
    projects ||--o{ project_edit_requests : "has"
    projects ||--o{ gantt_task_edit_requests : "has"
    projects ||--o{ project_update_requests : "has"
    projects ||--o{ project_update_logs : "has"
    
    gantt_tasks ||--o{ gantt_tasks : "parent of"
    gantt_tasks ||--o{ daily_reports : "has"
    gantt_tasks ||--o{ gantt_task_edit_requests : "has"
    
    unit_kerja ||--o{ unit_kerja_change_requests : "requested"
    
    project_update_requests ||--o{ project_update_logs : "logged in"
```

## Penjelasan Tabel

### Tabel Utama

| Tabel | Deskripsi |
|-------|-----------|
| `profiles` | Data profil pengguna |
| `user_roles` | Role pengguna (super_admin, project_executor, user) |
| `projects` | Data proyek |
| `gantt_tasks` | Task dalam proyek (Gantt chart) |

### Tabel Master Data

| Tabel | Deskripsi |
|-------|-----------|
| `unit_kerja` | Daftar unit kerja/departemen |
| `master_proyek` | Kategori proyek |

### Tabel Request & Approval

| Tabel | Deskripsi |
|-------|-----------|
| `unit_kerja_change_requests` | Permintaan perubahan unit kerja |
| `project_edit_requests` | Permintaan edit proyek |
| `gantt_task_edit_requests` | Permintaan edit task |
| `project_update_requests` | Permintaan update umum |
| `project_update_logs` | Log perubahan proyek |

### Tabel Pendukung

| Tabel | Deskripsi |
|-------|-----------|
| `project_assignments` | Penugasan user ke proyek |
| `daily_reports` | Laporan harian task |
| `notifications` | Notifikasi sistem |
| `notification_preferences` | Preferensi notifikasi user |

## Catatan Keamanan

- Semua tabel memiliki Row Level Security (RLS) aktif
- User hanya bisa mengakses data sesuai role dan assignment
- Super Admin memiliki akses penuh ke semua data
