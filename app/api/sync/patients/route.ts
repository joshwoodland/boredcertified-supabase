import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/app/lib/supabase';
import { createClient } from '@/app/utils/supabase/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Get the provider's email from the query string
    const { searchParams } = new URL(request.url);
    const providerEmail = searchParams.get('provider_email');

    if (!providerEmail) {
      return NextResponse.json({ error: 'Provider email is required' }, { status: 400 });
    }

    // Get all patients for this provider
    const { data: serverPatients, error: patientsError } = await serverSupabase
      .from('patients')
      .select('*')
      .eq('provider_email', providerEmail);

    if (patientsError) {
      console.error('Error fetching patients:', patientsError);
      return NextResponse.json({ error: 'Failed to fetch patients' }, { status: 500 });
    }

    return NextResponse.json(serverPatients);
  } catch (error) {
    console.error('Error in sync/patients route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { patient, providerEmail } = await request.json();

    if (!patient || !providerEmail) {
      return NextResponse.json({ error: 'Patient data and provider email are required' }, { status: 400 });
    }

    // Check if patient already exists
    const { data: existingPatient, error: lookupError } = await serverSupabase
      .from('patients')
      .select('*')
      .eq('id', patient.id)
      .single();

    if (lookupError && lookupError.code !== 'PGRST116') { // PGRST116 means no rows found
      console.error('Error looking up patient:', lookupError);
      return NextResponse.json({ error: 'Failed to check for existing patient' }, { status: 500 });
    }

    if (existingPatient) {
      // Update existing patient
      const { error: updateError } = await serverSupabase
        .from('patients')
        .update({
          name: patient.name,
          is_deleted: patient.is_deleted,
          deleted_at: patient.deleted_at,
          provider_email: providerEmail,
          updated_at: new Date().toISOString()
        })
        .eq('id', patient.id);

      if (updateError) {
        console.error('Error updating patient:', updateError);
        return NextResponse.json({ error: 'Failed to update patient' }, { status: 500 });
      }
    } else {
      // Create new patient
      const { error: createError } = await serverSupabase
        .from('patients')
        .insert({
          id: patient.id,
          name: patient.name,
          is_deleted: patient.is_deleted,
          deleted_at: patient.deleted_at,
          provider_email: providerEmail,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (createError) {
        console.error('Error creating patient:', createError);
        return NextResponse.json({ error: 'Failed to create patient' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in sync/patients route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
