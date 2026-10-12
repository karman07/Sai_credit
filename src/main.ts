import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');
  // Default CORP ("same-origin") blocks the admin/coordinator/sales frontends — each on
  // its own port/origin — from embedding uploaded files (e.g. chat/case images) via <img>,
  // even though CORS already allows the request. These are first-party frontends for the
  // same product, so relax it to "cross-origin" rather than leaving embeds silently broken.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Validation is handled per-route by ZodValidationPipe (Zod = single
  // source of truth for both DTO types and runtime validation).
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = config.get<number>('port')!;
  await app.listen(port);
  new Logger('Bootstrap').log(`Insurance CRM API → http://localhost:${port}/api/v1`);
}
void bootstrap();
