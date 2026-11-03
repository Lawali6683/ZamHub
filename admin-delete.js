const reply = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

export const onRequestPost = async ({ request, env }) => {
  try {
    const key = env.SUPABASE_SECRET_KEY
    if (!key) return reply({ error: 'Server is not configured.' }, 500)
    const base = (env.SUPABASE_URL || 'https://avrqojegjalzeskmhsgr.supabase.co').replace(/\/$/, '')
    const headers = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }

    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    if (!token) return reply({ error: 'Please log in again.' }, 401)
    const who = await fetch(base + '/auth/v1/user', { headers: { apikey: key, Authorization: 'Bearer ' + token } })
    if (!who.ok) return reply({ error: 'Please log in again.' }, 401)
    const me = await who.json()

    const adm = await fetch(base + '/rest/v1/admin_emails?email=eq.' + encodeURIComponent(String(me.email).toLowerCase()) + '&select=email', { headers })
    const admins = adm.ok ? await adm.json() : []
    if (!admins.length) return reply({ error: 'Not allowed.' }, 403)

    let body = {}
    try { body = await request.json() } catch {}
    const target = String(body.user_id || '')
    if (!/^[0-9a-f-]{36}$/i.test(target)) return reply({ error: 'Invalid user.' }, 400)
    if (target === me.id) return reply({ error: 'You cannot delete yourself.' }, 400)

    const res = await fetch(base + '/auth/v1/admin/users/' + target, { method: 'DELETE', headers })
    if (!res.ok) return reply({ error: 'Could not delete this user.' }, 502)
    return reply({ ok: true })
  } catch (err) {
    return reply({ error: err.message || 'Server error' }, 500)
  }
}
