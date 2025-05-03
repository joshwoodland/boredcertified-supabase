import { NextRequest, NextResponse } from 'next/server'
import { prisma, connectWithFallback } from '@/app/lib/db'
import { 
  checkSupabaseConnection, 
  convertToPrismaFormat 
} from '@/app/lib/supabase'
import { createClient } from '@/app/utils/supabase/server'
import { cookies } from 'next/headers'

// Debug logging with prefix for easier identification
const debugLog = (message: string, data?: unknown) => {
  if (data) {
    console.log(`[SETTINGS DEBUG] ${message}`, data);
  } else {
    console.log(`[SETTINGS DEBUG] ${message}`);
  }
};

// Get app settings from Supabase
async function getSupabaseAppSettings(userId?: string | null) {
  const supabase = createClient();
  
  try {
    // Get current user's session to access their ID if not provided
    const { data: { session } } = await supabase.auth.getSession();
    const currentUserId = userId || session?.user?.id;
    
    console.log('[SETTINGS DEBUG] Auth session details:', {
      hasSession: !!session,
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      cookiesPresent: true,
      authCookiePresent: true
    });
    
    const query = supabase.from('app_settings').select('*');
    
    // First priority: Try to get settings by user ID if available
    if (currentUserId) {
      const { data: userIdSettings, error: userIdError } = await query
        .eq('user_id', currentUserId)
        .single();
      
      if (!userIdError && userIdSettings) {
        console.log(`Found settings for user ID: ${currentUserId}`);
        return convertToPrismaFormat(userIdSettings, 'settings');
      }
      
      // If there was an error or no user ID settings found, log and fall back to default
      if (userIdError && userIdError.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
        console.error(`Error fetching user settings for user ID ${currentUserId}:`, userIdError);
      } else {
        console.log(`No settings found for user ID: ${currentUserId}, falling back to default`);
      }
    } else {
      console.log('[SETTINGS DEBUG] No user found, using default settings');
    }
    
    // Fall back to default settings
    const { data: defaultSettings, error: defaultError } = await query
      .eq('id', 'default')
      .single();
    
    if (defaultError) {
      console.error('Error fetching default app settings from Supabase:', defaultError);
      console.log('[SETTINGS DEBUG] Using default settings');
      return null;
    }
    
    return convertToPrismaFormat(defaultSettings, 'settings');
  } catch (error) {
    console.error('Error in getSupabaseAppSettings:', error);
    console.log('[SETTINGS DEBUG] Using default settings');
    return null;
  }
}

export async function GET(request: NextRequest) {
  debugLog('Starting GET request for settings');
  
  try {
    // Create a Supabase client
    const supabase = createClient();
    
    // Check for auth cookies
    const cookieStore = cookies();
    const authCookie = cookieStore.getAll().find(c => c.name.includes('supabase-auth-token'));
    if (authCookie) {
      debugLog(`Found auth cookie: ${authCookie.name}`);
    } else {
      debugLog('No Supabase auth cookie found!');
    }
    
    // Check if Supabase is available
    const isSupabaseAvailable = await checkSupabaseConnection();
    debugLog(`Supabase connection available: ${isSupabaseAvailable}`);
    
    let settings = null;
    
    if (isSupabaseAvailable) {
      debugLog('Using Supabase to get app settings');
      
      try {
        // Get current user with server-side auth
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        
        // IMPORTANT: Log auth session details for debugging
        debugLog('Auth session details:', { 
          hasSession: !!session, 
          userId, 
          userEmail: session?.user?.email,
          cookiesPresent: cookieStore.getAll().length > 0,
          authCookiePresent: cookieStore.getAll().some(c => c.name.includes('-auth-token'))
        });
        
        // Use the server-side client to get the user's settings
        settings = await getSupabaseAppSettings(userId);
      } catch (error) {
        debugLog('Error accessing Supabase settings:', error);
        // Fall through to Prisma fallback
      }
    }
    
    // Fall back to Prisma if Supabase is unavailable or operation failed
    if (!settings) {
      debugLog('Falling back to Prisma to get app settings');
      const db = await connectWithFallback();
      settings = await db.appSettings.findUnique({
        where: { id: 'default' },
      });

      if (!settings) {
        settings = await db.appSettings.create({
          data: {
            id: 'default',
            darkMode: true,
            gptModel: 'gpt-4o',
            initialVisitPrompt: '',
            followUpVisitPrompt: '',
            autoSave: false,
            lowEchoCancellation: false
          },
        });
      }
    }

    // Load system messages from files
    const initialVisitPrompt = await import('@/app/config/initialVisitPrompt');
    const followUpVisitPrompt = await import('@/app/config/followUpVisitPrompt');

    // Update settings with system messages from files
    settings.initialVisitPrompt = initialVisitPrompt.systemMessage.content;
    settings.followUpVisitPrompt = followUpVisitPrompt.systemMessage.content;

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  debugLog('Starting POST request for settings');
  
  try {
    const body = await request.json();
    debugLog('Request body:', body);
    
    // Create a Supabase client
    const supabase = createClient();
    
    // Check for auth cookies
    const cookieStore = cookies();
    const authCookie = cookieStore.getAll().find(c => c.name.includes('supabase-auth-token'));
    if (authCookie) {
      debugLog(`Found auth cookie: ${authCookie.name}`);
    } else {
      debugLog('No Supabase auth cookie found!');
    }
    
    // Check if Supabase is available
    const isSupabaseAvailable = await checkSupabaseConnection();
    debugLog(`Supabase connection available: ${isSupabaseAvailable}`);
    
    let updatedSettings = null; 
    
    if (isSupabaseAvailable) {
      debugLog('Using Supabase to update app settings');
      
      try {
        // Get current user with server-side auth
        const { data: { session } } = await supabase.auth.getSession();
        
        // IMPORTANT: Log auth session details for debugging
        debugLog('Auth session details:', { 
          hasSession: !!session, 
          userId: session?.user?.id, 
          userEmail: session?.user?.email,
          cookiesPresent: cookieStore.getAll().length > 0,
          authCookiePresent: cookieStore.getAll().some(c => c.name.includes('-auth-token'))
        });
        
        const userId = session?.user?.id;
        
        // Convert camelCase to snake_case
        const updateData: Record<string, unknown> = {};
        if (body.darkMode !== undefined) updateData.dark_mode = body.darkMode;
        if (body.gptModel !== undefined) updateData.gpt_model = body.gptModel;
        if (body.initialVisitPrompt !== undefined) updateData.initial_visit_prompt = body.initialVisitPrompt;
        if (body.followUpVisitPrompt !== undefined) updateData.follow_up_visit_prompt = body.followUpVisitPrompt;
        if (body.lowEchoCancellation !== undefined) updateData.low_echo_cancellation = body.lowEchoCancellation;
        if (body.autoSave !== undefined) updateData.auto_save = body.autoSave;
        updateData.updated_at = new Date().toISOString();
        
        debugLog('Update data prepared:', updateData);
        
        if (userId) {
          debugLog(`Updating settings for user ID: ${userId}`);
          
          // Check if user settings exist
          const { data: existingSettings, error: checkError } = await supabase
            .from('app_settings')
            .select('id')
            .eq('user_id', userId)
            .single();
            
          if (checkError && checkError.code === 'PGRST116') {
            debugLog('No user settings found, creating new settings first');
            
            // Get default settings to use as base
            const { data: defaultSettings, error: defaultError } = await supabase
              .from('app_settings')
              .select('*')
              .eq('id', 'default')
              .single();
              
            if (defaultError) {
              debugLog('Error fetching default settings:', defaultError);
              // Create base settings instead of throwing
              const userSettingsId = `user_id_${userId.replace(/[^a-zA-Z0-9]/g, '_')}`;
              debugLog(`Creating base user settings with ID: ${userSettingsId}`);
              
              const { data: newSettings, error: insertError } = await supabase
                .from('app_settings')
                .insert({
                  id: userSettingsId,
                  user_id: userId,
                  email: session?.user?.email || null,
                  dark_mode: true,
                  gpt_model: 'gpt-4o',
                  initial_visit_prompt: '',
                  follow_up_visit_prompt: '',
                  low_echo_cancellation: false,
                  auto_save: false,
                  updated_at: updateData.updated_at as string
                })
                .select()
                .single();
                
              if (insertError) {
                debugLog('Error creating base user settings:', insertError);
                throw insertError;
              }
            } else {
              // Use default settings as template
              debugLog('Using default settings as template for new user settings');
              
              // Create user settings
              const userSettingsId = `user_id_${userId.replace(/[^a-zA-Z0-9]/g, '_')}`;
              const { data: newSettings, error: insertError } = await supabase
                .from('app_settings')
                .insert({
                  id: userSettingsId,
                  user_id: userId,
                  email: session?.user?.email || null,
                  dark_mode: defaultSettings?.dark_mode ?? true,
                  gpt_model: defaultSettings?.gpt_model ?? 'gpt-4o',
                  initial_visit_prompt: defaultSettings?.initial_visit_prompt ?? '',
                  follow_up_visit_prompt: defaultSettings?.follow_up_visit_prompt ?? '',
                  low_echo_cancellation: defaultSettings?.low_echo_cancellation ?? false,
                  auto_save: defaultSettings?.auto_save ?? false,
                  updated_at: updateData.updated_at as string
                })
                .select()
                .single();
                
              if (insertError) {
                debugLog('Error creating user settings:', insertError);
                throw insertError;
              }
              
              debugLog('Successfully created user settings, now updating with new values');
            }
          }
          
          // Update user settings
          const { error: updateError } = await supabase
            .from('app_settings')
            .update(updateData)
            .eq('user_id', userId);
            
          if (updateError) {
            debugLog('Error updating user settings:', updateError);
            throw updateError;
          }
          
          debugLog('Successfully updated user settings');
          
          // Get updated settings
          const { data: fetchedSettings, error: fetchError } = await supabase
            .from('app_settings')
            .select('*')
            .eq('user_id', userId)
            .single();
            
          if (fetchError) {
            debugLog('Error fetching updated settings:', fetchError);
            throw fetchError;
          }
          
          updatedSettings = convertToPrismaFormat(fetchedSettings, 'settings');
          return NextResponse.json(updatedSettings);
        }
        
        // No user ID: update default settings
        debugLog('No user logged in, updating default settings');
        
        // Update default settings
        const { error: updateError } = await supabase
          .from('app_settings')
          .update(updateData)
          .eq('id', 'default');
          
        if (updateError) {
          debugLog('Error updating default settings:', updateError);
          throw updateError;
        }
        
        debugLog('Updated default settings');
        
        // Get updated settings
        const { data: fetchedSettings, error: fetchError } = await supabase
          .from('app_settings')
          .select('*')
          .eq('id', 'default')
          .single();
          
        if (fetchError) {
          debugLog('Error fetching updated settings:', fetchError);
          throw fetchError;
        }
        
        updatedSettings = convertToPrismaFormat(fetchedSettings, 'settings');
        return NextResponse.json(updatedSettings);
      } catch (error) {
        debugLog('Error accessing Supabase settings:', error);
        // Fall through to Prisma fallback
      }
    }
    
    // Fall back to Prisma if Supabase is unavailable or operation failed
    debugLog('Falling back to Prisma to update app settings');
    const db = await connectWithFallback();
    updatedSettings = await db.appSettings.upsert({
      where: { id: 'default' },
      update: {
        darkMode: body.darkMode !== undefined ? body.darkMode : undefined,
        gptModel: body.gptModel !== undefined ? body.gptModel : undefined,
        initialVisitPrompt: body.initialVisitPrompt !== undefined ? body.initialVisitPrompt : undefined,
        followUpVisitPrompt: body.followUpVisitPrompt !== undefined ? body.followUpVisitPrompt : undefined,
        lowEchoCancellation: body.lowEchoCancellation !== undefined ? body.lowEchoCancellation : undefined,
        autoSave: body.autoSave !== undefined ? body.autoSave : undefined,
        updatedAt: new Date(),
      },
      create: {
        id: 'default',
        darkMode: body.darkMode ?? true,
        gptModel: body.gptModel ?? 'gpt-4o',
        initialVisitPrompt: body.initialVisitPrompt ?? '',
        followUpVisitPrompt: body.followUpVisitPrompt ?? '',
        lowEchoCancellation: body.lowEchoCancellation ?? false,
        autoSave: body.autoSave ?? false,
        updatedAt: new Date(),
      },
    });

    // Load system messages from files
    const initialVisitPrompt = await import('@/app/config/initialVisitPrompt');
    const followUpVisitPrompt = await import('@/app/config/followUpVisitPrompt');

    // Return the updated settings
    return NextResponse.json({
      ...updatedSettings,
      initialVisitPrompt: body.initialVisitPrompt || initialVisitPrompt.systemMessage.content,
      followUpVisitPrompt: body.followUpVisitPrompt || followUpVisitPrompt.systemMessage.content,
    });
  } catch (error) {
    console.error('Settings update failed:', error);
    return NextResponse.json({
      error: 'Failed to update settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
