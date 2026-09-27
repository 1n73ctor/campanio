import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { config, productionProblems } from './common/config';
import helmet from 'helmet';
import { extname } from 'path';
import { PUBLIC_DIR, PUBLIC_IMAGE_EXTS } from './files/uploads';

async function bootstrap() {
  const problems = productionProblems();
  if (problems.length) {
    new Logger('Bootstrap').error(`Refusing to start in production:\n  - ${problems.join('\n  - ')}`);
    process.exit(1);
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.disable('x-powered-by');
  app.use(
    helmet({
      // JSON API: nothing to render, never framed. The Swagger UI (dev only) needs its own scripts, so CSP is prod-only.
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } } : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // the website (another origin) shows photos from /uploads
      crossOriginEmbedderPolicy: false,
      hsts: { maxAge: 63_072_000, includeSubDomains: true },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  app.enableCors({ origin: config.corsOrigins, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));
  // public uploads: only images, never executable, even for files stored before type checks existed
  app.use('/uploads/public', (req: { path: string }, res: { status: (n: number) => { end: () => void } }, next: () => void) =>
    PUBLIC_IMAGE_EXTS.includes(extname(req.path).toLowerCase()) || ['.jpeg'].includes(extname(req.path).toLowerCase()) ? next() : res.status(404).end(),
  );
  app.useStaticAssets(PUBLIC_DIR, {
    prefix: '/uploads/public',
    maxAge: '7d',
    dotfiles: 'deny',
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; sandbox");
    },
  });
  app.set('trust proxy', 1);
  app.enableShutdownHooks();

  // API docs map every endpoint — handy in development, off in production unless API_DOCS=true
  if (config.docsEnabled) {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Companio API').setDescription('Backend for web, mobile and admin clients').setVersion('0.1.0').addBearerAuth().build(),
    );
    SwaggerModule.setup('docs', app, doc, { jsonDocumentUrl: 'docs/openapi.json' });
  }

  await app.listen(config.port);
  const log = new Logger('Bootstrap');
  log.log(`API ready on http://localhost:${config.port}${config.docsEnabled ? '  ·  docs: /docs' : ''}  ·  payments: ${config.paymentProvider}`);
  if (config.otpDevEcho) log.warn('OTP_DEV_ECHO is on — OTP codes are returned in API responses (dev only)');
  if (config.firebaseProjectId) log.log(`Phone sign-in: Firebase (project ${config.firebaseProjectId})`);
  else if (process.env.NODE_ENV === 'production' && config.smsProvider === 'console')
    log.warn('No SMS delivery: set FIREBASE_PROJECT_ID (Firebase phone sign-in) or plug an SMS provider into src/auth/sms.service.ts — otherwise real users cannot sign in');
}
void bootstrap();
