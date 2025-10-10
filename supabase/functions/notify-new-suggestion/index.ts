import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WebhookPayload {
  type: string;
  table: string;
  record: {
    id: string;
    user_id: string;
    content: string;
    status: string;
    created_at: string;
  };
  schema: string;
  old_record: null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!;

    if (!resendApiKey) {
      console.error('RESEND_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const payload: WebhookPayload = await req.json();
    console.log('Received webhook payload:', JSON.stringify(payload, null, 2));

    if (payload.type !== 'INSERT' || payload.table !== '0008-ap-suggestions') {
      console.log('Ignoring non-INSERT event or wrong table');
      return new Response(
        JSON.stringify({ message: 'Event ignored' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: user, error: userError } = await supabase.auth.admin.getUserById(
      payload.record.user_id
    );

    if (userError || !user) {
      console.error('Error fetching user:', userError);
      throw new Error('Failed to fetch user details');
    }

    const userEmail = user.user.email || 'unknown@example.com';
    const userName = user.user.user_metadata?.full_name ||
                     user.user.user_metadata?.name ||
                     userEmail.split('@')[0];

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .container {
              background-color: #ffffff;
              border-radius: 8px;
              padding: 32px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .header {
              border-bottom: 3px solid #4F46E5;
              padding-bottom: 16px;
              margin-bottom: 24px;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              color: #4F46E5;
            }
            .meta {
              background-color: #f9fafb;
              border-left: 4px solid #4F46E5;
              padding: 16px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .meta-item {
              margin: 8px 0;
              font-size: 14px;
            }
            .meta-label {
              font-weight: 600;
              color: #4F46E5;
              display: inline-block;
              width: 120px;
            }
            .content {
              background-color: #fefefe;
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              padding: 20px;
              margin: 20px 0;
              white-space: pre-wrap;
              word-wrap: break-word;
              font-size: 15px;
              line-height: 1.8;
            }
            .footer {
              margin-top: 32px;
              padding-top: 16px;
              border-top: 1px solid #e5e7eb;
              font-size: 13px;
              color: #6b7280;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🌟 New User Suggestion</h1>
            </div>

            <div class="meta">
              <div class="meta-item">
                <span class="meta-label">From:</span>
                <span>${userName}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Email:</span>
                <span>${userEmail}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Submitted:</span>
                <span>${new Date(payload.record.created_at).toLocaleString('en-US', {
                  dateStyle: 'full',
                  timeStyle: 'short'
                })}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Suggestion ID:</span>
                <span>${payload.record.id}</span>
              </div>
            </div>

            <h2 style="color: #1f2937; font-size: 18px; margin: 24px 0 12px 0;">Suggestion Content:</h2>
            <div class="content">${payload.record.content}</div>

            <div class="footer">
              <p>This email was automatically generated by the Authentic Investments suggestion system.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Authentic Investments <onboarding@resend.dev>',
        to: ['cazbyu@gmail.com'],
        subject: `New Suggestion from ${userName} (${userEmail})`,
        html: emailHtml,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error('Resend API error:', resendResponse.status, errorText);
      throw new Error(`Resend API error: ${resendResponse.status} - ${errorText}`);
    }

    const resendData = await resendResponse.json();
    console.log('Email sent successfully:', resendData);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email notification sent',
        email_id: resendData.id,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Fatal error in notify-new-suggestion:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: String(error),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});