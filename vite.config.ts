import tailwindcss from '@tailwindcss/vite';
import vinext from 'vinext';
import { defineConfig } from 'vite';

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === 'seatbelt';

const localBindingConfig = {
  main: 'vinext/server/app-router-entry',
  compatibility_flags: ['nodejs_compat'],
};

export default defineConfig(async () => {
  const isVercelBuild = process.env.VERCEL === '1' || process.env.NITRO_PRESET === 'vercel';

  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  if (!isVercelBuild) {
    process.env.WRANGLER_WRITE_LOGS ??= 'false';
    process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
    process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';
  }

  const platformPlugin = isVercelBuild
    ? (await import('nitro/vite')).nitro()
    : (await import('@cloudflare/vite-plugin')).cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        config: localBindingConfig,
      });

  return {
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      tailwindcss(),
      vinext(),
      platformPlugin,
    ],
  };
});
