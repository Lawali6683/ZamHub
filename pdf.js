const LOGO = 'https://i.imgur.com/d6TxLMp.png'

async function lib() {
  if (!window.jspdf) {
    await new Promise((res, rej) => {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
      s.onload = res
      s.onerror = rej
      document.head.appendChild(s)
    })
  }
  return window.jspdf.jsPDF
}

async function blobOf(url) {
  const res = await fetch(url, { mode: 'cors' })
  if (!res.ok) throw new Error('fetch failed')
  return res.blob()
}

async function jpegOf(url) {
  const blob = await blobOf(url)
  const src = URL.createObjectURL(blob)
  const img = await new Promise((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = rej
    i.src = src
  })
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height
  const x = c.getContext('2d')
  x.fillStyle = '#fff'
  x.fillRect(0, 0, c.width, c.height)
  x.drawImage(img, 0, 0)
  URL.revokeObjectURL(src)
  return { data: c.toDataURL('image/jpeg', 0.92), w: img.width, h: img.height }
}

async function pngOf(url) {
  const blob = await blobOf(url)
  return new Promise((res) => {
    const f = new FileReader()
    f.onload = () => res(f.result)
    f.readAsDataURL(blob)
  })
}

async function base(title, date) {
  const JsPDF = await lib()
  const d = new JsPDF({ unit: 'pt', format: 'a4' })
  const W = d.internal.pageSize.getWidth()
  const H = d.internal.pageSize.getHeight()
  let logo = null
  try { logo = await pngOf(LOGO) } catch {}
  const page = () => {
    if (logo) {
      d.saveGraphicsState()
      d.setGState(new d.GState({ opacity: 0.08 }))
      d.addImage(logo, 'PNG', W / 2 - 170, H / 2 - 170, 340, 340)
      d.restoreGraphicsState()
    }
    d.setDrawColor(11, 138, 62).setLineWidth(2).rect(20, 20, W - 40, H - 40)
  }
  page()
  if (logo) d.addImage(logo, 'PNG', 44, 40, 50, 50)
  d.setFont('helvetica', 'bold').setFontSize(22).setTextColor(11, 138, 62).text('ZamHub', 104, 62)
  d.setFont('helvetica', 'normal').setFontSize(9).setTextColor(211, 34, 42).text('We Shape Tomorrow', 104, 78)
  d.setFontSize(10).setTextColor(90).text(String(date), W - 44, 62, { align: 'right' })
  d.setDrawColor(211, 34, 42).setLineWidth(1.2).line(44, 100, W - 44, 100)
  d.setFont('helvetica', 'bold').setFontSize(17).setTextColor(20).text(title, W / 2, 132, { align: 'center' })
  return { d, W, H, page }
}

export async function slipPdf(i) {
  const { d, W } = await base('Result Slip', i.date)
  const rows = [
    ['Student', i.name], ['Hub ID', i.code], ['Course', i.course], ['Test', i.title],
    ['Score', `${i.score} / ${i.total}`], ['Marks removed', String(i.penalty || 0)], ['Date', i.date]
  ]
  let y = 180
  rows.forEach(([k, v]) => {
    d.setFont('helvetica', 'normal').setFontSize(10).setTextColor(110).text(k, 56, y)
    d.setFont('helvetica', 'bold').setFontSize(12).setTextColor(20).text(String(v || '-'), 190, y)
    d.setDrawColor(216, 234, 221).setLineWidth(0.8).line(56, y + 9, W - 56, y + 9)
    y += 34
  })
  d.setFillColor(...(i.passed ? [11, 138, 62] : [211, 34, 42])).roundedRect(W / 2 - 95, y + 12, 190, 46, 12, 12, 'F')
  d.setFont('helvetica', 'bold').setFontSize(18).setTextColor(255).text(i.passed ? 'PASSED' : 'FAILED', W / 2, y + 42, { align: 'center' })
  d.setFont('helvetica', 'normal').setFontSize(9).setTextColor(110).text('ZAMHUB NIG LTD - zamhubnigltd@gmail.com - +234 706 688 9998', W / 2, 800, { align: 'center' })
  d.save('zamhub-result-slip.pdf')
}

export async function answersPdf(i) {
  const { d, W, H, page } = await base(`${i.title}: Questions and Answers`, i.date)
  d.setFont('helvetica', 'bold').setFontSize(11).setTextColor(11, 138, 62).text(`${i.name || ''}   Score: ${i.score} / ${i.total}`, W / 2, 154, { align: 'center' })
  const lab = (r, v) => (v == null ? 'No answer' : v.length === 1 && 'ABCD'.includes(v) ? `${v}. ${(r.options || [])['ABCD'.indexOf(v)] || ''}` : v)
  let y = 190
  ;(i.review || []).forEach((r, n) => {
    const q = d.splitTextToSize(`${n + 1}. ${r.question}`, W - 130)
    const need = q.length * 14 + (r.ok ? 40 : 58)
    if (y + need > H - 50) {
      d.addPage()
      page()
      y = 60
    }
    if (r.ok) d.setDrawColor(11, 138, 62).setLineWidth(2.4).line(42, y - 2, 47, y + 3).line(47, y + 3, 56, y - 9)
    else d.setDrawColor(211, 34, 42).setLineWidth(2.4).line(43, y - 9, 55, y + 2).line(55, y - 9, 43, y + 2)
    d.setFont('helvetica', 'bold').setFontSize(11).setTextColor(20).text(q, 70, y)
    y += q.length * 14
    d.setFont('helvetica', 'normal').setFontSize(10).setTextColor(90).text(d.splitTextToSize(`Your answer: ${lab(r, r.picked)}`, W - 130), 70, y)
    y += 16
    if (!r.ok) {
      d.setTextColor(11, 138, 62).text(d.splitTextToSize(`Correct answer: ${lab(r, r.answer)}`, W - 130), 70, y)
      y += 16
    }
    y += 14
  })
  d.save('zamhub-answers.pdf')
}

export async function imagesToPdf(urls, file) {
  const JsPDF = await lib()
  const d = new JsPDF({ unit: 'pt', format: 'a4' })
  const W = d.internal.pageSize.getWidth()
  const H = d.internal.pageSize.getHeight()
  for (const [n, u] of urls.entries()) {
    const im = await jpegOf(u)
    const r = Math.min((W - 40) / im.w, (H - 40) / im.h)
    const w = im.w * r
    const h = im.h * r
    if (n > 0) d.addPage()
    d.addImage(im.data, 'JPEG', (W - w) / 2, (H - h) / 2, w, h)
  }
  d.save(file || 'zamhub-certificate.pdf')
}
