import { toBase64Utf8, getRef, createTree, createCommit, updateRef, createBlob, type TreeItem } from '@/lib/github-client'
import { fileToBase64NoPrefix, hashFileSHA256 } from '@/lib/file-utils'
import { getAuthToken } from '@/lib/auth'
import { GITHUB_CONFIG } from '@/consts'
import type { ImageItem, PublishForm } from '../types'
import { getFileExt, formatDateTimeLocal } from '@/lib/utils'
import { toast } from 'sonner'
import { stringifyFrontmatter } from '@/lib/frontmatter'

export type PushBlogParams = {
    form: PublishForm
    cover?: ImageItem | null
    images?: ImageItem[]
    mode?: 'create' | 'edit'
    originalSlug?: string | null
    originalFileFormat?: 'md' | 'mdx' | null
}

export async function pushBlog(params: PushBlogParams): Promise<void> {
    const { form, cover, images, mode = 'create', originalSlug, originalFileFormat } = params

    if (!form?.slug) throw new Error('需要 slug')
    if (!/^[a-z0-9][a-z0-9\-_]*$/.test(form.slug)) throw new Error('slug 格式不合法')

    const token = await getAuthToken()
    const toastId = toast.loading('🚀 正在初始化发布...')

    try {
        toast.loading('📡 正在同步分支信息...', { id: toastId })
        const refData = await getRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`)
        const latestCommitSha = refData.sha

        const commitMessage = mode === 'edit' ? `feat(blog): update post "${form.title}"` : `feat(blog): publish post "${form.title}"`

        // 收集所有本地图片（去重：cover 如果已在 images 列表中则不重复添加）
        const seenIds = new Set<string>()
        const allLocalImages: Array<{ img: Extract<ImageItem, { type: 'file' }>; id: string }> = []

        for (const img of images || []) {
            if (img.type === 'file' && !seenIds.has(img.id)) {
                seenIds.add(img.id)
                allLocalImages.push({ img, id: img.id })
            }
        }
        if (cover?.type === 'file' && !seenIds.has(cover.id)) {
            allLocalImages.push({ img: cover, id: cover.id })
        }

        toast.loading('正在准备文件...', { id: toastId })

        let mdToUpload = form.md
        let coverPath: string | undefined

        const treeItems: TreeItem[] = []

        if (allLocalImages.length > 0) {
            toast.loading(`📤 正在上传 ${allLocalImages.length} 张图片...`, { id: toastId })

            // 同步阶段：按 hash 去重，计算每张图片的路径映射
            const seenHashes = new Set<string>()
            const imageMeta: Array<{
                img: Extract<ImageItem, { type: 'file' }>
                id: string
                hash: string
                publicPath: string
                repoPath: string
                needUpload: boolean
            }> = []

            for (const { img, id } of allLocalImages) {
                const hash = img.hash || (await hashFileSHA256(img.file))
                const ext = getFileExt(img.file.name)
                const filename = `${hash}${ext}`
                const publicPath = `/images/${form.slug}/${filename}`
                const repoPath = `public/images/${form.slug}/${filename}`
                const needUpload = !seenHashes.has(hash)
                if (needUpload) seenHashes.add(hash)
                imageMeta.push({ img, id, hash, publicPath, repoPath, needUpload })
            }

            // 并行上传需要上传的图片 Blob
            const toUpload = imageMeta.filter(m => m.needUpload)
            const blobResults = await Promise.all(
                toUpload.map(async ({ img, repoPath }) => {
                    const contentBase64 = await fileToBase64NoPrefix(img.file)
                    const blobData = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, contentBase64, 'base64')
                    return { repoPath, sha: blobData.sha }
                })
            )

            // 收集 tree 条目
            for (const { repoPath, sha } of blobResults) {
                treeItems.push({ path: repoPath, mode: '100644', type: 'blob', sha })
            }

            // 替换 markdown 中的占位符
            for (const { id, publicPath } of imageMeta) {
                const placeholder = `local-image:${id}`
                mdToUpload = mdToUpload.split(`(${placeholder})`).join(`(${publicPath})`)

                if (cover?.type === 'file' && cover.id === id) {
                    coverPath = publicPath
                }
            }
        }

        if (cover?.type === 'url') {
            coverPath = cover.url
        }

        toast.loading('正在创建文章内容...', { id: toastId })

        const dateStr = form.date || formatDateTimeLocal()
        const frontmatter: Record<string, any> = {
            title: form.title,
            description: form.summary,
            aiModel: form.aiModel,
            pubDate: dateStr,
            image: coverPath,
            draft: form.hidden,
            tags: form.tags,
            categories: form.categories,
            badge: form.badge,
            encrypted: form.encrypted
        }

        const finalContent = stringifyFrontmatter(frontmatter, mdToUpload)

        toast.loading('📝 正在生成文章内容...', { id: toastId })
        const mdBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(finalContent), 'base64')
        treeItems.push({
            path: `src/content/blog/${form.slug}.${form.fileFormat}`,
            mode: '100644',
            type: 'blob',
            sha: mdBlob.sha
        })

        // 如果是编辑模式且文件格式发生了变化，删除原文件
        if (mode === 'edit' && originalFileFormat && originalFileFormat !== form.fileFormat) {
            // 在Git中，删除文件是通过添加一个sha为null的条目来实现的
            treeItems.push({
                path: `src/content/blog/${form.slug}.${originalFileFormat}`,
                mode: '100644',
                type: 'blob',
                sha: null // 空sha表示删除文件
            })
        }

        toast.loading('🌳 正在构建文件树...', { id: toastId })
        const treeData = await createTree(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, treeItems, latestCommitSha)

        toast.loading('💾 正在提交更改...', { id: toastId })
        const commitData = await createCommit(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, commitMessage, treeData.sha, [latestCommitSha])

        toast.loading('🔄 正在同步远程分支...', { id: toastId })
        await updateRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`, commitData.sha)

        toast.success(`🎉 ${mode === 'edit' ? '更新' : '发布'}成功！更改已推送到仓库`, {
            id: toastId,
            duration: 5000,
            description: 'GitHub Actions 将会自动部署您的站点，请稍候。'
        })
    } catch (error: any) {
        console.error(error)
        toast.error('❌ 操作失败', {
            id: toastId,
            description: error.message || '发生了未知错误，请重试'
        })
        throw error
    }
}
