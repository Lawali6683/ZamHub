import { toast } from './loader.js'

const LOGO = 'https://i.imgur.com/d6TxLMp.png'
const PHONE = '2347066889998'
const page = location.pathname.split('/').pop() || 'index.html'
const links = [
  ['Home', 'index.html', 'fa-house'],
  ['Courses', 'course.html', 'fa-book-open'],
  ['About', 'about.html', 'fa-circle-info'],
  ['Contact', 'contact.html', 'fa-envelope']
]

const APP = document.body.dataset.app === '1'
const LG = APP ? '' : '<span class="lg"><a class="btn line" href="register.html">Login</a><a class="btn" href="register.html?tab=register">Register</a></span>'
const TAIL = APP
  ? '<a href="certificate.html"><i class="fa-solid fa-certificate"></i> My certificate</a><a href="register.html" id="lo"><i class="fa-solid fa-right-from-bracket"></i> Log out</a>'
  : '<a href="register.html"><i class="fa-solid fa-right-to-bracket"></i> Login</a><a class="pri" href="register.html?tab=register"><i class="fa-solid fa-user-plus"></i> Register</a>'
const hd = document.getElementById('hdr')
if (hd) {
  hd.innerHTML = `<header class="hd"><a class="brandlink" href="index.html" aria-label="ZamHub home"><img src="${LOGO}" alt="ZamHub" width="40" height="40"><b>ZamHub</b></a>${LG}<button class="ibtn" id="mb" aria-label="Open menu"><i class="fa-solid fa-bars"></i></button></header>
  <div class="drawer" id="dr"><div class="shade" id="sh"></div><nav><button class="ibtn x" id="cb" aria-label="Close menu"><i class="fa-solid fa-xmark"></i></button>
  ${links.map(([t, h, i]) => `<a href="${h}" class="${h === page ? 'cur' : ''}"><i class="fa-solid ${i}"></i> ${t}</a>`).join('')}
  ${TAIL}</nav></div>`
  const dr = document.getElementById('dr')
  document.getElementById('mb').addEventListener('click', () => dr.classList.add('on'))
  document.getElementById('cb').addEventListener('click', () => dr.classList.remove('on'))
  document.getElementById('sh').addEventListener('click', () => dr.classList.remove('on'))
  const lo = document.getElementById('lo')
  if (lo) {
    lo.addEventListener('click', async (e) => {
      e.preventDefault()
      const { supabase } = await import('./supabase.js')
      await supabase.auth.signOut()
      location.href = 'register.html'
    })
  }
}

const ft = document.getElementById('ftr')
if (ft) {
  ft.innerHTML = `<footer class="ft"><img src="${LOGO}" alt="ZamHub" width="70" height="70"><b>ZAMHUB NIG LTD</b><br>We Shape Tomorrow<nav>${links.map(([t, h]) => `<a href="${h}">${t}</a>`).join('')}</nav><small>+234 706 688 9998</small></footer>`
}

const fl = document.createElement('div')
fl.className = 'float'
fl.innerHTML = `<a class="wa" href="https://wa.me/${PHONE}?text=${encodeURIComponent('Hello ZamHub, I would like to know more about your courses.')}" target="_blank" rel="noopener" aria-label="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a><a class="call" href="tel:+${PHONE}" aria-label="Call"><i class="fa-solid fa-phone"></i></a>`
document.body.appendChild(fl)

document.querySelectorAll('[data-yt]').forEach((el) => {
  const id = el.dataset.yt
  el.classList.add('yt')
  if (el.dataset.short) el.classList.add('short')
  el.innerHTML = `<img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="Video preview" loading="lazy"><div class="pl"><span><i class="fa-solid fa-play"></i></span></div>`
  el.addEventListener('click', () => {
    el.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" title="ZamHub video"></iframe>`
    el.style.cursor = 'default'
  }, { once: true })
})

document.querySelectorAll('video[data-fallback]').forEach((v) => {
  const swap = () => {
    const d = document.createElement('div')
    d.className = 'nov'
    d.innerHTML = '<div><i class="fa-solid fa-film" style="font-size:2rem;color:var(--red)"></i><p>This video is not available right now. Please check back soon.</p></div>'
    v.replaceWith(d)
  }
  const s = v.querySelector('source')
  if (s) s.addEventListener('error', swap, { once: true })
  v.addEventListener('error', swap, { once: true })
})

const cf = document.getElementById('cform')
if (cf) {
  cf.addEventListener('submit', (e) => {
    e.preventDefault()
    const n = document.getElementById('cn').value.trim()
    const m = document.getElementById('cm').value.trim()
    const from = document.getElementById('ce').value.trim()
    if (n.length < 2) return toast('Enter your name.', 'warn')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(from)) return toast('Enter a valid email address.', 'warn')
    if (m.length < 5) return toast('Write your message.', 'warn')
    const to = ['zamhubnigltd', 'gmail.com'].join('@')
    const subject = encodeURIComponent(`Message from ${n} (ZamHub website)`)
    const body = encodeURIComponent(`${m}\n\nName: ${n}\nReply to: ${from}`)
    toast('Opening your email app...')
    location.href = `mailto:${to}?subject=${subject}&body=${body}`
  })
}

if ('IntersectionObserver' in window) {
  document.documentElement.classList.add('js')
  const io = new IntersectionObserver(
    (list) => list.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('in')
        io.unobserve(e.target)
      }
    }),
    { threshold: 0.1 }
  )
  document.querySelectorAll('section > .w, main.page > *, .s-g2 img').forEach((el) => {
    el.classList.add('rv')
    io.observe(el)
  })
}

async function sha(t) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')
}

const hin = document.getElementById('hin')
if (hin && window.crypto && crypto.subtle) {
  const out = document.getElementById('hout')
  const run = async () => {
    out.textContent = await sha(hin.value)
    out.classList.remove('flash')
    void out.offsetWidth
    out.classList.add('flash')
  }
  hin.addEventListener('input', run)
  run()
}

const chain = document.getElementById('chain')
if (chain && window.crypto && crypto.subtle) {
  ;(async () => {
    let prev = '0'.repeat(64)
    let html = ''
    for (let i = 1; i <= 4; i++) {
      const hash = await sha(prev + 'ZamHub block ' + i)
      html += `<div class="blk"><b>Block #${i}</b><small>Previous</small><code>${prev.slice(0, 12)}</code><small>Hash</small><code>${hash.slice(0, 12)}</code></div>`
      prev = hash
    }
    chain.innerHTML = html
  })()
}

const cv = document.getElementById('zcv')
if (cv) {
  const ctx = cv.getContext('2d')
  const coin = new Image()
  coin.src = LOGO
  const el = (id) => document.getElementById(id)
  const H = 260
  const MAX = 60
  let pts = [1]
  let ticks = 0
  let timer = null
  let t0 = 0
  const size = () => {
    const r = window.devicePixelRatio || 1
    cv.width = cv.clientWidth * r
    cv.height = H * r
    ctx.setTransform(r, 0, 0, r, 0, 0)
  }
  const frame = () => {
    const W = cv.clientWidth
    ctx.clearRect(0, 0, W, H)
    const hi = Math.max(...pts)
    const lo = Math.min(...pts)
    const mx = hi * 1.1
    const mn = Math.max(0, lo * 0.9)
    const padL = 8
    const padR = 58
    const X = (i) => padL + (i / (MAX - 1)) * (W - padL - padR)
    const Y = (v) => H - 22 - ((v - mn) / (mx - mn || 1)) * (H - 46)
    ctx.font = '10px ui-monospace,Menlo,monospace'
    ctx.fillStyle = '#5b6b61'
    for (let k = 0; k <= 4; k++) {
      const v = mn + ((mx - mn) * k) / 4
      ctx.fillText('$' + v.toFixed(2), W - padR + 8, Y(v) + 3)
    }
    const last = pts[pts.length - 1]
    const up = last >= 1
    const col = up ? '#0b8a3e' : '#d3222a'
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, up ? 'rgba(11,138,62,.35)' : 'rgba(211,34,42,.3)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.beginPath()
    pts.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))))
    ctx.lineTo(X(pts.length - 1), H)
    ctx.lineTo(X(0), H)
    ctx.closePath()
    ctx.fillStyle = g
    ctx.fill()
    ctx.save()
    ctx.shadowColor = col
    ctx.shadowBlur = 12
    ctx.beginPath()
    pts.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))))
    ctx.strokeStyle = col
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    ctx.stroke()
    ctx.restore()
    const lx = X(pts.length - 1)
    const ly = Y(last)
    ctx.setLineDash([4, 4])
    ctx.strokeStyle = col
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(lx, ly)
    ctx.lineTo(W - padR + 4, ly)
    ctx.stroke()
    ctx.setLineDash([])
    const pulse = ((Date.now() - t0) % 1200) / 1200
    ctx.beginPath()
    ctx.arc(lx, ly, 16 + pulse * 14, 0, Math.PI * 2)
    ctx.strokeStyle = col
    ctx.globalAlpha = 1 - pulse
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.beginPath()
    ctx.arc(lx, ly, 16, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = col
    ctx.stroke()
    if (coin.complete && coin.naturalWidth) ctx.drawImage(coin, lx - 12, ly - 12, 24, 24)
    requestAnimationFrame(frame)
  }
  const tickSim = () => {
    if (document.hidden) return
    const last = pts[pts.length - 1]
    const next = Math.max(0.3, last * (1 + (Math.random() - 0.42) * 0.12))
    pts.push(next)
    if (pts.length > MAX) pts.shift()
    ticks++
    const ch = (next - 1) * 100
    el('zp').textContent = '$' + next.toFixed(2)
    el('zc').textContent = (ch >= 0 ? '+' : '') + ch.toFixed(1) + '%'
    el('zc').style.color = ch >= 0 ? '#0b8a3e' : '#d3222a'
    el('zh').textContent = '$' + Math.max(...pts).toFixed(2)
    el('zl').textContent = '$' + Math.min(...pts).toFixed(2)
    el('zt').textContent = ticks
    if (next >= 25) {
      clearInterval(timer)
      setTimeout(restart, 2500)
    }
  }
  const restart = () => {
    clearInterval(timer)
    pts = [1]
    ticks = 0
    t0 = Date.now()
    timer = setInterval(tickSim, 600)
  }
  size()
  window.addEventListener('resize', size)
  el('zr').addEventListener('click', restart)
  restart()
  frame()
}
