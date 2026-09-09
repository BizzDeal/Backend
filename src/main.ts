import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { SWAGGER_AUTH_SCRIPT } from './common/utils/swagger-auth.script';
import { SettingsService } from './modules/settings/settings.service';
import helmet from 'helmet';
import compression from 'compression';

import { Request, Response, NextFunction } from 'express';

// Ensure India Time Zone (Asia/Kolkata, UTC+05:30) for Node process and PostgreSQL driver
process.env.TZ = process.env.TZ || 'Asia/Kolkata';
process.env.PGTZ = process.env.PGTZ || 'Asia/Kolkata';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Apply security headers and compression
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'", 'https:', 'data:', 'blob:'],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https:'],
          scriptSrcAttr: ["'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          fontSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'https:', 'wss:'],
        },
      },
    }),
  );
  app.use(compression());
  const configService = app.get(ConfigService);
  const settingsService = app.get(SettingsService);

  // Enable CORS for frontend applications and test clients
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Configure views
  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('ejs');

  // Subdomain & local routing middleware:
  // - localhost / 127.0.0.1 (root or /landing): serves the static landing page in local development
  // - app.bizzdeal.in: serves the static landing page in production
  // - admin.bizzdeal.in: redirects root to /admin portal
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    const rawHost = (req.headers['x-forwarded-host'] || req.headers.host || req.hostname || '') as string;
    const host = rawHost.toLowerCase().split(':')[0];
    const path = req.path || req.url || '';

    // Bypass API routes, Swagger documentation, static assets, and media files
    if (
      path.startsWith('/bizzdeal/api') ||
      path.startsWith('/bizzdeal/swagger') ||
      path.startsWith('/assets') ||
      path.includes('.')
    ) {
      return next();
    }

    const isLocal =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host === '[::1]';
    const normalizedPath = path.replace(/\/+$/, '') || '/';

    // Requests to app.bizzdeal.in or local development root/landing -> render static landing page
    if (
      host.startsWith('app.') ||
      host === 'app.bizzdeal.in' ||
      (isLocal && (normalizedPath === '/' || normalizedPath === '/landing'))
    ) {
      let playStoreUrl = 'https://play.google.com/store/apps/details?id=com.bizzdeal.app';
      try {
        const settings = await settingsService.getSettings();
        if (settings?.app_invite_base_url) {
          playStoreUrl = settings.app_invite_base_url;
        }
      } catch {
        // Fallback default
      }
      return res.render('landing', { playStoreUrl });
    }

    // Requests to admin.bizzdeal.in -> if root, redirect to /admin
    if (host.startsWith('admin.') || host === 'admin.bizzdeal.in') {
      if (normalizedPath === '/' || normalizedPath === '') {
        return res.redirect('/admin');
      }
    }

    next();
  });

  // Set the global context path so all API routes are prefixed dynamically
  const contextPath = configService.get<string>('CONTEXT_PATH') || '/bizzdeal/api';
  const prefix = contextPath.startsWith('/') ? contextPath.substring(1) : contextPath;
  app.setGlobalPrefix(prefix);

  // Configure Swagger doc builder
  const config = new DocumentBuilder()
    .setTitle('BizzDeal API')
    .setDescription('The BizzDeal backend API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Expose Swagger UI at /bizzdeal/swagger/api with custom CSS to hide the default Authorize button
  SwaggerModule.setup('bizzdeal/swagger/api', app, document, {
    customCss: '.swagger-ui .auth-wrapper { display: none !important; }',
    customJs:
      'data:text/javascript;base64,' +
      Buffer.from(SWAGGER_AUTH_SCRIPT).toString('base64'),
    customJsStr: SWAGGER_AUTH_SCRIPT,
  });

  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
