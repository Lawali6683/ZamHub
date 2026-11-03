import { supabase } from './supabase.js'
import { toast } from './loader.js'

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const labels = { one_time: 'pay once', weekly: 'per week', monthly: 'per month', yearly: 'per year' }
const LOGO = 'https://i.imgur.com/d6TxLMp.png'
const price = (c) => `<div class="price">₦${Number(c.price).toLocaleString()} <small>${labels[c.billing] || ''}</small></div>`
let courses = []

function view(c) {
  const m = document.createElement('div')
  m.className = 'modal'
  m.innerHTML = `<div class="box"><button class="ibtn x" aria-label="Close"><i class="fa-solid fa-xmark"></i></button><img src="${esc(c.image_url || LOGO)}" alt="${esc(c.course_name)}"><div class="in"><h2>${esc(c.course_name)}</h2>${price(c)}<div class="txt">${esc(c.description)}</div><a class="btn" href="register.html?course=${c.id}&tab=register">Apply now</a></div></div>`
  m.addEventListener('click', (e) => {
    if (e.target === m || e.target.closest('.x')) m.remove()
  })
  document.body.appendChild(m)
}

;(async () => {
  const { data, error } = await supabase.from('view_courser').select('*').order('created_at', { ascending: false })
  const grid = document.getElementById('grid')
  if (error) {
    toast('Could not load courses.', 'err')
    grid.innerHTML = '<p>Please refresh the page.</p>'
    return
  }
  courses = data || []
  grid.innerHTML = courses.length
    ? courses.map((c) => `<article class="card cc"><img src="${esc(c.image_url || LOGO)}" alt="${esc(c.course_name)}" loading="lazy"><div class="b"><h3>${esc(c.course_name)}</h3>${price(c)}<p>${esc(c.description)}</p><div class="acts"><button class="btn line" data-v="${c.id}" type="button">View</button><a class="btn" href="register.html?course=${c.id}&tab=register">Apply</a></div></div></article>`).join('')
    : '<p>No courses have been added yet. Please check back soon.</p>'
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]')
    if (b) view(courses.find((c) => c.id === b.dataset.v))
  })
})()
