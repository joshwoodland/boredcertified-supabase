import { PrismaClient } from '@prisma/client'
import { systemMessage as initialVisitPrompt } from './app/config/initialVisitPrompt'
import { systemMessage as followUpVisitPrompt } from './app/config/followUpVisitPrompt'

const prisma = new PrismaClient()

async function main() {
  // Create or update default app settings
  await prisma.appSettings.upsert({
    where: { id: 'default' },
    update: {
      initialVisitPrompt: initialVisitPrompt.content,
      followUpVisitPrompt: followUpVisitPrompt.content,
    },
    create: {
      id: 'default',
      darkMode: false,
      gptModel: 'gpt-4o',
      initialVisitPrompt: initialVisitPrompt.content,
      followUpVisitPrompt: followUpVisitPrompt.content,
      autoSave: false,
    }
  })

  console.log('Settings initialized successfully')
}

main()
  .catch((e) => {
    console.log('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 