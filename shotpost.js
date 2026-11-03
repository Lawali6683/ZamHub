import { initAdmin, uploadToImgur, $ } from './admin-core.js'
import { supabase } from './supabase.js'
import { toast } from './loader.js'

const prev = $('prev')
const showPrev = (src) => {
  prev.hidden = !src
  if (src) prev.src = src
}

$('img').addEventListener('input', () => showPrev($('img').value.trim()))
$('file').addEventListener('change', () => {
  const f = $('file').files[0]
  if (f) {
    $('img').value = ''
    showPrev(URL.createObjectURL(f))
  }
})

$('form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const name = $('name').value.trim()
  const code = $('code').value.trim()
  const price = Number($('price').value)
  const billing = $('billing').value
  const desc = $('desc').value
  if (!name || !code) return toast('Enter the course name and code.', 'warn')
  if (!(price >= 0) || $('price').value === '') return toast('Enter a valid price.', 'warn')
  if (!billing) return toast('Select a payment type.', 'warn')
  if (!desc.trim()) return toast('Enter the course description.', 'warn')

  const btn = $('go')
  btn.disabled = true
  try {
    let image = $('img').value.trim()
    const file = $('file').files[0]
    if (file) image = await uploadToImgur(file)
    const { error } = await supabase.from('view_courser').insert({
      course_name: name,
      course_code: code,
      price,
      billing,
      description: desc,
      image_url: image
    })
    if (error) {
      toast(error.code === '23505' ? 'This course code is already used.' : 'Could not save the course.', 'err')
    } else {
      toast('Course saved.')
      $('form').reset()
      showPrev('')
    }
  } catch {
    toast('Image upload failed. Try again.', 'err')
  }
  btn.disabled = false
})

initAdmin()
