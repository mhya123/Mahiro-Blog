import { GITHUB_CONFIG } from '@/consts'
import { listRepoFilesRecursive, listRepoDir, type TreeItem } from '@/lib/github-client'

/**
 * 根据 slug 列表，收集需要删除的 Git Tree 条目
 * 包括 src/content/blog/{slug}.md(x) 和 public/images/{slug}/ 下的所有文件
 */
export async function collectDeleteTreeItems(
	token: string,
	slugs: string[],
	blogFiles: string[],
	imagesRootDir: any[]
): Promise<TreeItem[]> {
	const treeItems: TreeItem[] = []

	for (const slug of slugs) {
		// 1. 处理图片目录 (忽略大小写)
		const targetDirItem = imagesRootDir.find(
			(item: any) => item.name.toLowerCase() === slug.toLowerCase() && item.type === 'dir'
		)

		if (targetDirItem) {
			const slugImages = await listRepoFilesRecursive(
				token,
				GITHUB_CONFIG.OWNER,
				GITHUB_CONFIG.REPO,
				targetDirItem.path,
				GITHUB_CONFIG.BRANCH
			)
			for (const path of slugImages) {
				treeItems.push({ path, mode: '100644', type: 'blob', sha: null })
			}
		}

		// 2. 处理文章文件 .md / .mdx (忽略大小写)
		const mdPath = `src/content/blog/${slug}.md`
		const mdxPath = `src/content/blog/${slug}.mdx`

		const foundMd = blogFiles.find(p => p.toLowerCase() === mdPath.toLowerCase())
		if (foundMd) {
			treeItems.push({ path: foundMd, mode: '100644', type: 'blob', sha: null })
		}

		const foundMdx = blogFiles.find(p => p.toLowerCase() === mdxPath.toLowerCase())
		if (foundMdx) {
			treeItems.push({ path: foundMdx, mode: '100644', type: 'blob', sha: null })
		}

		if (!foundMd && !foundMdx) {
			console.warn(`未找到文章文件: ${slug}`)
		}
	}

	return treeItems
}
