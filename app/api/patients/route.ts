import { NextRequest, NextResponse } from 'next/server';
import { prisma, connectWithFallback } from '@/app/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { convertToPrismaFormat, getSupabasePatients, serverSupabase } from '@/app/lib/supabase';
import { createClient } from '@/app/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const filterByProvider = searchParams.get('filterByProvider') !== 'false'; // Default true
    
    // Check for search query
    const searchQuery = searchParams.get('search')?.toLowerCase();
    
    // First try to get patients from Supabase
    try {
      const supabaseServer = await createClient();
      
      // First get the user's session
      const { data: { session } } = await supabaseServer.auth.getSession();
      const userEmail = session?.user?.email;
      
      console.log('Providers API - auth session:', { 
        hasSession: !!session,
        userEmail 
      });
      
      // Get patients from Supabase using the server-side function
      const patients = await getSupabasePatients(filterByProvider ? userEmail : null);
      
      // Filter by search query if provided
      const filteredPatients = searchQuery
        ? patients.filter(p => p.name?.toLowerCase().includes(searchQuery))
        : patients;
      
      // Convert to Prisma format for consistent API
      const formattedPatients = filteredPatients.map(p => 
        convertToPrismaFormat(p, 'patient')
      ).filter(Boolean);
      
      return NextResponse.json(formattedPatients);
    } catch (error) {
      console.error('Error getting patients from Supabase:', error);
      // Fall through to Prisma if Supabase fails
    }
    
    // Fallback to Prisma
    console.log('Falling back to Prisma for patients API');
    const db = await connectWithFallback();
    
    // Get the user's email from the request headers or query param
    const userEmail = request.headers.get('x-user-email') || 
                     (filterByProvider ? searchParams.get('email') : null); 
    
    console.log(`Patients API - Provider email: ${userEmail || 'none'}`);
    
    // Build the base query
    const patientsQuery = {
      where: {
        isDeleted: false,
        ...(searchQuery ? { name: { contains: searchQuery, mode: 'insensitive' as const } } : {})
      },
      orderBy: { createdAt: 'desc' as const }
    };
    
    const patients = await db.patient.findMany(patientsQuery);
    return NextResponse.json(patients);
  } catch (error) {
    console.error('Error fetching patients:', error);
    return NextResponse.json({ error: 'Failed to fetch patients' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Try with Supabase first
    try {
      const supabaseServer = await createClient();
      
      // Get the user's email from their session
      const { data: { session } } = await supabaseServer.auth.getSession();
      const userEmail = session?.user?.email;
      
      if (!userEmail) {
        console.warn('No user email found in session for creating patient');
      }
      
      const patientId = body.id || uuidv4();
      const now = new Date().toISOString();
      
      // Create the patient in Supabase
      const { data, error } = await supabaseServer.from('patients').insert({
        id: patientId,
        name: body.name,
        provider_email: userEmail || body.providerEmail || null,
        is_deleted: false,
        created_at: now,
        updated_at: now
      }).select().single();
      
      if (error) {
        console.error('Error creating patient in Supabase:', error);
        throw error;
      }
      
      // Convert to Prisma format for consistent API
      const formattedPatient = convertToPrismaFormat(data, 'patient');
      return NextResponse.json(formattedPatient);
    } catch (error) {
      console.error('Error creating patient in Supabase:', error);
      // Fall through to Prisma as fallback
    }
    
    // Fallback to Prisma
    console.log('Falling back to Prisma for patient creation');
    const db = await connectWithFallback();
    
    // We don't have providerEmail in the Prisma schema according to the error
    const patient = await db.patient.create({
      data: {
        id: body.id || undefined, // Let Prisma generate UUID if not provided
        name: body.name,
      },
    });
    
    return NextResponse.json(patient);
  } catch (error) {
    console.error('Error creating patient:', error);
    return NextResponse.json({ error: 'Failed to create patient' }, { status: 500 });
  }
}

// For update and delete functionality
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.id) {
      return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 });
    }

    // Try with Supabase first
    try {
      const supabaseServer = await createClient();
      
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString()
      };
      
      if (body.name !== undefined) updateData.name = body.name;
      if (body.isDeleted !== undefined) updateData.is_deleted = body.isDeleted;
      if (body.deletedAt !== undefined) {
        updateData.deleted_at = body.deletedAt ? new Date(body.deletedAt).toISOString() : null;
      }
      if (body.providerEmail !== undefined) updateData.provider_email = body.providerEmail;
      
      // Update the patient in Supabase
      const { data, error } = await supabaseServer
        .from('patients')
        .update(updateData)
        .eq('id', body.id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating patient in Supabase:', error);
        throw error;
      }
      
      // Convert to Prisma format for consistent API
      const formattedPatient = convertToPrismaFormat(data, 'patient');
      return NextResponse.json(formattedPatient);
    } catch (error) {
      console.error('Error updating patient in Supabase:', error);
      // Fall through to Prisma as fallback
    }
    
    // Fallback to Prisma
    const db = await connectWithFallback();
    
    // Define update data with proper type
    const updateData: {
      name?: string;
      isDeleted?: boolean;
      deletedAt?: Date | null;
    } = {};
    
    if (body.name !== undefined) updateData.name = body.name;
    if (body.isDeleted !== undefined) updateData.isDeleted = body.isDeleted;
    if (body.deletedAt !== undefined) {
      updateData.deletedAt = body.deletedAt ? new Date(body.deletedAt) : null;
    }
    
    const patient = await db.patient.update({
      where: { id: body.id },
      data: updateData
    });
    
    return NextResponse.json(patient);
  } catch (error) {
    console.error('Error updating patient:', error);
    return NextResponse.json({ error: 'Failed to update patient' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const patientId = searchParams.get('id');
    
    if (!patientId) {
      return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 });
    }
    
    // Try with Supabase first - we'll do a soft delete
    try {
      const supabaseServer = await createClient();
      
      // Soft delete the patient in Supabase
      const now = new Date().toISOString();
      const { error } = await supabaseServer
        .from('patients')
        .update({
          is_deleted: true,
          deleted_at: now,
          updated_at: now
        })
        .eq('id', patientId);
      
      if (error) {
        console.error('Error soft-deleting patient in Supabase:', error);
        throw error;
      }
      
      return NextResponse.json({ success: true, id: patientId });
    } catch (error) {
      console.error('Error deleting patient in Supabase:', error);
      // Fall through to Prisma as fallback
    }
    
    // Fallback to Prisma - also soft delete
    const db = await connectWithFallback();
    
    await db.patient.update({
      where: { id: patientId },
      data: { isDeleted: true, deletedAt: new Date() }
    });
    
    return NextResponse.json({ success: true, id: patientId });
  } catch (error) {
    console.error('Error deleting patient:', error);
    return NextResponse.json({ error: 'Failed to delete patient' }, { status: 500 });
  }
}
