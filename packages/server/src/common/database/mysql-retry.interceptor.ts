import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { Observable, catchError, throwError } from 'rxjs';
import { isMalformedMysqlPacket } from './mysql-retry';

/**
 * Retries GET/HEAD requests once when the query dies on a proxy-killed pooled
 * connection ("Malformed communication packet"). Error 1835 fires before the
 * statement executes, so re-running a read handler has no side effects.
 * Mutating methods are excluded: their controllers may interleave
 * non-idempotent external calls (e.g. WeChat subscribe sends).
 */
@Injectable()
export class MysqlRetryInterceptor implements NestInterceptor {
  private readonly logger = new Logger('MysqlRetry');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const method = (req?.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      return next.handle();
    }

    return next.handle().pipe(
      catchError((err) => {
        if (!isMalformedMysqlPacket(err)) return throwError(() => err);
        this.logger.warn(`Retrying ${method} ${req.originalUrl} after malformed MySQL packet`);
        return next.handle();
      }),
    );
  }
}
