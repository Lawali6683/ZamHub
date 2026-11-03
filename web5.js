import { initAdmin, $ } from './admin-core.js'

const items = [
  { icon: 'fa-circle-plus', name: 'Add course', info: 'Create a new course', href: 'shotpost.html' },
  { icon: 'fa-list-check', name: 'Topics and courses', info: 'Add or edit topics and course details', href: 'postopic.html' },
  { icon: 'fa-users-gear', name: 'Admin dashboard', info: 'Users, payments and reports', href: 'admin.html' },
  { icon: 'fa-clipboard-question', name: 'Assessments and exams', info: 'Set questions, time and pass marks', href: 'quizadmin.html' },
  { icon: 'fa-certificate', name: 'Certificates', info: 'Students who passed the final exam', href: 'certs.html' }
]

initAdmin().then(() => {
  $('tiles').innerHTML = items
    .map((i) => `<a class="tile${i.off ? ' off' : ''}" href="${i.href}"><i class="fa-solid ${i.icon}"></i><span><b>${i.name}</b><small>${i.off ? 'Coming soon' : i.info}</small></span></a>`)
    .join('')
})
