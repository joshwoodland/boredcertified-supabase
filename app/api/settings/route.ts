'use server';

import { NextRequest, NextResponse } from 'next/server';
import { prisma, connectWithFallback } from '@/app/lib/db';
import { createClient } from '@/app/utils/supabase/server';
import { checkServerSupabaseConnection, convertServerRecordToPrisma } from '@/app/utils/supabase/server-utils';
import { cookies } from 'next/headers';
import { DefaultSettings } from '@/app/lib/defaultSettings';
import { v4 as uuidv4 } from 'uuid';

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

// Convert from Supabase's snake_case to Prisma's camelCase
const convertToPrismaFormat = (data: any, type: string) => {
  if (!data) return null;
  
  if (type === 'settings') {
    return {
      id: data.id,
      deepgramApiKey: data.deepgram_api_key,
      openaiApiKey: data.openai_api_key,
      gptModel: data.gpt_model,
      lowEchoCancellation: data.low_echo_cancellation,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
  
  return null;
};

/**
 * GET handler for settings
 */
export async function GET(request: NextRequest) {
  try {
    debugLog('GET settings request received');
    
    // Try to get settings from Supabase first
    let settings = null;
    let memorySettings = null;
    let responseSource = '';
    
    try {
      // Check if we're in a Vercel environment with environment variables
      if (process.env.OPENAI_API_KEY) {
        debugLog('Using environment variables for settings');
        memorySettings = {
          id: 'default',
          deepgramApiKey: process.env.DEEPGRAM_API_KEY || '',
          openaiApiKey: process.env.OPENAI_API_KEY || '',
          gptModel: process.env.GPT_MODEL || 'gpt-4o',
          lowEchoCancellation: process.env.LOW_ECHO_CANCELLATION === 'true',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        responseSource = 'env';
      }
      
      // If this is from the /api/settings/force-memory route, always use memory settings
      const url = new URL(request.url);
      if (url.pathname === '/api/settings/force-memory') {
        debugLog('Forcing memory settings due to route');
        if (memorySettings) {
          return NextResponse.json({
            data: memorySettings,
            source: responseSource
          });
        }
      }
      
      // Try to get settings from Supabase
      const { data, error } = await prisma.appSettings.findUnique({
        where: { id: 'default' },
      });
      
      if (!error && data) {
        debugLog('Got settings from Prisma/PostgreSQL');
        settings = convertToPrismaFormat(data, 'settings');
        responseSource = 'postgresql';
      } else {
        debugLog('Error getting settings from Prisma/PostgreSQL:', error);
        
        // If we have memory settings, use those
        if (memorySettings) {
          debugLog('Using memory settings as fallback');
          settings = memorySettings;
          responseSource = 'env';
        } else {
          // Try to get settings from Prisma/PostgreSQL directly
          debugLog('Trying to get settings from Prisma/PostgreSQL');
          const prismaSettings = await prisma.appSettings.findUnique({
            where: { id: 'default' },
          });
          
          if (prismaSettings) {
            debugLog('Got settings from Prisma/PostgreSQL');
            settings = prismaSettings;
            responseSource = 'postgresql';
          }
        }
      }
      
      // If we still don't have settings, use default settings
      if (!settings) {
        debugLog('No settings found, using defaults');
        settings = DefaultSettings;
        responseSource = 'defaults';
      }
      
      return NextResponse.json({
        data: settings,
        source: responseSource
      });
    } catch (error) {
      debugLog('Error in main settings flow:', error);
      
      // Last resort fallback to default settings
      if (!settings && memorySettings) {
        debugLog('Using memory defaults as last resort');
        settings = memorySettings;
        responseSource = 'env';
      } else if (!settings) {
        debugLog('Using hard-coded defaults as last resort');
        settings = DefaultSettings;
        responseSource = 'defaults';
      }
      
      return NextResponse.json({
        data: settings,
        source: responseSource
      });
    }
  } catch (error) {
    debugLog('Catastrophic error in GET handler:', error);
    return NextResponse.json({
      data: DefaultSettings,
      source: 'defaults',
      error: 'Error retrieving settings'
    }, { status: 500 });
  }
}

/**
 * POST handler for settings
 */
export async function POST(request: NextRequest) {
  try {
    const requestData = await request.json();
    debugLog('POST settings request received:', requestData);
    
    // Initialize settings from request
    const settingsData = {
      id: 'default',
      deepgramApiKey: requestData.deepgramApiKey,
      openaiApiKey: requestData.openaiApiKey,
      gptModel: requestData.gptModel || 'gpt-4o',
      lowEchoCancellation: requestData.lowEchoCancellation === true,
      updatedAt: new Date(),
    };
    
    let settings = null;
    let updateSource = '';
    let created = false;
    
    // First try Supabase
    try {
      debugLog('Trying to update settings in Supabase');
      
      // First check if settings already exist
      const { data: existingData, error: existingError } = await prisma.appSettings.findUnique({
        where: { id: 'default' },
      });
      
      let result;
      
      if (!existingError && existingData) {
        // Update existing settings
        debugLog('Updating existing settings in Supabase');
        const { data, error } = await prisma.appSettings.update({
          where: { id: 'default' },
          data: {
            deepgramApiKey: settingsData.deepgramApiKey,
            openaiApiKey: settingsData.openaiApiKey,
            gptModel: settingsData.gptModel,
            lowEchoCancellation: settingsData.lowEchoCancellation,
            updatedAt: new Date(),
          },
        });
        
        result = { data, error };
      } else {
        // Insert new settings
        debugLog('Inserting new settings in Supabase');
        const { data, error } = await prisma.appSettings.create({
          data: {
            id: 'default',
            deepgramApiKey: settingsData.deepgramApiKey,
            openaiApiKey: settingsData.openaiApiKey,
            gptModel: settingsData.gptModel,
            lowEchoCancellation: settingsData.lowEchoCancellation,
            updatedAt: new Date(),
          },
        });
        
        created = true;
        result = { data, error };
      }
      
      if (!result.error) {
        debugLog('Successfully updated settings in Supabase');
        settings = convertToPrismaFormat(result.data, 'settings');
        updateSource = 'supabase';
      } else {
        debugLog('Error updating settings in Supabase:', result.error);
        
        // Try to update settings in Prisma/PostgreSQL directly
        try {
          debugLog('Trying to update settings in Prisma/PostgreSQL');
          
          const prismaSettings = await prisma.appSettings.upsert({
            where: { id: 'default' },
            update: {
              deepgramApiKey: settingsData.deepgramApiKey,
              openaiApiKey: settingsData.openaiApiKey,
              gptModel: settingsData.gptModel,
              lowEchoCancellation: settingsData.lowEchoCancellation,
              updatedAt: new Date(),
            },
            create: {
              id: 'default',
              deepgramApiKey: settingsData.deepgramApiKey,
              openaiApiKey: settingsData.openaiApiKey,
              gptModel: settingsData.gptModel,
              lowEchoCancellation: settingsData.lowEchoCancellation,
              updatedAt: new Date(),
            },
          });
          
          debugLog('Successfully updated settings in Prisma/PostgreSQL');
          settings = prismaSettings;
          updateSource = 'postgresql';
          created = !prismaSettings.createdAt || 
                    prismaSettings.createdAt.getTime() === prismaSettings.updatedAt.getTime();
        } catch (prismaError) {
          debugLog('Error updating settings in Prisma/PostgreSQL:', prismaError);
          throw prismaError;
        }
      }
      
      return NextResponse.json({
        data: settings,
        source: updateSource,
        created
      });
    } catch (error) {
      debugLog('Error in POST handler:', error);
      return NextResponse.json({
        error: 'Failed to update settings',
        details: error instanceof Error ? error.message : String(error)
      }, { status: 500 });
    }
  } catch (error) {
    debugLog('Error parsing request data:', error);
    return NextResponse.json({
      error: 'Invalid request data',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 400 });
  }
} 