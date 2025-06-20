import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { createServerClient } from '@/app/lib/supabase';
import { convertToAppFormat, AppSettings } from '@/app/lib/supabaseTypes';
import { getModelForPurpose, getSoapTemplate } from '@/app/utils/masterSettings';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to check Supabase connection
async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const supabase = createServerClient();
    if (!supabase) {
      console.error('[openai/route] Failed to initialize Supabase client');
      return false;
    }
    if (!supabase) {
      console.error('[openai/route] Failed to initialize Supabase client');
      return false;
    }

    const { data, error } = await supabase.from('app_settings').select('id').limit(1);
    if (error && error.code !== '42P01') { // 42P01 means table doesn't exist, which is fine
      console.error('[openai/route] Supabase connection error:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[openai/route] Failed to connect to Supabase:', error);
    return false;
  }
}

// Helper function to get app settings
async function getAppSettings(): Promise<AppSettings | null> {
  try {
    // Use standardized client initialization
    const supabase = createServerClient();
    if (!supabase) {
      console.error('[openai/route] Failed to initialize Supabase client');
      return null;
    }

    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('[openai/route] Error fetching app settings:', error);
      return null;
    }

    return convertToAppFormat(data, 'settings') as AppSettings;
  } catch (error) {
    console.error('[openai/route] Error getting app settings:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { prompt, messages: requestMessages, model, temperature, maxTokens, systemMessage, isInitialVisit = true } = body;

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

    // Get app settings for default values and master settings for backend configuration
    const settings = await getAppSettings();
    
    // Prepare OpenAI request
    let messages: ChatCompletionMessageParam[] = [];

    // Handle both formats: direct messages array or prompt parameter
    if (Array.isArray(requestMessages) && requestMessages.length > 0) {
      // Use the messages array directly if provided
      messages = requestMessages as ChatCompletionMessageParam[];
    } else if (prompt) {
      // Legacy format with prompt parameter
      // Add system message if provided
      if (systemMessage) {
        // Add formatting instructions to the system message
        const formattingInstructions = `
FORMATTING INSTRUCTIONS:
- Use clean section headers like "Subjective", "Objective", "Assessment", "Plan" without any prefixes
- Do NOT use "S-", "O-", "A-", "P-" prefixes before section headers
- Use proper markdown formatting with ## for main sections
- Keep section headers simple and consistent
`;
        messages.push({
          role: 'system',
          content: formattingInstructions + systemMessage,
        } as ChatCompletionMessageParam);
      } else if (settings && 'initialVisitPrompt' in settings && 'followUpVisitPrompt' in settings) {
        // Use the appropriate prompt based on isInitialVisit flag from request
        const appSettings = settings as AppSettings;
        
        // Get the base template from master settings
        const baseTemplate = await getSoapTemplate(isInitialVisit);
        const userPreferences = isInitialVisit ? appSettings.initialVisitPrompt : appSettings.followUpVisitPrompt;

        // Add formatting instructions to the prompt
        const formattingInstructions = `
FORMATTING INSTRUCTIONS:
- Use clean section headers like "Subjective", "Objective", "Assessment", "Plan" without any prefixes
- Do NOT use "S-", "O-", "A-", "P-" prefixes before section headers
- Use proper markdown formatting with ## for main sections
- Keep section headers simple and consistent

`;
        
        // Combine base template with user preferences
        const combinedContent = `${formattingInstructions}${baseTemplate}\n\n--- USER PREFERENCES ---\n${userPreferences}`;
        
        messages.push({
          role: 'system',
          content: combinedContent,
        } as ChatCompletionMessageParam);
      }

      // Add user prompt
      messages.push({
        role: 'user',
        content: prompt,
      } as ChatCompletionMessageParam);
    } else {
      // Neither prompt nor messages provided
      return NextResponse.json({ error: 'Either prompt or messages is required' }, { status: 400 });
    }

    // Determine which model to use: explicit model > user setting > master setting > default
    let selectedModel = model;
    if (!selectedModel) {
      selectedModel = settings?.gptModel;
    }
    if (!selectedModel) {
      selectedModel = await getModelForPurpose('generate_soap');
    }
    if (!selectedModel) {
      selectedModel = 'gpt-4o'; // Final fallback
    }

    console.log(`[openai/route] Using model: ${selectedModel}`);

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: selectedModel,
      messages,
      temperature: temperature !== undefined ? temperature : 0.7,
      max_tokens: maxTokens || 2000,
    });

    // Extract response
    const content = completion.choices[0]?.message?.content || '';

    return NextResponse.json({
      content,
      usage: completion.usage,
      model: completion.model,
    });
  } catch (error) {
    console.error('[openai/route] Error calling OpenAI:', error);

    // Handle OpenAI API errors
    if (error instanceof OpenAI.APIError) {
      return NextResponse.json(
        {
          error: 'OpenAI API error',
          message: error.message,
          type: error.type,
          code: error.status,
        },
        { status: error.status || 500 }
      );
    }

    // Handle other errors
    return NextResponse.json(
      {
        error: 'Server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
