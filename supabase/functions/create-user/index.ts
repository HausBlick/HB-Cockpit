import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? ''

    // Verify caller via anon key (reads RLS-protected profiles)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin-Zugriff erforderlich' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Service-role client for user management
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    const users = Array.isArray(body) ? body : [body]

    const results = []

    for (const u of users) {
      if (!u.email || !u.full_name || !u.role) {
        results.push({ email: u.email || '?', success: false, error: 'E-Mail, Name und Rolle sind Pflichtfelder' })
        continue
      }

      try {
        let authUser

        if (u.password) {
          // Direct creation — no invitation email
          const { data, error } = await adminClient.auth.admin.createUser({
            email: u.email,
            password: u.password,
            email_confirm: true,
            user_metadata: { full_name: u.full_name }
          })
          if (error) throw new Error(error.message)
          authUser = data.user
        } else {
          // Invite by email — user sets own password
          const { data, error } = await adminClient.auth.admin.inviteUserByEmail(u.email, {
            data: { full_name: u.full_name }
          })
          if (error) throw new Error(error.message)
          authUser = data.user
        }

        if (!authUser) throw new Error('Kein Auth-User erstellt')

        // Create / update profile
        const { error: profileError } = await adminClient.from('profiles').upsert({
          id: authUser.id,
          email: u.email,
          full_name: u.full_name,
          role: u.role
        })
        if (profileError) throw new Error('Profil: ' + profileError.message)

        // Manager: assign buildings
        if (u.role === 'manager' && u.building_ids?.length) {
          for (const bid of u.building_ids) {
            await adminClient.from('management_assignments').upsert({
              manager_id: authUser.id,
              building_id: Number(bid)
            })
          }
        }

        results.push({ email: u.email, success: true, user_id: authUser.id })
      } catch (err: any) {
        results.push({ email: u.email, success: false, error: err.message })
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
