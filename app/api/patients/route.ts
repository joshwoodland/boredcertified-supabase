import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/db'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const showDeleted = searchParams.get('showDeleted') === 'true'

    const patients = await prisma.patient.findMany({
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
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })
    return NextResponse.json(patients)
  } catch (error) {
    console.error('Error fetching patients:', error)
    return NextResponse.json({ error: 'Failed to fetch patients' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  console.log('POST /api/patients - Starting request processing');
  
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

      console.log('Patient created successfully:', patient);
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
  } catch (error) {
    console.error('Error updating patient:', error)
    return NextResponse.json({ error: 'Failed to update patient' }, { status: 500 })
  }
} 