import { NextResponse } from 'next/server'
import { prisma } from '@/app/lib/db'
import fs from 'fs/promises'
import path from 'path'
import { SystemMessage, SystemMessageUpdate } from '@/app/config/types'

async function saveSystemMessage(type: 'initial' | 'followUp', update: SystemMessageUpdate) {
  const configDir = path.join(process.cwd(), 'app', 'config');
  const filename = type === 'initial' ? 'initialVisitPrompt.ts' : 'followUpVisitPrompt.ts';
  const filePath = path.join(configDir, filename);
  
  if (typeof update.content !== 'string') {
    throw new Error('System message content must be a string');
  }

  const systemMessage: SystemMessage = {
    content: update.content,
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
}

export async function GET() {
  try {
    // Get settings or create default if doesn't exist
    let settings = await prisma.appSettings.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      settings = await prisma.appSettings.create({
        data: {
          id: 'default',
          darkMode: false,
          gptModel: 'gpt-4',
          initialVisitPrompt: '',
          followUpVisitPrompt: '',
        },
      });
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

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const updates: { [key: string]: SystemMessage } = {};
    
    // Batch system message updates
    const systemMessagePromises = [];
    
    if (data.initialVisitPrompt !== undefined) {
      systemMessagePromises.push(
        saveSystemMessage('initial', {
          content: data.initialVisitPrompt,
          description: data.initialVisitDescription
        }).then(result => {
          updates.initialVisitPrompt = result;
        })
      );
    }
    
    if (data.followUpVisitPrompt !== undefined) {
      systemMessagePromises.push(
        saveSystemMessage('followUp', {
          content: data.followUpVisitPrompt,
          description: data.followUpVisitDescription
        }).then(result => {
          updates.followUpVisitPrompt = result;
        })
      );
    }

    // Wait for all system message updates to complete
    await Promise.all(systemMessagePromises);

    // Update database settings
    const settings = await prisma.appSettings.upsert({
      where: { id: 'default' },
      update: {
        darkMode: data.darkMode,
        gptModel: data.gptModel,
        initialVisitPrompt: data.initialVisitPrompt,
        followUpVisitPrompt: data.followUpVisitPrompt,
        updatedAt: new Date(),
      },
      create: {
        id: 'default',
        darkMode: data.darkMode,
        gptModel: data.gptModel,
        initialVisitPrompt: data.initialVisitPrompt,
        followUpVisitPrompt: data.followUpVisitPrompt,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      ...settings,
      systemMessages: updates,
      initialVisitPrompt: updates.initialVisitPrompt?.content || settings.initialVisitPrompt,
      followUpVisitPrompt: updates.followUpVisitPrompt?.content || settings.followUpVisitPrompt,
    });
  } catch (error) {
    console.error('Settings update failed:', error);
    return NextResponse.json({ 
      error: 'Failed to update settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 