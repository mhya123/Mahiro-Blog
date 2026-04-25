import { animate, stagger } from 'animejs'

function promoteToGpu(elements: Iterable<HTMLElement> | ArrayLike<HTMLElement>) {
  Array.from(elements).forEach((el) => {
    el.style.willChange = 'transform, opacity'
    el.style.transform =
      el.style.transform && el.style.transform !== 'none'
        ? `${el.style.transform} translateZ(0)`
        : 'translateZ(0)'
    el.style.backfaceVisibility = 'hidden'
  })
}

function releaseGpu(elements: Iterable<HTMLElement> | ArrayLike<HTMLElement>) {
  Array.from(elements).forEach((el) => {
    el.style.willChange = ''
    el.style.backfaceVisibility = ''
    if (el.style.transform === 'translateZ(0)') {
      el.style.transform = ''
    }
  })
}

/**
 * 全局柔和过渡系统 — anime.js 缓动函数注入
 *
 * 用真正的弹性 / 阻尼曲线替换 CSS 的 ease、ease-in-out 等生硬缓动，
 * 让整个博客的交互手感如丝般顺滑。
 *
 * 涵盖的场景：
 * 1. 侧边栏卡片入场（依次浮现）
 * 2. 可悬浮卡片的弹性 hover（替代 Tailwind hover:-translate-y-1）
 * 3. 导航栏滚动隐藏/显示（平滑滑动而非硬切）
 * 4. 分类/标签页卡片交错入场
 * 5. 归档卡片弹性 hover
 * 6. 返回顶部 / FAB 按钮呼吸感入场
 */

// ─── 1. 侧边栏卡片交错入场 ──────────────────────────

function animateSidebar() {
  const sidebar = document.querySelector('aside')
  if (!sidebar) return

  const cards = sidebar.querySelectorAll<HTMLElement>(':scope > .relative, :scope > .md\\:sticky > *')
  if (cards.length === 0) return

  // 避免重复绑定
  if ((sidebar as any).__sidebarAnimated) return
  ;(sidebar as any).__sidebarAnimated = true

  cards.forEach(el => {
    el.style.opacity = '0'
    el.style.transform = 'translateX(-20px)'
  })
  promoteToGpu(cards)

  animate(cards, {
    opacity: [0, 1],
    translateX: ['-20px', '0px'],
    duration: 700,
    delay: stagger(120, { start: 200 }),
    ease: 'out(3)',
    onComplete() {
      Array.from(cards).forEach(el => {
        el.style.transform = ''
      })
      releaseGpu(cards)
    },
  })
}

// ─── 2. 弹性 hover — 替代 Tailwind hover:-translate-y-1 ─

function bindElasticHover() {
  // 选择所有带 hover:-translate-y-1 的卡片式元素
  const selectors = [
    '.archive-card',           // 归档卡片
    '.category-inner',         // 分类卡片
    '.press-effect',           // 首页导航卡片
    '.card.shadow-lg',         // 通用大卡片
  ]

  document.querySelectorAll<HTMLElement>(selectors.join(',')).forEach(el => {
    if (el.dataset.elasticBound) return
    el.dataset.elasticBound = '1'

    // 取消 Tailwind 的硬切 translate，由 anime.js 接管
    el.classList.remove('hover:-translate-y-1')

    el.addEventListener('mouseenter', () => {
      promoteToGpu([el])
      animate(el, {
        translateY: '-4px',
        duration: 400,
        ease: 'out(4)',       // 丝滑阻尼出
      })
    })

    el.addEventListener('mouseleave', () => {
      animate(el, {
        translateY: '0px',
        duration: 500,
        ease: 'out(2)',       // 更慢回弹，有"放下"的质感
        onComplete() {
          releaseGpu([el])
        },
      })
    })
  })
}

// ─── 3. 导航栏平滑滑动 ─────────────────────────────

function bindNavbarSmooth() {
  const navDesktop = document.getElementById('navbar-desktop')
  const navMobile = document.getElementById('navbar-mobile')

  if (!navDesktop && !navMobile) return

  // 防止重复绑定
  if ((window as any).__navbarSmoothBound) return
  ;(window as any).__navbarSmoothBound = true

  let lastScrollY = window.scrollY
  let desktopHidden = false
  let mobileHidden = false
  promoteToGpu([navDesktop, navMobile].filter(Boolean) as HTMLElement[])

  // 移除原有 CSS transition 类（我们用 anime.js 接管）
  navDesktop?.classList.remove('transition-opacity', 'duration-500')
  navMobile?.classList.remove('transition-all', 'duration-500', 'ease-in-out')

  function handleScroll() {
    const y = window.scrollY
    const goingDown = y > lastScrollY && y > 50

    // 桌面端：向下滚动淡出上滑 / 向上滚动淡入下滑
    if (navDesktop) {
      if (goingDown && !desktopHidden) {
        desktopHidden = true
        navDesktop.style.pointerEvents = 'none'
        animate(navDesktop, {
          opacity: [1, 0],
          translateY: ['0px', '-20px'],
          duration: 350,
          ease: 'in(3)',
        })
      } else if (!goingDown && desktopHidden) {
        desktopHidden = false
        navDesktop.style.pointerEvents = 'auto'
        animate(navDesktop, {
          opacity: [0, 1],
          translateY: ['-20px', '0px'],
          duration: 450,
          ease: 'out(3)',
        })
      }
    }

    // 移动端：向下滚动上滑隐藏 / 向上滚动弹回
    if (navMobile) {
      if (goingDown && !mobileHidden) {
        mobileHidden = true
        navMobile.style.pointerEvents = 'none'
        animate(navMobile, {
          translateY: [0, -100],
          opacity: [1, 0],
          duration: 350,
          ease: 'in(3)',
        })
      } else if (!goingDown && mobileHidden) {
        mobileHidden = false
        navMobile.style.pointerEvents = 'auto'
        animate(navMobile, {
          translateY: [-100, 0],
          opacity: [0, 1],
          duration: 450,
          ease: 'out(4)',     // 更有弹性的回弹
        })
      }
    }

    lastScrollY = y
  }

  let ticking = false
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        handleScroll()
        ticking = false
      })
      ticking = true
    }
  })
}

// ─── 4. 分类 / 标签页卡片 CSS 动画 → anime.js ──────

function animateCategoryCards() {
  const cards = document.querySelectorAll<HTMLElement>('.category-card')
  if (cards.length === 0) return
  promoteToGpu(cards)

  // 用 anime.js 替代 CSS @keyframes fadeIn
  cards.forEach(el => {
    el.style.animation = 'none' // 取消原 CSS animation
  })

  animate(cards, {
    opacity: [0, 1],
    translateY: ['20px', '0px'],
    duration: 600,
    delay: stagger(80),
    ease: 'out(3)',
    onComplete() {
      releaseGpu(cards)
    },
  })
}

function animateTagItems() {
  const items = document.querySelectorAll<HTMLElement>('.tags-item')
  if (items.length === 0) return
  promoteToGpu(items)

  items.forEach(el => {
    el.style.animation = 'none'
  })

  animate(items, {
    opacity: [0, 1],
    translateY: ['8px', '0px'],
    scale: [0.92, 1],
    duration: 500,
    delay: stagger(25, { start: 100 }),
    ease: 'out(3)',
    onComplete() {
      releaseGpu(items)
    },
  })
}

// ─── 5. 链接卡片 & 导航卡片柔和 hover ─────────────

function bindLinkCardHover() {
  const selectors = [
    '.navigation-card a',       // 导航页链接
    '.friend-card',             // 友链卡片
    '.project-card',            // 项目卡片
  ]

  document.querySelectorAll<HTMLElement>(selectors.join(',')).forEach(el => {
    if (el.dataset.softHover) return
    el.dataset.softHover = '1'

    el.addEventListener('mouseenter', () => {
      promoteToGpu([el])
      animate(el, {
        translateY: '-3px',
        scale: 1.015,
        duration: 350,
        ease: 'out(4)',
      })
    })

    el.addEventListener('mouseleave', () => {
      animate(el, {
        translateY: '0px',
        scale: 1,
        duration: 450,
        ease: 'out(2)',
        onComplete() {
          releaseGpu([el])
        },
      })
    })
  })
}

// ─── 6. 图片点击缩放反馈 ─────────────────────────

function bindImagePressEffect() {
  document.querySelectorAll<HTMLElement>('.prose img').forEach(img => {
    if (img.dataset.pressBound) return
    img.dataset.pressBound = '1'

    img.addEventListener('click', () => {
      promoteToGpu([img])
      animate(img, {
        scale: [1, 0.97, 1.01, 1],
        duration: 400,
        ease: 'out(3)',
        onComplete() {
          releaseGpu([img])
        },
      })
    })
  })
}

// ─── 统一入口 ────────────────────────────────────────

/**
 * 初始化全局柔和过渡。
 * 在 astro:page-load 中调用，在 initHoverEffects 之后。
 */
export function initSmoothTransitions() {
  // 侧边栏入场
  animateSidebar()

  // 弹性 hover
  bindElasticHover()

  // 导航栏平滑滚动隐藏
  bindNavbarSmooth()

  // 分类 / 标签页动画接管
  animateCategoryCards()
  animateTagItems()

  // 链接卡片柔和 hover
  bindLinkCardHover()

  // 图片点击反馈
  bindImagePressEffect()
}
