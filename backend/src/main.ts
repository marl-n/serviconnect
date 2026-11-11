import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { UPLOADS_DIR } from './uploads/uploads.constants';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useStaticAssets(UPLOADS_DIR, { prefix: '/uploads/' });
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: [process.env.FRONTEND_URL, 'http://localhost:3001', 'http://localhost:19006'],
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));

  const config = new DocumentBuilder()
    .setTitle('ServiConnect API')
    .setDescription('Local services lead-generation platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api', app, SwaggerModule.createDocument(app, config));

  await app.listen(process.env.PORT ?? 3000);
  console.log(`API running → http://localhost:${process.env.PORT ?? 3000}`);
  console.log(`Swagger  → http://localhost:${process.env.PORT ?? 3000}/api`);
}
bootstrap();
