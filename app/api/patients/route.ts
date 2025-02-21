import { NextResponse } from 'next/server'
import { prisma } from '@/app/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const showDeleted = searchParams.get('showDeleted') === 'true'

    const patients = await prisma.patient.findMany({
      where: {
        isDeleted: showDeleted,
      },
      include: {
        soapNotes: {
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

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const patient = await prisma.patient.create({
      data: {
        name: json.name,
      },
    })
    return NextResponse.json(patient)
  } catch (error) {
    console.error('Error creating patient:', error)
    return NextResponse.json({ error: 'Failed to create patient' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
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