import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Create temp directory if it doesn't exist
const TEMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR);
}

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize SQLite Prisma client
const sqlitePrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:../prisma/dev.db',
    },
  },
});

// Initialize PostgreSQL Prisma client
const postgresPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function exportSqliteData() {
  console.log('Exporting data from SQLite...');
  
  // Export patients
  const patients = await sqlitePrisma.patient.findMany({
    include: { notes: true },
  });
  fs.writeFileSync(
    path.join(TEMP_DIR, 'patients.json'),
    JSON.stringify(patients, null, 2)
  );
  console.log(`Exported ${patients.length} patients`);
  
  // Export app settings
  const settings = await sqlitePrisma.appSettings.findUnique({
    where: { id: 'default' },
  });
  fs.writeFileSync(
    path.join(TEMP_DIR, 'settings.json'),
    JSON.stringify(settings, null, 2)
  );
  console.log('Exported app settings');
  
  return { patients, settings };
}

interface Patient {
  id: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  name: string;
  isDeleted: boolean;
  deletedAt: string | Date | null;
  notes: Note[];
}

interface Note {
  id: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  patientId: string;
  transcript: string;
  content: string;
  summary: string | null;
  audioFileUrl: string | null;
  isInitialVisit: boolean;
}

interface AppSettings {
  id: string;
  darkMode: boolean;
  gptModel: string;
  initialVisitPrompt: string;
  followUpVisitPrompt: string;
  autoSave: boolean;
  lowEchoCancellation: boolean;
  updatedAt: string | Date;
}

async function importToPostgres(data: { patients: Patient[], settings: AppSettings | null }) {
  console.log('Importing data to PostgreSQL...');
  
  // Import app settings
  if (data.settings) {
    await postgresPrisma.appSettings.upsert({
      where: { id: 'default' },
      update: {
        ...data.settings,
        updatedAt: new Date(),
      },
      create: {
        ...data.settings,
        updatedAt: new Date(),
      },
    });
    console.log('Imported app settings');
  }
  
  // Import patients and notes
  for (const patient of data.patients) {
    const { notes, ...patientData } = patient;
    
    // Create the patient
    const createdPatient = await postgresPrisma.patient.upsert({
      where: { id: patient.id },
      update: {
        ...patientData,
        updatedAt: new Date(),
      },
      create: {
        ...patientData,
        createdAt: new Date(patientData.createdAt),
        updatedAt: new Date(),
        deletedAt: patientData.deletedAt ? new Date(patientData.deletedAt) : null,
      },
    });
    
    // Create all associated notes
    if (notes && notes.length > 0) {
      for (const note of notes) {
        await postgresPrisma.note.upsert({
          where: { id: note.id },
          update: {
            ...note,
            updatedAt: new Date(),
          },
          create: {
            ...note,
            createdAt: new Date(note.createdAt),
            updatedAt: new Date(),
            patientId: createdPatient.id,
          },
        });
      }
      console.log(`Imported ${notes.length} notes for patient ${patient.name}`);
    }
  }
  
  console.log(`Imported ${data.patients.length} patients`);
}

async function testPostgresConnection() {
  try {
    await postgresPrisma.$queryRaw`SELECT 1`;
    console.log('PostgreSQL connection test successful');
    return true;
  } catch (error) {
    console.error('PostgreSQL connection test failed:', error);
    return false;
  }
}

async function main() {
  console.log('Starting database migration from SQLite to PostgreSQL...');
  
  try {
    // Test PostgreSQL connection
    const isPostgresConnected = await testPostgresConnection();
    if (!isPostgresConnected) {
      console.error('Cannot proceed with migration due to PostgreSQL connection failure');
      process.exit(1);
    }
    
    // Export data from SQLite
    const data = await exportSqliteData();
    
    // Import data to PostgreSQL
    await importToPostgres(data);
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    // Close database connections
    await sqlitePrisma.$disconnect();
    await postgresPrisma.$disconnect();
  }
}

main();
