# Component Diagram

Diagram ini menggambarkan arsitektur komponen sistem SIMAPROS.

## Arsitektur Sistem

```mermaid
graph TB
    subgraph "Client Layer"
        Browser[Web Browser]
    end
    
    subgraph "Frontend - React/Vite"
        App[App.tsx]
        
        subgraph "Pages"
            Index[Index - Dashboard]
            Auth[Auth - Login/Register]
            Submit[SubmitProject]
            ProjectDetail[ProjectDetail]
            Approval[ApprovalQueue]
            Manage[ManageProjects]
            Users[UserManagement]
            Report[WeeklyReport]
            Profile[EditProfile]
            MasterData[Master Data Pages]
        end
        
        subgraph "Components"
            Layout[SimpleLayout]
            Dialogs[Dialog Components]
            Cards[Card Components]
            Forms[Form Components]
            Gantt[SpreadsheetGantt]
        end
        
        subgraph "Hooks"
            useAuth[useAuth]
            useProjects[useProjects]
            useUsers[useUsers]
            useNotifications[useNotifications]
            useProfile[useProfile]
        end
        
        subgraph "UI Library"
            Shadcn[shadcn/ui Components]
            Tailwind[Tailwind CSS]
        end
    end
    
    subgraph "Backend - Lovable Cloud"
        subgraph "Supabase Core"
            AuthService[Auth Service]
            Database[(PostgreSQL)]
            Storage[Storage]
            Realtime[Realtime]
        end
        
        subgraph "Edge Functions"
            GenTasks[generate-task-suggestions]
            GenReport[generate-weekly-report]
            CalcProgress[calculate-task-progress]
            CheckDeadlines[check-deadlines]
            SendNotif[send-notification]
        end
        
        subgraph "Security"
            RLS[Row Level Security]
            Policies[RLS Policies]
        end
    end
    
    subgraph "External Services"
        AI[Lovable AI Gateway]
    end
    
    Browser --> App
    App --> Layout
    Layout --> Pages
    Pages --> Components
    Pages --> Hooks
    Components --> Shadcn
    Hooks --> Database
    Hooks --> AuthService
    
    Database --> RLS
    RLS --> Policies
    
    GenTasks --> AI
    GenReport --> AI
    CalcProgress --> AI
```

## Frontend Component Details

```mermaid
graph TB
    subgraph "App Entry"
        Main[main.tsx]
        App[App.tsx]
        Router[React Router]
    end
    
    subgraph "Providers"
        QueryClient[QueryClientProvider]
        AuthProvider[AuthProvider]
        TooltipProvider[TooltipProvider]
        Toaster[Toaster/Sonner]
    end
    
    subgraph "Layout Components"
        SimpleLayout[SimpleLayout]
        Sidebar[Sidebar]
        Header[Header]
        NotifDropdown[NotificationDropdown]
    end
    
    subgraph "Page Components"
        subgraph "Public"
            AuthPage[Auth]
        end
        
        subgraph "User Pages"
            Dashboard[Index/Dashboard]
            SubmitProject[SubmitProject]
            EditProfile[EditProfile]
            NotifSettings[NotificationSettings]
        end
        
        subgraph "Executor Pages"
            ProjectDetail[ProjectDetail]
            GanttFull[GanttFullscreen]
        end
        
        subgraph "Admin Pages"
            ApprovalQueue[ApprovalQueue]
            ManageProjects[ManageProjects]
            EditRequests[EditRequestsQueue]
            UserMgmt[UserManagement]
            WeeklyReport[WeeklyReport]
            UnitKerjaReq[UnitKerjaRequests]
        end
        
        subgraph "Master Data"
            MasterKategori[MasterKategoriProyek]
            MasterUnit[MasterUnitKerja]
        end
    end
    
    Main --> App
    App --> QueryClient
    QueryClient --> AuthProvider
    AuthProvider --> TooltipProvider
    TooltipProvider --> Router
    Router --> SimpleLayout
    SimpleLayout --> Sidebar
    SimpleLayout --> Header
    Header --> NotifDropdown
```

## Backend Component Details

```mermaid
graph TB
    subgraph "Supabase Client"
        Client[supabase/client.ts]
    end
    
    subgraph "Database Tables"
        profiles[(profiles)]
        user_roles[(user_roles)]
        projects[(projects)]
        gantt_tasks[(gantt_tasks)]
        daily_reports[(daily_reports)]
        notifications[(notifications)]
        unit_kerja[(unit_kerja)]
        master_proyek[(master_proyek)]
        
        subgraph "Request Tables"
            task_edit_req[(gantt_task_edit_requests)]
            project_edit_req[(project_edit_requests)]
            unit_change_req[(unit_kerja_change_requests)]
            update_req[(project_update_requests)]
        end
        
        subgraph "Log Tables"
            update_logs[(project_update_logs)]
        end
        
        subgraph "Preference Tables"
            notif_prefs[(notification_preferences)]
            project_assign[(project_assignments)]
        end
    end
    
    subgraph "Edge Functions"
        subgraph "AI Functions"
            GenTasks[generate-task-suggestions]
            GenReport[generate-weekly-report]
            CalcProgress[calculate-task-progress]
        end
        
        subgraph "Utility Functions"
            CheckDeadlines[check-deadlines]
            SendNotif[send-notification]
            SendProjectNotif[send-project-notification]
        end
    end
    
    subgraph "External"
        LovableAI[Lovable AI Gateway]
    end
    
    Client --> profiles
    Client --> projects
    Client --> gantt_tasks
    
    GenTasks --> LovableAI
    GenReport --> LovableAI
    CalcProgress --> LovableAI
```

## Data Flow

```mermaid
flowchart LR
    subgraph Frontend
        UI[User Interface]
        Hooks[React Hooks]
        State[React Query State]
    end
    
    subgraph "Lovable Cloud"
        Auth[Auth Service]
        DB[(PostgreSQL)]
        RLS{RLS Policies}
        Edge[Edge Functions]
    end
    
    subgraph External
        AI[AI Gateway]
    end
    
    UI -->|User Action| Hooks
    Hooks -->|Supabase SDK| Auth
    Hooks -->|Query/Mutation| DB
    DB -->|Check| RLS
    RLS -->|Allow/Deny| DB
    DB -->|Response| Hooks
    Hooks -->|Cache| State
    State -->|Render| UI
    
    Edge -->|API Call| AI
    AI -->|Response| Edge
    Edge -->|Update| DB
```

## Security Architecture

```mermaid
graph TB
    subgraph "Client"
        User[User Browser]
        Token[JWT Token]
    end
    
    subgraph "Auth Layer"
        AuthService[Auth Service]
        Session[Session Management]
    end
    
    subgraph "API Layer"
        API[Supabase API]
        RLS[Row Level Security]
    end
    
    subgraph "Policies"
        UserPolicy[User Policies]
        ExecutorPolicy[Executor Policies]
        AdminPolicy[Admin Policies]
    end
    
    subgraph "Database"
        Tables[(Database Tables)]
    end
    
    User -->|Login| AuthService
    AuthService -->|Issue| Token
    Token -->|Include in Request| API
    API -->|Validate| Session
    Session -->|Check Role| RLS
    RLS -->|Apply| UserPolicy
    RLS -->|Apply| ExecutorPolicy
    RLS -->|Apply| AdminPolicy
    
    UserPolicy -->|Filter| Tables
    ExecutorPolicy -->|Filter| Tables
    AdminPolicy -->|Full Access| Tables
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Lovable Platform"
        subgraph "Frontend"
            Vite[Vite Build]
            CDN[CDN Distribution]
        end
        
        subgraph "Backend - Lovable Cloud"
            Supabase[Supabase Instance]
            EdgeRuntime[Edge Runtime]
            PgDB[(PostgreSQL)]
            Storage[File Storage]
        end
    end
    
    subgraph "External Services"
        AIGateway[Lovable AI Gateway]
    end
    
    subgraph "Users"
        Browser[User Browsers]
    end
    
    Browser -->|HTTPS| CDN
    CDN -->|Serve| Vite
    Browser -->|API Calls| Supabase
    Supabase -->|Query| PgDB
    Supabase -->|Invoke| EdgeRuntime
    EdgeRuntime -->|Call| AIGateway
    Browser -->|Upload/Download| Storage
```
