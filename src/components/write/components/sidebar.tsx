import { CoverSection } from './sections/cover-section'
import { MetaSection } from './sections/meta-section'
import { ImagesSection } from './sections/images-section'
import { ANIMATION_DELAY, INIT_DELAY } from '@/consts'
import type { AiModelDefinition } from '@/lib/ai-models'

type WriteSidebarProps = {
	categories?: string[]
	aiModels?: AiModelDefinition[]
}

export function WriteSidebar({ categories = [], aiModels = [] }: WriteSidebarProps) {
	return (
		<div className='w-full max-w-[320px] space-y-6'>
			<div className='grid grid-cols-1 gap-6'>
				<CoverSection delay={INIT_DELAY + ANIMATION_DELAY * 0} />
				<MetaSection delay={INIT_DELAY + ANIMATION_DELAY * 1} categories={categories} aiModels={aiModels} />
			</div>
			<ImagesSection delay={INIT_DELAY + ANIMATION_DELAY * 2} />
		</div>
	)
}
