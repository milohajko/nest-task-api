import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Error as MongooseError, mongo } from 'mongoose';

const { MongoServerError } = mongo;

/** Maps every error to one JSON shape and translates database errors to HTTP codes. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const httpException = this.toHttpException(exception);
    const status = httpException.getStatus();
    const payload = httpException.getResponse();

    const body = {
      statusCode: status,
      error: HttpStatus[status] ?? 'Error',
      message:
        typeof payload === 'string'
          ? payload
          : ((payload as { message?: string | string[] }).message ?? httpException.message),
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        (exception as Error)?.stack,
      );
    }

    response.status(status).json(body);
  }

  private toHttpException(exception: unknown): HttpException {
    if (exception instanceof HttpException) return exception;

    if (exception instanceof MongoServerError && exception.code === 11000) {
      const fields = Object.keys(
        (exception.keyValue as Record<string, unknown> | undefined) ?? {},
      ).join(', ');
      return new ConflictException(`Duplicate value for unique field(s): ${fields}`);
    }

    if (exception instanceof MongooseError.ValidationError) {
      const errors = Object.values(exception.errors as Record<string, { message: string }>);
      return new HttpException({ message: errors.map((e) => e.message) }, HttpStatus.BAD_REQUEST);
    }

    if (exception instanceof MongooseError.CastError) {
      return new HttpException(
        `Invalid ${exception.path}: ${String(exception.value)}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
