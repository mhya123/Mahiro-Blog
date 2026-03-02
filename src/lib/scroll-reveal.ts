import { animate } from 'animejs'

/**
 * Scroll Reveal — 元素滚动入场动画
 *
 * 为 prose 内容区（文章详情页）和通用 .scroll-reveal 元素
 * 注册 IntersectionObserver，当元素进入视口时触发 anime.js 淡入动画。
 *
 * 支持的目标：
 * 1. #content（prose 文章）内的段落、标题、图片、代码块、列表、blockquote 等
 * 2. 任何带 .scroll-reveal 类的元素
 */

const PROSE_SELECTORS = [
  'p',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'pre',                          // 代码块
  'img',
  'ul', 'ol',                     // 列表
  'blockquote',
  'table',
  'hr',
  '.astro-code',                  // Astro Shiki 代码块
  'details',                      // Collapse
  '.not-prose',                   // MDX 组件容器
].join(',')

export function initScrollReveal() {
  // 防止 SPA 路由切换后重复绑定全局事件
  // 但每次 page-load 都需要重新扫描新页面的元素
  const content = document.getElementById('content')
  const genericEls = document.querySelectorAll<HTMLElement>('.scroll-reveal')

  // 收集 prose 内子元素
  const proseChildren: HTMLElement[] = []
  if (content) {
    content.querySelectorAll<HTMLElement>(PROSE_SELECTORS).forEach(el => {
      // 只选直接子元素或一级深度，避免嵌套重复
      // 已经有动画标记的跳过
      if (el.dataset.srReady) return
      // 跳过嵌套在其他 prose 子元素内的（比如 blockquote > p）
      if (el.parentElement !== content && el.parentElement?.closest(PROSE_SELECTORS)) return
      proseChildren.push(el)
    })
  }

  const targets = [...proseChildren, ...Array.from(genericEls)]
  if (targets.length === 0) return

  // 初始隐藏
  targets.forEach(el => {
    el.dataset.srReady = '1'
    el.style.opacity = '0'
    el.style.transform = 'translateY(24px)'
  })

  // 使用 IntersectionObserver 逐个触发动画
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        const el = entry.target as HTMLElement
        observer.unobserve(el) // 只触发一次

        animate(el, {
          opacity: [0, 1],
          translateY: [24, 0],
          duration: 600,
          ease: 'out(3)',
        })
      })
    },
    {
      // 元素露出 10% 就触发
      threshold: 0.08,
      rootMargin: '0px 0px -40px 0px',
    }
  )

  targets.forEach(el => observer.observe(el))

  // 页面切换前清理
  const cleanup = () => {
    observer.disconnect()
    document.removeEventListener('astro:before-swap', cleanup)
  }
  document.addEventListener('astro:before-swap', cleanup, { once: true })
}
