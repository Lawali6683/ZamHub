import { supabase } from './supabase.js'
import { toast } from './loader.js'

const $ = (id) => document.getElementById(id)
const params = new URLSearchParams(location.search)
const wantedCourse = params.get('course') || params.get('id') || ''

const tabLogin = $('tabLogin')
const tabReg = $('tabReg')
const loginForm = $('loginForm')
const regForm = $('regForm')

function showTab(which) {
  const login = which === 'login'
  loginForm.hidden = !login
  regForm.hidden = login
  tabLogin.classList.toggle('on', login)
  tabReg.classList.toggle('on', !login)
  tabLogin.setAttribute('aria-selected', String(login))
  tabReg.setAttribute('aria-selected', String(!login))
}

tabLogin.addEventListener('click', () => showTab('login'))
tabReg.addEventListener('click', () => showTab('register'))

document.querySelectorAll('[data-eye]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = $(btn.dataset.eye)
    const show = input.type === 'password'
    input.type = show ? 'text' : 'password'
    btn.querySelector('i').className = show ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'
  })
})

async function loadCourses() {
  const select = $('rCourse')
  const { data, error } = await supabase
    .from('view_courser')
    .select('id,course_name,course_code,price,billing')
    .order('created_at', { ascending: false })
  if (error || !data || !data.length) {
    select.innerHTML = '<option value="">No courses available</option>'
    return
  }
  const labels = { one_time: 'one time', weekly: 'per week', monthly: 'per month', yearly: 'per year' }
  select.innerHTML = '<option value="">Select a course</option>'
  data.forEach((c) => {
    const opt = document.createElement('option')
    opt.value = c.id
    opt.textContent = `${c.course_name} - ₦${Number(c.price).toLocaleString()} ${labels[c.billing] || ''}`
    select.appendChild(opt)
  })
  if (wantedCourse) {
    const match = data.find((c) => c.id === wantedCourse || c.course_code === wantedCourse)
    if (match) {
      select.value = match.id
      showTab('register')
    }
  }
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const email = $('lEmail').value.trim().toLowerCase()
  const password = $('lPass').value
  if (!email || !password) return toast('Enter your email and password.', 'warn')
  const btn = $('loginBtn')
  btn.disabled = true
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    btn.disabled = false
    return toast('Wrong email or password.', 'err')
  }
  toast('Login successful.')
  setTimeout(() => (location.href = 'dashboard.html'), 700)
})

function deviceInfo() {
  return {
    platform: navigator.platform || '',
    language: navigator.language || '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    screen: `${screen.width}x${screen.height}`,
    pixel_ratio: window.devicePixelRatio || 1,
    touch: navigator.maxTouchPoints > 0,
    memory: navigator.deviceMemory || null,
    cores: navigator.hardwareConcurrency || null
  }
}

regForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const payload = {
    full_name: $('rName').value.trim(),
    email: $('rEmail').value.trim().toLowerCase(),
    phone: $('rPhone').value.trim(),
    gender: $('rGender').value,
    course_id: $('rCourse').value,
    password: $('rPass').value,
    device: deviceInfo()
  }
  if (payload.full_name.length < 3) return toast('Enter your full name.', 'warn')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(payload.email)) return toast('Enter a valid email address.', 'warn')
  if (!/^\+?[0-9\s-]{7,16}$/.test(payload.phone)) return toast('Enter a valid phone number.', 'warn')
  if (!payload.gender) return toast('Select your gender.', 'warn')
  if (!payload.course_id) return toast('Select a course.', 'warn')
  if (payload.password.length < 8) return toast('Password must be at least 8 characters.', 'warn')
  if (payload.password !== $('rPass2').value) return toast('Passwords do not match.', 'err')

  const btn = $('regBtn')
  btn.disabled = true
  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const out = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast(out.error || 'Registration failed. Try again.', 'err')
      btn.disabled = false
      return
    }
    toast('Account created. Please log in to continue.')
    $('lEmail').value = payload.email
    regForm.reset()
    showTab('login')
  } catch {
    toast('Network error. Check your connection.', 'err')
  }
  btn.disabled = false
})

if (params.get('tab') === 'register') showTab('register')
loadCourses()
