import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/app/lib/supabase';
import { getMasterSettings, updateMasterSettings, clearMasterSettingsCache, MasterSettings } from '@/app/utils/masterSettings';

// Helper function to check Supabase connection
async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const supabase = createServerClient();
    if (!supabase) {
      console.error('[master-settings/route] Failed to initialize Supabase client');
      return false;
    }

    const { data, error } = await supabase.from('master_settings').select('id').limit(1);
    if (error && error.code !== '42P01') { // 42P01 means table doesn't exist
      console.error('[master-settings/route] Supabase connection error:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[master-settings/route] Failed to connect to Supabase:', error);
    return false;
  }
}

// GET handler for fetching master settings
export async function GET(request: NextRequest) {
  try {
    // Check if Supabase is available
    const isSupabaseAvailable = await checkSupabaseConnection();
    if (!isSupabaseAvailable) {
      return NextResponse.json(
        {
          error: 'Database connection unavailable',
          details: 'Please check your database connection settings.',
        },
        { status: 503 }
      );
    }

    // Fetch master settings
    const settings = await getMasterSettings();

    return NextResponse.json(settings);
  } catch (error) {
    console.error('[master-settings/route] Error fetching master settings:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch master settings',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// PUT handler for updating master settings
export async function PUT(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { 
      initial_eval_soap_template,
      follow_up_visit_soap_template,
      generate_soap_model,
      checklist_model,
      note_summary_model
    } = body;

    // Validate that at least one field is provided
    if (!initial_eval_soap_template && 
        !follow_up_visit_soap_template && 
        !generate_soap_model && 
        !checklist_model && 
        !note_summary_model) {
      return NextResponse.json(
        { error: 'At least one field must be provided for update' }, 
        { status: 400 }
      );
    }

    // Check if Supabase is available
    const isSupabaseAvailable = await checkSupabaseConnection();
    if (!isSupabaseAvailable) {
      return NextResponse.json(
        {
          error: 'Database connection unavailable',
          details: 'Please check your database connection settings.',
        },
        { status: 503 }
      );
    }

    // Prepare updates object (only include defined fields)
    const updates: Partial<Omit<MasterSettings, 'id' | 'created_at' | 'updated_at'>> = {};
    
    if (initial_eval_soap_template !== undefined) {
      updates.initial_eval_soap_template = initial_eval_soap_template;
    }
    if (follow_up_visit_soap_template !== undefined) {
      updates.follow_up_visit_soap_template = follow_up_visit_soap_template;
    }
    if (generate_soap_model !== undefined) {
      updates.generate_soap_model = generate_soap_model;
    }
    if (checklist_model !== undefined) {
      updates.checklist_model = checklist_model;
    }
    if (note_summary_model !== undefined) {
      updates.note_summary_model = note_summary_model;
    }

    // Update master settings
    await updateMasterSettings(updates);

    // Fetch and return updated settings
    const updatedSettings = await getMasterSettings();
    
    return NextResponse.json({
      message: 'Master settings updated successfully',
      settings: updatedSettings
    });
  } catch (error) {
    console.error('[master-settings/route] Error updating master settings:', error);
    return NextResponse.json(
      {
        error: 'Failed to update master settings',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// DELETE handler for resetting master settings to defaults
export async function DELETE(request: NextRequest) {
  try {
    // Check if Supabase is available
    const isSupabaseAvailable = await checkSupabaseConnection();
    if (!isSupabaseAvailable) {
      return NextResponse.json(
        {
          error: 'Database connection unavailable',
          details: 'Please check your database connection settings.',
        },
        { status: 503 }
      );
    }

    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Failed to initialize database client' },
        { status: 500 }
      );
    }

    // Delete existing settings (this will trigger the default values to be re-inserted)
    const { error: deleteError } = await supabase
      .from('master_settings')
      .delete()
      .eq('id', 'default');

    if (deleteError) {
      console.error('[master-settings/route] Error deleting master settings:', deleteError);
      return NextResponse.json(
        { error: 'Failed to reset master settings', details: deleteError.message },
        { status: 500 }
      );
    }

    // Clear cache
    clearMasterSettingsCache();

    // The database migration script should have an ON CONFLICT clause that will re-insert defaults
    // Or we can manually re-insert them here
    const { error: insertError } = await supabase.rpc('create_default_master_settings');
    
    if (insertError) {
      // If the RPC doesn't exist, manually insert defaults
      const defaultSettings = {
        id: 'default',
        initial_eval_soap_template: 'Please generate a comprehensive SOAP note for this initial psychiatric evaluation.',
        follow_up_visit_soap_template: 'Please generate a comprehensive SOAP note for this follow-up psychiatric visit.',
        generate_soap_model: 'gpt-4o',
        checklist_model: 'gpt-4o',
        note_summary_model: 'gpt-4o'
      };

      const { error: manualInsertError } = await supabase
        .from('master_settings')
        .insert(defaultSettings);

      if (manualInsertError) {
        console.error('[master-settings/route] Error inserting default settings:', manualInsertError);
        return NextResponse.json(
          { error: 'Failed to restore default settings', details: manualInsertError.message },
          { status: 500 }
        );
      }
    }

    // Fetch and return the reset settings
    const resetSettings = await getMasterSettings();

    return NextResponse.json({
      message: 'Master settings reset to defaults successfully',
      settings: resetSettings
    });
  } catch (error) {
    console.error('[master-settings/route] Error resetting master settings:', error);
    return NextResponse.json(
      {
        error: 'Failed to reset master settings',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}