const path = require('path');
const root = process.cwd();
(async () => {
  const viteModule = await import(require('url').pathToFileURL(require.resolve('vite', { paths: [path.dirname(require.resolve('vitest/package.json'))] })).href);
  const { createServer } = viteModule.default ?? viteModule;
  const preview = path.join(root, 'scripts/style-preview');
  const server = await createServer({
    configFile: false, root: preview,
    publicDir: path.join(root, 'public'),
    resolve: { alias: { '@': path.join(root, 'src'),
      'next/navigation': path.join(preview, 'navigation.ts'), 'next/link': path.join(preview, 'link.tsx'), 'next/image': path.join(preview, 'image.tsx') } },
    esbuild: { jsx: 'automatic' },
    define: { 'process.env.NODE_ENV': '"development"', 'process.env.NEXT_PUBLIC_BACKEND': '"octopus"', 'process.env.NEXT_PUBLIC_API_URL': '"/api"' },
    plugins: [{ name: 'isolated-preview-fixtures', enforce: 'pre', resolveId(source, importer) {
      source = source.replaceAll('\\', '/').replace(/\.(tsx?|jsx?)$/, '');
      if (source.endsWith('/src/lib/api')) return path.join(preview, 'api.ts');
      if (source.endsWith('/src/lib/tasks')) return path.join(preview, 'tasks.ts');
      if (source.endsWith('/src/components/providers/AuthProvider')) return path.join(preview, 'auth.ts');
      if (source.endsWith('/src/components/providers/AIProvider')) return path.join(preview, 'ai.ts');
      if (source.endsWith('/src/lib/parquet-browser')) return path.join(preview, 'parquet.ts');
      if (source === '@/lib/api' || source === './api' && importer?.includes('/src/lib/')) return path.join(preview, 'api.ts');
      if ((source === './history-client' || source.endsWith('/src/app/(main)/history/history-client')) && importer?.includes('/history/HistoryWorkspace')) return path.join(preview, 'history.ts');
      if (source === '@/lib/assessment/client' || source.endsWith('/src/lib/assessment/client') && !importer?.includes('/style-preview/assessment')) return path.join(preview, 'assessment.ts');
      if (source === '@/lib/tasks') return path.join(preview, 'tasks.ts');
      if (source === '@/components/providers/AuthProvider') return path.join(preview, 'auth.ts');
      if (source === '@/components/providers/AIProvider') return path.join(preview, 'ai.ts');
      if ((source === '../result-api' || source === './result-api') && importer?.includes('/tasks/')) return path.join(preview, 'results.ts');
      if (source === '@/lib/parquet-browser') return path.join(preview, 'parquet.ts');
    }}],
    server: { host: '127.0.0.1', port: 4173, strictPort: true, fs: { allow: [root] } },
  });
  await server.listen(); server.printUrls();
})();
