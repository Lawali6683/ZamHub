const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS }
  })
}

function genRef() {
  return 'ZMH-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase()
}

async function sb(env, path) {
  const base = (env.SUPABASE_URL || 'https://avrqojegjalzeskmhsgr.supabase.co').replace(/\/$/, '')
  const key = env.SUPABASE_SECRET_KEY
  const res = await fetch(base + path, { headers: { apikey: key, Authorization: 'Bearer ' + key } })
  if (!res.ok) throw new Error('Supabase error ' + res.status)
  return res.json()
}

export const onRequestPost = async ({ request, env }) => {
  try {
    const secretKey = env.PAY_SECRET_KEY
    if (!secretKey || !env.SUPABASE_SECRET_KEY) return json({ success: false, error: 'Server is not configured' }, 500)

    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    if (!token) return json({ success: false, error: 'Please log in again' }, 401)

    const base = (env.SUPABASE_URL || 'https://avrqojegjalzeskmhsgr.supabase.co').replace(/\/$/, '')
    const who = await fetch(base + '/auth/v1/user', {
      headers: { apikey: env.SUPABASE_SECRET_KEY, Authorization: 'Bearer ' + token }
    })
    if (!who.ok) return json({ success: false, error: 'Please log in again' }, 401)
    const authUser = await who.json()
    const userId = authUser.id

    let body = {}
    try { body = await request.json() } catch {}

    const profiles = await sb(env, '/rest/v1/user_profiles?id=eq.' + encodeURIComponent(userId) + '&select=*')
    if (!profiles.length) return json({ success: false, error: 'User profile not found' }, 404)
    const profile = profiles[0]

    let kind = 'first'
    let courseId = profile.course_id
    if (profile.status === 'active') {
      kind = 'extra'
      courseId = String(body.course_id || '')
      if (!/^[0-9a-f-]{36}$/i.test(courseId)) return json({ success: false, error: 'Select a course' }, 400)
      const owned = await sb(env, '/rest/v1/user_courses?user_id=eq.' + userId + '&course_id=eq.' + courseId + '&select=id')
      if (owned.length) return json({ success: false, error: 'You already own this course' }, 400)
    }
    if (!courseId) return json({ success: false, error: 'No course selected' }, 400)

    const courses = await sb(env, '/rest/v1/view_courser?id=eq.' + encodeURIComponent(courseId) + '&select=id,course_name,price')
    if (!courses.length) return json({ success: false, error: 'Course not found' }, 404)
    const course = courses[0]
    const price = Math.round(Number(course.price))
    if (!price || price <= 0) return json({ success: false, error: 'Valid course price is required' }, 400)

    const reference = genRef()
    const origin = new URL(request.url).origin

    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + secretKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: String(profile.email).toLowerCase(),
        amount: price * 100,
        reference,
        currency: 'NGN',
        callback_url: origin + '/dashboard.html',
        channels: ['bank_transfer'],
        metadata: { user_id: userId, full_name: profile.full_name, kind, course_id: course.id, course_name: course.course_name, course_price: price }
      })
    })
    const init = await res.json()
    if (!init || !init.status || !init.data || !init.data.authorization_url) {
      return json({ success: false, error: (init && init.message) || 'Failed to start payment' }, 502)
    }

    return json({ success: true, reference, amount: price, authorization_url: init.data.authorization_url })
  } catch (err) {
    return json({ success: false, error: err.message || 'Server error' }, 500)
  }
}

export const onRequestOptions = async () => new Response(null, { status: 204, headers: CORS })
