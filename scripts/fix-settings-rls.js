/**
 * Script to fix Supabase Row Level Security policies for app_settings table
 * Run this script with: node scripts/fix-settings-rls.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Check for required environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERROR: Missing environment variables:');
  console.error(`NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? 'Found' : 'Missing'}`);
  console.error(`SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceKey ? 'Found' : 'Missing'}`);
  process.exit(1);
}

// Create Supabase client with admin privileges
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupRLS() {
  console.log('Setting up Row Level Security for app_settings table...');
  
  try {
    // Step 1: Create the app_settings table if it doesn't exist
    const { error: createTableError } = await supabase.rpc('create_settings_table_if_not_exists', {});
    
    if (createTableError) {
      // If RPC doesn't exist, we'll try to use raw SQL
      console.log('Using direct SQL to check table existence...');
      
      // First check if the table exists
      const { data: tableCheck, error: tableCheckError } = await supabase
        .from('app_settings')
        .select('id')
        .limit(1);
      
      if (tableCheckError && tableCheckError.code === '42P01') {
        console.log('Table app_settings does not exist, creating it...');
        // Create the table using SQL
        const { error: createError } = await supabase.rpc('exec_sql', {
          sql_string: `
            CREATE TABLE public.app_settings (
              id TEXT PRIMARY KEY,
              user_id UUID REFERENCES auth.users(id),
              dark_mode BOOLEAN DEFAULT true,
              gpt_model TEXT DEFAULT 'gpt-4o',
              initial_visit_prompt TEXT DEFAULT '',
              follow_up_visit_prompt TEXT DEFAULT '',
              auto_save BOOLEAN DEFAULT false,
              low_echo_cancellation BOOLEAN DEFAULT false,
              email TEXT,
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
            );
          `
        });
        
        if (createError) {
          throw createError;
        }
        
        console.log('Successfully created app_settings table');
      } else if (tableCheckError) {
        // Some other error when checking the table
        throw tableCheckError;
      } else {
        console.log('Table app_settings already exists');
      }
    }
    
    // Step 2: Enable Row Level Security on the table
    console.log('Enabling Row Level Security on app_settings table...');
    const { error: rlsError } = await supabase.rpc('exec_sql', {
      sql_string: `
        ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
      `
    });
    
    if (rlsError) {
      throw rlsError;
    }
    
    // Step 3: Create RLS policies
    // First, check if policies already exist and drop them
    console.log('Dropping existing policies (if any)...');
    try {
      await supabase.rpc('exec_sql', {
        sql_string: `
          DROP POLICY IF EXISTS "Select own settings" ON public.app_settings;
          DROP POLICY IF EXISTS "Insert own settings" ON public.app_settings;
          DROP POLICY IF EXISTS "Update own settings" ON public.app_settings;
          DROP POLICY IF EXISTS "Select public settings" ON public.app_settings;
        `
      });
    } catch (error) {
      console.warn('Warning when dropping policies:', error.message);
    }
    
    // Now create the policies
    console.log('Creating RLS policies for app_settings table...');
    
    // Policy 1: Allow users to select their own settings
    const { error: selectPolicyError } = await supabase.rpc('exec_sql', {
      sql_string: `
        CREATE POLICY "Select own settings"
        ON public.app_settings
        FOR SELECT
        USING (auth.uid() = user_id);
      `
    });
    
    if (selectPolicyError) {
      throw selectPolicyError;
    }
    
    // Policy 2: Allow users to select public settings (no user_id)
    const { error: publicSelectPolicyError } = await supabase.rpc('exec_sql', {
      sql_string: `
        CREATE POLICY "Select public settings"
        ON public.app_settings
        FOR SELECT
        USING (user_id IS NULL);
      `
    });
    
    if (publicSelectPolicyError) {
      throw publicSelectPolicyError;
    }
    
    // Policy 3: Allow users to insert their own settings
    const { error: insertPolicyError } = await supabase.rpc('exec_sql', {
      sql_string: `
        CREATE POLICY "Insert own settings"
        ON public.app_settings
        FOR INSERT
        WITH CHECK (auth.uid() = user_id);
      `
    });
    
    if (insertPolicyError) {
      throw insertPolicyError;
    }
    
    // Policy 4: Allow users to update their own settings
    const { error: updatePolicyError } = await supabase.rpc('exec_sql', {
      sql_string: `
        CREATE POLICY "Update own settings"
        ON public.app_settings
        FOR UPDATE
        USING (auth.uid() = user_id);
      `
    });
    
    if (updatePolicyError) {
      throw updatePolicyError;
    }
    
    // Step 4: Create default settings if they don't exist
    console.log('Checking for default settings...');
    const { data: defaultSettings, error: defaultSettingsError } = await supabase
      .from('app_settings')
      .select('*')
      .eq('id', 'default')
      .single();
    
    if (defaultSettingsError && defaultSettingsError.code !== 'PGRST116') {
      throw defaultSettingsError;
    }
    
    if (!defaultSettings || defaultSettingsError) {
      console.log('Creating default settings...');
      const { error: createDefaultError } = await supabase
        .from('app_settings')
        .insert({
          id: 'default',
          user_id: null, // Default settings have no user
          dark_mode: true,
          gpt_model: 'gpt-4o',
          initial_visit_prompt: '',
          follow_up_visit_prompt: '',
          auto_save: false,
          low_echo_cancellation: false,
          updated_at: new Date().toISOString()
        });
      
      if (createDefaultError) {
        throw createDefaultError;
      }
      
      console.log('Default settings created successfully');
    } else {
      console.log('Default settings already exist');
    }
    
    console.log('✅ Row Level Security setup completed successfully!');
    console.log('\nRLS Policies created:');
    console.log('1. Select own settings: Users can read their own settings');
    console.log('2. Select public settings: Everyone can read default settings');
    console.log('3. Insert own settings: Users can create their own settings');
    console.log('4. Update own settings: Users can update their own settings');
    
  } catch (error) {
    console.error('Error setting up Row Level Security:', error);
    process.exit(1);
  }
}

// Run the setup
setupRLS();
