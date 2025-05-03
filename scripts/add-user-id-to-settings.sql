-- Add user_id column to app_settings table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'app_settings' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE app_settings ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
        
        -- Add comment to the column
        COMMENT ON COLUMN app_settings.user_id IS 'The Supabase Auth user ID these settings belong to';
        
        -- Add index on user_id for faster lookups
        CREATE INDEX idx_app_settings_user_id ON app_settings(user_id);
        
        -- Add unique constraint to prevent multiple settings per user
        ALTER TABLE app_settings ADD CONSTRAINT unique_app_settings_user_id UNIQUE (user_id);
        
        -- For existing records with email, try to link them to user_id
        UPDATE app_settings AS s
        SET user_id = u.id
        FROM auth.users AS u
        WHERE s.email IS NOT NULL AND s.email = u.email;
    END IF;
END $$;

-- Ensure user_id is included in RLS policies (if you're using them)
DO $$ 
BEGIN
    -- If you have RLS enabled, update or create policies to consider user_id
    -- Example for a read policy:
    IF EXISTS (
        SELECT FROM pg_policies WHERE tablename = 'app_settings' AND policyname = 'app_settings_select_policy'
    ) THEN
        DROP POLICY IF EXISTS app_settings_select_policy ON app_settings;
        
        CREATE POLICY app_settings_select_policy ON app_settings
            FOR SELECT
            USING (
                -- Allow reading default settings and user's own settings
                id = 'default' OR 
                user_id = auth.uid() OR 
                email = (SELECT email FROM auth.users WHERE id = auth.uid())
            );
    END IF;
    
    -- Example for an update policy:
    IF EXISTS (
        SELECT FROM pg_policies WHERE tablename = 'app_settings' AND policyname = 'app_settings_update_policy'
    ) THEN
        DROP POLICY IF EXISTS app_settings_update_policy ON app_settings;
        
        CREATE POLICY app_settings_update_policy ON app_settings
            FOR UPDATE
            USING (
                -- Allow updating default settings or user's own settings
                id = 'default' OR 
                user_id = auth.uid() OR 
                email = (SELECT email FROM auth.users WHERE id = auth.uid())
            );
    END IF;
END $$;

-- Function to automatically set user_id when creating settings based on auth.uid()
CREATE OR REPLACE FUNCTION set_user_id_for_app_settings()
RETURNS TRIGGER AS $$
BEGIN
    -- Only set user_id if not explicitly provided
    IF NEW.user_id IS NULL AND auth.uid() IS NOT NULL THEN
        NEW.user_id := auth.uid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_trigger WHERE tgname = 'trigger_set_user_id_for_app_settings'
    ) THEN
        CREATE TRIGGER trigger_set_user_id_for_app_settings
        BEFORE INSERT ON app_settings
        FOR EACH ROW
        EXECUTE FUNCTION set_user_id_for_app_settings();
    END IF;
END $$;
