import { prisma } from '@/app/lib/db';

export async function getModelFromSettings() {
  const settings = await prisma.appSettings.findUnique({
    where: { id: 'default' },
  });

  if (!settings) {
    throw new Error('Settings not found');
  }

  return settings.gptModel;
} 