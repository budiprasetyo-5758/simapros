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

    // Fetch approved/active projects with dates
    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, title, description, project_stage, priority, start_date, end_date, google_calendar_event_id')
      .in('status', ['approved', 'active'])
      .not('start_date', 'is', null)
      .not('end_date', 'is', null);

    if (error) throw error;

    const calendarApi = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
    let synced = 0;

    for (const project of (projects || [])) {
      const stageLabels: Record<string, string> = {
        planning: 'Planning', execution: 'Execution',
        evaluation: 'Evaluation', followup: 'Follow-up',
      };

      const eventBody = {
        summary: project.title,
        description: [
          `Status: ${stageLabels[project.project_stage] || project.project_stage}`,
          `Priority: ${project.priority}`,
          '',
          `Lihat detail: ${appUrl}/project/${project.id}`,
        ].join('\n'),
        start: { date: project.start_date },
        end: { date: project.end_date },
      };

      let res: Response;
      if (project.google_calendar_event_id) {
        // Update existing event
        res = await fetch(`${calendarApi}/${project.google_calendar_event_id}`, {
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
        if (!project.google_calendar_event_id && eventData.id) {
          await supabase
            .from('projects')
            .update({ google_calendar_event_id: eventData.id })
            .eq('id', project.id);
        }
        synced++;
      } else {
        const errText = await res.text();
        console.error(`Failed to sync project ${project.id}:`, errText);
      }
    }

    return new Response(JSON.stringify({ synced, total: projects?.length || 0 }), {
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
