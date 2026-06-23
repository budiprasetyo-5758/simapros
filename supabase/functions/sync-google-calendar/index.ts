import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri: string;
}

async function getAccessToken(serviceAccount: ServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: serviceAccount.token_uri,
    exp: now + 3600,
    iat: now,
  }));

  const textEncoder = new TextEncoder();
  const signingInput = `${header}.${payload}`;

  // Import private key
  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\n/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    textEncoder.encode(signingInput)
  );

  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  
  const jwt = `${header}.${payload}.${base64Signature}`;

  // Exchange JWT for access token
  const tokenRes = await fetch(serviceAccount.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // GET = return calendar URL
  if (req.method === 'GET') {
    const calendarId = Deno.env.get('GOOGLE_CALENDAR_ID');
    if (!calendarId) {
      return new Response(JSON.stringify({ error: 'GOOGLE_CALENDAR_ID not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const url = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(calendarId)}`;
    return new Response(JSON.stringify({ url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
    const calendarId = Deno.env.get('GOOGLE_CALENDAR_ID');
    
    if (!serviceAccountJson || !calendarId) {
      throw new Error('Google Calendar credentials not configured. Please add GOOGLE_SERVICE_ACCOUNT_KEY and GOOGLE_CALENDAR_ID secrets.');
    }

    const serviceAccount: ServiceAccountKey = JSON.parse(serviceAccountJson);
    const accessToken = await getAccessToken(serviceAccount);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const appUrl = Deno.env.get('APP_URL') || 'https://simapros.my.id';
    const calendarApi = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

    // ========================================================
    // STEP 1: Cleanup old project events from Google Calendar
    // ========================================================
    console.log('[sync-gcal] Step 1: Cleaning up old project events...');

    const { data: projectsWithEvents } = await supabase
      .from('projects')
      .select('id, title, google_calendar_event_id')
      .not('google_calendar_event_id', 'is', null);

    let cleaned = 0;
    const cleanupErrors: string[] = [];

    for (const project of (projectsWithEvents || [])) {
      try {
        const delRes = await fetch(
          `${calendarApi}/${project.google_calendar_event_id}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        // 200/204 = deleted, 404/410 = already gone — all are fine
        if (delRes.ok || delRes.status === 404 || delRes.status === 410) {
          await supabase
            .from('projects')
            .update({ google_calendar_event_id: null })
            .eq('id', project.id);
          cleaned++;
          console.log(`[sync-gcal] Cleaned project event: ${project.title} (${project.id})`);
        } else {
          const errText = await delRes.text();
          console.error(`[sync-gcal] Failed to cleanup project ${project.id}:`, errText);
          cleanupErrors.push(`Project "${project.title}": ${delRes.status}`);
        }
      } catch (e) {
        console.error(`[sync-gcal] Error cleaning project ${project.id}:`, e);
        cleanupErrors.push(`Project "${project.title}": ${e.message}`);
      }
    }

    console.log(`[sync-gcal] Cleanup done. Removed ${cleaned} project events.`);

    // ========================================================
    // STEP 2: Sync meetings to Google Calendar
    // ========================================================
    console.log('[sync-gcal] Step 2: Syncing meetings...');

    const { data: meetings, error } = await supabase
      .from('meetings')
      .select('id, title, description, meeting_date, meeting_time, project_id, google_calendar_event_id')
      .not('meeting_date', 'is', null);

    if (error) throw error;

    let synced = 0;
    const syncErrors: string[] = [];

    for (const meeting of (meetings || [])) {
      try {
        let start, end;
        
        if (meeting.meeting_time) {
          // Timed event — use Asia/Jakarta timezone
          const timeStr = meeting.meeting_time.slice(0, 8); // Ensure HH:MM:SS format
          const dateTimeStr = `${meeting.meeting_date}T${timeStr}+07:00`;
          start = { dateTime: dateTimeStr, timeZone: 'Asia/Jakarta' };
          
          // End time = start + 1 hour
          const startMs = new Date(dateTimeStr).getTime();
          const endMs = startMs + 60 * 60 * 1000;
          const endDate = new Date(endMs);
          
          // Format end time in +07:00
          const endHours = String(endDate.getUTCHours() + 7).padStart(2, '0');
          const endMins = String(endDate.getUTCMinutes()).padStart(2, '0');
          const endSecs = String(endDate.getUTCSeconds()).padStart(2, '0');
          // Use ISO string with timeZone parameter — Google handles the conversion
          end = { dateTime: endDate.toISOString(), timeZone: 'Asia/Jakarta' };
        } else {
          // All-day event
          start = { date: meeting.meeting_date };
          
          // End date is exclusive in Google Calendar, so add 1 day
          const nextDay = new Date(new Date(meeting.meeting_date + 'T00:00:00Z').getTime() + 24 * 60 * 60 * 1000);
          end = { date: nextDay.toISOString().split('T')[0] };
        }

        // Fetch project title if linked
        let projectName = '';
        if (meeting.project_id) {
          const { data: proj } = await supabase
            .from('projects')
            .select('title')
            .eq('id', meeting.project_id)
            .single();
          projectName = proj?.title || '';
        }

        const eventBody = {
          summary: `Meeting: ${meeting.title}`,
          description: [
            meeting.description || '',
            '',
            projectName ? `Proyek: ${projectName}` : '',
            `Lihat detail: ${appUrl}/timeline`,
          ].filter(Boolean).join('\n'),
          start,
          end,
        };

        let res: Response;
        if (meeting.google_calendar_event_id) {
          // Try to update existing event
          res = await fetch(`${calendarApi}/${meeting.google_calendar_event_id}`, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(eventBody),
          });

          // If event no longer exists (404/410), create a new one instead
          if (res.status === 404 || res.status === 410) {
            console.log(`[sync-gcal] Event for meeting "${meeting.title}" not found, creating new...`);
            // Clear old ID
            await supabase
              .from('meetings')
              .update({ google_calendar_event_id: null })
              .eq('id', meeting.id);
            
            // Create new event
            res = await fetch(calendarApi, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(eventBody),
            });
          }
        } else {
          // Create new event
          res = await fetch(calendarApi, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(eventBody),
          });
        }

        if (res.ok) {
          const eventData = await res.json();
          // Save/update the Google Calendar event ID
          if (eventData.id) {
            await supabase
              .from('meetings')
              .update({ google_calendar_event_id: eventData.id })
              .eq('id', meeting.id);
          }
          synced++;
          console.log(`[sync-gcal] Synced meeting: "${meeting.title}" (${meeting.meeting_date})`);
        } else {
          const errText = await res.text();
          console.error(`[sync-gcal] Failed to sync meeting "${meeting.title}" (${meeting.id}):`, errText);
          syncErrors.push(`"${meeting.title}" (${meeting.meeting_date}): ${res.status}`);
        }
      } catch (e) {
        console.error(`[sync-gcal] Error syncing meeting "${meeting.title}" (${meeting.id}):`, e);
        syncErrors.push(`"${meeting.title}": ${e.message}`);
      }
    }

    console.log(`[sync-gcal] Sync done. Synced ${synced}/${meetings?.length || 0} meetings.`);

    return new Response(JSON.stringify({
      synced,
      total: meetings?.length || 0,
      cleaned,
      cleanupErrors: cleanupErrors.length > 0 ? cleanupErrors : undefined,
      syncErrors: syncErrors.length > 0 ? syncErrors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[sync-gcal] Fatal error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
