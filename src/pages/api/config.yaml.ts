import type { APIRoute } from 'astro';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Astro API Endpoint that serves the mahiro.config.yaml file
// This is primarily used for the /config page to get the latest config in dev mode
export const GET: APIRoute = async () => {
    try {
        const configPath = path.resolve('mahiro.config.yaml');
        if (fs.existsSync(configPath)) {
            const configContent = fs.readFileSync(configPath, 'utf8');
            return new Response(configContent, {
                status: 200,
                headers: {
                    'Content-Type': 'application/x-yaml'
                }
            });
        } else {
            return new Response('Config file not found', { status: 404 });
        }
    } catch (e: any) {
        return new Response(`Error reading config: ${e.message}`, { status: 500 });
    }
};
