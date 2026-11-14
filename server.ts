import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { authRouter } from './src/server/routes-auth.ts';
import { marketplaceRouter } from './src/server/routes-marketplace.ts';
import { paymentsAdminRouter } from './src/server/routes-payments-admin.ts';
import { ensurePlatformSeeded } from './src/server/seed.ts';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  app.use(express.json({ limit: '3mb' }));

  // Lazy idempotent platform seed on API traffic
  app.use('/api', async (_req, _res, next) => {
    await ensurePlatformSeeded();
    next();
  });

  app.use('/api', authRouter);
  app.use('/api', marketplaceRouter);
  app.use('/api', paymentsAdminRouter);

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LOGEASI.COM server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start LOGEASI.COM server:', err);
  process.exit(1);
});
