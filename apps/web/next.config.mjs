import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    outputFileTracingExcludes: {
      '*': [
        '../../apps/api/**/*',
        '../../apps/api/node_modules/**/*',
        'node_modules/playwright/**/*',
        'node_modules/puppeteer/**/*'
      ],
    },
  },
};

export default nextConfig;
