import { animate, stagger } from 'animejs'

/**
 * 提升元素至 GPU 渲染层，减少重绘引起的掉帧
 * @param elements 需要开启硬件加速的 HTML 元素集合
 */
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

/**
 * 释放 GPU 资源，在动画结束后清理 style 属性
 * @param elements 需要清理硬件加速样式的 HTML 元素集合
 */
function releaseGpu(elements: Iterable<HTMLElement> | ArrayLike<HTMLElement>) {
  Array.from(elements).forEach((el) => {
    el.style.willChange = ''
    el.style.backfaceVisibility = ''
    if (el.style.transform === 'translateZ(0)') {
      el.style.transform = ''
    }
  })
}

/* ==========================================================
 * 全局柔和过渡系统 (Global Smooth Transitions)
 * ========================================================== */

// ─── 1. 侧边栏卡片交错入场 ──────────────────────────

/**
 * 侧边栏卡片瀑布流交错入场动画
 */
function animateSidebar() {
  const sidebar = document.querySelector('aside')
  if (!sidebar) return

  const cards = sidebar.querySelectorAll<HTMLElement>(':scope > .relative, :scope > .md\\:sticky > *')
  if (cards.length === 0) return

  // 避免逻辑重复执行
  if ((sidebar as any).__sidebarAnimated) return
  ;(sidebar as any).__sidebarAnimated = true

  // 初始化初始状态
  cards.forEach(el => {
    el.style.opacity = '0'
    el.style.transform = 'translateX(-20px)'
  })
  promoteToGpu(cards)

  animate(cards, {
    opacity: [0, 1],
    translateX: ['-20px', '0px'],
    duration: 700,
    delay: stagger(120, { start: 200 }), // 分阶延迟，产生交错感
    ease: 'out(3)',
    onComplete() {
      // 清收动画残留样式
      Array.from(cards).forEach(el => {
        el.style.transform = ''
      })
      releaseGpu(cards)
    },
  })
}

// ─── 2. 弹性悬浮交互 (取代 Tailwind 的普通位移) ─────

/**
 * 为特定的卡片式元素绑定具有物理阻尼感的悬浮动画
 */
function bindElasticHover() {
  const selectors = [
    '.archive-card',           // 归档卡片
    '.category-inner',         // 分类卡片
    '.press-effect',           // 首页导航卡片
    '.card.shadow-lg',         // 通用卡片容器
  ]

  document.querySelectorAll<HTMLElement>(selectors.join(',')).forEach(el => {
    if (el.dataset.elasticBound) return
    el.dataset.elasticBound = '1'

    // 禁用 Tailwind 默认的硬切 translate 动画
    el.classList.remove('hover:-translate-y-1')

    el.addEventListener('mouseenter', () => {
      promoteToGpu([el])
      animate(el, {
        translateY: '-4px',
        duration: 400,
        ease: 'out(4)',       // 丝滑阻尼式滑入
      })
    })

    el.addEventListener('mouseleave', () => {
      animate(el, {
        translateY: '0px',
        duration: 500,
        ease: 'out(2)',       // 优雅回弹，模拟"放下"的物理质感
        onComplete() {
          releaseGpu([el])
        },
      })
    })
  })
}

let _navbarScrollListenerBound = false
let _navbarLastScrollY = 0
let _navbarDesktopHidden = false
let _navbarMobileHidden = false

/**
 * 导航栏随滚动智能显隐逻辑。
 * 使用 CSS Transition 替代 JS 动画循环，利用合成器线程确保 60FPS 的极致流畅。
 */
function bindNavbarSmooth() {
  // 动态注入核心显隐 CSS 规则
  const styleId = 'mahiro-navbar-transition'
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      #navbar-bg,
      #navbar-mobile-bg {
        transition: opacity 0.4s cubic-bezier(0.25, 0.1, 0.25, 1),
                    visibility 0s linear 0s;
      }
      #navbar-bg.nav-hidden,
      #navbar-mobile-bg.nav-hidden {
        opacity: 0 !important;
        pointer-events: none;
        visibility: hidden;
        transition: opacity 0.4s cubic-bezier(0.25, 0.1, 0.25, 1),
                    visibility 0s linear 0.4s; /* 确保 display:hidden 在透明后触发 */
      }
    `
    document.head.appendChild(style)
  }

  // 获取页面切换后的新 DOM 节点，清除旧有的 CSS 动画干扰类
  const navDesktop = document.getElementById('navbar-desktop')
  const navMobile = document.getElementById('navbar-mobile')
  navDesktop?.classList.remove('transition-opacity', 'duration-500')
  navMobile?.classList.remove('transition-all', 'duration-500', 'ease-in-out')

  // 若存在新页面重新初始化，则重置滚动状态
  _navbarLastScrollY = window.scrollY
  _navbarDesktopHidden = false
  _navbarMobileHidden = false

  // 全局只绑定一次 window 的 scroll 事件
  if (_navbarScrollListenerBound) return
  _navbarScrollListenerBound = true

  // 使用 rAF (RequestAnimationFrame) 节流滚动事件
  let ticking = false
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const y = window.scrollY
        const goingDown = y > _navbarLastScrollY && y > 50

        // 因为 Astro 视图过渡会重建 DOM，所以需在每次滚动时动态获取元素
        const curNavBg = document.getElementById('navbar-bg')
        const curNavMobBg = document.getElementById('navbar-mobile-bg')
        const curNavDesktop = document.getElementById('navbar-desktop')
        const curNavMobile = document.getElementById('navbar-mobile')

        // ── 桌面端控制 ──
        if (curNavBg && curNavDesktop) {
          if (goingDown && !_navbarDesktopHidden) {
            _navbarDesktopHidden = true
            curNavDesktop.style.pointerEvents = 'none'
            curNavBg.classList.add('nav-hidden')
          } else if (!goingDown && _navbarDesktopHidden) {
            _navbarDesktopHidden = false
            curNavDesktop.style.pointerEvents = ''
            curNavBg.classList.remove('nav-hidden')
          }
        }

        // ── 移动端控制 ──
        if (curNavMobBg && curNavMobile) {
          if (goingDown && !_navbarMobileHidden) {
            _navbarMobileHidden = true
            curNavMobile.style.pointerEvents = 'none'
            curNavMobBg.classList.add('nav-hidden')
          } else if (!goingDown && _navbarMobileHidden) {
            _navbarMobileHidden = false
            curNavMobile.style.pointerEvents = ''
            curNavMobBg.classList.remove('nav-hidden')
          }
        }

        _navbarLastScrollY = y
        ticking = false
      })
      ticking = true
    }
  }, { passive: true })
}

// ─── 4. 内容页元素入场动画 ───────────────────────────

/**
 * 分类页面卡片交错入场
 */
function animateCategoryCards() {
  const cards = document.querySelectorAll<HTMLElement>('.category-card')
  if (cards.length === 0) return
  promoteToGpu(cards)

  // 禁用原生的 CSS 渐变动画，交由 anime.js 精确控制
  cards.forEach(el => {
    el.style.animation = 'none'
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

/**
 * 标签页项目快速入场
 */
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

// ─── 5. 通用卡片柔和悬停 ───────────────────────────

/**
 * 为各种展示型卡片（项目、友链等）绑定微互动动画
 */
function bindLinkCardHover() {
  const selectors = [
    '.navigation-card a',       // 导航卡片链接
    '.friend-card',             // 友情链接
    '.project-card',            // 项目展示
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

// ─── 6. 图片点击触感反馈 ───────────────────────────

/**
 * 为正文中的图片提供轻微的缩放点击反馈
 */
function bindImagePressEffect() {
  document.querySelectorAll<HTMLElement>('.prose img').forEach(img => {
    if (img.dataset.pressBound) return
    img.dataset.pressBound = '1'

    img.addEventListener('click', () => {
      promoteToGpu([img])
      animate(img, {
        scale: [1, 0.97, 1.01, 1], // 按下缩减，弹起微扩
        duration: 400,
        ease: 'out(3)',
        onComplete() {
          releaseGpu([img])
        },
      })
    })
  })
}

/* ==========================================================
 * 模块入口 (Universal Initialization)
 * ========================================================== */

/**
 * 启动全局柔和过渡系统。
 * 通常在 `astro:page-load` 事件中触发。
 */
export function initSmoothTransitions() {
  // 组件层入场
  animateSidebar()

  // 交互式绑定
  bindElasticHover()
  bindNavbarSmooth()
  bindLinkCardHover()
  bindImagePressEffect()

  // 页面特定元素入场
  animateCategoryCards()
  animateTagItems()
}
