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
    const { deviceId, lastSyncTime, notes } = data;

    if (!deviceId) {
      return NextResponse.json({ error: 'Device ID is required' }, { status: 400 });
    }

    // Get notes modified since last sync
    let modifiedSince = new Date(0); // Default to epoch
    if (lastSyncTime) {
      modifiedSince = new Date(lastSyncTime);
    }

    // Get notes from server that were modified since last sync
    const serverNotes = await prisma.note.findMany({
      where: {
        updatedAt: {
          gt: modifiedSince
        }
      }
    });

    // Process notes from client
    const conflicts = [];
    if (notes && notes.length > 0) {
      for (const note of notes) {
        // Check if note exists
        const existingNote = await prisma.note.findUnique({
          where: { id: note.remote_id || note.id }
        });

        if (existingNote) {
          // Check for conflicts (both client and server modified)
          const clientModified = new Date(note.updated_at);
          const serverModified = existingNote.updatedAt;

          if (clientModified > modifiedSince && serverModified > modifiedSince) {
            // Conflict detected - for now, server wins
            conflicts.push({
              local: note,
              remote: existingNote
            });
          } else if (clientModified > serverModified) {
            // Client has newer version, update server
            await prisma.note.update({
              where: { id: existingNote.id },
              data: {
                title: note.title,
                content: note.content,
                transcript: note.transcript,
                summary: note.summary,
                visitType: note.visit_type,
                visitDate: note.visit_date ? new Date(note.visit_date) : null,
                isDeleted: note.is_deleted === 1,
                updatedAt: new Date()
              }
            });
          }
        } else {
          // New note from client, create on server
          await prisma.note.create({
            data: {
              id: note.remote_id || note.id,
              patientId: note.patient_id,
              title: note.title,
              content: note.content,
              transcript: note.transcript,
              summary: note.summary,
              visitType: note.visit_type,
              visitDate: note.visit_date ? new Date(note.visit_date) : new Date(),
              isDeleted: note.is_deleted === 1,
              createdAt: new Date(note.created_at),
              updatedAt: new Date()
            }
          });
        }
      }
    }

    // Return updated notes and conflicts
    return NextResponse.json({
      notes: serverNotes,
      conflicts
    });
  } catch (error) {
    console.error('Error syncing notes:', error);
    return NextResponse.json(
      { error: 'Failed to sync notes' },
      { status: 500 }
    );
  }
}
