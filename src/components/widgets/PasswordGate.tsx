import { useState, useCallback, useEffect, useRef } from 'react'
import { decrypt } from '@/lib/aes256-util'
import gsap from 'gsap'

interface PasswordGateProps {
    encryptedContent: string
}

/** SVG 锁头图标，锁钩/锁孔分离以支持独立动画 */
function LockIcon({ 
    shackleRef, 
    keyholeRef 
}: { 
    shackleRef: React.RefObject<SVGGElement | null>
    keyholeRef: React.RefObject<SVGGElement | null> 
}) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className="w-16 h-16 overflow-visible" xmlns="http://www.w3.org/2000/svg">
            <g ref={shackleRef} style={{ transformOrigin: '16px 11px' }}>
                <path
                    d="M8 11V7.5a4 4 0 0 1 8 0V11"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                />
            </g>
            <rect
                x="5" y="11" width="14" height="10.5" rx="2"
                stroke="currentColor"
                strokeWidth="1.8"
                fill="currentColor"
                fillOpacity="0.1"
            />
            <g ref={keyholeRef} style={{ transformOrigin: '12px 16.25px' }}>
                <circle cx="12" cy="15.5" r="1.5" fill="currentColor" />
                <path d="M12 17V18.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </g>
        </svg>
    )
}

export default function PasswordGate({ encryptedContent }: PasswordGateProps) {
    const [password, setPassword] = useState('')
    const [decryptedHtml, setDecryptedHtml] = useState<string | null>(null)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const lockRef = useRef<HTMLDivElement>(null)
    const shackleRef = useRef<SVGGElement>(null)
    const keyholeRef = useRef<SVGGElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const errorRef = useRef<HTMLParagraphElement>(null)
    const formRef = useRef<HTMLDivElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const contentRef = useRef<HTMLDivElement>(null)
    const loadingTween = useRef<gsap.core.Tween | null>(null)

    // sessionStorage 缓存自动解密
    useEffect(() => {
        try {
            const cached = sessionStorage.getItem('_post_pwd')
            if (cached) {
                decrypt(encryptedContent, cached).then(
                    result => setDecryptedHtml(result),
                    () => { /* 缓存无效，忽略 */ }
                )
            }
        } catch { /* ignore */ }
    }, [encryptedContent])

    // 入场动画
    useEffect(() => {
        if (decryptedHtml !== null || !containerRef.current) return
        const tl = gsap.timeline()
        tl.fromTo(lockRef.current, { scale: 0, rotation: -180 }, { scale: 1, rotation: 0, duration: 0.6, ease: 'back.out(1.7)' })
          .fromTo(containerRef.current.querySelectorAll('h2, p'), { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.1, ease: 'power2.out' }, '-=0.2')
          .fromTo(formRef.current, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out' }, '-=0.2')
    }, [decryptedHtml])

    // loading 呼吸动画
    useEffect(() => {
        if (loading && lockRef.current) {
            loadingTween.current = gsap.to(lockRef.current, {
                scale: 0.95,
                opacity: 0.7,
                duration: 0.6,
                yoyo: true,
                repeat: -1,
                ease: 'sine.inOut'
            })
        } else if (loadingTween.current && lockRef.current) {
            loadingTween.current.kill()
            gsap.to(lockRef.current, { scale: 1, opacity: 1, duration: 0.3 })
        }
    }, [loading])

    // 密码错误动画
    const playErrorAnimation = useCallback(() => {
        const tl = gsap.timeline()

        tl.to(inputRef.current, { x: -12, duration: 0.06, ease: 'power2.inOut' })
          .to(inputRef.current, { x: 12, duration: 0.06, ease: 'power2.inOut' })
          .to(inputRef.current, { x: -8, duration: 0.06, ease: 'power2.inOut' })
          .to(inputRef.current, { x: 8, duration: 0.06, ease: 'power2.inOut' })
          .to(inputRef.current, { x: -4, duration: 0.06, ease: 'power2.inOut' })
          .to(inputRef.current, { x: 0, duration: 0.06, ease: 'power2.out' })

        tl.fromTo(lockRef.current, { rotation: 0, scale: 1 }, { rotation: -15, scale: 1.2, duration: 0.15, ease: 'power2.in' }, 0)
          .to(lockRef.current, { rotation: 15, duration: 0.12, ease: 'power2.inOut' })
          .to(lockRef.current, { rotation: -8, duration: 0.1, ease: 'power2.inOut' })
          .to(lockRef.current, { rotation: 0, scale: 1, duration: 0.2, ease: 'elastic.out(1, 0.5)' })

        tl.fromTo(shackleRef.current, { rotation: 0, y: 0 }, { rotation: 5, y: -3, duration: 0.1, ease: 'power2.out' }, 0.05)
          .to(shackleRef.current, { rotation: 0, y: 0, duration: 0.2, ease: 'bounce.out' })

        tl.fromTo(errorRef.current, { y: 10, opacity: 0, scale: 0.8 }, { y: 0, opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, 0.15)

        // 输入框红色闪烁
        if (inputRef.current) {
            const input = inputRef.current
            input.style.borderColor = 'oklch(var(--er))'
            input.style.boxShadow = '0 0 0 3px oklch(var(--er) / 0.2)'
            gsap.to(input, {
                boxShadow: '0 0 0 0px oklch(var(--er) / 0)',
                duration: 0.8,
                delay: 0.5,
                ease: 'power2.out',
                onComplete: () => {
                    input.style.borderColor = ''
                    input.style.boxShadow = ''
                }
            })
        }
    }, [])

    // 解密成功动画：锁芯旋转 → 变绿 → 锁钩弹开 → 飞出消散
    const playSuccessAnimation = useCallback(() => {
        return new Promise<void>(resolve => {
            const tl = gsap.timeline({ onComplete: resolve })

            // 锁芯旋转
            tl.to(keyholeRef.current, { rotation: 90, duration: 0.2, ease: 'back.out(2)' })

            // 变绿 + 锁钩弹开
            tl.to(lockRef.current, { color: 'oklch(var(--su))', duration: 0.2 }, '-=0.1')
            tl.to(shackleRef.current, { rotation: 30, y: -4, duration: 0.35, ease: 'back.out(2)' }, '-=0.1')

            // 蓄力
            tl.to(lockRef.current, { scale: 1.05, duration: 0.15, ease: 'power1.out' }, '+=0.1')

            // 飞出消散
            tl.to(lockRef.current, {
                y: -50,
                opacity: 0,
                scale: 0.3,
                filter: 'drop-shadow(0px 0px 15px oklch(var(--su) / 0.8))', 
                duration: 0.4,
                ease: 'power2.in',
            })

            tl.to(formRef.current, { y: 20, opacity: 0, duration: 0.3, ease: 'power2.in' }, '-=0.35')
            tl.to(containerRef.current?.querySelectorAll('h2, p') || [], {
                y: -10, opacity: 0, duration: 0.25, stagger: 0.05, ease: 'power2.in'
            }, '-=0.4')
        })
    }, [])

    const handleDecrypt = useCallback(async () => {
        if (!password.trim()) {
            setError('请输入密码')
            playErrorAnimation()
            return
        }

        setLoading(true)
        setError('')

        try {
            const result = await decrypt(encryptedContent, password.trim())
            
            try { sessionStorage.setItem('_post_pwd', password.trim()) } catch { }
            
            await playSuccessAnimation()
            setDecryptedHtml(result) 
        } catch {
            setError('密码错误，请重试')
            playErrorAnimation()
            setLoading(false)
        }
    }, [password, encryptedContent, playErrorAnimation, playSuccessAnimation])

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter') handleDecrypt()
        },
        [handleDecrypt]
    )

    // 已解密 → 渲染内容
    if (decryptedHtml !== null) {
        return (
            <div
                ref={contentRef}
                id="content"
                className="prose prose-lg prose-code:text-base max-w-none text-justify prose-headings:scroll-mt-20 prose-img:rounded-2xl prose-img:mx-auto prose-img:cursor-pointer"
                dangerouslySetInnerHTML={{ __html: decryptedHtml }}
            />
        )
    }

    // 未解密 → 密码输入
    return (
        <div ref={containerRef} className="flex flex-col items-center justify-center py-16 gap-6">
            <div ref={lockRef} className="text-base-content select-none">
                <LockIcon shackleRef={shackleRef} keyholeRef={keyholeRef} />
            </div>
            <h2 className="text-xl font-bold text-base-content">该文章已加密</h2>
            <p className="text-base-content/60 text-sm text-center max-w-sm">
                这是一篇受密码保护的文章，请输入密码后查看完整内容。
            </p>

            <div ref={formRef} className="flex flex-col items-center gap-3 w-full max-w-xs">
                <input
                    ref={inputRef}
                    type="password"
                    placeholder="请输入文章密码"
                    className="input input-bordered w-full focus:input-primary text-center transition-colors"
                    value={password}
                    onChange={e => {
                        setPassword(e.target.value)
                        setError('')
                    }}
                    onKeyDown={handleKeyDown}
                    autoFocus
                />

                <p
                    ref={errorRef}
                    className="text-error text-sm min-h-5"
                    style={{ opacity: error ? undefined : 0 }}
                >
                    {error || '\u00A0'}
                </p>

                <button
                    className="btn btn-primary w-full"
                    onClick={handleDecrypt}
                    disabled={loading}
                >
                    {loading ? (
                        <>
                            <span className="loading loading-spinner loading-sm" />
                            解密中...
                        </>
                    ) : (
                        '解锁文章'
                    )}
                </button>
            </div>
        </div>
    )
}