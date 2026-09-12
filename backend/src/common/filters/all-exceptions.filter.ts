import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';

type ExceptionResponse = string | Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getMessage(value: ExceptionResponse): string | string[] {
  if (typeof value === 'string') {
    return value;
  }

  const message = value.message;

  if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
    return message;
  }

  return typeof message === 'string' ? message : 'Request failed';
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const safeResponse: ExceptionResponse = isRecord(exceptionResponse)
        ? exceptionResponse
        : String(exceptionResponse);

      response.status(status).json({
        statusCode: status,
        message: getMessage(safeResponse),
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
  }
}
