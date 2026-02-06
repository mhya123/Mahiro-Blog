import { useEffect, useState, useRef } from 'react'
import { toast, Toaster } from 'sonner'
import { getAuthToken } from '@/lib/auth'
import { GITHUB_CONFIG } from '@/consts'
import {
    readTextFileFromRepo,
    putFile,
    toBase64Utf8,
    createBlob,
    createTree,
    createCommit,
    updateRef,
    getRef,
    getCommit,
    type TreeItem
} from '@/lib/github-client'
import yaml from 'js-yaml'
import { useAuthStore } from './hooks/use-auth'
import { readFileAsText, fileToBase64NoPrefix } from '@/lib/file-utils'
import { CustomSelect } from './components/ui/custom-select'

// Common social icons mapping
const SOCIAL_PRESETS = [
    { label: 'Github', value: 'ri:github-line' },
    { label: 'Twitter (X)', value: 'ri:twitter-line' },
    { label: 'Bilibili', value: 'ri:bilibili-line' },
    { label: 'Email', value: 'ri:mail-line' },
    { label: 'Telegram', value: 'ri:telegram-line' },
    { label: 'QQ', value: 'ri:qq-line' },
    { label: 'WeChat', value: 'ri:wechat-fill' },
    { label: 'Douyin', value: 'ri:tiktok-line' },
    { label: 'RSS', value: 'ri:rss-fill' },
    { label: 'Weibo', value: 'ri:weibo-fill' },
    { label: 'Zhihu', value: 'ri:zhihu-line' },
    { label: 'Other', value: 'ri:link' }
]

const COMMENT_PROVIDERS = [
    { value: 'giscus', label: 'Giscus' },
    { value: 'waline', label: 'Waline' }
]

export function ConfigPage() {
    const [configContent, setConfigContent] = useState('')
    const [lastFetchedContent, setLastFetchedContent] = useState<string | null>(null)
    const [isDirty, setIsDirty] = useState(false)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [mode, setMode] = useState<'visual' | 'code'>('visual')
    const [parsedConfig, setParsedConfig] = useState<any>(null)
    const { isAuth, setPrivateKey } = useAuthStore()
    const keyInputRef = useRef<HTMLInputElement>(null)

    // Image upload state
    const [uploadingImage, setUploadingImage] = useState(false)
    const [uploadTarget, setUploadTarget] = useState<string>('')
    const imageInputRef = useRef<HTMLInputElement>(null)
    // 缓存待上传图片 { [targetKey]: { file, previewUrl } }
    const [pendingImages, setPendingImages] = useState<Record<string, { file: File, previewUrl: string }>>({})

    useEffect(() => {
        loadConfig()
    }, [isAuth])

    useEffect(() => {
        if (configContent && mode === 'visual') {
            try {
                const parsed = yaml.load(configContent)
                setParsedConfig(parsed)
            } catch (e) {
                console.error(e)
                toast.error('YAML 解析失败，已切换回代码模式')
                setMode('code')
            }
        }
    }, [configContent, mode])

    const loadConfig = async () => {
        try {
            setLoading(true)
            let token: string | undefined
            try {
                token = await getAuthToken()
            } catch (e) {
                // Ignore auth error, try public access
                console.log('Public access mode')
            }

            // 即使没有 token 也尝试读取（对于公开仓库）
            const content = await readTextFileFromRepo(
                token,
                GITHUB_CONFIG.OWNER,
                GITHUB_CONFIG.REPO,
                'ryuchan.config.yaml',
                GITHUB_CONFIG.BRANCH
            )
            if (content) {
                // 如果本地已有未保存的更改（isDirty），则不要覆盖用户当前编辑
                if (isDirty) {
                    toast.info('检测到本地未保存更改，已跳过远程配置覆盖')
                } else {
                    setConfigContent(content)
                    try {
                        setParsedConfig(yaml.load(content))
                    } catch (e) {
                        console.error(e)
                    }
                }
                setLastFetchedContent(content)
            }
        } catch (error: any) {
            toast.error('加载配置失败: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const updateConfigValue = (path: string, value: any) => {
        if (!parsedConfig) return
        const newConfig = JSON.parse(JSON.stringify(parsedConfig))
        const parts = path.split('.')
        let current = newConfig
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) current[parts[i]] = {}
            current = current[parts[i]]
        }
        current[parts[parts.length - 1]] = value
        setParsedConfig(newConfig)
        setConfigContent(yaml.dump(newConfig))
        setIsDirty(true)
    }

    const handleSocialChange = (index: number, field: string, value: any) => {
        const social = [...(parsedConfig?.user?.sidebar?.social || [])]
        if (!social[index]) social[index] = {}
        social[index][field] = value

        // Auto-set title/ariaLabel when icon changes
        if (field === 'svg') {
            const preset = SOCIAL_PRESETS.find(p => p.value === value)
            if (preset) {
                social[index].title = preset.label
                social[index].ariaLabel = preset.label
            }
        }

        updateConfigValue('user.sidebar.social', social)
    }

    const addSocial = () => {
        const social = [...(parsedConfig?.user?.sidebar?.social || [])]
        social.push({
            href: '',
            title: 'New Link',
            ariaLabel: 'New Link',
            svg: 'ri:link'
        })
        updateConfigValue('user.sidebar.social', social)
    }

    const removeSocial = (index: number) => {
        const social = [...(parsedConfig?.user?.sidebar?.social || [])]
        social.splice(index, 1)
        updateConfigValue('user.sidebar.social', social)
    }

    const moveSocial = (index: number, direction: 'up' | 'down') => {
        const social = [...(parsedConfig?.user?.sidebar?.social || [])]
        if (direction === 'up' && index > 0) {
            [social[index], social[index - 1]] = [social[index - 1], social[index]]
        } else if (direction === 'down' && index < social.length - 1) {
            [social[index], social[index + 1]] = [social[index + 1], social[index]]
        }
        updateConfigValue('user.sidebar.social', social)
    }

    const handleSave = async () => {
        if (!window.confirm('确定保存配置吗？这将直接推送到 GitHub 仓库。')) {
            return
        }
        try {
            setSaving(true)
            const token = await getAuthToken()
            if (!token) throw new Error('未授权')

            const toastId = toast.loading('🚀 正在初始化保存...')

            let configToUpdate = parsedConfig ? JSON.parse(JSON.stringify(parsedConfig)) : null
            const treeItems: TreeItem[] = []

            // 1. Process Images
            if (Object.keys(pendingImages).length > 0) {
                const totalImages = Object.keys(pendingImages).length
                toast.loading(`📤 准备上传 ${totalImages} 张图片...`, { id: toastId })

                let idx = 1
                for (const [target, { file }] of Object.entries(pendingImages)) {
                    toast.loading(`📸 正在处理图片 (${idx}/${totalImages}): ${file.name}...`, { id: toastId })
                    const base64 = await fileToBase64NoPrefix(file)
                    let path, filename, publicPath

                    // 处理favicon和profile.png，直接覆盖原文件
                    if (target === 'site.favicon') {
                        path = 'public/favicon.ico'
                        filename = 'favicon.ico'
                        publicPath = '/favicon.ico'
                    } else if (target === 'user.avatar') {
                        path = 'public/profile.png'
                        filename = 'profile.png'
                        publicPath = '/profile.png'
                    } else {
                        // 不处理其他图片类型
                        continue
                    }

                    // Create Blob
                    const { sha } = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, base64, 'base64')
                    treeItems.push({
                        path: path,
                        mode: '100644',
                        type: 'blob',
                        sha: sha
                    })

                    // Update config with new path
                    if (configToUpdate) {
                        const parts = target.split('.')
                        let current = configToUpdate
                        for (let i = 0; i < parts.length - 1; i++) {
                            if (!current[parts[i]]) current[parts[i]] = {}
                            current = current[parts[i]]
                        }
                        current[parts[parts.length - 1]] = publicPath
                    }
                    idx++
                }
                setPendingImages({})
            }

            // 2. Process Config File
            let contentToSave = configContent
            if (mode === 'visual' && configToUpdate) {
                contentToSave = yaml.dump(configToUpdate)
                setParsedConfig(configToUpdate)
                setConfigContent(contentToSave)
            }

            const configBase64 = toBase64Utf8(contentToSave)
            toast.loading('正在创建配置文件 Blob...', { id: toastId })
            const { sha: configSha } = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, configBase64, 'base64')
            treeItems.push({
                path: 'ryuchan.config.yaml',
                mode: '100644',
                type: 'blob',
                sha: configSha
            })

            // 3. Create Commit
            toast.loading('正在获取分支信息...', { id: toastId })

            // Get current ref
            const refName = `heads/${GITHUB_CONFIG.BRANCH}`
            const ref = await getRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, refName)
            const currentCommitSha = ref.sha

            // Get tree of current commit
            const commit = await getCommit(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, currentCommitSha)
            const baseTreeSha = commit.tree.sha

            // Create new tree
            toast.loading('🌳 正在构建文件树...', { id: toastId })
            const { sha: newTreeSha } = await createTree(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, treeItems, baseTreeSha)

            // Create new commit
            toast.loading('💾 正在创建提交...', { id: toastId })
            const { sha: newCommitSha } = await createCommit(
                token,
                GITHUB_CONFIG.OWNER,
                GITHUB_CONFIG.REPO,
                'chore(config): update site configuration',
                newTreeSha,
                [currentCommitSha]
            )

            // Update ref
            toast.loading('🔄 正在同步远程分支...', { id: toastId })
            await updateRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, refName, newCommitSha)

            toast.success('🎉 配置更新成功！', {
                id: toastId,
                description: '更改已推送到仓库，GitHub Actions 将会自动重新部署。'
            })
        } catch (error: any) {
            console.error(error)
            toast.error('❌ 保存配置失败', {
                description: error.message
            })
        } finally {
            setSaving(false)
        }
    }

    const triggerImageUpload = (target: string) => {
        setUploadTarget(target)
        imageInputRef.current?.click()
    }

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !uploadTarget) return

        const previewUrl = URL.createObjectURL(file)
        setPendingImages(prev => ({ ...prev, [uploadTarget]: { file, previewUrl } }))

        // Update preview in UI immediately
        updateConfigValue(uploadTarget, previewUrl)

        setUploadTarget('')
        if (imageInputRef.current) imageInputRef.current.value = ''
        toast.info('图片已缓存，保存配置时会统一上传')
    }

    const handleImportKey = () => {
        keyInputRef.current?.click()
    }

    const onChoosePrivateKey = async (file: File) => {
        try {
            const pem = await readFileAsText(file)
            await setPrivateKey(pem)
            toast.success('密钥导入成功')
        } catch (e) {
            toast.error('密钥导入失败')
        }
    }

    return (
        <div className="w-full max-w-4xl mx-auto my-12 font-sans">
            <Toaster
                richColors
                position="top-center"
                toastOptions={{
                    className: 'shadow-xl rounded-2xl border-2 border-primary/20 backdrop-blur-sm',
                    style: {
                        fontSize: '1rem',
                        padding: '14px 20px',
                        zIndex: '999999',
                        borderRadius: '12px',
                        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
                        transition: 'all 0.3s ease-in-out',
                    },
                    classNames: {
                        title: 'text-lg font-semibold tracking-tight',
                        description: 'text-sm font-medium opacity-90',
                        error: 'bg-error/95 text-error-content border-error/30',
                        success: 'bg-success/95 text-success-content border-success/30',
                        warning: 'bg-warning/95 text-warning-content border-warning/30',
                        info: 'bg-info/95 text-info-content border-info/30',
                    },
                    duration: 5000,
                    closeButton: false,
                }}
            />

            <input
                ref={keyInputRef}
                type='file'
                accept='.pem'
                className='hidden'
                onChange={async e => {
                    const f = e.target.files?.[0]
                    if (f) await onChoosePrivateKey(f)
                    if (e.currentTarget) e.currentTarget.value = ''
                }}
            />

            <input
                ref={imageInputRef}
                type='file'
                accept='image/*'
                className='hidden'
                onChange={handleImageSelect}
            />

            <div className="rounded-3xl bg-base-100 shadow-2xl flex flex-col overflow-hidden border border-base-200 min-h-[600px]">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-8 py-5 border-b border-base-200 bg-base-100/50 backdrop-blur-sm sticky top-0 z-10 space-y-3 sm:space-y-0">
                    <div className="flex items-center gap-3">
                        <div className="w-1 h-6 bg-primary rounded-full"></div>
                        <h2 className="text-xl font-bold text-primary">站点配置</h2>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="join bg-base-200 p-1 rounded-lg">
                            <button
                                className={`join-item btn btn-sm border-none ${mode === 'visual' ? 'btn-primary shadow-md' : 'btn-ghost text-base-content/60'}`}
                                onClick={() => setMode('visual')}
                                disabled={false}
                            >
                                可视化
                            </button>
                            <button
                                className={`join-item btn btn-sm border-none ${mode === 'code' ? 'btn-primary shadow-md' : 'btn-ghost text-base-content/60'}`}
                                onClick={() => setMode('code')}
                                disabled={false}
                            >
                                代码
                            </button>
                        </div>
                        {!isAuth && (
                            <button onClick={handleImportKey} className="btn btn-sm btn-ghost bg-base-200 gap-1" title="导入密钥以解锁保存功能">
                                <span className="text-lg">🔑</span>
                                <span className="hidden sm:inline">验证</span>
                            </button>
                        )}
                        <button onClick={handleSave} disabled={saving || loading || !isAuth} className="btn btn-sm btn-primary px-6 shadow-lg shadow-primary/20">
                            {saving ? '保存中...' : '保存配置'}
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex h-64 items-center justify-center text-base-content/50">
                        <span className="loading loading-spinner loading-lg text-primary"></span>
                    </div>
                ) : (!isAuth && !configContent) ? (
                    <div className="flex flex-col items-center justify-center h-full flex-1 p-12 text-center space-y-6">
                        <div className="w-24 h-24 bg-base-200 rounded-full flex items-center justify-center mb-4">
                            <span className="text-4xl">🔒</span>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-bold">需要身份验证</h3>
                            <p className="text-base-content/60">请导入您的私钥以开始编辑配置</p>
                        </div>
                        <button onClick={handleImportKey} className="btn btn-primary btn-wide shadow-lg shadow-primary/20">
                            导入密钥 (.pem)
                        </button>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto bg-base-200/30 p-4 md:p-8">
                        {mode === 'code' ? (
                            <textarea
                                className="h-[600px] w-full rounded-xl border border-base-300 bg-base-100 p-6 font-mono text-sm focus:border-primary focus:outline-none resize-none shadow-inner"
                                value={configContent}
                                onChange={(e) => { setConfigContent(e.target.value); setIsDirty(true) }}
                                spellCheck={false}
                            />
                        ) : (
                            <div className="max-w-3xl mx-auto space-y-10">
                                {/* Icons */}
                                <div className="grid grid-cols-2 gap-4 md:gap-12">
                                    <div className="space-y-3">
                                        <div className="text-xs font-medium text-base-content/70 ml-1">网站图标</div>
                                        <div className="group relative flex justify-center p-4 md:p-8 bg-base-100 rounded-2xl md:rounded-3xl border border-base-200 shadow-sm hover:shadow-md transition-all duration-300">
                                            <div className="w-16 h-16 md:w-24 md:h-24 rounded-xl md:rounded-2xl overflow-hidden bg-base-200 ring-4 ring-base-100 shadow-xl group-hover:scale-105 transition-transform duration-300">
                                                <img src={parsedConfig?.site?.favicon || '/favicon.ico'} alt="Favicon" className="w-full h-full object-cover" />
                                            </div>
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-base-100/50 backdrop-blur-sm rounded-2xl md:rounded-3xl cursor-pointer" onClick={() => triggerImageUpload('site.favicon')}>
                                                <button className="btn btn-circle btn-primary shadow-lg scale-90 group-hover:scale-100 transition-transform">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
                                                </button>
                                            </div>
                                            {uploadingImage && uploadTarget === 'site.favicon' && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-base-100/80 rounded-2xl md:rounded-3xl z-10">
                                                    <span className="loading loading-spinner loading-md text-primary"></span>
                                                </div>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            className="input input-sm input-bordered w-full text-center text-xs rounded-full bg-base-100 shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20"
                                            value={parsedConfig?.site?.favicon || ''}
                                            onChange={e => updateConfigValue('site.favicon', e.target.value)}
                                            placeholder="图标 URL"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <div className="text-xs font-medium text-base-content/70 ml-1">用户头像</div>
                                        <div className="group relative flex justify-center p-4 md:p-8 bg-base-100 rounded-2xl md:rounded-3xl border border-base-200 shadow-sm hover:shadow-md transition-all duration-300">
                                            <div className="w-16 h-16 md:w-24 md:h-24 rounded-xl md:rounded-2xl overflow-hidden bg-base-200 ring-4 ring-base-100 shadow-xl group-hover:scale-105 transition-transform duration-300">
                                                <img src={parsedConfig?.user?.avatar || '/avatar.png'} alt="Avatar" className="w-full h-full object-cover" />
                                            </div>
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-base-100/50 backdrop-blur-sm rounded-2xl md:rounded-3xl cursor-pointer" onClick={() => triggerImageUpload('user.avatar')}>
                                                <button className="btn btn-circle btn-primary shadow-lg scale-90 group-hover:scale-100 transition-transform">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
                                                </button>
                                            </div>
                                            {uploadingImage && uploadTarget === 'user.avatar' && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-base-100/80 rounded-2xl md:rounded-3xl z-10">
                                                    <span className="loading loading-spinner loading-md text-primary"></span>
                                                </div>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            className="input input-sm input-bordered w-full text-center text-xs rounded-full bg-base-100 shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20"
                                            value={parsedConfig?.user?.avatar || ''}
                                            onChange={e => updateConfigValue('user.avatar', e.target.value)}
                                            placeholder="头像 URL"
                                        />
                                    </div>
                                </div>

                                {/* User Info */}
                                <div className="card bg-base-100 shadow-sm border border-base-200 p-6 rounded-2xl space-y-6">
                                    <h3 className="font-bold text-lg text-primary border-b border-base-200 pb-2">用户信息</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                        <div className="form-control w-full">
                                            <label className="label"><span className="label-text font-medium">用户名称</span></label>
                                            <input type="text" className="input input-bordered w-full bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                                value={parsedConfig?.user?.name || ''}
                                                onChange={e => updateConfigValue('user.name', e.target.value)} />
                                        </div>
                                        <div className="form-control w-full">
                                            <label className="label"><span className="label-text font-medium">个人主页</span></label>
                                            <input type="text" className="input input-bordered w-full bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                                value={parsedConfig?.user?.site || ''}
                                                onChange={e => updateConfigValue('user.site', e.target.value)} />
                                        </div>
                                    </div>
                                    <div className="form-control w-full">
                                        <label className="label"><span className="label-text font-medium">个人描述</span></label>
                                        <input type="text" className="input input-bordered w-full bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                            placeholder="Ciallo～(∠・ω<)⌒★"
                                            value={parsedConfig?.user?.description || ''}
                                            onChange={e => updateConfigValue('user.description', e.target.value)} />
                                    </div>
                                </div>

                                {/* Basic Info */}
                                <div className="card bg-base-100 shadow-sm border border-base-200 p-6 rounded-2xl space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                        <div className="form-control w-full">
                                            <label className="label"><span className="label-text font-medium">站点标题</span></label>
                                            <input type="text" className="input input-bordered w-full bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                                value={parsedConfig?.site?.title || ''}
                                                onChange={e => updateConfigValue('site.title', e.target.value)} />
                                        </div>
                                        <div className="form-control w-full">
                                            <label className="label"><span className="label-text font-medium">浏览器标签</span></label>
                                            <input type="text" className="input input-bordered w-full bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                                value={parsedConfig?.site?.tab || ''}
                                                onChange={e => updateConfigValue('site.tab', e.target.value)} />
                                        </div>
                                    </div>

                                    <div className="form-control w-full">
                                        <label className="label"><span className="label-text font-medium">站点描述</span></label>
                                        <textarea className="textarea textarea-bordered w-full h-24 bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                                            value={parsedConfig?.site?.description || ''}
                                            onChange={e => updateConfigValue('site.description', e.target.value)} />
                                    </div>

                                    {/* ICP Info */}
                                    <div className="space-y-3">
                                        <div className="text-sm font-medium text-base-content/70">备案信息</div>
                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                                            <input type="text" className="input input-bordered w-full bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                                placeholder="例如：京ICP备12345678号"
                                                value={parsedConfig?.site?.icp || ''}
                                                onChange={e => updateConfigValue('site.icp', e.target.value)} />
                                            <input type="text" className="input input-bordered w-full bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                                placeholder="https://beian.miit.gov.cn/"
                                                value={parsedConfig?.site?.icp_link || ''}
                                                onChange={e => updateConfigValue('site.icp_link', e.target.value)} />
                                        </div>
                                    </div>
                                </div>

                                {/* Social Links */}
                                <div className="space-y-4">
                                    <div className="text-sm font-medium text-base-content/70 ml-1">社交按钮</div>
                                    <div className="card bg-base-100 shadow-sm border border-base-200 p-2 rounded-2xl">
                                        <div className="space-y-2 p-2">
                                            {(parsedConfig?.user?.sidebar?.social || []).map((item: any, index: number) => (
                                                <div key={index} className="flex items-center gap-3 group p-2 hover:bg-base-200/50 rounded-xl transition-colors">
                                                    <div className="w-32">
                                                        <CustomSelect
                                                            value={SOCIAL_PRESETS.find(p => p.value === item.svg)?.value || 'ri:link'}
                                                            onChange={val => handleSocialChange(index, 'svg', val)}
                                                            options={SOCIAL_PRESETS}
                                                        />
                                                    </div>

                                                    <input
                                                        type="text"
                                                        className="input input-sm input-bordered flex-1 bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                                        placeholder="链接地址"
                                                        value={item.href}
                                                        onChange={e => handleSocialChange(index, 'href', e.target.value)}
                                                    />

                                                    <div className="join bg-base-200 rounded-lg p-1">
                                                        <div className="w-8 h-6 flex items-center justify-center text-xs font-mono text-base-content/50">
                                                            {index + 1}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => moveSocial(index, 'up')} className="btn btn-xs btn-ghost btn-square" disabled={index === 0}>↑</button>
                                                        <button onClick={() => moveSocial(index, 'down')} className="btn btn-xs btn-ghost btn-square" disabled={index === (parsedConfig?.user?.sidebar?.social?.length || 0) - 1}>↓</button>
                                                        <button onClick={() => removeSocial(index)} className="btn btn-xs btn-ghost btn-square text-error bg-error/10 hover:bg-error hover:text-white">✕</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="p-2">
                                            <button onClick={addSocial} className="btn btn-outline btn-sm w-full border-dashed border-2 text-base-content/50 hover:text-primary hover:border-primary hover:bg-primary/5">
                                                + 添加按钮
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Features: Bangumi & TMDB */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2 pb-2 border-b border-base-200">
                                        <h3 className="font-bold text-lg text-primary">功能配置</h3>
                                    </div>

                                    <div className="card bg-base-100 shadow-sm border border-base-200 p-6 rounded-2xl space-y-8">
                                        {/* Bilibili Bangumi */}
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <div className="badge badge-primary badge-outline">Bilibili</div>
                                                <span className="text-sm font-medium">追番列表</span>
                                            </div>
                                            <div className="grid grid-cols-1 gap-4">
                                                <div className="form-control w-full">
                                                    <label className="label"><span className="label-text text-xs text-base-content/60">Bilibili UID</span></label>
                                                    <input type="text" className="input input-bordered w-full bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                                        placeholder="例如：1536411565"
                                                        value={parsedConfig?.anime?.bilibili?.uid || parsedConfig?.site?.bilibili?.uid || ''}
                                                        onChange={e => updateConfigValue('anime.bilibili.uid', e.target.value)} />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="divider my-0"></div>

                                        {/* TMDB */}
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <div className="badge badge-secondary badge-outline">TMDB</div>
                                                <span className="text-sm font-medium">电影/剧集</span>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                                <div className="form-control w-full">
                                                    <label className="label"><span className="label-text text-xs text-base-content/60">API Key</span></label>
                                                    <input type="text" className="input input-bordered w-full bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                                        value={parsedConfig?.anime?.tmdb?.apiKey || parsedConfig?.site?.tmdb?.apiKey || ''}
                                                        onChange={e => updateConfigValue('anime.tmdb.apiKey', e.target.value)} />
                                                </div>
                                                <div className="form-control w-full">
                                                    <label className="label"><span className="label-text text-xs text-base-content/60">List ID</span></label>
                                                    <input type="text" className="input input-bordered w-full bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                                        value={parsedConfig?.anime?.tmdb?.listId || parsedConfig?.site?.tmdb?.listId || ''}
                                                        onChange={e => updateConfigValue('anime.tmdb.listId', e.target.value)} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Comments */}
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between pb-2 border-b border-base-200">
                                        <h3 className="font-bold text-lg text-primary">评论系统</h3>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-base-content/60">启用</span>
                                            <input type="checkbox" className="toggle toggle-sm toggle-primary"
                                                checked={parsedConfig?.comments?.enable || false}
                                                onChange={e => updateConfigValue('comments.enable', e.target.checked)} />
                                        </div>
                                    </div>

                                    {parsedConfig?.comments?.enable && (
                                        <div className="card bg-base-100 shadow-sm border border-base-200 p-6 rounded-2xl space-y-4">
                                            <div className="form-control w-full">
                                                <label className="label"><span className="label-text font-medium">评论插件</span></label>
                                                <CustomSelect
                                                    value={parsedConfig?.comments?.type || 'giscus'}
                                                    onChange={val => updateConfigValue('comments.type', val)}
                                                    options={COMMENT_PROVIDERS}
                                                />
                                            </div>

                                            {parsedConfig?.comments?.type === 'giscus' && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="form-control w-full">
                                                        <label className="label"><span className="label-text text-xs text-base-content/60">Repo</span></label>
                                                        <input type="text" className="input input-sm input-bordered w-full bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20"
                                                            placeholder="owner/repo"
                                                            value={parsedConfig?.comments?.giscus?.repo || ''}
                                                            onChange={e => updateConfigValue('comments.giscus.repo', e.target.value)} />
                                                    </div>
                                                    <div className="form-control w-full">
                                                        <label className="label"><span className="label-text text-xs text-base-content/60">Repo ID</span></label>
                                                        <input type="text" className="input input-sm input-bordered w-full bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20"
                                                            value={parsedConfig?.comments?.giscus?.repoId || ''}
                                                            onChange={e => updateConfigValue('comments.giscus.repoId', e.target.value)} />
                                                    </div>
                                                    <div className="form-control w-full">
                                                        <label className="label"><span className="label-text text-xs text-base-content/60">Category</span></label>
                                                        <input type="text" className="input input-sm input-bordered w-full bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20"
                                                            value={parsedConfig?.comments?.giscus?.category || ''}
                                                            onChange={e => updateConfigValue('comments.giscus.category', e.target.value)} />
                                                    </div>
                                                    <div className="form-control w-full">
                                                        <label className="label"><span className="label-text text-xs text-base-content/60">Category ID</span></label>
                                                        <input type="text" className="input input-sm input-bordered w-full bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20"
                                                            value={parsedConfig?.comments?.giscus?.categoryId || ''}
                                                            onChange={e => updateConfigValue('comments.giscus.categoryId', e.target.value)} />
                                                    </div>
                                                </div>
                                            )}

                                            {parsedConfig?.comments?.type === 'waline' && (
                                                <div className="form-control w-full">
                                                    <label className="label"><span className="label-text text-xs text-base-content/60">Server URL</span></label>
                                                    <input type="text" className="input input-bordered w-full bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20"
                                                        placeholder="https://your-waline-server.vercel.app"
                                                        value={parsedConfig?.comments?.waline?.serverURL || ''}
                                                        onChange={e => updateConfigValue('comments.waline.serverURL', e.target.value)} />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Umami Analytics */}
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between pb-2 border-b border-base-200">
                                        <h3 className="font-bold text-lg text-primary">Umami 统计</h3>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-base-content/60">启用</span>
                                            <input type="checkbox" className="toggle toggle-sm toggle-primary"
                                                checked={parsedConfig?.umami?.enable || false}
                                                onChange={e => updateConfigValue('umami.enable', e.target.checked)} />
                                        </div>
                                    </div>

                                    {parsedConfig?.umami?.enable && (
                                        <div className="card bg-base-100 shadow-sm border border-base-200 p-6 rounded-2xl space-y-4">
                                            <div className="form-control w-full">
                                                <label className="label"><span className="label-text text-xs text-base-content/60">Base URL</span></label>
                                                <input type="text" className="input input-bordered w-full bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20"
                                                    placeholder="https://cloud.umami.is"
                                                    value={parsedConfig?.umami?.baseUrl || ''}
                                                    onChange={e => updateConfigValue('umami.baseUrl', e.target.value)} />
                                            </div>
                                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                                                <div className="form-control w-full">
                                                    <label className="label"><span className="label-text text-xs text-base-content/60">Website ID</span></label>
                                                    <input type="text" className="input input-bordered w-full bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20"
                                                        value={parsedConfig?.umami?.websiteId || ''}
                                                        onChange={e => updateConfigValue('umami.websiteId', e.target.value)} />
                                                </div>
                                                <div className="form-control w-full">
                                                    <label className="label"><span className="label-text text-xs text-base-content/60">Share ID</span></label>
                                                    <input type="text" className="input input-bordered w-full bg-base-100 focus:border-primary focus:ring-2 focus:ring-primary/20"
                                                        value={parsedConfig?.umami?.shareId || ''}
                                                        onChange={e => updateConfigValue('umami.shareId', e.target.value)} />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
