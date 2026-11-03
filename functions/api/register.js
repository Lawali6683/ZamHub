const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  })

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const makeCode = () =>
  `zmh/${String(new Date().getFullYear()).slice(2)}/${Math.floor(10000 + Math.random() * 90000)}`

export async function onRequestPost({ request, env }) {
  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid request.' }, 400)
  }

  const fullName = String(body.full_name || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const phone = String(body.phone || '').trim()
  const gender = String(body.gender || '')
  const courseId = String(body.course_id || '')
  const password = String(body.password || '')
  const device = body.device && typeof body.device === 'object' ? body.device : {}

  if (fullName.length < 3) return json({ error: 'Enter your full name.' }, 400)
  if (!emailRe.test(email)) return json({ error: 'Enter a valid email address.' }, 400)
  if (!/^\+?[0-9\s-]{7,16}$/.test(phone)) return json({ error: 'Enter a valid phone number.' }, 400)
  if (!['male', 'female'].includes(gender)) return json({ error: 'Select your gender.' }, 400)
  if (!uuidRe.test(courseId)) return json({ error: 'Select a course.' }, 400)
  if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400)

  const base = env.SUPABASE_URL || 'https://avrqojegjalzeskmhsgr.supabase.co'
  const key = env.SUPABASE_SECRET_KEY
  if (!key) return json({ error: 'Server is not configured.' }, 500)

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json'
  }

  const courseRes = await fetch(
    `${base}/rest/v1/view_courser?id=eq.${courseId}&select=id,course_name,price`,
    { headers }
  )
  const courses = courseRes.ok ? await courseRes.json() : []
  if (!courses.length) return json({ error: 'This course was not found.' }, 404)
  const course = courses[0]

  const createRes = await fetch(`${base}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    })
  })
  const created = await createRes.json().catch(() => ({}))
  if (!createRes.ok || !created.id) {
    const exists = /already|registered|exists/i.test(JSON.stringify(created))
    return json(
      { error: exists ? 'This email is already registered. Please log in.' : 'Could not create your account.' },
      exists ? 409 : 400
    )
  }

  const userId = created.id
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
  const cf = request.cf || {}

  let saved = false
  for (let i = 0; i < 5 && !saved; i++) {
    const res = await fetch(`${base}/rest/v1/user_profiles`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({
        id: userId,
        user_code: makeCode(),
        full_name: fullName,
        email,
        phone,
        gender,
        course_id: course.id,
        course_name: course.course_name,
        course_price: course.price,
        status: 'no',
        final_no: 'no',
        ip_address: ip,
        device_info: {
          ...device,
          country: cf.country || null,
          city: cf.city || null,
          user_agent: request.headers.get('User-Agent') || ''
        },
        requested_at: new Date().toISOString()
      })
    })
    if (res.ok) {
      saved = true
    } else {
      const text = await res.text()
      if (!/user_code/.test(text)) break
    }
  }

  if (!saved) {
    await fetch(`${base}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers })
    return json({ error: 'Registration failed. Please try again.' }, 500)
  }

  return json({ ok: true })
}
