import { animate } from 'animejs'

function prepareHoverLayer(el: HTMLElement) {
  el.style.willChange = 'transform'
  el.style.backfaceVisibility = 'hidden'
}

function releaseHoverLayer(el: HTMLElement) {
  el.style.willChange = ''
  el.style.backfaceVisibility = ''
}

/**
 * 交互动效模块 — anime.js 驱动
 *
 * 1. 文章卡片悬停（scale + shadow）
 * 2. 标签/分类按钮悬停（下划线展开）
 * 3. 导航栏按钮悬停（柔和放大 + 发光）
 * 4. 复制代码按钮点击反馈（回弹 + 图标切换）
 */

// ─── 文章卡片悬停 ───────────────────────────────────

function bindCardHover() {
  document.querySelectorAll<HTMLElement>('.post-card-link').forEach(card => {
    if (card.dataset.hoverBound) return
    card.dataset.hoverBound = '1'

    card.addEventListener('mouseenter', () => {
      prepareHoverLayer(card)
      animate(card, {
        scale: 1.02,
        duration: 350,
        ease: 'out(3)',
      })
      card.style.boxShadow = '0 20px 40px -12px rgba(0,0,0,0.2), 0 8px 20px -8px rgba(0,0,0,0.1)'
    })

    card.addEventListener('mouseleave', () => {
      animate(card, {
        scale: 1,
        duration: 400,
        ease: 'out(2)',
        onComplete() {
          releaseHoverLayer(card)
        },
      })
      card.style.boxShadow = ''
    })
  })
}

// ─── 标签 / 分类按钮悬停 ────────────────────────────

function bindTagHover() {
  document.querySelectorAll<HTMLElement>('.btn-category, .btn-tag').forEach(btn => {
    if (btn.dataset.hoverBound) return
    btn.dataset.hoverBound = '1'

    // 移除 Tailwind 的 hover:scale-110（由 anime.js 接管）
    btn.classList.remove('hover:scale-110')

    btn.addEventListener('mouseenter', () => {
      prepareHoverLayer(btn)
      animate(btn, {
        scale: 1.12,
        duration: 300,
        ease: 'out(4)',
      })
    })

    btn.addEventListener('mouseleave', () => {
      animate(btn, {
        scale: 1,
        duration: 350,
        ease: 'out(2)',
        onComplete() {
          releaseHoverLayer(btn)
        },
      })
    })
  })
}

// ─── 导航栏菜单项悬停 ────────────────────────────────

function bindNavHover() {
  document.querySelectorAll<HTMLElement>('.nav-item').forEach(item => {
    if (item.dataset.hoverBound) return
    item.dataset.hoverBound = '1'

    item.addEventListener('mouseenter', () => {
      prepareHoverLayer(item)
      animate(item, {
        scale: 1.08,
        duration: 250,
        ease: 'out(3)',
      })
    })

    item.addEventListener('mouseleave', () => {
      animate(item, {
        scale: 1,
        duration: 300,
        ease: 'out(2)',
        onComplete() {
          releaseHoverLayer(item)
        },
      })
    })
  })
}

// ─── 复制代码按钮 ────────────────────────────────────

function bindCopyButton() {
  document.querySelectorAll<HTMLElement>('.btn-copy').forEach(btn => {
    if (btn.dataset.animeBound) return
    btn.dataset.animeBound = '1'

    btn.addEventListener('click', async () => {
      const codeBlock = btn.closest('.mahiro-code')
      const code = codeBlock?.querySelector('code')?.textContent
      if (!code) return

      // 执行复制
      try {
        await navigator.clipboard.writeText(code)
      } catch (err) {
        console.error('Failed to copy:', err)
        return
      }

      const copyIcon = btn.querySelector('.mahiro-code-toolbar-copy-icon') as HTMLElement | null
      const successIcon = btn.querySelector('.mahiro-code-toolbar-copy-success') as HTMLElement | null
      if (!copyIcon || !successIcon) return

      // 按钮回弹缩放
      animate(btn, {
        scale: [1, 0.85, 1.15, 1],
        duration: 500,
        ease: 'out(3)',
      })

      // 复制图标淡出 + 缩小
      animate(copyIcon, {
        opacity: [1, 0],
        scale: [1, 0.5],
        rotate: [-0, -90],
        duration: 200,
        ease: 'in(2)',
        onComplete() {
          copyIcon.classList.add('hidden')
          successIcon.classList.remove('hidden')

          // 成功图标弹入
          animate(successIcon, {
            opacity: [0, 1],
            scale: [0.3, 1.2, 1],
            rotate: [90, 0],
            duration: 400,
            ease: 'out(3)',
          })
        },
      })

      // 2 秒后恢复
      setTimeout(() => {
        animate(successIcon, {
          opacity: [1, 0],
          scale: [1, 0.5],
          duration: 200,
          ease: 'in(2)',
          onComplete() {
            successIcon.classList.add('hidden')
            copyIcon.classList.remove('hidden')

            animate(copyIcon, {
              opacity: [0, 1],
              scale: [0.5, 1],
              rotate: [90, 0],
              duration: 300,
              ease: 'out(3)',
            })
          },
        })
      }, 2000)
    })
  })
}

// ─── 统一入口 ────────────────────────────────────────

/** 初始化所有悬停/交互动效，在 astro:page-load 中调用 */
export function initHoverEffects() {
  bindCardHover()
  bindTagHover()
  bindNavHover()
  bindCopyButton()
}
