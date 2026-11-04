import { supabase } from './supabase.js'
import { toast, busy } from './loader.js'

const root = document.getElementById('root')
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const wrap = (html) => (root.innerHTML = `<div class="wrap">${html}</div>`)

;(async () => {
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) {
    location.href = 'register.html'
    return
  }
  const { data, error } = await supabase
    .from('certificates')
    .select('*, view_courser(course_name)')
    .eq('user_id', u.user.id)
    .order('created_at', { ascending: false })
  if (error) return wrap('<div class="panel"><h2>Could not load your certificate</h2><p>Please refresh the page.</p></div>')
  if (!data.length) {
    return wrap('<div class="panel"><h2>No certificate yet</h2><p>Finish all topics and pass your final exam to earn your certificate.</p><div class="acts"><a class="btn" href="dashboard.html" style="text-decoration:none">Back to dashboard</a></div></div>')
  }
  wrap(data.map((c, i) => {
    const urls = c.image_urls || []
    const name = c.view_courser ? c.view_courser.course_name : 'Course'
    return urls.length
      ? `<div class="panel"><span class="chip">Certificate ready</span><h2 style="margin:8px 0">${esc(name)}</h2>${urls.map((x) => `<img src="${esc(x)}" alt="Certificate" style="border-radius:12px;margin:8px 0;width:100%">`).join('')}<div class="acts"><button class="btn" data-pdf="${i}" type="button"><i class="fa-solid fa-file-pdf"></i> Download PDF</button><button class="btn line" data-mail="${i}" type="button"><i class="fa-solid fa-envelope"></i> Send to my email</button></div></div>`
      : `<div class="panel"><span class="chip">Pending</span><h2 style="margin:8px 0">${esc(name)}</h2><p>Congratulations on passing your final exam. Your certificate is being prepared. Please check back soon.</p></div>`
  }).join(''))
  root.addEventListener('click', async (e) => {
    const p = e.target.closest('[data-pdf]')
    const m = e.target.closest('[data-mail]')
    if (p) {
      busy(true)
      try {
        const lib = await import('./pdf.js')
        await lib.imagesToPdf(data[p.dataset.pdf].image_urls, 'zamhub-certificate.pdf')
      } catch {
        toast('Could not create the PDF. Check your connection.', 'err')
      }
      busy(false)
    }
    if (m) {
      const c = data[m.dataset.mail]
      const subject = encodeURIComponent('My ZamHub certificate')
      const body = encodeURIComponent('My ZamHub certificate:\n\n' + c.image_urls.join('\n'))
      location.href = `mailto:${u.user.email}?subject=${subject}&body=${body}`
    }
  })
})()
