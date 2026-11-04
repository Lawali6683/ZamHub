import { supabase } from './supabase.js'
import { toast, busy } from './loader.js'

const $ = (id) => document.getElementById(id)
const LOGO = 'https://i.imgur.com/d6TxLMp.png'
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const naira = (n) => '₦' + Number(n).toLocaleString()

let user, profile, courses = [], ownedIds = [], course, topics = [], store = { courses: {}, history: [], watched: {} }
let cur = 1
let skipped = false
let poll
let sets = []
let cert = null
let passed = new Set()

function say(icon, title, msg) {
  return new Promise((resolve) => {
    const m = document.createElement('div')
    m.className = 'modal'
    m.innerHTML = `<div class="box"><i class="fa-solid ${icon}"></i><h3>${esc(title)}</h3><p>${esc(msg)}</p><button class="btn" type="button">OK</button></div>`
    m.querySelector('button').addEventListener('click', () => {
      m.remove()
      resolve()
    })
    document.body.appendChild(m)
  })
}

async function pay(courseId) {
  busy(true)
  try {
    const { data } = await supabase.auth.getSession()
    const res = await fetch('/api/paystack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session.access_token },
      body: JSON.stringify({ course_id: courseId })
    })
    const out = await res.json().catch(() => ({}))
    if (!res.ok || !out.authorization_url) {
      busy(false)
      return toast(out.error || 'Could not start payment.', 'err')
    }
    location.href = out.authorization_url
  } catch {
    busy(false)
    toast('Network error. Check your connection.', 'err')
  }
}

async function showLock() {
  const { data } = await supabase.from('view_courser').select('*').eq('id', profile.course_id).maybeSingle()
  const c = data || { course_name: profile.course_name, price: profile.course_price, image_url: '' }
  $('root').innerHTML = `<div class="lock"><div class="panel"><img class="c" src="${esc(c.image_url || LOGO)}" alt="Course"><span class="chip">Locked</span><h2>${esc(c.course_name)}</h2><p>Pay once to unlock your lessons.</p><div class="price">${naira(c.price)}</div><button class="btn" id="payBtn" type="button"><i class="fa-solid fa-lock-open"></i> Pay now</button></div></div>`
  $('payBtn').addEventListener('click', () => pay(profile.course_id))
  if (new URLSearchParams(location.search).has('reference')) toast('Confirming your payment...', 'warn')
  poll = setInterval(async () => {
    const { data: p } = await supabase.from('user_profiles').select('status').eq('id', user.id).maybeSingle()
    if (p && p.status === 'active') {
      clearInterval(poll)
      await say('fa-circle-check', 'Congratulations!', 'Your payment is confirmed. Your course is now open.')
      history.replaceState(null, '', 'dashboard.html')
      startApp()
    }
  }, 5000)
}

async function save() {
  await supabase.from('updated').upsert({ id: user.id, data: store, updated_at: new Date().toISOString() })
}

function logHistory(entry) {
  store.history.push({ ...entry, at: new Date().toISOString() })
  if (store.history.length > 300) store.history.shift()
}

function ytId(url) {
  const m = String(url || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : ''
}

async function startApp() {
  const [{ data: owned }, { data: all }, { data: upd }] = await Promise.all([
    supabase.from('user_courses').select('course_id').eq('user_id', user.id),
    supabase.from('view_courser').select('*').order('created_at', { ascending: false }),
    supabase.from('updated').select('data').eq('id', user.id).maybeSingle()
  ])
  courses = all || []
  ownedIds = (owned || []).map((o) => o.course_id)
  if (!ownedIds.length && profile.course_id) ownedIds = [profile.course_id]
  if (upd && upd.data) store = { courses: {}, history: [], watched: {}, ...upd.data }
  const pick = store.current_course && ownedIds.includes(store.current_course) ? store.current_course : ownedIds[0]
  if (!pick) {
    $('root').innerHTML = '<div class="wrap"><div class="panel"><h2>No course found</h2><p>Please contact support.</p></div></div>'
    return
  }
  await openCourse(pick)
}

async function openCourse(id) {
  course = courses.find((c) => c.id === id)
  if (!course) {
    const { data: c1 } = await supabase.from('view_courser').select('*').eq('id', id).maybeSingle()
    course = c1 || { id, course_name: profile.course_name, price: profile.course_price, image_url: '' }
    courses.push(course)
  }
  store.current_course = id
  const { data, error } = await supabase.from('course_topic').select('*').eq('course_id', id).order('topic_no')
  if (error) return toast('Could not load topics.', 'err')
  topics = data || []
  const [{ data: qz }, { data: ps }] = await Promise.all([
    supabase.from('quiz_sets').select('*').eq('course_id', id),
    supabase.from('attempts').select('set_id').eq('user_id', user.id).eq('passed', true)
  ])
  sets = qz || []
  passed = new Set((ps || []).map((x) => x.set_id))
  const { data: ce } = await supabase.from('certificates').select('*').eq('user_id', user.id).eq('course_id', id).maybeSingle()
  cert = ce
  cur = Math.min(Math.max(1, (store.courses[id] && store.courses[id].topic) || 1), Math.max(1, topics.length))
  skipped = false
  render()
}

function render() {
  const t = topics.find((x) => x.topic_no === cur)
  const pct = topics.length ? Math.round((cur / topics.length) * 100) : 0
  let body = '<div class="panel"><h2>Topics are coming soon</h2><p>Your teacher is preparing the lessons. Please check back.</p></div>'
  if (t) {
    const id = ytId(t.video_url)
    const vid = id
      ? `<div class="vid" id="vid" data-id="${id}"><img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="Video preview"><div class="play"><span><i class="fa-solid fa-play"></i></span></div></div>`
      : ''
    body = `<div class="panel"><span class="chip">Topic ${t.topic_no} of ${topics.length}</span><h2 style="margin:8px 0 12px">${esc(t.topic_name)}</h2>${vid}</div>
    <div class="panel"><div class="tools"><button class="ibtn" id="copyBtn" aria-label="Copy text"><i class="fa-solid fa-copy"></i></button><button class="ibtn" id="pdfBtn" aria-label="Download PDF"><i class="fa-solid fa-file-pdf"></i></button></div><div class="txt" id="ttext">${esc(t.topic_text)}</div></div>
    <div class="acts">${cur > 1 ? '<button class="btn line grow" id="backBtn" type="button"><i class="fa-solid fa-arrow-left"></i> Back</button>' : ''}<button class="btn grow" id="nextBtn" type="button">Next <i class="fa-solid fa-arrow-right"></i></button></div>`
  }
  body = certPanel() + body
  $('root').innerHTML = `<div class="wrap">
    <div class="panel hero"><small>Student</small><b>${esc(profile.full_name)}</b><span class="chip">Hub ID: ${esc(profile.user_code)}</span><small>Course</small><b>${esc(course ? course.course_name : profile.course_name)}</b>
    <small>Progress: topic ${Math.min(cur, topics.length)} of ${topics.length}</small><div class="bar"><span style="width:${pct}%"></span></div>
    <div class="acts" style="margin-top:6px"><button class="btn line" id="myCourses" type="button"><i class="fa-solid fa-layer-group"></i> My courses</button><a class="btn line" href="assess.html?view=history" style="text-decoration:none"><i class="fa-solid fa-clock-rotate-left"></i> History</a></div></div>${body}</div>`
  $('myCourses').addEventListener('click', openSheet)
  $('certPdf') && $('certPdf').addEventListener('click', async () => {
    busy(true)
    try {
      const m = await import('./pdf.js')
      await m.imagesToPdf(cert.image_urls, 'zamhub-certificate.pdf')
    } catch {
      toast('Could not create the PDF. Check your connection.', 'err')
    }
    busy(false)
  })
  $('certMail') && $('certMail').addEventListener('click', () => {
    const subject = encodeURIComponent('My ZamHub certificate')
    const body = encodeURIComponent('My ZamHub certificate:\n\n' + cert.image_urls.join('\n'))
    location.href = `mailto:${profile.email}?subject=${subject}&body=${body}`
  })
  if (!t) return
  $('vid') && $('vid').addEventListener('click', playVideo)
  $('copyBtn').addEventListener('click', copyText)
  $('pdfBtn').addEventListener('click', () => makePdf(t))
  $('nextBtn').addEventListener('click', next)
  $('backBtn') && $('backBtn').addEventListener('click', () => go(cur - 1))
}

function certPanel() {
  if (!cert) return ''
  const urls = cert.image_urls || []
  if (!urls.length) return '<div class="panel"><h3>Final exam passed</h3><p>Congratulations! Please wait while your certificate is prepared.</p></div>'
  return `<div class="panel"><h3>Your certificate</h3>${urls.map((u) => `<img src="${esc(u)}" alt="Certificate" style="border-radius:12px;margin:8px 0">`).join('')}<div class="acts"><button class="btn" id="certPdf" type="button"><i class="fa-solid fa-file-pdf"></i> Download PDF</button><button class="btn line" id="certMail" type="button"><i class="fa-solid fa-envelope"></i> Send to my email</button></div></div>`
}

function playVideo() {
  const box = $('vid')
  const t = topics.find((x) => x.topic_no === cur)
  box.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${box.dataset.id}?autoplay=1&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" title="Lesson video"></iframe>`
  box.style.cursor = 'default'
  store.watched[t.id] = true
  logHistory({ type: 'video', course: course.id, topic: t.topic_no })
  save()
}

async function copyText() {
  try {
    await navigator.clipboard.writeText($('ttext').textContent)
    toast('Text copied.')
  } catch {
    toast('Could not copy. Try again.', 'err')
  }
}

function go(n) {
  cur = n
  skipped = false
  store.courses[course.id] = { topic: cur }
  save()
  render()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function next() {
  const t = topics.find((x) => x.topic_no === cur)
  if (ytId(t.video_url) && !store.watched[t.id] && !skipped) {
    skipped = true
    return say('fa-circle-play', 'Watch the video first', 'Please watch the lesson video before you continue. Tap Next again if you want to skip it.')
  }
  logHistory({ type: 'topic_done', course: course.id, topic: t.topic_no })
  const pending = sets.find((x) => x.kind === 'assessment' && x.to_topic === cur && !passed.has(x.id))
  if (pending) {
    await say('fa-clipboard-question', 'Assessment time', 'Pass the assessment to unlock the next topic.')
    location.href = 'assess.html?set=' + pending.id
    return
  }
  const nxt = topics.find((x) => x.topic_no === cur + 1)
  if (nxt) return go(cur + 1)
  save()
  if (t.is_final) {
    const exam = sets.find((x) => x.kind === 'exam')
    if (exam && passed.has(exam.id)) return say('fa-certificate', 'Well done', 'You passed. Please wait for your certificate.')
    if (exam) {
      await say('fa-flag-checkered', 'Final exam', 'You have finished all topics. Your final exam is ready.')
      location.href = 'assess.html?set=' + exam.id
      return
    }
    return say('fa-flag-checkered', 'You reached the end', 'You have finished all topics. The final exam will open here soon.')
  }
  say('fa-hourglass-half', 'Next topic is not ready', 'Please wait for next week. The next topic will be added soon.')
}

function openSheet() {
  const s = document.createElement('div')
  s.className = 'sheet'
  s.innerHTML = `<div class="in"><div class="acts"><button class="ibtn" id="sBack" aria-label="Back"><i class="fa-solid fa-arrow-left"></i></button></div><h2 style="color:var(--green-d)">All courses</h2>${courses
    .map((c) => {
      const own = ownedIds.includes(c.id)
      return `<div class="ci"><img src="${esc(c.image_url || LOGO)}" alt=""><div><b>${esc(c.course_name)}</b><br><small>${naira(c.price)}</small></div><button class="btn${own ? ' line' : ''}" data-id="${c.id}" data-own="${own}" type="button">${own ? 'View' : 'Buy'}</button></div>`
    })
    .join('')}</div>`
  document.body.appendChild(s)
  s.querySelector('#sBack').addEventListener('click', () => s.remove())
  s.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-id]')
    if (!b) return
    if (b.dataset.own === 'true') {
      s.remove()
      await openCourse(b.dataset.id)
      save()
    } else {
      pay(b.dataset.id)
    }
  })
}

async function makePdf(t) {
  busy(true)
  try {
    if (!window.jspdf) {
      await new Promise((res, rej) => {
        const sc = document.createElement('script')
        sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
        sc.onload = res
        sc.onerror = rej
        document.head.appendChild(sc)
      })
    }
    let logo = null
    try {
      const blob = await (await fetch(LOGO)).blob()
      logo = await new Promise((r) => {
        const f = new FileReader()
        f.onload = () => r(f.result)
        f.readAsDataURL(blob)
      })
    } catch {}
    const d = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' })
    const W = d.internal.pageSize.getWidth()
    const H = d.internal.pageSize.getHeight()
    const mark = () => {
      if (!logo) return
      d.saveGraphicsState()
      d.setGState(new d.GState({ opacity: 0.08 }))
      d.addImage(logo, 'PNG', W / 2 - 170, H / 2 - 170, 340, 340)
      d.restoreGraphicsState()
    }
    mark()
    if (logo) d.addImage(logo, 'PNG', 40, 30, 46, 46)
    d.setFont('helvetica', 'bold').setFontSize(20).setTextColor(11, 138, 62).text('ZamHub', 96, 58)
    d.setFont('helvetica', 'normal').setFontSize(10).setTextColor(90).text(new Date().toLocaleDateString(), W - 40, 58, { align: 'right' })
    d.setDrawColor(211, 34, 42).line(40, 88, W - 40, 88)
    d.setFont('helvetica', 'bold').setFontSize(15).setTextColor(20).text(d.splitTextToSize(`Topic ${t.topic_no}: ${t.topic_name}`, W - 80), 40, 112)
    d.setFont('helvetica', 'normal').setFontSize(11)
    let y = 150
    d.splitTextToSize(t.topic_text || '', W - 80).forEach((line) => {
      if (y > H - 50) {
        d.addPage()
        mark()
        y = 50
      }
      d.text(line, 40, y)
      y += 16
    })
    d.save(`zamhub-topic-${t.topic_no}.pdf`)
  } catch {
    toast('Could not create the PDF.', 'err')
  }
  busy(false)
}

function fail(e) {
  console.error(e)
  $('root').innerHTML = '<div class="wrap"><div class="panel"><h2>Something went wrong</h2><p>We could not load your lessons. Please check your connection and try again.</p><div class="acts"><button class="btn" id="again" type="button">Try again</button></div></div></div>'
  $('again').addEventListener('click', () => location.reload())
}

;(async () => {
  const { data } = await supabase.auth.getUser()
  if (!data.user) {
    location.href = 'register.html'
    return
  }
  user = data.user
  const { data: p, error } = await supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle()
  if (error || !p) {
    toast('Could not load your profile.', 'err')
    return
  }
  profile = p
  if (p.status === 'active') startApp().catch(fail)
  else showLock().catch(fail)
})()


