import { toast } from 'sonner'
import { getAuthToken } from '@/lib/auth'
import { GITHUB_CONFIG } from '@/consts'
import { createCommit, createTree, getRef, getCommit, listRepoFilesRecursive, listRepoDir, updateRef } from '@/lib/github-client'
import { collectDeleteTreeItems } from './collect-delete-items'

/**
 * 删除单篇文章及其关联图片
 * 内部复用 collectDeleteTreeItems 收集待删除条目
 */
export async function deleteBlog(slug: string): Promise<void> {
	if (!slug) throw new Error('需要 slug')

	const token = await getAuthToken()
	const toastId = toast.loading('正在初始化删除...')

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

		const treeItems = await collectDeleteTreeItems(token, [slug], blogFiles, imagesRootDir)

		if (treeItems.length === 0) {
			toast.info('没有找到需要删除的文件', { id: toastId })
			return
		}

		toast.loading('正在创建文件树...', { id: toastId })
		const treeData = await createTree(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, treeItems, baseTreeSha)

		toast.loading('正在创建提交...', { id: toastId })
		const newCommitData = await createCommit(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `删除文章: ${slug}`, treeData.sha, [latestCommitSha])

		toast.loading('正在更新分支...', { id: toastId })
		await updateRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`, newCommitData.sha)

		toast.success('删除成功！请等待部署完成后刷新页面', { id: toastId })
	} catch (error: any) {
		console.error(error)
		toast.error(error.message || '删除失败', { id: toastId })
		throw error
	}
}
