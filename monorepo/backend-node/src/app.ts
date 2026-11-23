/**
 * Express application factory (no network listener — see server.ts).
 */

import path from 'path';
import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import { API_PREFIX, DOCS_PATH, UPLOADS_PUBLIC_PATH } from './constants';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiLimiter, requestLogger } from './middleware/security';
import { routes } from './routes';
import { openApiDocument } from './utils/openapi';

const JSON_LIMIT = '1mb';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    }),
  );
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || config.corsOrigins.includes(origin)),
      credentials: true,
    }),
  );
  // Keep the raw body for webhook signature verification.
  app.use(
    express.json({
      limit: JSON_LIMIT,
      verify: (req, _res, buf) => {
        (req as express.Request).rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: false, limit: JSON_LIMIT }));
  app.use(requestLogger);

  app.get('/health', (_req, res) => res.json({ status: 'healthy', version: config.appVersion }));
  app.use(
    UPLOADS_PUBLIC_PATH,
    express.static(path.resolve(config.upload.dir), {
      fallthrough: false,
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; media-src 'self'");
      },
    }),
  );
  app.use(DOCS_PATH, swaggerUi.serve, swaggerUi.setup(openApiDocument));

  app.use(API_PREFIX, apiLimiter, routes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
