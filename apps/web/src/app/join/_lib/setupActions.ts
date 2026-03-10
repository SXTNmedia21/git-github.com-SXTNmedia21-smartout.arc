'use server'

import { createAdminClient } from '@smartout/supabase/admin'
import { createClient } from '@smartout/supabase/server'

interface SetupData {
  step1: { email: string; companyName: string; websiteUrl: string }
  step2: {
    firstName: string
    lastName: string
    street: string
    postalCode: string
    city: string
    orgNumber: string
  }
  step3: { aboutUs: string; ourHistory?: string; ourConcept: string }
  step4: {
    openingHours: Array<{
      dayOfWeek: number
      isClosed: boolean
      openTime?: string
      closeTime?: string
    }>
    phone: string
    instagram?: string
    facebook?: string
  }
  step5: {
    restaurantType?: string
    cuisineTypes?: string[]
    priceCategory?: string
    menuDescription?: string
  }
  step6: { employeeCount?: string; teamInvites?: string[] }
}

export async function completeSignup(data: SetupData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const admin = createAdminClient()

  // ── Phase 1: Core setup (admin client, bypasses RLS) ──────────

  // 1. Update user_identity with name
  const { error: identityError } = await admin
    .from('user_identity')
    .update({
      first_name: data.step2.firstName,
      last_name: data.step2.lastName,
    })
    .eq('user_id', user.id)

  if (identityError) {
    console.error('[completeSignup] user_identity update failed:', identityError)
  }

  // 2. Create company
  const slug = data.step1.companyName
    .toLowerCase()
    .replace(/[^a-z0-9æøå]+/g, '-')
    .replace(/^-|-$/g, '')

  const { data: company, error: companyError } = await admin
    .from('company')
    .insert({
      name: data.step1.companyName,
      org_number: data.step2.orgNumber,
      address_line_1: data.step2.street,
      postal_code: data.step2.postalCode,
      city: data.step2.city,
      phone: data.step4.phone,
      email: user.email,
      website: data.step1.websiteUrl,
      industry: 'restaurant',
    })
    .select('company_id')
    .single()

  if (companyError || !company) {
    throw new Error(`Failed to create company: ${companyError?.message ?? 'unknown'}`)
  }

  // 3. Create workspace (check slug uniqueness)
  let finalSlug = slug
  const { data: existing } = await admin
    .from('workspace')
    .select('workspace_id')
    .eq('slug', slug)
    .limit(1)

  if (existing && existing.length > 0) {
    finalSlug = `${slug}-${Date.now().toString(36).slice(-4)}`
  }

  const { data: workspace, error: wsError } = await admin
    .from('workspace')
    .insert({
      company_id: company.company_id,
      name: data.step1.companyName,
      slug: finalSlug,
      phone: data.step4.phone,
      email: user.email,
    })
    .select('workspace_id')
    .single()

  if (wsError || !workspace) {
    throw new Error(`Failed to create workspace: ${wsError?.message ?? 'unknown'}`)
  }

  // 4. Create company_member
  const { error: memberError } = await admin.from('company_member').insert({
    user_id: user.id,
    company_id: company.company_id,
    role: 'owner',
  })

  if (memberError) {
    throw new Error(`Failed to create company_member: ${memberError.message}`)
  }

  // 5. Create profile
  const profileCode = Math.random().toString(16).slice(2, 8)
  const { error: profileError } = await admin.from('profile').insert({
    user_id: user.id,
    workspace_id: workspace.workspace_id,
    company_id: company.company_id,
    profile_code: profileCode,
    role: 'owner',
    status: 'active',
    display_name: `${data.step2.firstName} ${data.step2.lastName}`,
  })

  if (profileError) {
    throw new Error(`Failed to create profile: ${profileError.message}`)
  }

  // ── Phase 2: Extended data (user client, RLS works now) ───────
  // Re-create client to pick up new profile context
  const userClient = await createClient()

  // 6. Company details
  await userClient.from('company_details').insert({
    workspace_id: workspace.workspace_id,
    about_us: data.step3.aboutUs,
    our_history: data.step3.ourHistory || null,
    our_concept: data.step3.ourConcept,
    restaurant_type: data.step5.restaurantType || null,
    cuisine_types: data.step5.cuisineTypes || [],
    price_category: data.step5.priceCategory || null,
    menu_description: data.step5.menuDescription || null,
    employee_count: data.step6.employeeCount || null,
    ai_generated_fields: [],
  })

  // 7. Opening hours
  const hoursRows = data.step4.openingHours.map((h) => ({
    workspace_id: workspace.workspace_id,
    day_of_week: h.dayOfWeek,
    is_closed: h.isClosed,
    open_time: h.isClosed ? null : (h.openTime || null),
    close_time: h.isClosed ? null : (h.closeTime || null),
  }))
  await userClient.from('company_opening_hours').insert(hoursRows)

  // 8. Social media
  const socialRows: Array<{
    workspace_id: string
    platform: string
    url: string
  }> = []
  if (data.step4.instagram) {
    socialRows.push({
      workspace_id: workspace.workspace_id,
      platform: 'instagram',
      url: data.step4.instagram,
    })
  }
  if (data.step4.facebook) {
    socialRows.push({
      workspace_id: workspace.workspace_id,
      platform: 'facebook',
      url: data.step4.facebook,
    })
  }
  if (socialRows.length > 0) {
    await userClient.from('company_social_media').insert(socialRows)
  }

  // 9. Link scraped data to workspace
  await userClient
    .from('company_scraped_data')
    .update({ workspace_id: workspace.workspace_id })
    .eq('auth_id', user.id)

  // 10. Mark signup as completed
  await userClient
    .from('signup_progress')
    .update({ completed: true, current_step: 7 })
    .eq('auth_id', user.id)

  // 11. Team invitations (fire-and-forget via admin to bypass RLS)
  if (data.step6.teamInvites && data.step6.teamInvites.length > 0) {
    const { data: profile } = await admin
      .from('profile')
      .select('profile_id')
      .eq('user_id', user.id)
      .eq('workspace_id', workspace.workspace_id)
      .single()

    if (profile) {
      const invitations = data.step6.teamInvites.map((email) => ({
        workspace_id: workspace.workspace_id,
        company_id: company.company_id,
        email,
        role: 'employee' as const,
        status: 'pending' as const,
        invited_by: profile.profile_id,
      }))
      await admin.from('invitation').insert(invitations)
    }
  }

  return { workspaceId: workspace.workspace_id, slug: finalSlug }
}
