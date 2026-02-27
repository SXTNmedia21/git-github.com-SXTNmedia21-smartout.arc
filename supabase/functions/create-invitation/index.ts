import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Verify authentication
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    const { workspace_id, company_id, invites } = await req.json()
    if (!workspace_id || !company_id || !invites || !Array.isArray(invites)) {
      throw new Error('Invalid request payload')
    }

    // Attempt to resolve the inviter's profile_id
    const { data: inviterProfile, error: profileError } = await supabaseClient
      .from('profile')
      .select('profile_id, role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single()

    if (profileError || !inviterProfile) {
      throw new Error('Could not verify your role in this workspace')
    }

    // Role check mapping, but RLS on the table should catch this anyway,
    // this is a helpful fail-fast.
    if (!['admin', 'owner'].includes(inviterProfile.role)) {
       throw new Error('Insufficient permissions to invite employees')
    }

    const recordsToInsert = invites.map((inv: any) => ({
      workspace_id,
      company_id,
      email: inv.email,
      first_name: inv.first_name,
      last_name: inv.last_name,
      role: inv.role || 'employee',
      department_ids: inv.department_ids || [],
      team_ids: inv.team_ids || [],
      status: 'pending',
      invited_by: inviterProfile.profile_id
    }))

    // RLS handles the permission verification at the DB layer during insert
    const { data: insertedInvites, error: insertError } = await supabaseClient
      .from('invitation')
      .insert(recordsToInsert)
      .select()

    if (insertError) {
      console.error('Insert error:', insertError)
      throw new Error('Failed to create invitations in the database')
    }

    // TODO: Dispatch transactional emails with the generated invitation tokens
    // e.g. using Resend: await resend.emails.send({...})
    // For now, we simulate this layer and echo back the tokens.

    return new Response(JSON.stringify({ 
      success: true, 
      count: insertedInvites.length,
      invitations: insertedInvites 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
