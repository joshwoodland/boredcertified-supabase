import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const settings = await prisma.appSettings.upsert({
    where: { id: 'default' },
    update: {
      darkMode: true,
      autoSave: true,
      gptModel: 'gpt-4-turbo-preview',
      initialVisitPrompt: '',
      followUpVisitPrompt: ''
    },
    create: {
      id: 'default',
      darkMode: true,
      autoSave: true,
      gptModel: 'gpt-4-turbo-preview',
      initialVisitPrompt: '',
      followUpVisitPrompt: ''
    }
  })
  console.log('Settings created/updated:', settings)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 