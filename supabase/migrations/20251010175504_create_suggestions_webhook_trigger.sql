/*
  # Create Database Webhook Trigger for Suggestions

  1. Purpose
    - Automatically trigger the notify-new-suggestion Edge Function when a new suggestion is inserted
    - This enables real-time email notifications via Resend

  2. Implementation
    - Create a trigger function that calls the Edge Function via HTTP
    - Attach the trigger to INSERT events on 0008-ap-suggestions table
    - Send the full row data as JSON payload

  3. Security
    - Uses pg_net extension for HTTP requests
    - Includes service role authentication
    - Handles errors gracefully without blocking the insert operation
*/

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create function to call the Edge Function webhook
CREATE OR REPLACE FUNCTION notify_new_suggestion()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url text;
  payload jsonb;
  request_id bigint;
BEGIN
  -- Construct the webhook URL from environment
  webhook_url := current_setting('app.supabase_url', true) || '/functions/v1/notify-new-suggestion';

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
  SELECT INTO request_id net.http_post(
    url := webhook_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
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

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_notify_new_suggestion ON "0008-ap-suggestions";

-- Create trigger on INSERT
CREATE TRIGGER trigger_notify_new_suggestion
  AFTER INSERT ON "0008-ap-suggestions"
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_suggestion();

-- Set runtime config for the webhook URL (this needs to be updated with your actual values)
-- Note: These settings should be configured in Supabase Dashboard > Project Settings > Database > Config
-- ALTER DATABASE postgres SET app.supabase_url = 'https://wyipyiahvjcvnwoxwttd.supabase.co';
-- ALTER DATABASE postgres SET app.service_role_key = 'your-service-role-key-here';

COMMENT ON FUNCTION notify_new_suggestion() IS 'Triggers Edge Function to send email notification when a new suggestion is created';