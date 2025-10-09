import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

    // Create Supabase client with service role key for admin operations
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all active users
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
    }

    const results: any[] = [];
    let successCount = 0;
    let errorCount = 0;

    // For each user, call the create_weekly_reflection_for_user function
    for (const user of users) {
      try {
        const { data, error } = await supabase.rpc('create_weekly_reflection_for_user', {
          p_user_id: user.id
        });

        if (error) {
          console.error(`Error creating reflection for user ${user.id}:`, error);
          errorCount++;
          results.push({
            user_id: user.id,
            success: false,
            error: error.message,
          });
        } else {
          successCount++;
          results.push({
            user_id: user.id,
            success: true,
            reflection_id: data,
          });
        }
      } catch (err) {
        console.error(`Exception creating reflection for user ${user.id}:`, err);
        errorCount++;
        results.push({
          user_id: user.id,
          success: false,
          error: String(err),
        });
      }
    }

    const responseData = {
      message: 'Weekly reflections creation completed',
      total_users: users.length,
      success_count: successCount,
      error_count: errorCount,
      timestamp: new Date().toISOString(),
      details: results,
    };

    console.log('Weekly reflections creation summary:', responseData);

    return new Response(
      JSON.stringify(responseData),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Fatal error in create-weekly-reflections:', error);

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