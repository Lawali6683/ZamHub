import { initAdmin, uploadToImgur, $ } from './admin-core.js'
import { supabase } from './supabase.js'
import { toast } from './loader.js'

let course = null
let topics = []
let editing = null
let isFinal = false

const panels = ['topicForm', 'listBox', 'courseForm']
const open = (id) => panels.forEach((p) => ($(p).hidden = p !== id))
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

function setFinal(v) {
  isFinal = v
  $('finYes').classList.toggle('on', v)
  $('finNo').classList.toggle('on', !v)
  $('finNo').classList.toggle('no', !v)
}
$('finNo').addEventListener('click', () => setFinal(false))
$('finYes').addEventListener('click', () => setFinal(true))

async function loadTopics() {
  const { data, error } = await supabase.from('course_topic').select('*').eq('course_id', course.id).order('topic_no')
  if (error) return toast('Could not load topics.', 'err')
  topics = data
  $('cCount').textContent = `${topics.length} topic${topics.length === 1 ? '' : 's'} added`
  renderList()
}

function renderCourse() {
  $('courseBox').hidden = false
  $('cImg').src = course.image_url || 'https://i.imgur.com/d6TxLMp.png'
  $('cName').textContent = course.course_name
  $('cCode').textContent = `${course.course_code} - ₦${Number(course.price).toLocaleString()}`
}

function renderList() {
  const box = $('tl')
  if (!topics.length) {
    box.innerHTML = '<p>No topics yet. Tap Add topic to start.</p>'
    return
  }
  box.innerHTML = topics
    .map((t) => `<div class="ti"><span class="n">${t.topic_no}</span><span class="t">${esc(t.topic_name)}${t.is_final ? ' <span class="fin">Final</span>' : ''}</span><button class="btn line" data-edit="${t.id}" type="button">Edit</button><button class="btn red" data-del="${t.id}" type="button">Delete</button></div>`)
    .join('')
}

$('tl').addEventListener('click', async (e) => {
  const ed = e.target.closest('[data-edit]')
  const del = e.target.closest('[data-del]')
  if (ed) openTopic(topics.find((t) => t.id === ed.dataset.edit))
  if (del && confirm('Delete this topic?')) {
    const { error } = await supabase.from('course_topic').delete().eq('id', del.dataset.del)
    if (error) return toast('Could not delete the topic.', 'err')
    const gone = topics.find((t) => t.id === del.dataset.del)
    for (const t of topics.filter((x) => x.topic_no > gone.topic_no)) {
      await supabase.from('course_topic').update({ topic_no: t.topic_no - 1 }).eq('id', t.id)
    }
    toast('Topic deleted.')
    loadTopics()
  }
})

function openTopic(t) {
  editing = t || null
  const no = t ? t.topic_no : (topics.length ? Math.max(...topics.map((x) => x.topic_no)) : 0) + 1
  $('tTitle').textContent = t ? `Edit topic ${no}` : `Add topic ${no}`
  $('tName').value = t ? t.topic_name : ''
  $('tVideo').value = t ? t.video_url : ''
  $('tText').value = t ? t.topic_text : ''
  setFinal(t ? t.is_final : false)
  open('topicForm')
  $('topicForm').scrollIntoView({ behavior: 'smooth' })
}

$('findForm').addEventListener('submit', async (e) => {
  e.preventDefault()
  const { data, error } = await supabase.from('view_courser').select('*').eq('course_code', $('fCode').value.trim()).maybeSingle()
  if (error || !data) return toast('No course found with this code.', 'err')
  course = data
  renderCourse()
  open('')
  loadTopics()
})

$('bAdd').addEventListener('click', () => openTopic(null))
$('bView').addEventListener('click', () => {
  open('listBox')
  $('listBox').scrollIntoView({ behavior: 'smooth' })
})
$('tCancel').addEventListener('click', () => open(''))
$('cCancel').addEventListener('click', () => open(''))

$('tf').addEventListener('submit', async (e) => {
  e.preventDefault()
  const name = $('tName').value.trim()
  if (!name) return toast('Enter the topic name.', 'warn')
  const row = { topic_name: name, video_url: $('tVideo').value.trim(), topic_text: $('tText').value, is_final: isFinal }
  $('tSave').disabled = true
  const q = editing
    ? supabase.from('course_topic').update(row).eq('id', editing.id)
    : supabase.from('course_topic').insert({ ...row, course_id: course.id, topic_no: (topics.length ? Math.max(...topics.map((x) => x.topic_no)) : 0) + 1 })
  const { error } = await q
  $('tSave').disabled = false
  if (error) return toast('Could not save the topic.', 'err')
  toast(editing ? 'Topic updated.' : 'Topic added.')
  open('')
  loadTopics()
})

$('bEditC').addEventListener('click', () => {
  $('eName').value = course.course_name
  $('eCode').value = course.course_code
  $('ePrice').value = course.price
  $('eBilling').value = course.billing
  $('eDesc').value = course.description
  $('eImg').value = course.image_url
  open('courseForm')
  $('courseForm').scrollIntoView({ behavior: 'smooth' })
})

$('cf').addEventListener('submit', async (e) => {
  e.preventDefault()
  const price = Number($('ePrice').value)
  if (!$('eName').value.trim() || !$('eCode').value.trim()) return toast('Enter the course name and code.', 'warn')
  if (!(price >= 0) || $('ePrice').value === '') return toast('Enter a valid price.', 'warn')
  $('cSave').disabled = true
  try {
    let image = $('eImg').value.trim()
    const f = $('eFile').files[0]
    if (f) image = await uploadToImgur(f)
    const { data, error } = await supabase
      .from('view_courser')
      .update({ course_name: $('eName').value.trim(), course_code: $('eCode').value.trim(), price, billing: $('eBilling').value, description: $('eDesc').value, image_url: image })
      .eq('id', course.id)
      .select()
      .single()
    if (error) throw error
    course = data
    renderCourse()
    toast('Course updated.')
    open('')
  } catch (err) {
    toast(err && err.code === '23505' ? 'This course code is already used.' : 'Could not save changes.', 'err')
  }
  $('cSave').disabled = false
})

initAdmin()
