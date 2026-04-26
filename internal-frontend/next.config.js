import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Next.js only auto-loads .env* inside internal-frontend/. We pull monorepo root env so one file can serve backend + frontend.
// These files must exist on the machine that runs `next dev` / `next build` (they are gitignored — CI/deploy must provide env another way).
const rootEnv = resolve(__dirname, '..', '.env');
const rootEnvLocal = resolve(__dirname, '..', '.env.local');
config({ path: rootEnv });
config({ path: rootEnvLocal, override: true });

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
    ],
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  },
};

export default nextConfig;
