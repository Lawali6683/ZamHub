import { supabase } from './supabase.js'
import { toast } from './loader.js'

const $ = (id) => document.getElementById(id)

supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') {
    $('reqForm').hidden = true
    $('newForm').hidden = false
  }
})

if (location.hash.includes('type=recovery')) {
  $('reqForm').hidden = true
  $('newForm').hidden = false
}

$('reqForm').addEventListener('submit', async (e) => {
  e.preventDefault()
  const email = $('em').value.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return toast('Enter a valid email address.', 'warn')
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/forget.html' })
  if (error) return toast('Could not send the link. Try again later.', 'err')
  toast('If this email is registered, a reset link has been sent.')
})

$('newForm').addEventListener('submit', async (e) => {
  e.preventDefault()
  if ($('p1').value.length < 8) return toast('Password must be at least 8 characters.', 'warn')
  if ($('p1').value !== $('p2').value) return toast('Passwords do not match.', 'err')
  const { error } = await supabase.auth.updateUser({ password: $('p1').value })
  if (error) return toast('Could not save the password.', 'err')
  await supabase.auth.signOut()
  toast('Password changed. Please log in.')
  setTimeout(() => (location.href = 'register.html'), 1200)
})
