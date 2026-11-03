import { supabase } from './supabase.js'
import { toast, busy } from './loader.js'
import { slipPdf, answersPdf } from './pdf.js'

const $ = (id) => document.getElementById(id)
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const params = new URLSearchParams(location.search)
const setId = params.get('set')
const root = $('root')

let quiz = null
let idx = 0
let answers = {}
let penalty = 0
let endAt = 0
let timer = null
let active = false
let done = false
let prof = {}

const head = (title) => `<div class="qbar"><a class="ibtn" href="dashboard.html" aria-label="Back to dashboard"><i class="fa-solid fa-arrow-left"></i></a><img src="https://i.imgur.com/d6TxLMp.png" alt="" width="40" height="40"><b>${esc(title)}</b></div>`
const fmt = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`

const block = (e) => {
  if (active) e.preventDefault()
}

function penalize(why) {
  if (!active) return
  penalty++
  toast(`${why} One mark has been removed.`, 'err')
}

;['copy', 'cut', 'paste', 'contextmenu', 'selectstart', 'dragstart'].forEach((ev) => document.addEventListener(ev, block))
document.addEventListener('keydown', (e) => {
  if (!active) return
  const k = e.key.toLowerCase()
  if ((e.ctrlKey || e.metaKey) && ['c', 'x', 'v', 'a', 'p', 's', 'u'].includes(k)) e.preventDefault()
})
document.addEventListener('keyup', (e) => {
  if (active && e.key === 'PrintScreen') {
    navigator.clipboard && navigator.clipboard.writeText('').catch(() => {})
    penalize('Screenshots are not allowed.')
  }
})
document.addEventListener('visibilitychange', () => {
  if (active && document.hidden) toast('Please stay on this page during the test.', 'warn')
})
window.addEventListener('beforeunload', (e) => {
  if (active) {
    e.preventDefault()
    e.returnValue = ''
  }
})

async function showIntro() {
  const { data: s } = await supabase.from('quiz_sets').select('*').eq('id', setId).maybeSingle()
  if (!s) {
    root.innerHTML = head('Not found') + '<div class="panel"><p>This test was not found.</p></div>'
    return
  }
  const ex = s.kind === 'exam'
  root.innerHTML = `${head(ex ? 'Final exam' : 'Assessment')}<div class="panel"><h2>${ex ? 'Final exam' : `Assessment: topics ${s.from_topic} to ${s.to_topic}`}</h2>
  <p>Questions: <b>${s.question_count}</b><br>Time: <b>${s.time_minutes} minutes</b><br>Total marks: <b>${s.total_marks}</b><br>Pass mark: <b>${s.pass_mark}</b></p>
  <p style="margin-top:10px">Rules: copying is disabled. Taking a screenshot removes 1 mark. The test submits itself when the time ends. If you fail you can try again after ${ex ? '4 days' : '24 hours'}.</p>
  <div class="acts" style="margin-top:14px"><button class="btn grow" id="go" type="button"><i class="fa-solid fa-play"></i> Start ${ex ? 'final exam' : 'assessment'}</button></div></div>`
  $('go').addEventListener('click', start)
}

async function start() {
  busy(true)
  const { data, error } = await supabase.rpc('start_quiz', { p_set: setId })
  busy(false)
  if (error) {
    const m = error.message || ''
    if (m.includes('ALREADY_PASSED')) return toast('You already passed this test.', 'ok')
    if (m.includes('WAIT_UNTIL')) return toast('You can try again on ' + new Date(m.split('WAIT_UNTIL:')[1].trim().replace(' ', 'T')).toLocaleString() + '.', 'warn')
    return toast('Could not start the test.', 'err')
  }
  quiz = data
  idx = 0
  answers = {}
  penalty = 0
  endAt = Date.now() + quiz.time_minutes * 60000
  active = true
  tick()
  timer = setInterval(tick, 1000)
  drawQ()
}

function tick() {
  const left = Math.max(0, Math.round((endAt - Date.now()) / 1000))
  const el = $('tm')
  if (el) el.textContent = fmt(left)
  if (left <= 0 && active) {
    toast('Time is up. Submitting your answers.', 'warn')
    submit()
  }
}

function drawQ() {
  const q = quiz.questions[idx]
  const opts = q.qtype === 'tf' ? [['TRUE', 'True'], ['FALSE', 'False']] : q.options.map((o, i) => ['ABCD'[i], o])
  const last = idx === quiz.questions.length - 1
  root.innerHTML = `<div class="qbar"><button class="ibtn" id="quit" aria-label="Quit"><i class="fa-solid fa-arrow-left"></i></button><b>Question ${idx + 1} of ${quiz.questions.length}</b><span class="tm" id="tm"></span></div>
  <div class="panel"><p style="font-size:1.1rem;font-weight:600">${esc(q.question)}</p>${opts.map(([v, t]) => `<button class="opt${answers[q.id] === v ? ' on' : ''}" data-v="${v}" type="button">${q.qtype === 'mcq' ? v + '. ' : ''}${esc(t)}</button>`).join('')}</div>
  <div class="acts">${idx > 0 ? '<button class="btn line grow" id="prev" type="button">Previous</button>' : ''}${last ? '<button class="btn grow" id="sub" type="button">Submit</button>' : '<button class="btn grow" id="nx" type="button">Next</button>'}</div>`
  tick()
  root.querySelectorAll('.opt').forEach((b) =>
    b.addEventListener('click', () => {
      answers[q.id] = b.dataset.v
      drawQ()
    })
  )
  $('prev') && $('prev').addEventListener('click', () => { idx--; drawQ() })
  $('nx') && $('nx').addEventListener('click', () => { idx++; drawQ() })
  $('sub') && $('sub').addEventListener('click', () => {
    const left = quiz.questions.filter((x) => !answers[x.id]).length
    if (left && !confirm(`${left} question(s) are not answered. Submit anyway?`)) return
    submit()
  })
  $('quit').addEventListener('click', () => {
    if (confirm('Leave now? Your test will be submitted.')) submit()
  })
}

async function submit() {
  if (done) return
  done = true
  active = false
  clearInterval(timer)
  busy(true)
  const { data, error } = await supabase.rpc('submit_quiz', { p_attempt: quiz.attempt_id, p_answers: answers, p_penalty: penalty })
  busy(false)
  if (error) {
    done = false
    toast('Could not submit. Check your connection and try again.', 'err')
    root.innerHTML = head('Submit') + '<div class="panel"><button class="btn" id="retry" type="button">Try submitting again</button></div>'
    $('retry').addEventListener('click', submit)
    return
  }
  showResult(data)
}

function reviewHtml(review) {
  return review
    .map((r) => {
      const label = (v) => (v == null ? 'No answer' : 'ABCD'.includes(v) && v.length === 1 ? `${v}. ${esc((r.options || [])['ABCD'.indexOf(v)])}` : esc(v))
      return `<div class="rv ${r.ok ? 'ok' : 'bad'}"><b>${r.ok ? '✔️' : '❌'} ${esc(r.question)}</b><br><small>Your answer: ${label(r.picked)}</small>${r.ok ? '' : `<br><small>Correct answer: ${label(r.answer)}</small>`}</div>`
    })
    .join('')
}

function showResult(r) {
  const ex = r.kind === 'exam'
  const msg = r.passed
    ? ex
      ? 'You passed the final exam. Please wait for your certificate.'
      : 'You passed. The next topic is now open.'
    : `You did not reach the pass mark. Study again and retry after ${ex ? '4 days' : '24 hours'}.`
  root.innerHTML = `${head('Result')}<div class="panel"><div class="score ${r.passed ? '' : 'bad'}">${r.score} / ${r.total}</div><p style="text-align:center">${esc(msg)}</p>${r.penalty ? `<p style="text-align:center"><small>${r.penalty} mark(s) removed for breaking the rules.</small></p>` : ''}<div class="acts" style="margin-top:12px"><button class="btn line grow" id="slipBtn" type="button"><i class="fa-solid fa-file-pdf"></i> Result slip</button><button class="btn line grow" id="ansBtn" type="button"><i class="fa-solid fa-file-circle-check"></i> Answers PDF</button><a class="btn grow" href="dashboard.html" style="text-decoration:none;text-align:center">Back to dashboard</a></div></div><div class="panel"><h2>Your answers</h2>${reviewHtml(r.review)}</div>`
  const info = { name: prof.full_name, code: prof.user_code, course: prof.course_name, title: ex ? 'Final exam' : 'Assessment', score: r.score, total: r.total, passed: r.passed, penalty: r.penalty || 0, date: r.date || new Date().toLocaleString(), review: r.review }
  const run = (fn) => async () => {
    busy(true)
    try {
      await fn(info)
    } catch {
      toast('Could not create the PDF. Check your connection.', 'err')
    }
    busy(false)
  }
  $('slipBtn').addEventListener('click', run(slipPdf))
  $('ansBtn').addEventListener('click', run(answersPdf))
}

async function showHistory() {
  const { data, error } = await supabase
    .from('attempts')
    .select('id,kind,score,total,passed,penalty,submitted_at,review,quiz_sets(from_topic,to_topic,time_minutes)')
    .not('submitted_at', 'is', null)
    .order('submitted_at', { ascending: false })
  if (error) return toast('Could not load history.', 'err')
  root.innerHTML = `${head('History')}${
    (data || []).length
      ? data.map((a) => `<div class="panel"><b>${a.kind === 'exam' ? 'Final exam' : `Assessment: topics ${a.quiz_sets ? a.quiz_sets.from_topic + '-' + a.quiz_sets.to_topic : ''}`}</b><br><span class="chip">${a.score} / ${a.total} ${a.passed ? 'Passed' : 'Failed'}</span><br><small>${new Date(a.submitted_at).toLocaleString()}${a.quiz_sets ? ' - ' + a.quiz_sets.time_minutes + ' min' : ''}</small><div class="acts" style="margin-top:8px"><button class="btn line" data-v="${a.id}" type="button">View answers</button></div></div>`).join('')
      : '<div class="panel"><p>You have not taken any test yet.</p></div>'
  }`
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]')
    if (!b) return
    const a = data.find((x) => x.id === b.dataset.v)
    showResult({ kind: a.kind, score: a.score, total: a.total, passed: a.passed, penalty: a.penalty, review: a.review, date: new Date(a.submitted_at).toLocaleString() })
  })
}

;(async () => {
  const { data } = await supabase.auth.getUser()
  if (!data.user) {
    location.href = 'register.html'
    return
  }
  const { data: pr } = await supabase.from('user_profiles').select('full_name,user_code,course_name').eq('id', data.user.id).maybeSingle()
  prof = pr || {}
  if (params.get('view') === 'history') return showHistory()
  if (!setId) {
    location.href = 'dashboard.html'
    return
  }
  showIntro()
})()
