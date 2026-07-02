import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request & { user?: any }>();
    const response = ctx.getResponse<Response>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const isProd = process.env.NODE_ENV === 'production';

    let message: string;
    if (exception instanceof HttpException) {
      message = exception.message;
    } else if (isProd) {
      message = 'Internal server error';
    } else {
      message = exception instanceof Error ? exception.message : 'Internal server error';
    }

    const err = exception instanceof Error ? exception : undefined;
    const user = (request as any)?.user;
    const detail = {
      status,
      method: (request as any)?.method,
      url: (request as any)?.originalUrl || (request as any)?.url,
      userId: user?.id,
      userRole: user?.role,
      errorName: err?.name || 'NonErrorException',
      errorMessage: err?.message || String(exception),
      response: exception instanceof HttpException ? exception.getResponse() : undefined,
    };

    const line = `[HTTP_EXCEPTION] ${JSON.stringify(detail)}`;
    if (status >= 500) {
      this.logger.error(line, err?.stack);
    } else if (process.env.LOG_HTTP_ERRORS === 'true') {
      this.logger.warn(line);
    }

    response.status(status).json({
      code: status,
      data: null,
      message,
    });
  }
}
