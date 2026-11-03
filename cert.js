import { initAdmin, uploadToImgur, $ } from './admin-core.js'
import { imagesToPdf } from './pdf.js'
import { supabase } from './supabase.js'
import { toast } from './loader.js'

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
let rows = []

async function load() {
  const { data, error } = await supabase
    .from('certificates')
    .select('*, user_profiles(full_name,email,phone,user_code), view_courser(course_name)')
    .order('created_at', { ascending: false })
  if (error) return toast('Could not load certificates.', 'err')
  rows = data || []
  $('list').innerHTML = rows.length
    ? rows
        .map((r) => `<div class="ti" style="flex-wrap:wrap"><span class="t" style="white-space:normal"><b>${esc(r.user_profiles && r.user_profiles.full_name)}</b><br><small>${esc(r.user_profiles && r.user_profiles.email)} - ${esc(r.user_profiles && r.user_profiles.user_code)}<br>${esc(r.view_courser && r.view_courser.course_name)}</small></span><span class="fin" style="color:${r.status === 'sent' ? 'var(--green)' : 'var(--red)'}">${r.status === 'sent' ? 'Sent' : 'Pending'}</span><button class="btn line" data-d="${r.id}" type="button">Results</button><button class="btn line" data-c="${r.id}" type="button">Certificate</button><button class="btn" data-m="${r.id}" type="button">Email</button>${r.status === 'sent' ? '' : `<button class="btn red" data-s="${r.id}" type="button">Mark sent</button>`}</div>`)
        .join('')
    : '<p>No student has passed the final exam yet.</p>'
}

async function results(r) {
  const { data } = await supabase.from('attempts').select('kind,score,total,passed,penalty,submitted_at,quiz_sets(from_topic,to_topic,course_id)').eq('user_id', r.user_id).not('submitted_at', 'is', null).order('submitted_at')
  const mine = (data || []).filter((a) => a.quiz_sets && a.quiz_sets.course_id === r.course_id)
  const ass = mine.filter((a) => a.kind === 'assessment' && a.passed)
  const exam = mine.filter((a) => a.kind === 'exam' && a.passed).pop()
  const sum = ass.reduce((t, a) => t + a.score, 0)
  const max = ass.reduce((t, a) => t + a.total, 0)
  const m = document.createElement('div')
  m.className = 'gate'
  m.innerHTML = `<div class="gate-card" style="text-align:left"><h2>${esc(r.user_profiles.full_name)}</h2><p>Assessments passed: ${ass.length}<br>Assessment total: ${sum} / ${max}<br>Final exam: ${exam ? exam.score + ' / ' + exam.total : 'none'}<br>Total attempts: ${mine.length}</p><button class="btn" type="button">Close</button></div>`
  m.querySelector('button').addEventListener('click', () => m.remove())
  document.body.appendChild(m)
}

function certBox(r) {
  const g = document.createElement('div')
  g.className = 'gate'
  const old = r.image_urls || []
  g.innerHTML = `<div class="gate-card" style="text-align:left"><button class="ibtn" data-x aria-label="Close" style="margin-left:auto"><i class="fa-solid fa-xmark"></i></button><h2>Certificate</h2><p>${esc(r.user_profiles.full_name)}</p><div class="fm"><div class="acts" id="old">${old.map((u) => `<img src="${esc(u)}" alt="" width="70" height="70" style="object-fit:cover;border-radius:10px">`).join('')}</div><label><span>Add certificate images</span><input id="cf" type="file" accept="image/*" multiple></label><div class="acts" id="np"></div><div class="acts"><button class="btn" id="cs" type="button">Upload and save</button>${old.length ? '<button class="btn line" id="cd" type="button">Download PDF</button>' : ''}</div></div></div>`
  document.body.appendChild(g)
  g.querySelector('[data-x]').addEventListener('click', () => g.remove())
  g.querySelector('#cf').addEventListener('change', (e) => {
    g.querySelector('#np').innerHTML = [...e.target.files].map((f) => `<img src="${URL.createObjectURL(f)}" alt="" width="70" height="70" style="object-fit:cover;border-radius:10px">`).join('')
  })
  const cd = g.querySelector('#cd')
  cd && cd.addEventListener('click', async () => {
    try { await imagesToPdf(old, 'zamhub-certificate.pdf') } catch { toast('Could not create the PDF.', 'err') }
  })
  g.querySelector('#cs').addEventListener('click', async () => {
    const files = [...g.querySelector('#cf').files]
    if (!files.length) return toast('Choose at least one image.', 'warn')
    const btn = g.querySelector('#cs')
    btn.disabled = true
    try {
      const urls = [...old]
      for (const f of files) urls.push(await uploadToImgur(f))
      const { error } = await supabase.from('certificates').update({ image_urls: urls, status: 'sent', sent_at: new Date().toISOString() }).eq('id', r.id)
      if (error) throw error
      toast('Certificate saved. The student can now see it in the dashboard.')
      g.remove()
      load()
    } catch {
      btn.disabled = false
      toast('Upload failed. Try again.', 'err')
    }
  })
}

$('list').addEventListener('click', async (e) => {
  const b = e.target.closest('button')
  if (!b) return
  const find = (k) => rows.find((r) => r.id === b.dataset[k])
  if (b.dataset.d) return results(find('d'))
  if (b.dataset.c) return certBox(find('c'))
  if (b.dataset.m) {
    const r = find('m')
    const subject = encodeURIComponent('Your ZamHub certificate')
    const body = encodeURIComponent(`Dear ${r.user_profiles.full_name},\n\nCongratulations on passing your final exam for ${r.view_courser.course_name}. Your certificate is ready. Please log in to your ZamHub dashboard to view and download it as a PDF.\n\nZamHub - We Shape Tomorrow`)
    location.href = `mailto:${r.user_profiles.email}?subject=${subject}&body=${body}`
    return
  }
  if (b.dataset.s) {
    const { error } = await supabase.from('certificates').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', b.dataset.s)
    if (error) return toast('Could not update.', 'err')
    toast('Marked as sent.')
    load()
  }
})

initAdmin().then(load)
