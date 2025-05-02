import { NextRequest, NextResponse } from 'next/server'
import { prisma, connectWithFallback } from '@/app/lib/db'
import { Prisma } from '@prisma/client'
import { checkSupabaseConnection, getSupabasePatients, convertToPrismaFormat, supabase } from '@/app/lib/supabase'

// Define interfaces for the data structures
interface Note {
  id: string;
  patientId: string;
  transcript: string;
  content: string;
  summary: string | null;
  audioFileUrl: string | null;
  isInitialVisit: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Patient {
  id: string;
  name: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  providerEmail: string | null;
  notes: Note[];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const showDeleted = searchParams.get('showDeleted') === 'true'
    
    // First check if Supabase is available
    const isSupabaseAvailable = await checkSupabaseConnection()
    
    if (isSupabaseAvailable) {
      // Use Supabase for data retrieval
      console.log('Using Supabase for patients GET')
      
      // Get patients from Supabase
      const supabasePatients = await getSupabasePatients()
      
      // Filter based on showDeleted parameter
      const filteredPatients = supabasePatients.filter(patient => 
        patient.is_deleted === showDeleted
      )
      
      // Convert to Prisma format and add notes array
      const patients = filteredPatients.map(patient => {
        const convertedPatient = convertToPrismaFormat(patient, 'patient') as Patient;
        if (convertedPatient) {
          convertedPatient.notes = [];
        }
        return convertedPatient;
      }).filter(Boolean) as Patient[];
      
      // For each patient, get their most recent note (if any)
      for (const patient of patients) {
        const { data: notes } = await supabase
          .from('notes')
          .select('*')
          .eq('patient_id', patient.id)
          .order('created_at', { ascending: false })
          .limit(1)
        
        if (notes && notes.length > 0) {
          const convertedNote = convertToPrismaFormat(notes[0], 'note') as Note;
          if (convertedNote) {
            patient.notes = [convertedNote];
          }
        }
      }
      
      // Sort patients as required
      patients.sort((a, b) => {
        // Always prioritize patients without notes but sort them by creation date (newest first)
        if (a.notes.length === 0 && b.notes.length === 0) {
          return b.createdAt.getTime() - a.createdAt.getTime();
        }

        // If patient A has no notes (new) and patient B has notes, A comes first
        if (a.notes.length === 0 && b.notes.length > 0) return -1;

        // If patient B has no notes (new) and patient A has notes, B comes first
        if (a.notes.length > 0 && b.notes.length === 0) return 1;

        // If both have notes, compare by most recent note's creation date
        return b.notes[0].createdAt.getTime() - a.notes[0].createdAt.getTime();
      });
      
      return NextResponse.json(patients)
    } else {
      // Fall back to Prisma/SQLite
      console.log('Falling back to Prisma for patients GET')
      
      const db = await connectWithFallback()
      
      // First get all patients with their most recent note
      const patients = await db.patient.findMany({
        where: {
          isDeleted: showDeleted,
        },
        include: {
          notes: {
            orderBy: {
              createdAt: 'desc'
            },
            take: 1
          }
        }
      })

      // Then manually sort them by the most recent note's creation date or creation time for new patients
      patients.sort((a, b) => {
        // Always prioritize patients without notes but sort them by creation date (newest first)
        // This ensures newly created patients appear at the top
        if (a.notes.length === 0 && b.notes.length === 0) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }

        // If patient A has no notes (new) and patient B has notes, A comes first
        if (a.notes.length === 0 && b.notes.length > 0) return -1;

        // If patient B has no notes (new) and patient A has notes, B comes first
        if (a.notes.length > 0 && b.notes.length === 0) return 1;

        // If both have notes, compare by most recent note's creation date
        return new Date(b.notes[0].createdAt).getTime() - new Date(a.notes[0].createdAt).getTime();
      });
      
      return NextResponse.json(patients)
    }
  } catch (error) {
    console.error('Error fetching patients:', error)
    return NextResponse.json({ error: 'Failed to fetch patients' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  console.log('POST /api/patients - Starting request processing');

  try {
    const json = await request.json();
    console.log('Received request body:', json);

    if (!json.name || typeof json.name !== 'string') {
      console.log('Invalid request: missing or invalid name');
      return NextResponse.json(
        { error: 'Invalid or missing patient name' },
        { status: 400 }
      );
    }

    const trimmedName = json.name.trim();
    console.log('Creating patient with name:', trimmedName);
    
    // Check if Supabase is available
    const isSupabaseAvailable = await checkSupabaseConnection();
    
    if (isSupabaseAvailable) {
      console.log('Using Supabase for patient creation');
      
      try {
        // Get current user's session to access their email
        const { data: { session } } = await supabase.auth.getSession();
        const userEmail = session?.user?.email;
        
        // Generate a new UUID for the patient
        const patientId = crypto.randomUUID();
        const now = new Date().toISOString();
        
        // Insert patient into Supabase with provider email
        const { data, error } = await supabase
          .from('patients')
          .insert({
            id: patientId,
            name: trimmedName,
            is_deleted: false,
            created_at: now,
            updated_at: now,
            provider_email: userEmail
          })
          .select()
          .single();
          
        if (error) throw error;
        
        // Convert to Prisma format for consistent response
        const patient = convertToPrismaFormat(data, 'patient') as Patient;
        if (!patient) {
          throw new Error('Failed to convert patient data');
        }
        
        // Add empty notes array for consistency with Prisma response
        patient.notes = [];
        
        console.log('Patient created successfully in Supabase:', patient);
        return NextResponse.json(patient, { status: 201 });
      } catch (error) {
        console.error('Error creating patient in Supabase:', error);
        // Fall through to Prisma if Supabase operation fails
        console.log('Falling back to Prisma for patient creation');
      }
    }
    
    // Fallback to Prisma/SQLite
    console.log('Using Prisma for patient creation');
    
    // Check database connection first
    try {
      await prisma.$connect();
      console.log('Database connection successful');
    } catch (connectionError) {
      console.error('Database connection error:', connectionError);
      return NextResponse.json(
        { error: 'Database connection failed', details: 'Could not connect to the database' },
        { status: 503 }
      );
    }

    try {
      // Create the patient with all necessary fields
      const patient = await prisma.patient.create({
        data: {
          name: trimmedName,
          isDeleted: false,
        },
        include: {
          notes: {
            orderBy: {
              createdAt: 'desc'
            },
            take: 1
          }
        }
      });

      console.log('Patient created successfully in Prisma:', patient);
      return NextResponse.json(patient, { status: 201 });

    } catch (dbError) {
      console.error('Database operation error:', dbError);

      if (dbError instanceof Prisma.PrismaClientKnownRequestError) {
        // Handle known Prisma errors
        if (dbError.code === 'P2002') {
          return NextResponse.json(
            { error: 'A patient with this name already exists' },
            { status: 409 }
          );
        }
      }

      throw dbError; // Re-throw for general error handling
    }
  } catch (error) {
    console.error('Error creating patient:', error);
    return NextResponse.json(
      {
        error: 'Failed to create patient',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    try {
      await prisma.$disconnect();
      console.log('Database disconnected successfully');
    } catch (disconnectError) {
      console.error('Error disconnecting from database:', disconnectError);
    }
  }
}

export async function PUT(request: NextRequest) {
  try {
    const json = await request.json()
    const { id, action, name } = json
    
    // Check if Supabase is available
    const isSupabaseAvailable = await checkSupabaseConnection();
    
    if (isSupabaseAvailable) {
      console.log('Using Supabase for patient update');
      
      if (action === 'moveToTrash') {
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from('patients')
          .update({
            is_deleted: true,
            deleted_at: now,
            updated_at: now
          })
          .eq('id', id)
          .select()
          .single();
          
        if (error) throw error;
        
        // Convert to Prisma format for consistent response
        const patient = convertToPrismaFormat(data, 'patient') as Patient;
        patient.notes = []; // Add empty notes array for consistency
        return NextResponse.json(patient);
      }

      if (action === 'restore') {
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from('patients')
          .update({
            is_deleted: false,
            deleted_at: null,
            updated_at: now
          })
          .eq('id', id)
          .select()
          .single();
          
        if (error) throw error;
        
        // Convert to Prisma format for consistent response
        const patient = convertToPrismaFormat(data, 'patient') as Patient;
        patient.notes = []; // Add empty notes array for consistency
        return NextResponse.json(patient);
      }

      if (action === 'rename') {
        if (!name || typeof name !== 'string') {
          return NextResponse.json({ error: 'Invalid name provided' }, { status: 400 })
        }
        
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from('patients')
          .update({
            name: name,
            updated_at: now
          })
          .eq('id', id)
          .select()
          .single();
          
        if (error) throw error;
        
        // Convert to Prisma format for consistent response
        const patient = convertToPrismaFormat(data, 'patient') as Patient;
        patient.notes = []; // Add empty notes array for consistency
        return NextResponse.json(patient);
      }
      
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    } else {
      // Fallback to Prisma
      console.log('Falling back to Prisma for patient update');
      
      if (action === 'moveToTrash') {
        const patient = await prisma.patient.update({
          where: { id },
          data: {
            isDeleted: true,
            deletedAt: new Date(),
          },
        })
        return NextResponse.json(patient)
      }

      if (action === 'restore') {
        const patient = await prisma.patient.update({
          where: { id },
          data: {
            isDeleted: false,
            deletedAt: null,
          },
        })
        return NextResponse.json(patient)
      }

      if (action === 'rename') {
        if (!name || typeof name !== 'string') {
          return NextResponse.json({ error: 'Invalid name provided' }, { status: 400 })
        }
        const patient = await prisma.patient.update({
          where: { id },
          data: { name },
        })
        return NextResponse.json(patient)
      }

      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error updating patient:', error)
    return NextResponse.json({ error: 'Failed to update patient' }, { status: 500 })
  }
}
