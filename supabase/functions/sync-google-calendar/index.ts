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
    const url = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(calendarId)}`;
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

    console.log(`[sync-gcal] GOOGLE_CALENDAR_ID = "${calendarId}"`);
    console.log(`[sync-gcal] Service account email = "${JSON.parse(serviceAccountJson).client_email}"`);

    const serviceAccount: ServiceAccountKey = JSON.parse(serviceAccountJson);
    let accessToken: string;
    try {
      accessToken = await getAccessToken(serviceAccount);
      console.log('[sync-gcal] Access token obtained successfully (length=' + accessToken.length + ')');
    } catch (tokenErr) {
      console.error('[sync-gcal] Failed to get access token:', tokenErr);
      throw new Error(`Failed to get Google access token: ${tokenErr.message}`);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const appUrl = Deno.env.get('APP_URL') || 'https://simapros.my.id';
    const calendarApi = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
    console.log(`[sync-gcal] Calendar API URL = ${calendarApi}`);

    // ========================================================
    // STEP 1: Clean slate — delete ALL events from Google Calendar
    // ========================================================
    console.log('[sync-gcal] Step 1: Deleting ALL existing events from Google Calendar (clean slate)...');

    let cleaned = 0;
    const cleanupErrors: string[] = [];

    try {
      // List all events from Google Calendar (paginated)
      let pageToken: string | undefined;
      do {
        const listUrl = pageToken
          ? `${calendarApi}?maxResults=2500&pageToken=${pageToken}`
          : `${calendarApi}?maxResults=2500`;
        const listRes = await fetch(listUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!listRes.ok) {
          const errText = await listRes.text();
          console.error('[sync-gcal] Failed to list events:', errText);
          cleanupErrors.push(`List events failed: ${listRes.status}`);
          break;
        }

        const listData = await listRes.json();
        const events = listData.items || [];
        console.log(`[sync-gcal] Found ${events.length} events to delete in this page.`);

        for (const event of events) {
          try {
            const delRes = await fetch(`${calendarApi}/${event.id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (delRes.ok || delRes.status === 404 || delRes.status === 410) {
              cleaned++;
              console.log(`[sync-gcal] Deleted event: "${event.summary}" (${event.id})`);
            } else {
              const errText = await delRes.text();
              console.error(`[sync-gcal] Failed to delete event ${event.id}:`, errText);
              cleanupErrors.push(`Event "${event.summary}": ${delRes.status}`);
            }
          } catch (e) {
            console.error(`[sync-gcal] Error deleting event ${event.id}:`, e);
            cleanupErrors.push(`Event "${event.summary}": ${e.message}`);
          }
        }

        pageToken = listData.nextPageToken;
      } while (pageToken);

      // Clear all google_calendar_event_id from both tables so meetings get re-created fresh
      await supabase.from('projects').update({ google_calendar_event_id: null }).not('google_calendar_event_id', 'is', null);
      await supabase.from('meetings').update({ google_calendar_event_id: null }).not('google_calendar_event_id', 'is', null);
      console.log('[sync-gcal] Cleared all google_calendar_event_id from projects and meetings tables.');
    } catch (e) {
      console.error('[sync-gcal] Error during cleanup:', e);
      cleanupErrors.push(`Cleanup error: ${e.message}`);
    }

    console.log(`[sync-gcal] Clean slate done. Deleted ${cleaned} events from Google Calendar.`);

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
          console.log(`[sync-gcal] Google API response for "${meeting.title}": status=${res.status}, eventId=${eventData.id}, htmlLink=${eventData.htmlLink}`);
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
