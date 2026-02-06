import { create } from 'zustand'
import { clearAllAuthCache, getAuthToken as getToken, hasAuth as checkAuth, getPemFromCache, savePemToCache } from '@/lib/auth'

interface AuthStore {
	// State
	isAuth: boolean
	privateKey: string | null

	// Actions
	setPrivateKey: (key: string) => void
	clearAuth: () => void
	refreshAuthState: () => void
	getAuthToken: () => Promise<string>
}

export const useAuthStore = create<AuthStore>((set, get) => ({
	isAuth: false,
	privateKey: null,

	setPrivateKey: async (key: string) => {
		set({ isAuth: true, privateKey: key })
		await savePemToCache(key)
	},

	clearAuth: () => {
		clearAllAuthCache()
		set({ isAuth: false })
	},

	refreshAuthState: async () => {
		set({ isAuth: await checkAuth() })
	},

	getAuthToken: async () => {
		const token = await getToken()
		get().refreshAuthState()
		return token
	}
}))

if (typeof window !== 'undefined') {
	getPemFromCache().then((key) => {
		if (key) {
			useAuthStore.setState({ privateKey: key })
		}
	})

	checkAuth().then((isAuth) => {
		if (isAuth) {
			useAuthStore.setState({ isAuth })
		}
	})
}
