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

    // Find all notes for this patient, ordered by creation date
    const notes = await prisma.note.findMany({
      where: {
        patientId: patient.id
      },
      orderBy: {
        createdAt: 'asc'
      },
      select: {
        id: true,
        createdAt: true,
        isInitialVisit: true
      }
    });

    if (notes.length === 0) {
      console.log(`No notes found for patient ${patient.name}`);
      return;
    }

    console.log(`\nFound ${notes.length} notes for ${patient.name}:`);
    notes.forEach((note, index) => {
      console.log(`${index + 1}. Date: ${note.createdAt} - ID: ${note.id} - Initial Visit: ${note.isInitialVisit}`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
