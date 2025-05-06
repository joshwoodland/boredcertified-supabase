import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { convertToAppFormat, getSupabasePatients, serverSupabase, SupabasePatient } from '@/app/lib/supabase';
import { createClient } from '@/app/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const filterByProvider = searchParams.get('filterByProvider') !== 'false'; // Default true

    // Check for search query
    const searchQuery = searchParams.get('search')?.toLowerCase();

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
      ? patients.filter((p: SupabasePatient) => p.name?.toLowerCase().includes(searchQuery))
      : patients;

    // Convert to App format for consistent API
    const formattedPatients = filteredPatients.map((p: SupabasePatient) => convertToAppFormat(p, 'patient')).filter(Boolean);

    return NextResponse.json(formattedPatients);
  } catch (error) {
    console.error('Error getting patients:', error);
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
      return NextResponse.json({ error: 'Failed to create patient' }, { status: 500 });
    }

    // Convert to App format for consistent API
    const formattedPatient = convertToAppFormat(data, 'patient');
    return NextResponse.json(formattedPatient);
  } catch (error) {
    console.error('Error creating patient:', error);
    return NextResponse.json({ error: 'Failed to create patient' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 });
    }

    const supabaseServer = await createClient();
    const now = new Date().toISOString();

    // Update the patient in Supabase
    const { data, error } = await supabaseServer
      .from('patients')
      .update({
        ...updates,
        updated_at: now
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating patient in Supabase:', error);
      return NextResponse.json({ error: 'Failed to update patient' }, { status: 500 });
    }

    // Convert to App format for consistent API
    const formattedPatient = convertToAppFormat(data, 'patient');
    return NextResponse.json(formattedPatient);
  } catch (error) {
    console.error('Error updating patient:', error);
    return NextResponse.json({ error: 'Failed to update patient' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 });
    }

    const supabaseServer = await createClient();
    const now = new Date().toISOString();

    // Soft delete the patient in Supabase
    const { data, error } = await supabaseServer
      .from('patients')
      .update({
        is_deleted: true,
        deleted_at: now,
        updated_at: now
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error deleting patient in Supabase:', error);
      return NextResponse.json({ error: 'Failed to delete patient' }, { status: 500 });
    }

    // Convert to App format for consistent API
    const formattedPatient = convertToAppFormat(data, 'patient');
    return NextResponse.json(formattedPatient);
  } catch (error) {
    console.error('Error deleting patient:', error);
    return NextResponse.json({ error: 'Failed to delete patient' }, { status: 500 });
  }
}
