import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';
import {
  convertToAppFormat,
  convertToSupabaseFormat,
  type SupabasePatient,
  type AppPatient
} from '@/app/lib/supabaseTypes';
import { v4 as uuidv4 } from 'uuid';

// Helper function to check Supabase connection
async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const supabase = createClient();
    if (!supabase) {
      console.error('[patients/route] Failed to initialize Supabase client');
      return false;
    }

    const { data, error } = await supabase.from('patients').select('id').limit(1);
    if (error && error.code !== '42P01') { // 42P01 means table doesn't exist, which is fine
      console.error('[patients/route] Supabase connection error:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[patients/route] Failed to connect to Supabase:', error);
    return false;
  }
}

// GET handler for patients
export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const includeDeleted = searchParams.get('includeDeleted') === 'true';
    const searchTerm = searchParams.get('search') || '';

    // Check if Supabase is available
    const isSupabaseAvailable = await checkSupabaseConnection();
    if (!isSupabaseAvailable) {
      return NextResponse.json(
        {
          error: 'Database connection unavailable',
          details: 'Please check your database connection settings.',
        },
        { status: 503 }
      );
    }

    // Use standardized client initialization
    const supabase = createClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Failed to initialize database client' },
        { status: 500 }
      );
    }

    // Build query
    let query = supabase.from('patients').select('*');

    // Filter deleted patients unless includeDeleted is true
    if (!includeDeleted) {
      query = query.is('is_deleted', false);
    }

    // Add search filter if provided
    if (searchTerm) {
      query = query.ilike('name', `%${searchTerm}%`);
    }

    // Order by name
    query = query.order('name');

    // Execute query
    const { data: patients, error } = await query;

    if (error) {
      console.error('[patients/route] Error fetching patients:', error);
      return NextResponse.json(
        { error: 'Failed to fetch patients', details: error.message },
        { status: 500 }
      );
    }

    // Convert to app format and return
    const appPatients = patients.map(patient => convertToAppFormat(patient, 'patient')) as AppPatient[];
    return NextResponse.json(appPatients);
  } catch (error) {
    console.error('[patients/route] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST handler for creating a new patient
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { name, dateOfBirth, providerEmail } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json({ error: 'Patient name is required' }, { status: 400 });
    }

    // Check if Supabase is available
    const isSupabaseAvailable = await checkSupabaseConnection();
    if (!isSupabaseAvailable) {
      return NextResponse.json(
        {
          error: 'Database connection unavailable',
          details: 'Please check your database connection settings.',
        },
        { status: 503 }
      );
    }

    // Use standardized client initialization
    const supabase = createClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Failed to initialize database client' },
        { status: 500 }
      );
    }

    // Create a new patient
    const newPatient: Partial<SupabasePatient> = {
      id: uuidv4(),
      name,
      provider_email: providerEmail || null,
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Insert the patient into Supabase
    const { data: insertedPatient, error } = await supabase
      .from('patients')
      .insert(newPatient)
      .select()
      .single();

    if (error) {
      console.error('[patients/route] Error creating patient:', error);
      return NextResponse.json(
        { error: 'Failed to create patient', details: error.message },
        { status: 500 }
      );
    }

    // Convert to app format and return
    const appPatient = convertToAppFormat(insertedPatient, 'patient') as AppPatient;
    return NextResponse.json(appPatient);
  } catch (error) {
    console.error('[patients/route] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
