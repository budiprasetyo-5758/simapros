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

    // Fetch meetings
    const { data: meetings, error } = await supabase
      .from('meetings')
      .select('id, title, description, meeting_date, meeting_time, project_id, google_calendar_event_id')
      .not('meeting_date', 'is', null);

    if (error) throw error;

    const calendarApi = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
    let synced = 0;

    for (const meeting of (meetings || [])) {
      let start, end;
      
      if (meeting.meeting_time) {
        // Has specific time (assume Asia/Jakarta timezone +07:00)
        // Format: YYYY-MM-DDTHH:MM:SS+07:00
        const dateTimeStr = `${meeting.meeting_date}T${meeting.meeting_time}+07:00`;
        start = { dateTime: dateTimeStr, timeZone: 'Asia/Jakarta' };
        
        // Add 1 hour for end time
        const endDate = new Date(new Date(dateTimeStr).getTime() + 60 * 60 * 1000);
        // Format manually to preserve timezone
        const endIso = endDate.toISOString(); // e.g. 2023-10-15T03:00:00.000Z
        // Convert to local +0700 string format? 
        // Actually, Google Calendar accepts Z format as well, but it's easier to just pass the Date object string and let Google handle it.
        // Wait, passing it as ISO string with timeZone will work:
        end = { dateTime: endDate.toISOString(), timeZone: 'Asia/Jakarta' };
      } else {
        // All-day event
        start = { date: meeting.meeting_date };
        
        // End date is exclusive in Google Calendar, so add 1 day
        const nextDay = new Date(new Date(meeting.meeting_date).getTime() + 24 * 60 * 60 * 1000);
        end = { date: nextDay.toISOString().split('T')[0] };
      }

      const eventBody = {
        summary: `Meeting: ${meeting.title}`,
        description: [
          meeting.description || '',
          '',
          meeting.project_id ? `Project ID: ${meeting.project_id}` : '',
          `Link: ${appUrl}/timeline`,
        ].filter(Boolean).join('\n'),
        start,
        end,
      };

      let res: Response;
      if (meeting.google_calendar_event_id) {
        // Update existing event
        res = await fetch(`${calendarApi}/${meeting.google_calendar_event_id}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventBody),
        });
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
        if (!meeting.google_calendar_event_id && eventData.id) {
          await supabase
            .from('meetings')
            .update({ google_calendar_event_id: eventData.id })
            .eq('id', meeting.id);
        }
        synced++;
      } else {
        const errText = await res.text();
        console.error(`Failed to sync meeting ${meeting.id}:`, errText);
      }
    }

    return new Response(JSON.stringify({ synced, total: meetings?.length || 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Sync error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
