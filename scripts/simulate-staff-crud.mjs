#!/usr/bin/env node
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function main() {
  console.log('Starting staff CRUD simulation')

  // 1) Create a credential (auth user)
  const testEmail = `simulate+${Date.now()}@example.com`
  const testPassword = 'TempPass123!'

  console.log('Creating auth user with email:', testEmail)
  const { data: authUserData, error: authErr } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { first_name: 'Sim', last_name: 'User', employee_id: `SIM${Date.now()}` },
  })

  if (authErr) {
    console.error('Failed to create auth user:', authErr)
    process.exit(1)
  }

  const userId = authUserData.user.id
  console.log('Auth user created, id=', userId)

  // 2) Create profile in user_profiles
  const profilePayload = {
    id: userId,
    email: testEmail,
    first_name: 'Sim',
    last_name: 'User',
    employee_id: `SIM${Date.now()}`,
    department_id: null,
    assigned_location_id: null,
    position: 'Simulation Tester',
    role: 'staff',
    is_active: true,
  }

  const { data: insertedProfile, error: insertErr } = await supabase.from('user_profiles').insert(profilePayload).select().single()
  if (insertErr) {
    console.error('Failed to insert profile, cleaning up auth user and exiting:', insertErr)
    await supabase.auth.admin.deleteUser(userId).catch(() => {})
    process.exit(1)
  }

  console.log('Profile created:', insertedProfile.id)

  // Add audit log for creation
  await supabase.from('audit_logs').insert({
    user_id: null,
    action: 'create_staff',
    table_name: 'user_profiles',
    record_id: userId,
    new_values: insertedProfile,
  }).catch((e) => console.warn('Audit log create failed:', e))

  // 3) Edit the staff: change first_name and position
  console.log('Updating staff first_name -> Sim2 and position -> Senior Tester')
  const beforeSnapshot = { first_name: insertedProfile.first_name, position: insertedProfile.position }

  const { data: updatedProfile, error: updateErr } = await supabase
    .from('user_profiles')
    .update({ first_name: 'Sim2', position: 'Senior Tester', updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()

  if (updateErr) {
    console.error('Failed to update profile:', updateErr)
  } else {
    console.log('Profile updated:', updatedProfile.id)
    await supabase.from('audit_logs').insert({
      user_id: null,
      action: 'update_staff',
      table_name: 'user_profiles',
      record_id: userId,
      old_values: beforeSnapshot,
      new_values: { first_name: updatedProfile.first_name, position: updatedProfile.position },
    }).catch((e) => console.warn('Audit log update failed:', e))
  }

  // 4) Revert the edit
  console.log('Reverting profile to previous values')
  const { data: revertedProfile, error: revertErr } = await supabase
    .from('user_profiles')
    .update({ first_name: beforeSnapshot.first_name, position: beforeSnapshot.position, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()

  if (revertErr) {
    console.error('Failed to revert profile:', revertErr)
  } else {
    console.log('Profile reverted:', revertedProfile.id)
    await supabase.from('audit_logs').insert({
      user_id: null,
      action: 'update_staff',
      table_name: 'user_profiles',
      record_id: userId,
      old_values: { first_name: updatedProfile?.first_name, position: updatedProfile?.position },
      new_values: revertedProfile,
    }).catch((e) => console.warn('Audit log revert failed:', e))
  }

  // 5) Clean up: delete created auth user and profile
  console.log('Cleaning up: deleting profile and auth user')
  await supabase.from('user_profiles').delete().eq('id', userId).catch((e) => console.warn('Profile delete failed:', e))
  await supabase.auth.admin.deleteUser(userId).catch((e) => console.warn('Auth user delete failed:', e))

  console.log('Simulation completed successfully')
}

main().catch((err) => {
  console.error('Unhandled error in simulation:', err)
  process.exit(1)
})
