async function verifySignature(body, signature, secret) {
  try {
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign'])
    const buf = await crypto.subtle.sign('HMAC', key, enc.encode(body))
    const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
    return hex === signature.toLowerCase()
  } catch {
    return false
  }
}

const reply = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

async function handlePayment(env, data) {
  const reference = String(data.reference || '').trim()
  const meta = data.metadata || {}
  const amountPaid = Math.round(Number(data.amount || 0) / 100)
  const userId = String(meta.user_id || '')
  const courseId = String(meta.course_id || '')
  const kind = meta.kind === 'extra' ? 'extra' : 'first'
  if (!reference || !userId || !courseId || !amountPaid) return

  const base = (env.SUPABASE_URL || 'https://avrqojegjalzeskmhsgr.supabase.co').replace(/\/$/, '') + '/rest/v1/'
  const key = env.SUPABASE_SECRET_KEY
  const headers = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }

  const courseRes = await fetch(base + 'view_courser?id=eq.' + encodeURIComponent(courseId) + '&select=price', { headers })
  const courses = courseRes.ok ? await courseRes.json() : []
  if (!courses.length || amountPaid < Math.round(Number(courses[0].price))) return

  const profRes = await fetch(base + 'user_profiles?id=eq.' + encodeURIComponent(userId) + '&select=id', { headers })
  const profs = profRes.ok ? await profRes.json() : []
  if (!profs.length) return

  const pay = await fetch(base + 'payments', {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ reference, user_id: userId, course_id: courseId, amount_paid: amountPaid, kind })
  })
  if (!pay.ok) return

  await fetch(base + 'user_courses?on_conflict=user_id,course_id', {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: userId, course_id: courseId, reference, amount_paid: amountPaid })
  })

  if (kind === 'first') {
    await fetch(base + 'user_profiles?id=eq.' + encodeURIComponent(userId), {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'active' })
    })
  }
}

export const onRequestPost = async ({ request, env }) => {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-paystack-signature') || ''
    const secret = env.PAY_SECRET_KEY || ''
    if (!signature) return reply({ success: false, message: 'Missing signature' }, 401)
    if (!secret || !env.SUPABASE_SECRET_KEY) return reply({ success: false, message: 'Server not configured' }, 500)
    if (!(await verifySignature(body, signature, secret))) return reply({ success: false, message: 'Invalid signature' }, 401)

    const event = JSON.parse(body)
    if (event.event === 'charge.success' && event.data && event.data.status === 'success') {
      await handlePayment(env, event.data)
    }
    return reply({ success: true })
  } catch (err) {
    return reply({ success: false, message: err.message }, 500)
  }
}
