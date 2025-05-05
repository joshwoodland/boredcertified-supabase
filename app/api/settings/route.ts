'use server';

import { NextRequest, NextResponse } from 'next/server';
import { prisma, connectWithFallback } from '@/app/lib/db';
import { createClient } from '@/app/utils/supabase/server';
import { checkServerSupabaseConnection, convertServerRecordToPrisma } from '@/app/utils/supabase/server-utils';
import { cookies } from 'next/headers';

// Debug logging helper
const debugLog = (message: string, data?: unknown) => {
  if (process.env.NODE_ENV === 'development') {
    if (data) {
      console.log(`[SETTINGS DEBUG] ${message}`, data);
    } else {
      console.log(`[SETTINGS DEBUG] ${message}`);
    }
  }
};

/**
 * GET handler for settings
 */
export async function GET(request: NextRequest) {
  debugLog('Starting GET request for settings');
  
  try {
    let settings = null;
    
    // Check if Supabase connection is available
    const isSupabaseAvailable = await checkServerSupabaseConnection();
    debugLog(`Supabase connection available: ${isSupabaseAvailable}`);
    
    // First try Supabase if available
    if (isSupabaseAvailable) {
      debugLog('Using Supabase to get app settings');
      
      try {
        const supabase = await createClient();
        
        // Get current user's session
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        
        debugLog('Auth session details', {
          hasSession: !!session,
          userId: session?.user?.id,
          userEmail: session?.user?.email,
        });
        
        // If user is logged in, try to get their settings
        if (userId) {
          const { data: userSettings, error: userSettingsError } = await supabase
            .from('app_settings')
            .select('*')
            .eq('user_id', userId)
            .single();
            
          if (!userSettingsError && userSettings) {
            debugLog(`Found settings for user ID: ${userId}`);
            settings = await convertServerRecordToPrisma(userSettings, 'settings');
          } else {
            debugLog(`No settings found for user ID: ${userId}, falling back to default`);
          }
        }
        
        // If no user settings found, get default settings
        if (!settings) {
          const { data: defaultSettings, error: defaultError } = await supabase
            .from('app_settings')
            .select('*')
            .eq('id', 'default')
            .single();
            
          if (!defaultError && defaultSettings) {
            debugLog('Using default settings');
            settings = await convertServerRecordToPrisma(defaultSettings, 'settings');
          } else {
            debugLog('No default settings found in Supabase, falling back to in-memory defaults');
          }
        }
      } catch (error) {
        debugLog('Error accessing Supabase settings:', error);
        // Fall through to fallback
      }
    }
    
    // Create default settings if none were found
    if (!settings) {
      debugLog('Falling back to Prisma/default settings');
      
      try {
        const db = await connectWithFallback();
        settings = await db.appSettings.findUnique({
          where: { id: 'default' },
        });
        
        if (!settings) {
          debugLog('No settings in Prisma, creating default settings');
          settings = await db.appSettings.create({
            data: {
              id: 'default',
              darkMode: true,
              gptModel: 'gpt-4o',
              initialVisitPrompt: '',
              followUpVisitPrompt: '',
              autoSave: false,
              lowEchoCancellation: false,
            },
          });
        }
      } catch (error) {
        debugLog('Error with Prisma fallback, using memory defaults:', error);
        
        // If everything fails, return in-memory defaults
        settings = {
          id: 'default',
          darkMode: true,
          gptModel: 'gpt-4o',
          initialVisitPrompt: '',
          followUpVisitPrompt: '',
          autoSave: false,
          lowEchoCancellation: false,
          updatedAt: new Date()
        };
      }
    }
    
    // Load default system messages if none available
    if (!settings.initialVisitPrompt || !settings.followUpVisitPrompt) {
      debugLog('Loading default system messages');
      const initialVisitPrompt = await import('@/app/config/initialVisitPrompt');
      const followUpVisitPrompt = await import('@/app/config/followUpVisitPrompt');
      
      return NextResponse.json({
        ...settings,
        initialVisitPrompt: settings.initialVisitPrompt || initialVisitPrompt.systemMessage.content,
        followUpVisitPrompt: settings.followUpVisitPrompt || followUpVisitPrompt.systemMessage.content,
      });
    } else {
      return NextResponse.json(settings);
    }
  } catch (error) {
    debugLog('Error in GET handler:', error);
    return NextResponse.json(
      { error: 'Failed to get settings' },
      { status: 500 }
    );
  }
}

/**
 * POST handler for settings
 */
export async function POST(request: NextRequest) {
  debugLog('Starting POST request for settings');
  
  try {
    const body = await request.json();
    debugLog('Request body:', body);
    
    // Check if Supabase connection is available
    const isSupabaseAvailable = await checkServerSupabaseConnection();
    debugLog(`Supabase connection available: ${isSupabaseAvailable}`);
    
    // Prepare the return value
    let updatedSettings = null;
    
    // Only proceed with Supabase if it's available
    if (isSupabaseAvailable) {
      debugLog('Using Supabase to update app settings');
      
      try {
        const supabase = await createClient();
        
        // Get current user's session
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        
        // Convert camelCase to snake_case for Supabase
        const updateData: Record<string, unknown> = {};
        if (body.darkMode !== undefined) updateData.dark_mode = body.darkMode;
        if (body.gptModel !== undefined) updateData.gpt_model = body.gptModel;
        
        // Only include prompts if they exist in the body to avoid sending large amounts of data
        if (body.initialVisitPrompt) updateData.initial_visit_prompt = body.initialVisitPrompt;
        if (body.followUpVisitPrompt) updateData.follow_up_visit_prompt = body.followUpVisitPrompt;
        
        if (body.lowEchoCancellation !== undefined) updateData.low_echo_cancellation = body.lowEchoCancellation;
        if (body.autoSave !== undefined) updateData.auto_save = body.autoSave;
        updateData.updated_at = new Date().toISOString();
        
        debugLog('Update data prepared:', updateData);
        
        // If user is logged in, update/create their settings
        if (userId) {
          debugLog(`Operating on settings for user ID: ${userId}`);
          
          try {
            // First check if user has settings
            const { data: existingSettings, error: checkError } = await supabase
              .from('app_settings')
              .select('*')
              .eq('user_id', userId)
              .single();
              
            if (checkError && checkError.code === 'PGRST116') {
              // User settings don't exist yet, create them
              debugLog('No user settings found, creating new settings');
              
              // Generate a unique ID for the user settings
              const userSettingsId = `user_id_${userId.replace(/[^a-zA-Z0-9]/g, '_')}`;
              
              try {
                // Simplified insert with only essential fields
                const { data: newSettings, error: insertError } = await supabase
                  .from('app_settings')
                  .insert({
                    id: userSettingsId,
                    user_id: userId,
                    dark_mode: body.darkMode !== undefined ? body.darkMode : true,
                    gpt_model: body.gptModel || 'gpt-4o',
                    low_echo_cancellation: body.lowEchoCancellation !== undefined ? body.lowEchoCancellation : false
                  })
                  .select()
                  .single();
                  
                if (insertError) {
                  debugLog('Error creating user settings:', insertError);
                  throw insertError;
                }
                
                debugLog('Successfully created user settings');
                updatedSettings = await convertServerRecordToPrisma(newSettings, 'settings');
              } catch (error) {
                debugLog('All attempts to create settings failed:', error);
                throw new Error('Failed to create user settings');
              }
            } else {
              // User settings exist, update them
              debugLog('User settings exist, updating them');
              
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
              
              updatedSettings = await convertServerRecordToPrisma(fetchedSettings, 'settings');
            }
          } catch (error) {
            debugLog('Error in user settings operation:', error);
            throw error;
          }
        } else {
          // No user logged in, update default settings
          debugLog('No user logged in, updating default settings');
          
          try {
            // Update default settings
            const { error: updateError } = await supabase
              .from('app_settings')
              .update(updateData)
              .eq('id', 'default');
              
            if (updateError) {
              debugLog('Error updating default settings:', updateError);
              throw updateError;
            }
            
            debugLog('Successfully updated default settings');
            
            // Get updated default settings
            const { data: fetchedSettings, error: fetchError } = await supabase
              .from('app_settings')
              .select('*')
              .eq('id', 'default')
              .single();
              
            if (fetchError) {
              debugLog('Error fetching updated default settings:', fetchError);
              throw fetchError;
            }
            
            updatedSettings = await convertServerRecordToPrisma(fetchedSettings, 'settings');
          } catch (error) {
            debugLog('Error updating default settings:', error);
            throw error;
          }
        }
      } catch (error) {
        debugLog('Error with Supabase operations:', error);
        // Fall through to Prisma fallback
      }
    }
    
    // If we couldn't update settings with Supabase, use Prisma as fallback
    if (!updatedSettings) {
      debugLog('Falling back to Prisma to update app settings');
      
      try {
        const db = await connectWithFallback();
        updatedSettings = await db.appSettings.upsert({
          where: { id: 'default' },
          create: {
            id: 'default',
            darkMode: body.darkMode !== undefined ? body.darkMode : true,
            gptModel: body.gptModel || 'gpt-4o',
            initialVisitPrompt: body.initialVisitPrompt || '',
            followUpVisitPrompt: body.followUpVisitPrompt || '',
            lowEchoCancellation: body.lowEchoCancellation !== undefined ? body.lowEchoCancellation : false,
            autoSave: body.autoSave !== undefined ? body.autoSave : false,
          },
          update: {
            darkMode: body.darkMode !== undefined ? body.darkMode : undefined,
            gptModel: body.gptModel !== undefined ? body.gptModel : undefined,
            initialVisitPrompt: body.initialVisitPrompt ? body.initialVisitPrompt : undefined,
            followUpVisitPrompt: body.followUpVisitPrompt ? body.followUpVisitPrompt : undefined,
            lowEchoCancellation: body.lowEchoCancellation !== undefined ? body.lowEchoCancellation : undefined,
            autoSave: body.autoSave !== undefined ? body.autoSave : undefined,
          },
        });
      } catch (error) {
        debugLog('Prisma fallback failed:', error);
        
        // If all else fails, return a mock result with the requested changes
        updatedSettings = {
          id: 'default',
          darkMode: body.darkMode ?? true,
          gptModel: body.gptModel ?? 'gpt-4o',
          initialVisitPrompt: body.initialVisitPrompt ?? '',
          followUpVisitPrompt: body.followUpVisitPrompt ?? '',
          lowEchoCancellation: body.lowEchoCancellation ?? false,
          autoSave: body.autoSave ?? false,
          updatedAt: new Date()
        };
      }
    }

    // Load system messages from files for the response
    const initialVisitPrompt = await import('@/app/config/initialVisitPrompt');
    const followUpVisitPrompt = await import('@/app/config/followUpVisitPrompt');

    // Return the updated settings
    return NextResponse.json({
      ...updatedSettings,
      initialVisitPrompt: body.initialVisitPrompt || initialVisitPrompt.systemMessage.content,
      followUpVisitPrompt: body.followUpVisitPrompt || followUpVisitPrompt.systemMessage.content,
    });
  } catch (error) {
    debugLog('Error in POST handler:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
} 