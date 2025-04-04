const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findLatestTranscripts() {
  try {
    const recentNotes = await prisma.note.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      take: 3,
      select: {
        id: true,
        createdAt: true,
        transcript: true,
        patientId: true,
        patient: {
          select: {
            name: true
          }
        }
      }
    });
    
    if (recentNotes.length > 0) {
      console.log(`Found ${recentNotes.length} recent notes:`);
      
      recentNotes.forEach((note, index) => {
        console.log(`\n==== NOTE ${index + 1} ====`);
        console.log(`ID: ${note.id}`);
        console.log(`Created at: ${note.createdAt}`);
        console.log(`Patient ID: ${note.patientId}`);
        console.log(`Patient name: ${note.patient?.name || 'Unknown'}`);
        console.log(`\nTranscript:\n${note.transcript}`);
        console.log('=================\n');
      });
    } else {
      console.log('No notes found in the database');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findLatestTranscripts(); 