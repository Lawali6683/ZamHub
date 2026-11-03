import { supabase } from './supabase.js'
import { toast } from './loader.js'

const PIN_HASH = '4522d27a0589a4fc78b133d83f6c80a3a4bc6c0b91fbfafafb93884a026f109c'
export const $ = (id) => document.getElementById(id)
const LOGO = 'https://i.imgur.com/d6TxLMp.png'

async function sha(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('')
}

function overlay(html) {
  const g = document.createElement('div')
  g.className = 'gate'
  g.innerHTML = '<div class="gate-card"><img src="' + LOGO + '" alt="ZamHub">' + html + '</div>'
  document.body.appendChild(g)
  return g
}

function pinGate() {
  return new Promise((resolve) => {
    const g = overlay('<h2>Admin access</h2><p>Enter the 6-digit security code.</p><div class="pins">' + '<input inputmode="numeric" maxlength="1" autocomplete="off">'.repeat(6) + '</div>')
    const wrap = g.querySelector('.pins')
    const boxes = [...g.querySelectorAll('input')]
    boxes[0].focus()
    const check = async () => {
      const code = boxes.map((b) => b.value).join('')
      if (code.length < 6) return
      if ((await sha(code)) === PIN_HASH) {
        g.remove()
        resolve()
      } else {
        toast('Wrong security code.', 'err')
        wrap.classList.add('bad')
        setTimeout(() => wrap.classList.remove('bad'), 450)
        boxes.forEach((b) => (b.value = ''))
        boxes[0].focus()
      }
    }
    boxes.forEach((b, i) => {
      b.addEventListener('input', () => {
        b.value = b.value.replace(/\D/g, '').slice(-1)
        if (b.value && boxes[i + 1]) boxes[i + 1].focus()
        check()
      })
      b.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !b.value && boxes[i - 1]) boxes[i - 1].focus()
      })
      b.addEventListener('paste', (e) => {
        const t = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6)
        if (!t) return
        e.preventDefault()
        boxes.forEach((x, k) => (x.value = t[k] || ''))
        check()
      })
    })
  })
}

async function isAdmin() {
  const { data, error } = await supabase.rpc('is_admin')
  return !error && data === true
}

function loginGate() {
  return new Promise((resolve) => {
    const g = overlay('<h2>Admin login</h2><p>Only approved admin emails can enter.</p><form class="fm" style="text-align:left"><label><span>Email</span><input id="aEmail" type="email" autocomplete="email" required></label><label><span>Password</span><input id="aPass" type="password" autocomplete="current-password" required></label><button class="btn" type="submit">Submit</button></form>')
    g.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const btn = g.querySelector('button')
      btn.disabled = true
      const { error } = await supabase.auth.signInWithPassword({
        email: $('aEmail').value.trim().toLowerCase(),
        password: $('aPass').value
      })
      if (error) {
        btn.disabled = false
        return toast('Wrong email or password.', 'err')
      }
      if (!(await isAdmin())) {
        await supabase.auth.signOut()
        btn.disabled = false
        return toast('This email is not allowed here.', 'err')
      }
      g.remove()
      resolve()
    })
  })
}

export async function initAdmin() {
  await pinGate()
  const { data } = await supabase.auth.getSession()
  if (data.session && !(await isAdmin())) {
    await supabase.auth.signOut()
    data.session = null
  }
  if (!data.session) await loginGate()
  $('app').hidden = false
  document.querySelectorAll('[data-logout]').forEach((b) =>
    b.addEventListener('click', async () => {
      await supabase.auth.signOut()
      location.reload()
    })
  )
}

function compress(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const max = 1280
      const r = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * r)
      c.height = Math.round(img.height * r)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      resolve(c.toDataURL('image/jpeg', 0.8).split(',')[1])
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

export async function uploadToImgur(file) {
  const base64 = await compress(file)
  const res = await fetch('https://api.imgur.com/3/image', {
    method: 'POST',
    headers: { Authorization: 'Client-ID 5acf7eff9c91660' },
    body: new URLSearchParams({ image: base64, type: 'base64' })
  })
  const out = await res.json()
  if (!res.ok || !out.success) throw new Error('Upload failed')
  return out.data.link
}
