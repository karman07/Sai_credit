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
  app.use(helmet());
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
