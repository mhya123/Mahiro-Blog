import { animate, stagger } from 'animejs'

/**
 * 页面入场动画系统 — anime.js
 * 1. Banner 标题 & 副标题：淡入 + 上浮（Fade In & Translate Y）
 * 2. 页面容器 `.page-content-animate`：整体位移 + 淡入
 * 3. 交错加载 `.onload-animation`：按 data-stagger-index 排序，
 *    以 100ms 间隔依次浮现（Staggering），打造层次感
 *
 * 在 astro:page-load 中调用 initPageEntrance() 即可。
 */

// ─── Banner 标题 & 副标题入场 ─────────────────────────

function animateBanner() {
  const title = document.querySelector<HTMLElement>('.banner .title')
  const subtitle = document.querySelector<HTMLElement>('.banner .subtitle')

  if (!title && !subtitle) return

  const targets: HTMLElement[] = []
  if (title) targets.push(title)
  if (subtitle) targets.push(subtitle)

  // 初始隐藏（在动画启动前就设好，防闪烁）
  targets.forEach(el => {
    el.style.opacity = '0'
    el.style.transform = 'translateY(32px)'
  })

  // 标题先入场，副标题紧随其后
  animate(targets, {
    opacity: [0, 1],
    translateY: ['32px', '0px'],
    duration: 900,
    delay: stagger(200, { start: 150 }), // title 150ms, subtitle 350ms
    ease: 'out(4)',
    onComplete() {
      // 只清理 transform，保留 opacity（CSS 中无 opacity 规则，自然为 1）
      targets.forEach(el => {
        el.style.transform = ''
      })
    },
  })
}

// ─── 页面容器入场 ─────────────────────────────────────

function animateContainer(hasStagger: boolean) {
  const content = document.querySelector<HTMLElement>('.page-content-animate')
  if (!content) return

  if (hasStagger) {
    // 有交错子元素时：容器做较短的整体位移淡入，子元素各自交错
    animate(content, {
      opacity: [0, 1],
      translateY: ['40px', '0px'],
      duration: 600,
      ease: 'out(4)',
      onComplete() {
        content.style.transform = ''
      },
    })
  } else {
    // 无交错子元素（如文章详情页）：整体做更大幅度的丝滑位移淡入
    animate(content, {
      opacity: [0, 1],
      translateY: ['80px', '0px'],
      duration: 1000,
      ease: 'out(5)',
      onComplete() {
        content.style.transform = ''
      },
    })
  }
}

// ─── 交错入场：.onload-animation ──────────────────────

function animateStagger() {
  const elements = document.querySelectorAll<HTMLElement>('.onload-animation')
  if (elements.length === 0) return false

  // 按 data-stagger-index 排序（无索引的排到最后）
  const sorted = Array.from(elements).sort((a, b) => {
    const ai = Number(a.dataset.staggerIndex ?? 999)
    const bi = Number(b.dataset.staggerIndex ?? 999)
    return ai - bi
  })

  // 确保初始状态不可见（CSS 已经设了，这里是双保险）
  sorted.forEach(el => {
    el.style.opacity = '0'
    el.style.transform = 'translateY(30px)'
  })

  // 核心交错动画 — 100ms 间隔打造层次感
  animate(sorted, {
    opacity: [0, 1],
    translateY: ['30px', '0px'],
    duration: 600,
    delay: stagger(100),
    ease: 'out(3)',
    onComplete() {
      // 动画完成后移除 .onload-animation 类
      // 防止 CSS 中的 opacity:0 规则把元素重新隐藏
      sorted.forEach(el => {
        el.classList.remove('onload-animation')
        el.style.opacity = ''
        el.style.transform = ''
      })
    },
  })

  return true
}

// ─── 统一入口 ─────────────────────────────────────────

/**
 * 初始化页面入场动画。
 * 在 astro:page-load 事件中调用。
 */
export function initPageEntrance() {
  // 1. Banner 标题入场
  animateBanner()

  // 2. 交错入场（返回是否有交错元素）
  const hasStagger = animateStagger()

  // 3. 容器整体入场
  animateContainer(hasStagger)
}
