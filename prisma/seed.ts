import { PrismaClient } from '@prisma/client'
import { systemMessage as initialVisitPrompt } from '../app/config/initialVisitPrompt'
import { systemMessage as followUpVisitPrompt } from '../app/config/followUpVisitPrompt'
import { MODEL_MAP } from '../app/config/models'

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

  // Create a test patient if none exists
  const existingPatients = await prisma.patient.count()
  if (existingPatients === 0) {
    await prisma.patient.create({
      data: {
        name: 'Test Patient',
        isDeleted: false,
      }
    })
  }

  console.log('Seed data created successfully')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 