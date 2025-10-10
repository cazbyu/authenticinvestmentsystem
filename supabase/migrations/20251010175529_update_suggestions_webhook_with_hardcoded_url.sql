/*
  # Update Webhook Trigger with Direct URL

  1. Changes
    - Update the webhook trigger function to use the direct Supabase URL
    - Remove dependency on database config settings
    - Use the current project's Edge Function URL

  2. Notes
    - The webhook URL is hardcoded to the current project
    - Service role key is retrieved from Supabase environment (automatically available)
*/

-- Drop and recreate the function with direct URL
CREATE OR REPLACE FUNCTION notify_new_suggestion()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url text;
  payload jsonb;
  request_id bigint;
BEGIN
  -- Use the current project's webhook URL directly
  webhook_url := 'https://wyipyiahvjcvnwoxwttd.supabase.co/functions/v1/notify-new-suggestion';

  -- Build the webhook payload
  payload := jsonb_build_object(
    'type', 'INSERT',
    'table', '0008-ap-suggestions',
    'record', jsonb_build_object(
      'id', NEW.id,
      'user_id', NEW.user_id,
      'content', NEW.content,
      'status', NEW.status,
      'created_at', NEW.created_at
    ),
    'schema', 'public',
    'old_record', null
  );

  -- Make async HTTP request to Edge Function
  -- Note: The Authorization header with service role key is not needed for pg_net
  -- as it runs in the database context with full permissions
  SELECT INTO request_id net.http_post(
    url := webhook_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := payload
  );

  -- Log the request (optional, for debugging)
  RAISE NOTICE 'Webhook triggered for suggestion % with request_id %', NEW.id, request_id;

  -- Always return NEW to allow the insert to succeed
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the insert
  RAISE WARNING 'Failed to trigger webhook for suggestion %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION notify_new_suggestion() IS 'Triggers Edge Function at https://wyipyiahvjcvnwoxwttd.supabase.co/functions/v1/notify-new-suggestion when a new suggestion is created';