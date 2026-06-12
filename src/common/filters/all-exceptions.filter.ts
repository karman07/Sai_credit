import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

interface ErrorBody {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

/** Normalises all errors into { success:false, error:{ code, message, fields? } }. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ErrorBody = { code: 'INTERNAL_ERROR', message: 'Something went wrong' };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse() as any;
      if (typeof r === 'string') {
        body = { code: codeFromStatus(status), message: r };
      } else {
        body = {
          code: r.code ?? codeFromStatus(status),
          message: Array.isArray(r.message) ? r.message.join(', ') : r.message ?? exception.message,
          fields: r.fields,
        };
      }
    } else {
      this.logger.error(exception);
    }

    res.status(status).json({ success: false, error: body });
  }
}

function codeFromStatus(status: number): string {
  switch (status) {
    case 400: return 'VALIDATION_ERROR';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 409: return 'CONFLICT';
    case 429: return 'RATE_LIMITED';
    default:  return 'ERROR';
  }
}
