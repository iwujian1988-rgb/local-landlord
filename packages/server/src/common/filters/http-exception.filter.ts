import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
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

    response.status(status).json({
      code: status,
      data: null,
      message,
    });
  }
}
