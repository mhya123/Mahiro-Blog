'use client'

import { useEffect, useRef, useState } from 'react'

type Video360PreviewProps = {
    src: string
}

export function Video360Preview({ src }: Video360PreviewProps) {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const [failed, setFailed] = useState(false)

    useEffect(() => {
        let disposed = false
        let frameId = 0
        let cleanup = () => {}

        async function mount() {
            const container = containerRef.current
            if (!container) {
                return
            }

            try {
                const THREE = await import('three')
                if (disposed || !container) {
                    return
                }

                const scene = new THREE.Scene()
                const camera = new THREE.PerspectiveCamera(75, 1, 1, 1100)
                const renderer = new THREE.WebGLRenderer({
                    antialias: true,
                    alpha: true,
                })

                renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
                container.innerHTML = ''
                container.appendChild(renderer.domElement)

                const video = document.createElement('video')
                video.src = src
                video.crossOrigin = 'anonymous'
                video.loop = true
                video.muted = true
                video.playsInline = true
                video.setAttribute('webkit-playsinline', 'true')

                const texture = new THREE.VideoTexture(video)
                const geometry = new THREE.SphereGeometry(500, 80, 60)
                geometry.scale(-1, 1, 1)
                const material = new THREE.MeshBasicMaterial({ map: texture })
                const mesh = new THREE.Mesh(geometry, material)
                scene.add(mesh)

                let lon = 0
                let lat = 0
                let isPointerDown = false
                let pointerX = 0
                let pointerY = 0
                let startLon = 0
                let startLat = 0

                const resize = () => {
                    const width = container.clientWidth || 1
                    const height = container.clientHeight || 1
                    camera.aspect = width / height
                    camera.updateProjectionMatrix()
                    renderer.setSize(width, height, false)
                }

                const onPointerDown = (event: PointerEvent) => {
                    isPointerDown = true
                    pointerX = event.clientX
                    pointerY = event.clientY
                    startLon = lon
                    startLat = lat
                    container.setPointerCapture(event.pointerId)
                }

                const onPointerMove = (event: PointerEvent) => {
                    if (!isPointerDown) {
                        return
                    }

                    lon = startLon + (pointerX - event.clientX) * 0.15
                    lat = startLat + (event.clientY - pointerY) * 0.15
                }

                const onPointerUp = (event: PointerEvent) => {
                    isPointerDown = false
                    container.releasePointerCapture(event.pointerId)
                }

                const onWheel = (event: WheelEvent) => {
                    event.preventDefault()
                    camera.fov = Math.min(90, Math.max(35, camera.fov + event.deltaY * 0.02))
                    camera.updateProjectionMatrix()
                }

                const animate = () => {
                    lat = Math.max(-85, Math.min(85, lat))
                    const phi = THREE.MathUtils.degToRad(90 - lat)
                    const theta = THREE.MathUtils.degToRad(lon)

                    camera.position.set(
                        500 * Math.sin(phi) * Math.cos(theta),
                        500 * Math.cos(phi),
                        500 * Math.sin(phi) * Math.sin(theta),
                    )
                    camera.lookAt(0, 0, 0)
                    renderer.render(scene, camera)
                    frameId = window.requestAnimationFrame(animate)
                }

                resize()
                window.addEventListener('resize', resize)
                container.addEventListener('pointerdown', onPointerDown)
                container.addEventListener('pointermove', onPointerMove)
                container.addEventListener('pointerup', onPointerUp)
                container.addEventListener('pointerleave', onPointerUp)
                container.addEventListener('wheel', onWheel, { passive: false })

                video.play().catch(() => {
                    setFailed(true)
                })
                animate()

                cleanup = () => {
                    window.cancelAnimationFrame(frameId)
                    window.removeEventListener('resize', resize)
                    container.removeEventListener('pointerdown', onPointerDown)
                    container.removeEventListener('pointermove', onPointerMove)
                    container.removeEventListener('pointerup', onPointerUp)
                    container.removeEventListener('pointerleave', onPointerUp)
                    container.removeEventListener('wheel', onWheel)
                    texture.dispose()
                    geometry.dispose()
                    material.dispose()
                    renderer.dispose()
                    video.pause()
                    video.src = ''
                }
            } catch {
                setFailed(true)
            }
        }

        void mount()

        return () => {
            disposed = true
            cleanup()
        }
    }, [src])

    if (failed) {
        return (
            <div className="flex h-full items-center justify-center p-8 text-center text-base-content/60">
                当前浏览器环境无法打开 360 视频预览，你可以切回普通视频模式继续查看。
            </div>
        )
    }

    return (
        <div className="flex h-full flex-col gap-3">
            <div className="rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-semibold tracking-[0.2em] text-primary">
                VIDEO360
            </div>
            <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-base-300/70 bg-black shadow-inner" />
            <div className="text-xs leading-6 text-base-content/55">
                拖动画面可以环顾四周，滚轮可缩放视角。当前 360 模式适用于常见等距柱状全景视频。
            </div>
        </div>
    )
}
