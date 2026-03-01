/**
 * animate-value.ts
 * 
 * 使用 requestAnimationFrame 实现数字递增动画
 * 用于统计数字（文章数、字数等）的 "跳动" 进场效果
 * 
 * 用法示例:
 *   <span data-animate-value="128" data-animate-duration="1200">0</span>
 * 
 *   import { initAnimateValues } from '@lib/animate-value';
 *   initAnimateValues();
 */

export interface AnimateValueOptions {
  /** 动画结束值 */
  to: number;
  /** 动画起始值，默认 0 */
  from?: number;
  /** 动画持续时间 (ms)，默认 1000 */
  duration?: number;
  /** 缓动函数，默认 easeOutExpo */
  easing?: (t: number) => number;
  /** 每帧回调 */
  onUpdate: (value: number) => void;
  /** 动画完成回调 */
  onComplete?: () => void;
}

/** 缓动函数：easeOutExpo — 快速启动，缓慢停止 */
export function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/** easeOutCubic */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * 对单个数值执行 rAF 动画
 */
export function animateValue(opts: AnimateValueOptions): () => void {
  const { to, from = 0, duration = 1000, easing = easeOutExpo, onUpdate, onComplete } = opts;
  const startTime = performance.now();
  let rafId = 0;
  let cancelled = false;

  function tick(now: number) {
    if (cancelled) return;
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easing(progress);
    const currentValue = Math.round(from + (to - from) * easedProgress);

    onUpdate(currentValue);

    if (progress < 1) {
      rafId = requestAnimationFrame(tick);
    } else {
      onUpdate(to); // 确保最终值精确
      onComplete?.();
    }
  }

  rafId = requestAnimationFrame(tick);

  // 返回取消函数
  return () => {
    cancelled = true;
    cancelAnimationFrame(rafId);
  };
}

/**
 * 自动扫描所有 [data-animate-value] 元素并启动数字动画
 * 配合 IntersectionObserver 实现 "滚动进入视口时才播放"
 */
export function initAnimateValues(root?: Element | null): void {
  const elements = (root || document).querySelectorAll<HTMLElement>('[data-animate-value]');
  if (elements.length === 0) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement;
          const to = Number(el.dataset.animateValue) || 0;
          const from = Number(el.dataset.animateFrom) || 0;
          const duration = Number(el.dataset.animateDuration) || 1000;
          const suffix = el.dataset.animateSuffix || '';

          animateValue({
            to,
            from,
            duration,
            onUpdate(val) {
              el.textContent = val.toLocaleString() + suffix;
            },
          });

          observer.unobserve(el); // 只播放一次
        }
      });
    },
    { threshold: 0.3 }
  );

  elements.forEach((el) => observer.observe(el));
}
