import { toast } from 'sonner'
import { getAuthToken } from '@/lib/auth'
import { GITHUB_CONFIG } from '@/consts'
import { createCommit, createTree, getCommit, getRef, listRepoFilesRecursive, listRepoDir, updateRef } from '@/lib/github-client'
import { collectDeleteTreeItems } from './collect-delete-items'

/**
 * 批量删除文章及其关联图片
 * 内部复用 collectDeleteTreeItems 收集待删除条目
 */
export async function batchDeleteBlogs(slugs: string[]): Promise<void> {
	if (!slugs || slugs.length === 0) throw new Error('需要 slugs')

	const token = await getAuthToken()
	const toastId = toast.loading('正在初始化删除操作...')

	try {
		toast.loading('正在获取分支信息...', { id: toastId })
		const refData = await getRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`)
		const latestCommitSha = refData.sha

		const commitData = await getCommit(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, latestCommitSha)
		const baseTreeSha = commitData.tree.sha

		toast.loading('正在扫描博客文件...', { id: toastId })
		const [blogFiles, imagesRootDir] = await Promise.all([
			listRepoFilesRecursive(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, 'src/content/blog', GITHUB_CONFIG.BRANCH),
			listRepoDir(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, 'public/images', GITHUB_CONFIG.BRANCH)
		])

		const treeItems = await collectDeleteTreeItems(token, slugs, blogFiles, imagesRootDir)

		if (treeItems.length === 0) {
			toast.info('没有需要删除的文件', { id: toastId })
			return
		}

		toast.loading('正在创建文件树...', { id: toastId })
		const treeData = await createTree(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, treeItems, baseTreeSha)

		const message = slugs.length === 1 ? `删除文章: ${slugs[0]}` : `批量删除文章: ${slugs.length} 篇`
		toast.loading('正在创建提交...', { id: toastId })
		const newCommitData = await createCommit(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, message, treeData.sha, [latestCommitSha])

		toast.loading('正在更新分支...', { id: toastId })
		await updateRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`, newCommitData.sha)

		toast.success('批量删除成功！请等待页面部署后刷新', { id: toastId })
	} catch (error: any) {
		console.error(error)
		toast.error(error.message || '删除失败', { id: toastId })
		throw error
	}
}
