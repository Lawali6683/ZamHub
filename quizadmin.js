import { initAdmin, $ } from './admin-core.js'
import { supabase } from './supabase.js'
import { toast } from './loader.js'

let course = null
let topicCount = 0
let sets = []

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const isExam = () => $('kind').value === 'exam'

function nextFrom() {
  const a = sets.filter((s) => s.kind === 'assessment')
  return a.length ? Math.max(...a.map((s) => s.to_topic)) + 1 : 1
}

function addQ(type) {
  const n = $('qlist').children.length + 1
  const d = document.createElement('div')
  d.className = 'qc'
  d.dataset.type = type
  d.innerHTML = `<header><span>Question ${n} (${type === 'mcq' ? 'A-D' : 'True/False'})</span><button class="x" type="button" aria-label="Remove"><i class="fa-solid fa-trash"></i></button></header>
  <input class="q" placeholder="Question">
  ${type === 'mcq' ? ['A', 'B', 'C', 'D'].map((l) => `<input class="o" placeholder="Option ${l}">`).join('') + '<select class="a"><option value="A">Correct: A</option><option value="B">Correct: B</option><option value="C">Correct: C</option><option value="D">Correct: D</option></select>' : '<select class="a"><option value="TRUE">Correct: True</option><option value="FALSE">Correct: False</option></select>'}
  <input class="m" type="number" min="1" value="1" inputmode="numeric" placeholder="Marks" ${isExam() ? '' : 'disabled'}>`
  d.querySelector('.x').addEventListener('click', () => {
    d.remove()
    summary()
  })
  d.querySelector('.m').addEventListener('input', summary)
  $('qlist').appendChild(d)
  summary()
}

function summary() {
  const m = [...$('qlist').querySelectorAll('.m')].reduce((t, i) => t + (Number(i.value) || 0), 0)
  $('total').textContent = `${$('qlist').children.length} questions, ${m} total marks`
}

function resetBuilder() {
  $('qlist').innerHTML = ''
  const ex = isExam()
  $('toBox').hidden = ex
  $('adders').hidden = !ex
  $('fromNo').textContent = nextFrom()
  $('toTopic').value = ''
  $('pass').value = ex ? 1 : 3
  if (!ex) {
    for (let i = 0; i < 3; i++) addQ('mcq')
    for (let i = 0; i < 2; i++) addQ('tf')
  }
  summary()
}

function renderSets() {
  $('cName').textContent = course.course_name
  $('cSum').textContent = `${topicCount} topics, ${sets.length} quizzes saved`
  $('setList').innerHTML = sets
    .map((s) => `<div class="ti"><span class="n">${s.kind === 'exam' ? 'E' : 'A'}</span><span class="t">${s.kind === 'exam' ? 'Final exam' : `Assessment: topics ${s.from_topic}-${s.to_topic}`} (${s.question_count} questions, ${s.time_minutes} min)</span><button class="btn red" data-del="${s.id}" type="button">Delete</button></div>`)
    .join('')
}

async function loadSets() {
  const [{ data: t }, { data: s }] = await Promise.all([
    supabase.from('course_topic').select('id', { count: 'exact' }).eq('course_id', course.id),
    supabase.from('quiz_sets').select('*').eq('course_id', course.id).order('created_at')
  ])
  topicCount = (t || []).length
  sets = s || []
  renderSets()
  resetBuilder()
}

$('findForm').addEventListener('submit', async (e) => {
  e.preventDefault()
  const { data } = await supabase.from('view_courser').select('*').eq('course_code', $('fCode').value.trim()).maybeSingle()
  if (!data) return toast('No course found with this code.', 'err')
  course = data
  $('info').hidden = false
  $('builder').hidden = false
  loadSets()
})

$('kind').addEventListener('change', resetBuilder)
$('addMcq').addEventListener('click', () => addQ('mcq'))
$('addTf').addEventListener('click', () => addQ('tf'))

$('setList').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-del]')
  if (!b || !confirm('Delete this quiz and its questions?')) return
  const { error } = await supabase.from('quiz_sets').delete().eq('id', b.dataset.del)
  if (error) return toast('Could not delete the quiz.', 'err')
  toast('Quiz deleted.')
  loadSets()
})

$('save').addEventListener('click', async () => {
  const cards = [...$('qlist').children]
  const ex = isExam()
  if (!cards.length) return toast('Add at least one question.', 'warn')
  if (!ex && (cards.filter((c) => c.dataset.type === 'mcq').length !== 3 || cards.filter((c) => c.dataset.type === 'tf').length !== 2)) {
    return toast('An assessment needs 3 A-D questions and 2 true/false questions.', 'warn')
  }
  const rows = []
  for (const [i, c] of cards.entries()) {
    const q = c.querySelector('.q').value.trim()
    const opts = [...c.querySelectorAll('.o')].map((o) => o.value.trim())
    if (!q || (c.dataset.type === 'mcq' && opts.some((o) => !o))) return toast(`Complete question ${i + 1}.`, 'warn')
    rows.push({ position: i + 1, qtype: c.dataset.type, question: q, options: opts, answer: c.querySelector('.a').value, marks: ex ? Math.max(1, Number(c.querySelector('.m').value) || 1) : 1 })
  }
  const total = rows.reduce((t, r) => t + r.marks, 0)
  const pass = Number($('pass').value)
  const time = Number($('time').value)
  if (!(time >= 1)) return toast('Enter the time in minutes.', 'warn')
  if (!(pass >= 1) || pass > total) return toast('Pass marks must be between 1 and the total marks.', 'warn')
  let from = null
  let to = null
  if (!ex) {
    from = nextFrom()
    to = Number($('toTopic').value)
    if (!(to >= from) || to > topicCount) return toast(`Topics must be from ${from} to ${topicCount}.`, 'warn')
  }
  if (ex && sets.some((s) => s.kind === 'exam')) return toast('This course already has a final exam. Delete it first.', 'warn')
  $('save').disabled = true
  const { data: set, error } = await supabase
    .from('quiz_sets')
    .insert({ course_id: course.id, kind: ex ? 'exam' : 'assessment', from_topic: from, to_topic: to, time_minutes: time, pass_mark: pass, question_count: rows.length, total_marks: total })
    .select()
    .single()
  if (error) {
    $('save').disabled = false
    return toast('Could not save the quiz.', 'err')
  }
  const { error: qe } = await supabase.from('questions').insert(rows.map((r) => ({ ...r, set_id: set.id })))
  if (qe) {
    await supabase.from('quiz_sets').delete().eq('id', set.id)
    toast('Could not save the questions.', 'err')
  } else {
    toast('Quiz saved.')
    loadSets()
  }
  $('save').disabled = false
})

initAdmin()
