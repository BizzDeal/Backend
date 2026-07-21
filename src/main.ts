import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { SWAGGER_AUTH_SCRIPT } from './common/utils/swagger-auth.script';

// Ensure India Time Zone (Asia/Kolkata, UTC+05:30) for Node process and PostgreSQL driver
process.env.TZ = process.env.TZ || 'Asia/Kolkata';
process.env.PGTZ = process.env.PGTZ || 'Asia/Kolkata';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // Enable CORS for frontend applications and test clients
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Configure views and static assets
  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('ejs');

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
