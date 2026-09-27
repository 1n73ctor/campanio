import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { config, productionProblems } from './common/config';
import { PUBLIC_DIR } from './files/uploads';

async function bootstrap() {
  const problems = productionProblems();
  if (problems.length) {
    new Logger('Bootstrap').error(`Refusing to start in production:\n  - ${problems.join('\n  - ')}`);
    process.exit(1);
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.enableCors({ origin: config.corsOrigins, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));
  app.useStaticAssets(PUBLIC_DIR, { prefix: '/uploads/public', maxAge: '7d' });
  app.set('trust proxy', 1);
  app.enableShutdownHooks();

  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('Companio API').setDescription('Backend for web, mobile and admin clients').setVersion('0.1.0').addBearerAuth().build(),
  );
  SwaggerModule.setup('docs', app, doc, { jsonDocumentUrl: 'docs/openapi.json' });

  await app.listen(config.port);
  const log = new Logger('Bootstrap');
  log.log(`API ready on http://localhost:${config.port}  ·  docs: /docs  ·  payments: ${config.paymentProvider}`);
  if (config.otpDevEcho) log.warn('OTP_DEV_ECHO is on — OTP codes are returned in API responses (dev only)');
  if (process.env.NODE_ENV === 'production' && config.smsProvider === 'console')
    log.warn('SMS_PROVIDER=console — login codes are only written to this log, so real users cannot sign in. Plug in an SMS provider in src/auth/sms.service.ts');
}
void bootstrap();
