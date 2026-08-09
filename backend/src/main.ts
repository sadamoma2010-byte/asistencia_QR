import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger, ClassSerializerInterceptor } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { UPLOADS_ROOT, ensureUploadDirs } from './common/utils/upload.util';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const port = config.get<number>('api.port', 4000);
  const prefix = config.get<string>('api.prefix', 'api/v1');
  const origins = config.get<string[]>('api.corsOrigins', ['http://localhost:3000']);

  app.setGlobalPrefix(prefix);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // Archivos subidos (fotografías de docentes). Quedan fuera del prefijo /api
  // para poder referenciarlos directamente desde una etiqueta <img>.
  ensureUploadDirs();
  app.useStaticAssets(UPLOADS_ROOT, {
    prefix: '/uploads/',
    maxAge: '7d',
    index: false,
  });

  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Disposition'],
  });

  // Validación estricta de DTOs + sanitización de payloads
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      validationError: { target: false, value: false },
    }),
  );

  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector)),
    new TransformInterceptor(),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableShutdownHooks();

  // ───────────────────────── Swagger ─────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Sistema Web de Asistencia Docente por QR')
    .setDescription(
      'API REST para el control de asistencia docente mediante un código QR único institucional. ' +
        'Autenticación JWT con refresh token y control de acceso RBAC por permisos granulares.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'access-token',
    )
    .addTag('Auth', 'Autenticación, refresh token y sesión')
    .addTag('Usuarios', 'Gestión de usuarios del sistema')
    .addTag('Roles', 'Gestión de roles')
    .addTag('Permisos', 'Catálogo de permisos y asignación a roles')
    .addTag('Docentes', 'Gestión de docentes')
    .addTag('Jornadas', 'Gestión de jornadas')
    .addTag('Horarios', 'Gestión de horarios y tolerancias')
    .addTag('Asistencia', 'Registro de entradas y salidas')
    .addTag('Reportes', 'Reportes administrativos y exportación')
    .addTag('Auditoría', 'Trazabilidad de acciones')
    .addTag('Configuración', 'Parámetros del sistema y QR institucional')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true, tagsSorter: 'alpha', operationsSorter: 'alpha' },
    customSiteTitle: 'Asistencia Docente QR · API',
  });

  await app.listen(port, '0.0.0.0');

  logger.log(`🚀  API        →  http://localhost:${port}/${prefix}`);
  logger.log(`📚  Swagger    →  http://localhost:${port}/api/docs`);
  logger.log(`🌎  CORS       →  ${origins.join(', ')}`);
}

void bootstrap();
