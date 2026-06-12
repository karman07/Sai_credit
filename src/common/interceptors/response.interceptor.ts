import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiEnvelope<T> {
  success: true;
  data: T;
  meta?: unknown;
}

/** Wraps every successful response as { success, data, meta? }. */
@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiEnvelope<T>>
{
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<ApiEnvelope<T>> {
    return next.handle().pipe(
      map((payload: any) => {
        // Handlers may return { data, meta } (paginated) or a raw value.
        if (payload && typeof payload === 'object' && 'data' in payload && 'meta' in payload) {
          return { success: true, data: payload.data, meta: payload.meta };
        }
        return { success: true, data: payload as T };
      }),
    );
  }
}
