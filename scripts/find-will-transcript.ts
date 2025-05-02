import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // First find the patient with name like 'Titmus'
    const patient = await prisma.patient.findFirst({
      where: {
        name: {
          contains: 'Titmus'
        }
      }
    });

    if (!patient) {
      console.log('No patient with name containing "Titmus" found');
      return;
    }

    console.log(`Found patient: ${patient.name} (ID: ${patient.id})`);

    // Find the earliest note for this patient
    const earliestNote = await prisma.note.findFirst({
      where: {
        patientId: patient.id
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    if (!earliestNote) {
      console.log(`No notes found for patient ${patient.name}`);
      return;
    }

    console.log(`\nEarliest note date: ${earliestNote.createdAt}`);
    console.log(`\nTRANSCRIPT:\n${earliestNote.transcript}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
