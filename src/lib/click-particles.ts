import gsap from 'gsap'

const EMOJIS = ['✦', '★', '♡', '❀', '✿', '⚝', '⋆', '✧', '❋', '✺']
const COUNT = 8
const GRAVITY = 500 // px/s²

/** 在指定坐标喷射粒子 */
export function spawnParticles(x: number, y: number) {
  for (let i = 0; i < COUNT; i++) {
    const el = document.createElement('span')
    el.textContent = EMOJIS[Math.floor(Math.random() * EMOJIS.length)]
    el.style.cssText = `
      position:fixed;left:${x}px;top:${y}px;pointer-events:none;
      font-size:${10 + Math.random() * 10}px;z-index:9999;
      user-select:none;will-change:transform,opacity;
      color:hsl(${Math.random() * 360},80%,65%);
    `
    document.body.appendChild(el)

    // 随机初速度和角度
    const angle = -30 - Math.random() * 120       // -30°~-150° 向上扇形
    const speed = 150 + Math.random() * 250        // 150~400 px/s
    const rad = (angle * Math.PI) / 180
    const vx = Math.cos(rad) * speed
    const vy = Math.sin(rad) * speed
    const duration = 0.6 + Math.random() * 0.5     // 0.6~1.1s
    const spin = (Math.random() - 0.5) * 720       // ±360° 随机旋转

    // 用 onUpdate 每帧手动算抛物线，模拟 physics2D
    const state = { t: 0 }
    gsap.to(state, {
      t: duration,
      duration,
      ease: 'none',
      onUpdate() {
        const t = state.t
        const px = vx * t
        const py = vy * t + 0.5 * GRAVITY * t * t  // s = v₀t + ½gt²
        const rot = spin * (t / duration)
        el.style.transform = `translate(${px}px,${py}px) rotate(${rot}deg) scale(${1 - t / duration})`
        el.style.opacity = String(Math.max(0, 1 - t / duration))
      },
      onComplete() {
        el.remove()
      },
    })
  }
}

/** 全局点击粒子标记，防止重复绑定 */
let _bound = false

/** 初始化全局点击粒子，在 astro:page-load 中调用 */
export function initClickParticles() {
  if (_bound) return
  _bound = true

  document.addEventListener('click', (e: MouseEvent) => {
    spawnParticles(e.clientX, e.clientY)
  })
}
