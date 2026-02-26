import type { APIRoute } from 'astro';
import { GITHUB_CONFIG } from '@/config';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
    try {
        const url = new URL(request.url);
        const pathParam = url.searchParams.get('path');

        if (!pathParam) {
            return new Response(JSON.stringify({ error: 'Missing path parameter' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // We use the internal Astro GITHUB_CONFIG variable which is evaluated at build/runtime.
        const owner = GITHUB_CONFIG?.owner || "mhya123";
        const repo = GITHUB_CONFIG?.repo || "Mahiro-Blog";
        const token = (GITHUB_CONFIG as any)?.token || undefined; // If available, use the personal access token

        const apiEndpoint = `https://api.github.com/repos/${owner}/${repo}/commits?path=${encodeURIComponent(pathParam)}`;

        const headers: Record<string, string> = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Mahiro-Blog-Astro-Endpoint'
        };

        if (token) {
            headers['Authorization'] = `token ${token}`;
        }

        const response = await fetch(apiEndpoint, { headers });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errBody}`);
        }

        const data = await response.json();

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                // Optional: cache headers if needed, otherwise rely on SWR cache in UI
                'Cache-Control': 'public, max-age=60, s-maxage=300'
            }
        });

    } catch (e: any) {
        console.error("API /commits GET Error: ", e);
        return new Response(JSON.stringify({ error: e.message || "Failed to fetch commits" }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
