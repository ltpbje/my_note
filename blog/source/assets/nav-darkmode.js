// 把右下角的深浅模式按钮克隆到导航栏右上角常驻，点击转发给原按钮
(() => {
  const place = () => {
    const menus = document.querySelector('#menus')
    const src = document.querySelector('#rightside #darkmode')
    if (!menus || !src || document.querySelector('#nav-darkmode')) return
    const toggle = document.querySelector('#toggle-menu')
    const btn = document.createElement('button')
    btn.id = 'nav-darkmode'
    btn.type = 'button'
    btn.title = src.title
    btn.className = 'site-page social-icon'
    btn.innerHTML = src.innerHTML
    btn.addEventListener('click', () => src.click())
    toggle ? menus.insertBefore(btn, toggle) : menus.appendChild(btn)
  }
  place()
})()
