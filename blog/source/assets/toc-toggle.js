// 目录面板：滚动时展开当前章节子目录、一键收起、标题栏折叠、滚动查看、状态记忆
(() => {
  const KEY_PANEL = 'blog-toc-collapsed'
  let panelCollapsed = localStorage.getItem(KEY_PANEL) === '1'
  let forceCollapsed = false

  const apply = () => {
    const card = document.querySelector('#card-toc')
    if (!card) return
    const content = card.querySelector('.toc-content')
    const head = card.querySelector('.item-headline')
    if (!content || !head) return

    content.style.maxHeight = panelCollapsed ? '0px' : 'min(60vh, 520px)'
    content.style.overflowY = 'auto'
    content.style.overflowX = 'hidden'
    content.style.transition = 'max-height .25s ease, opacity .2s ease'
    content.style.scrollbarWidth = 'thin'
    content.style.opacity = panelCollapsed ? '0' : '1'
    content.style.paddingTop = panelCollapsed ? '0' : ''
    content.style.paddingBottom = panelCollapsed ? '0' : ''
    head.classList.toggle('toc-collapsed', panelCollapsed)
  }

  const bind = () => {
    const card = document.querySelector('#card-toc')
    if (!card || card.dataset.toggleBound) return
    const head = card.querySelector('.item-headline')
    const content = card.querySelector('.toc-content')
    if (!head || !content) return
    card.dataset.toggleBound = '1'

    if (content.querySelector('.toc-child')) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.id = 'toc-collapse-children'
      btn.className = 'toc-expand-btn'
      btn.textContent = '收起子目录'
      const pct = head.querySelector('.toc-percentage')
      pct ? head.insertBefore(btn, pct) : head.appendChild(btn)
      btn.addEventListener('click', e => {
        e.stopPropagation()
        forceCollapsed = true
        content.classList.add('toc-force-collapse')
        btn.textContent = '已收起'
      })
    }

    head.style.cursor = 'pointer'
    head.style.userSelect = 'none'
    head.addEventListener('click', () => {
      panelCollapsed = !panelCollapsed
      localStorage.setItem(KEY_PANEL, panelCollapsed ? '1' : '0')
      apply()
    })
    apply()
  }

  // 滚动时展开当前阅读位置的章节子目录（主题原生 observer 不触发时的兜底）
  let ticking = false
  const onScroll = () => {
    if (ticking) return
    // 收起后用户继续滚动正文，立即解除强制收起，恢复主题默认的“滚动到哪展开哪”
    if (forceCollapsed) {
      forceCollapsed = false
      document.querySelectorAll('#card-toc .toc-content.toc-force-collapse').forEach(el => el.classList.remove('toc-force-collapse'))
      const btn = document.querySelector('#toc-collapse-children')
      if (btn) btn.textContent = '收起子目录'
    }
    ticking = true
    requestAnimationFrame(() => {
      ticking = false
      const card = document.querySelector('#card-toc')
      if (!card) return
      const content = card.querySelector('.toc-content')
      if (!content) return
      const links = [...content.querySelectorAll('.toc-link')]
      const headings = [...document.querySelectorAll('#article-container h1,#article-container h2,#article-container h3,#article-container h4,#article-container h5,#article-container h6')]
      if (!links.length || !headings.length) return

      // 找到视口上方最近的标题
      let current = headings[0]
      for (const h of headings) {
        if (h.getBoundingClientRect().top <= 120) current = h
        else break
      }
      const target = links.find(a => decodeURIComponent(a.getAttribute('href') || '').replace('#', '') === current.id)
      if (!target) return

      // 清除旧 active，给当前项及其所有祖先 li 加 active（CSS 据此展开子目录）
      content.querySelectorAll('li.active, a.active').forEach(el => el.classList.remove('active'))
      target.classList.add('active')
      let p = target.parentElement
      while (p && !p.classList.contains('toc-content')) {
        if (p.tagName === 'LI') p.classList.add('active')
        p = p.parentElement
      }
    })
  }

  bind()
  new MutationObserver(bind).observe(document.body, { childList: true, subtree: true })
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})()
