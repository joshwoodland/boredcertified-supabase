import { NextRequest, NextResponse } from 'next/server'
import { prisma, connectWithFallback } from '@/app/lib/db'
import { checkSupabaseConnection, getSupabaseAppSettings, convertToPrismaFormat, supabase } from '@/app/lib/supabase'
import fs from 'fs/promises'
import path from 'path'
import { SystemMessage, SystemMessageUpdate } from '@/app/config/types'

// Function to preserve markdown formatting
function preserveMarkdownFormatting(content: string): string {
  // Remove any existing formatting instructions
  let cleanContent = content.replace(/^format:.*\n/, '');

  // Detect heading levels and formatting
  const headingMatches = cleanContent.match(/^(#{1,6})\s+(.+)$/gm) || [];
  const formatGuide = headingMatches.reduce((guide: any, match) => {
    const level = match.match(/^(#{1,6})/)?.[0].length || 0;
    const text = match.replace(/^#{1,6}\s+/, '').trim();
    guide[text] = level;
    return guide;
  }, {});

  // Store formatting information at the start of the content
  const formatInstructions = JSON.stringify(formatGuide);
  return `format:${formatInstructions}\n${cleanContent}`;
}

async function saveSystemMessage(type: 'initial' | 'followUp', update: SystemMessageUpdate) {
  try {
    const configDir = path.join(process.cwd(), 'app', 'config');
    const filename = type === 'initial' ? 'initialVisitPrompt.ts' : 'followUpVisitPrompt.ts';
    const filePath = path.join(configDir, filename);

    if (typeof update.content !== 'string') {
      throw new Error('System message content must be a string');
    }

    // Preserve markdown formatting
    const formattedContent = preserveMarkdownFormatting(update.content);

    const systemMessage: SystemMessage = {
      content: formattedContent,
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      description: update.description || (type === 'initial'
        ? 'System message for initial psychiatric evaluation visits'
        : 'System message for follow-up psychiatric visits')
    };

    await fs.mkdir(configDir, { recursive: true });
    const fileContent = `import { SystemMessage } from './types';\n\nexport const systemMessage: SystemMessage = ${JSON.stringify(systemMessage, null, 2)};\n`;
    await fs.writeFile(filePath, fileContent, 'utf-8');

    return systemMessage;
  } catch (error) {
    console.error(`Error saving ${type} system message:`, error);
    throw error;
  }
}

export async function GET() {
  try {
    // Check if Supabase is available
    const isSupabaseAvailable = await checkSupabaseConnection();
    
    let settings = null;
    
    if (isSupabaseAvailable) {
      console.log('Using Supabase to get app settings');
      // Get settings from Supabase
      settings = await getSupabaseAppSettings();
      
      if (settings) {
        // Convert to Prisma format
        settings = convertToPrismaFormat(settings, 'settings');
      } else {
        // If settings don't exist in Supabase, create default settings
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from('app_settings')
          .insert({
            id: 'default',
            dark_mode: false,
            gpt_model: 'gpt-4o',
            initial_visit_prompt: '',
            follow_up_visit_prompt: '',
            auto_save: false,
            low_echo_cancellation: false,
            updated_at: now
          })
          .select()
          .single();
          
        if (error) {
          console.error('Error creating default settings in Supabase:', error);
          // Fall through to Prisma fallback
        } else {
          settings = convertToPrismaFormat(data, 'settings');
        }
      }
    }
    
    // Fall back to Prisma if Supabase is unavailable or operation failed
    if (!settings) {
      console.log('Falling back to Prisma to get app settings');
      const db = await connectWithFallback();
      settings = await db.appSettings.findUnique({
        where: { id: 'default' },
      });

      if (!settings) {
        settings = await db.appSettings.create({
          data: {
            id: 'default',
            darkMode: false,
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
  try {
    const data = await request.json();
    const updates: { [key: string]: any } = {};

    // Batch system message updates
    const systemMessagePromises = [];

    if (data.initialVisitPrompt !== undefined) {
      systemMessagePromises.push(
        saveSystemMessage('initial', {
          content: data.initialVisitPrompt,
          description: data.initialVisitDescription
        }).then(result => {
          updates.initialVisitPrompt = data.initialVisitPrompt;
        }).catch(error => {
          console.error('Failed to save initial visit prompt:', error);
          throw error;
        })
      );
    }

    if (data.followUpVisitPrompt !== undefined) {
      systemMessagePromises.push(
        saveSystemMessage('followUp', {
          content: data.followUpVisitPrompt,
          description: data.followUpVisitDescription
        }).then(result => {
          updates.followUpVisitPrompt = data.followUpVisitPrompt;
        }).catch(error => {
          console.error('Failed to save follow-up visit prompt:', error);
          throw error;
        })
      );
    }

    // Wait for all system message updates to complete
    await Promise.all(systemMessagePromises);

    // Check if Supabase is available
    const isSupabaseAvailable = await checkSupabaseConnection();
    
    let settings = null;
    
    if (isSupabaseAvailable) {
      console.log('Using Supabase to update app settings');
      
      try {
        // First check if settings exist
        const { data: existingSettings } = await supabase
          .from('app_settings')
          .select('*')
          .eq('id', 'default')
          .single();
          
        const now = new Date().toISOString();
        
        if (existingSettings) {
          // Update existing settings
          const updateData: any = {
            updated_at: now
          };
          
          if (data.darkMode !== undefined) updateData.dark_mode = data.darkMode;
          if (data.gptModel !== undefined) updateData.gpt_model = data.gptModel;
          if (data.initialVisitPrompt !== undefined) updateData.initial_visit_prompt = data.initialVisitPrompt;
          if (data.followUpVisitPrompt !== undefined) updateData.follow_up_visit_prompt = data.followUpVisitPrompt;
          if (data.lowEchoCancellation !== undefined) updateData.low_echo_cancellation = data.lowEchoCancellation;
          if (data.autoSave !== undefined) updateData.auto_save = data.autoSave;
          
          const { data: updatedData, error } = await supabase
            .from('app_settings')
            .update(updateData)
            .eq('id', 'default')
            .select()
            .single();
            
          if (error) throw error;
          
          settings = convertToPrismaFormat(updatedData, 'settings');
        } else {
          // Create settings if they don't exist
          const insertData = {
            id: 'default',
            dark_mode: data.darkMode ?? false,
            gpt_model: data.gptModel ?? 'gpt-4o',
            initial_visit_prompt: data.initialVisitPrompt ?? '',
            follow_up_visit_prompt: data.followUpVisitPrompt ?? '',
            low_echo_cancellation: data.lowEchoCancellation ?? false,
            auto_save: data.autoSave ?? false,
            updated_at: now
          };
          
          const { data: newData, error } = await supabase
            .from('app_settings')
            .insert(insertData)
            .select()
            .single();
            
          if (error) throw error;
          
          settings = convertToPrismaFormat(newData, 'settings');
        }
      } catch (error) {
        console.error('Error updating settings in Supabase:', error);
        // Fall through to Prisma fallback
      }
    }
    
    // Fall back to Prisma if Supabase is unavailable or operation failed
    if (!settings) {
      console.log('Falling back to Prisma to update app settings');
      const db = await connectWithFallback();
      settings = await db.appSettings.upsert({
        where: { id: 'default' },
        update: {
          darkMode: data.darkMode !== undefined ? data.darkMode : undefined,
          gptModel: data.gptModel !== undefined ? data.gptModel : undefined,
          initialVisitPrompt: data.initialVisitPrompt !== undefined ? data.initialVisitPrompt : undefined,
          followUpVisitPrompt: data.followUpVisitPrompt !== undefined ? data.followUpVisitPrompt : undefined,
          lowEchoCancellation: data.lowEchoCancellation !== undefined ? data.lowEchoCancellation : undefined,
          autoSave: data.autoSave !== undefined ? data.autoSave : undefined,
          updatedAt: new Date(),
        },
        create: {
          id: 'default',
          darkMode: data.darkMode ?? false,
          gptModel: data.gptModel ?? 'gpt-4o',
          initialVisitPrompt: data.initialVisitPrompt ?? '',
          followUpVisitPrompt: data.followUpVisitPrompt ?? '',
          lowEchoCancellation: data.lowEchoCancellation ?? false,
          autoSave: data.autoSave ?? false,
          updatedAt: new Date(),
        },
      });
    }

    // Return the updated settings
    return NextResponse.json({
      ...settings,
      initialVisitPrompt: updates.initialVisitPrompt || settings.initialVisitPrompt,
      followUpVisitPrompt: updates.followUpVisitPrompt || settings.followUpVisitPrompt,
    });
  } catch (error) {
    console.error('Settings update failed:', error);
    return NextResponse.json({
      error: 'Failed to update settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
