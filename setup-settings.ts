import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const defaultSystemMessages = {
  initialVisit: "You are a medical scribe assistant. Your task is to generate a SOAP note for an INITIAL VISIT based on the provided medical visit transcript.",
  followUpVisit: "You are a medical scribe assistant. Your task is to generate a SOAP note for a FOLLOW-UP VISIT based on the provided medical visit transcript."
};

async function main() {
  // First clear any existing data to avoid conflicts
  await prisma.sOAPNote.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.appSettings.deleteMany({});

  // Restore settings with default system messages
  const settings = await prisma.appSettings.upsert({
    where: { id: 'default' },
    update: {
      darkMode: true,
      autoSave: true,
      gptModel: 'gpt-4-turbo-preview',
      initialVisitPrompt: defaultSystemMessages.initialVisit,
      followUpVisitPrompt: defaultSystemMessages.followUpVisit,
      updatedAt: new Date()
    },
    create: {
      id: 'default',
      darkMode: true,
      autoSave: true,
      gptModel: 'gpt-4-turbo-preview',
      initialVisitPrompt: defaultSystemMessages.initialVisit,
      followUpVisitPrompt: defaultSystemMessages.followUpVisit,
      updatedAt: new Date()
    }
  });
  console.log('Settings restored:', settings);

  // Restore Sarah's patient record
  const sarah = await prisma.patient.create({
    data: {
      name: 'Sarah',
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false
    }
  });
  console.log('Patient restored:', sarah);
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 