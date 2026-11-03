import { initAdmin, $ } from './admin-core.js'
import { supabase } from './supabase.js'
import { toast } from './loader.js'

const SIZE = 20
let page = 0
let query = ''
let rows = []

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const naira = (n) => '₦' + Number(n || 0).toLocaleString()

async function stats() {
  const { data, error } = await supabase.rpc('admin_stats')
  if (error) return toast('Could not load the totals.', 'err')
  const cards = [
    ['fa-users', 'Total users', data.users],
    ['fa-user-check', 'Active learners', data.learners],
    ['fa-graduation-cap', 'Completed', data.completed],
    ['fa-naira-sign', 'Total paid', naira(data.revenue)]
  ]
  $('stats').innerHTML = cards.map(([i, t, v]) => `<div class="panel"><i class="fa-solid ${i}" style="color:var(--red);font-size:1.4rem"></i><div style="font-size:1.6rem;font-weight:800;color:var(--green-d)">${v}</div><small>${t}</small></div>`).join('')
}

async function load(reset) {
  if (reset) {
    page = 0
    rows = []
  }
  let q = supabase.from('user_profiles').select('*').order('created_at', { ascending: false }).range(page * SIZE, page * SIZE + SIZE - 1)
  if (query) {
    const t = query.replace(/[,()%*]/g, ' ').trim()
    const parts = [`full_name.ilike.%${t}%`, `email.ilike.%${t}%`, `user_code.ilike.%${t}%`]
    if (/^[0-9a-f-]{36}$/i.test(t)) parts.push(`id.eq.${t}`)
    q = q.or(parts.join(','))
  }
  const { data, error } = await q
  if (error) return toast('Could not load users.', 'err')
  rows = rows.concat(data)
  $('more').hidden = data.length < SIZE
  $('list').innerHTML = rows.length
    ? rows.map((u) => `<div class="ti"><span class="n">${esc((u.full_name || '?')[0].toUpperCase())}</span><span class="t"><b>${esc(u.full_name)}</b><br><small>${esc(u.email)}</small></span><button class="btn line" data-v="${u.id}" type="button">View</button></div>`).join('')
    : '<p>No users found.</p>'
}

function overlay(html) {
  const g = document.createElement('div')
  g.className = 'gate'
  g.innerHTML = `<div class="gate-card" style="text-align:left"><button class="ibtn" data-x aria-label="Close" style="margin-left:auto"><i class="fa-solid fa-xmark"></i></button>${html}</div>`
  g.querySelector('[data-x]').addEventListener('click', () => g.remove())
  document.body.appendChild(g)
  return g
}

function confirmBox(msg) {
  return new Promise((res) => {
    const g = overlay(`<h2>Please confirm</h2><p>${esc(msg)}</p><div class="acts"><button class="btn red" data-ok type="button">OK</button><button class="btn line" data-no type="button">Cancel</button></div>`)
    g.style.zIndex = 950
    g.querySelector('[data-ok]').addEventListener('click', () => { g.remove(); res(true) })
    g.querySelector('[data-no]').addEventListener('click', () => { g.remove(); res(false) })
    g.querySelector('[data-x]').addEventListener('click', () => res(false))
  })
}

async function view(u) {
  const [{ data: owned }, { data: att }] = await Promise.all([
    supabase.from('user_courses').select('amount_paid, view_courser(course_name)').eq('user_id', u.id),
    supabase.from('attempts').select('kind,score,total,passed').eq('user_id', u.id).not('submitted_at', 'is', null)
  ])
  const info = [
    ['User ID (UUID)', u.id], ['Hub code', u.user_code], ['Name', u.full_name], ['Email', u.email], ['Phone', u.phone], ['Gender', u.gender],
    ['Chosen course', u.course_name], ['Course price', naira(u.course_price)], ['Status', u.status], ['Final', u.final_no],
    ['IP address', u.ip_address], ['Registered', new Date(u.created_at).toLocaleString()],
    ['Courses owned', (owned || []).map((o) => `${o.view_courser ? o.view_courser.course_name : ''} (${naira(o.amount_paid)})`).join(', ') || 'None'],
    ['Tests taken', `${(att || []).length} (passed ${(att || []).filter((a) => a.passed).length})`],
    ['Device', JSON.stringify(u.device_info || {})]
  ]
  const g = overlay(`<h2>${esc(u.full_name)}</h2><div class="tl">${info.map(([k, v]) => `<div class="ti" style="display:block"><small>${k}</small><br><b style="word-break:break-all">${esc(v)}</b></div>`).join('')}</div><div class="acts" style="margin-top:14px"><button class="btn" data-edit type="button">Edit</button><button class="btn red" data-del type="button">Delete</button></div>`)
  g.querySelector('[data-edit]').addEventListener('click', () => { g.remove(); edit(u) })
  g.querySelector('[data-del]').addEventListener('click', async () => {
    if (!(await confirmBox('Delete this user completely? They can register again afterwards.'))) return
    const { data } = await supabase.auth.getSession()
    const res = await fetch('/api/admin-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session.access_token },
      body: JSON.stringify({ user_id: u.id })
    })
    const out = await res.json().catch(() => ({}))
    if (!res.ok) return toast(out.error || 'Could not delete the user.', 'err')
    g.remove()
    toast('User deleted.')
    load(true)
    stats()
  })
}

function edit(u) {
  const g = overlay(`<h2>Edit user</h2><form class="fm" id="ef">
  <label><span>Name</span><input id="eN" value="${esc(u.full_name)}" required></label>
  <label><span>Phone</span><input id="eP" value="${esc(u.phone)}" required></label>
  <label><span>Hub code</span><input id="eC" value="${esc(u.user_code)}" required></label>
  <label><span>Gender</span><select id="eG"><option value="male"${u.gender === 'male' ? ' selected' : ''}>Male</option><option value="female"${u.gender === 'female' ? ' selected' : ''}>Female</option></select></label>
  <label><span>Status</span><select id="eS"><option value="no"${u.status === 'no' ? ' selected' : ''}>no</option><option value="active"${u.status === 'active' ? ' selected' : ''}>active</option></select></label>
  <label><span>Final</span><select id="eF"><option value="no"${u.final_no === 'no' ? ' selected' : ''}>no</option><option value="yes"${u.final_no === 'yes' ? ' selected' : ''}>yes</option></select></label>
  <button class="btn" type="submit">Save</button></form>`)
  g.querySelector('#ef').addEventListener('submit', async (e) => {
    e.preventDefault()
    const { error } = await supabase.from('user_profiles').update({
      full_name: $('eN').value.trim(), phone: $('eP').value.trim(), user_code: $('eC').value.trim(),
      gender: $('eG').value, status: $('eS').value, final_no: $('eF').value
    }).eq('id', u.id)
    if (error) return toast(error.code === '23505' ? 'This hub code is already used.' : 'Could not save.', 'err')
    g.remove()
    toast('Saved.')
    load(true)
    stats()
  })
}

$('sf').addEventListener('submit', (e) => {
  e.preventDefault()
  query = $('q').value.trim()
  load(true)
})
$('more').addEventListener('click', () => {
  page++
  load(false)
})
$('list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-v]')
  if (b) view(rows.find((u) => u.id === b.dataset.v))
})

initAdmin().then(() => {
  stats()
  load(true)
})
