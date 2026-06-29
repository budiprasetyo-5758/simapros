import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const EXPORT_DIR = 'supabase/data-export';
const OUTPUT_FILE = 'supabase/import_data.sql';

const tablesOrder = [
  'unit_kerja',
  'master_proyek',
  'pic_options',
  'profiles',
  'user_roles',
  'projects',
  'gantt_tasks',
  'meetings',
  'project_assignments',
  'project_unit_kerja_assignments',
  'project_documents',
  'project_obstacles',
  'notification_preferences',
  'followup_meetings',
  'daily_reports',
  'meeting_todos',
  'gantt_task_edit_requests',
  'project_edit_requests',
  'project_update_requests',
  'project_update_logs',
  'followup_tasks',
  'followup_files',
  'unit_kerja_change_requests',
  'notifications'
];

function escapeSql(val) {
  if (val === null || val === undefined || val === '') return 'NULL';
  if (val.toLowerCase() === 'true') return 'true';
  if (val.toLowerCase() === 'false') return 'false';
  let escaped = val.replace(/'/g, "''");
  return `'${escaped}'`;
}

function generateInserts(tableName, records, isProfile = false) {
  if (records.length === 0) return '';
  const headers = Object.keys(records[0]);
  let sql = `\n-- Table: ${tableName}\n`;
  
  sql += `INSERT INTO public.${tableName} (${headers.map(h => `"${h}"`).join(', ')}) VALUES\n`;

  const values = records.map(record => {
    const vals = headers.map(h => {
      if (tableName === 'meetings' && h === 'description' && record[h] === '') {
        return "''";
      }
      return escapeSql(record[h]);
    });
    return `(${vals.join(', ')})`;
  });

  sql += values.join(',\n');
  
  if (isProfile) {
    const updates = headers.filter(h => h !== 'id').map(h => `"${h}" = EXCLUDED."${h}"`).join(', ');
    sql += `\nON CONFLICT (id) DO UPDATE SET ${updates};\n`;
  } else {
    if (headers.includes('id')) {
        sql += `\nON CONFLICT (id) DO NOTHING;\n`;
    } else {
        sql += `;\n`;
    }
  }
  return sql;
}

let sqlOut = `-- SIMAPROS Data Import SQL\nBEGIN;\n\n-- Disable triggers and foreign key checks for bulk import\nSET session_replication_role = replica;\n\n-- Clear seed data from migrations to avoid unique constraint violations\nDELETE FROM public.pic_options;\nDELETE FROM public.master_proyek;\nDELETE FROM public.unit_kerja;\n\n`;
const files = fs.readdirSync(EXPORT_DIR);

// Process tables in strictly correct dependency order
for (const table of tablesOrder) {
  if (table === 'profiles') {
    // Process profiles -> generate auth.users and public.profiles
    const profileFile = files.find(f => f.startsWith('profiles-export-'));
    if (profileFile) {
      console.log(`Processing profiles...`);
      const content = fs.readFileSync(path.join(EXPORT_DIR, profileFile), 'utf8');
      const records = parse(content, {
        columns: true,
        delimiter: ';',
        skip_empty_lines: true
      });

      // Generate auth.users records
      const authUsersRecords = records.map(r => ({
        instance_id: '00000000-0000-0000-0000-000000000000',
        id: r.id,
        aud: 'authenticated',
        role: 'authenticated',
        email: r.email || `${r.id}@placeholder.com`,
        encrypted_password: "crypt('Simapros2026!', gen_salt('bf'))",
        email_confirmed_at: r.created_at || new Date().toISOString(),
        confirmation_token: '',
        recovery_token: '',
        email_change_token_new: '',
        email_change: '',
        phone_change: '',
        phone_change_token: '',
        email_change_token_current: '',
        email_change_confirm_status: '0',
        reauthentication_token: '',
        raw_app_meta_data: '{"provider":"email","providers":["email"]}',
        raw_user_meta_data: JSON.stringify({ name: r.name }),
        created_at: r.created_at || new Date().toISOString(),
        updated_at: r.updated_at || new Date().toISOString(),
        is_super_admin: 'false',
        is_sso_user: 'false',
        is_anonymous: 'false'
      }));
      
      const authHeaders = Object.keys(authUsersRecords[0]);
      const authEmptyStringColumns = new Set([
        'confirmation_token',
        'recovery_token',
        'email_change_token_new',
        'email_change',
        'phone_change',
        'phone_change_token',
        'email_change_token_current',
        'reauthentication_token',
      ]);
      const authRawColumns = new Set([
        'encrypted_password',
        'email_change_confirm_status',
        'is_super_admin',
        'is_sso_user',
        'is_anonymous',
      ]);
      let authSql = `\n-- Table: auth.users\nINSERT INTO auth.users (${authHeaders.map(h => `"${h}"`).join(', ')}) VALUES\n`;
      const authValues = authUsersRecords.map(r => {
        const vals = authHeaders.map(h => {
            if (authEmptyStringColumns.has(h)) return "''";
            if (authRawColumns.has(h)) return r[h]; // don't quote raw SQL values
            return escapeSql(r[h]);
        });
        return `(${vals.join(', ')})`;
      });
      authSql += authValues.join(',\n') + `\nON CONFLICT (id) DO NOTHING;\n`;
      
      sqlOut += authSql;

      const identitiesRecords = records
        .filter(r => r.email)
        .map(r => ({
          id: 'gen_random_uuid()',
          user_id: r.id,
          provider_id: r.id,
          provider: 'email',
          identity_data: JSON.stringify({
            sub: r.id,
            email: r.email,
            email_verified: true,
            phone_verified: false,
          }),
          last_sign_in_at: null,
          created_at: r.created_at || new Date().toISOString(),
          updated_at: r.updated_at || new Date().toISOString(),
        }));

      if (identitiesRecords.length > 0) {
        const identityHeaders = Object.keys(identitiesRecords[0]);
        let identitySql = `\n-- Table: auth.identities\nINSERT INTO auth.identities (${identityHeaders.map(h => `"${h}"`).join(', ')}) VALUES\n`;
        const identityValues = identitiesRecords.map(r => {
          const vals = identityHeaders.map(h => {
            if (h === 'id') return r[h];
            return escapeSql(r[h]);
          });
          return `(${vals.join(', ')})`;
        });
        identitySql += identityValues.join(',\n') + `\nON CONFLICT (provider, provider_id) DO NOTHING;\n`;

        sqlOut += identitySql;
      }

      // Generate public.profiles records
      sqlOut += generateInserts('profiles', records, true);
    }
  } else {
    const file = files.find(f => f.startsWith(`${table}-export-`));
    if (file) {
      console.log(`Processing ${table}...`);
      const content = fs.readFileSync(path.join(EXPORT_DIR, file), 'utf8');
      const records = parse(content, {
        columns: true,
        delimiter: ';',
        skip_empty_lines: true
      });
      
      if (table === 'user_roles') {
        sqlOut += `\n-- Clear auto-generated roles to avoid unique constraint violations\nDELETE FROM public.user_roles;\n`;
      }
      
      sqlOut += generateInserts(table, records);
    } else {
      console.warn(`Warning: Could not find export file for table ${table}`);
    }
  }
}

sqlOut += `\n-- Re-enable triggers and foreign key checks\nSET session_replication_role = DEFAULT;\n\nCOMMIT;\n`;
fs.writeFileSync(OUTPUT_FILE, sqlOut);
console.log(`\nGenerated SQL script successfully at: ${OUTPUT_FILE}`);
console.log(`File size: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(2)} KB`);
