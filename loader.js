const LOGO = 'https://i.imgur.com/d6TxLMp.png'

const loader = document.createElement('div')
loader.id = 'zam-loader'
loader.innerHTML = `<img src="${LOGO}" alt="ZamHub" width="120" height="120"><div class="zl-bar"><span></span></div><p>We Shape Tomorrow</p>`
document.documentElement.appendChild(loader)

const hide = () => {
  loader.classList.add('done')
  setTimeout(() => loader.remove(), 500)
}

if (document.readyState === 'complete') hide()
else window.addEventListener('load', hide)

export function toast(message, type = 'ok') {
  let box = document.getElementById('zam-toasts')
  if (!box) {
    box = document.createElement('div')
    box.id = 'zam-toasts'
    box.setAttribute('role', 'status')
    box.setAttribute('aria-live', 'polite')
    document.body.appendChild(box)
  }
  const item = document.createElement('div')
  item.className = `zt zt-${type}`
  const icon = type === 'ok' ? 'fa-circle-check' : type === 'warn' ? 'fa-triangle-exclamation' : 'fa-circle-xmark'
  item.innerHTML = `<i class="fa-solid ${icon}"></i><span></span>`
  item.querySelector('span').textContent = message
  box.appendChild(item)
  requestAnimationFrame(() => item.classList.add('show'))
  setTimeout(() => {
    item.classList.remove('show')
    setTimeout(() => item.remove(), 350)
  }, 4200)
}

export function busy(on) {
  let b = document.getElementById('zam-loader')
  if (!on) {
    if (b) b.remove()
    return
  }
  if (b) return
  b = document.createElement('div')
  b.id = 'zam-loader'
  b.innerHTML = `<img src="${LOGO}" alt="ZamHub" width="120" height="120"><div class="zl-bar"><span></span></div><p>Please wait...</p>`
  document.body.appendChild(b)
}
