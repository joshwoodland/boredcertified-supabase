import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request data
    const data = await request.json();
    const { deviceId, lastSyncTime, patients } = data;

    if (!deviceId) {
      return NextResponse.json({ error: 'Device ID is required' }, { status: 400 });
    }

    // Get patients modified since last sync
    let modifiedSince = new Date(0); // Default to epoch
    if (lastSyncTime) {
      modifiedSince = new Date(lastSyncTime);
    }

    // Get patients from server that were modified since last sync
    const serverPatients = await prisma.patient.findMany({
      where: {
        updatedAt: {
          gt: modifiedSince
        }
      }
    });

    // Process patients from client
    const conflicts = [];
    if (patients && patients.length > 0) {
      for (const patient of patients) {
        // Check if patient exists
        const existingPatient = await prisma.patient.findUnique({
          where: { id: patient.remote_id || patient.id }
        });

        if (existingPatient) {
          // Check for conflicts (both client and server modified)
          const clientModified = new Date(patient.updated_at);
          const serverModified = existingPatient.updatedAt;

          if (clientModified > modifiedSince && serverModified > modifiedSince) {
            // Conflict detected - for now, server wins
            conflicts.push({
              local: patient,
              remote: existingPatient
            });
          } else if (clientModified > serverModified) {
            // Client has newer version, update server
            await prisma.patient.update({
              where: { id: existingPatient.id },
              data: {
                name: patient.name,
                isDeleted: patient.is_deleted === 1,
                updatedAt: new Date()
              }
            });
          }
        } else {
          // New patient from client, create on server
          await prisma.patient.create({
            data: {
              id: patient.remote_id || patient.id,
              name: patient.name,
              isDeleted: patient.is_deleted === 1,
              createdAt: new Date(patient.created_at),
              updatedAt: new Date()
            }
          });
        }
      }
    }

    // Return updated patients and conflicts
    return NextResponse.json({
      patients: serverPatients,
      conflicts
    });
  } catch (error) {
    console.error('Error syncing patients:', error);
    return NextResponse.json(
      { error: 'Failed to sync patients' },
      { status: 500 }
    );
  }
}
