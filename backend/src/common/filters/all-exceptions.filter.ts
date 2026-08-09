import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

interface ErrorBody {
  success: false;
  statusCode: number;
  message: string;
  errors?: string[];
  path: string;
  timestamp: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Ha ocurrido un error inesperado';
    let errors: string[] | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const body = res as { message?: string | string[]; error?: string };
        if (Array.isArray(body.message)) {
          message = 'Los datos enviados no son válidos';
          errors = body.message;
        } else {
          message = body.message ?? body.error ?? message;
        }
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      ({ statusCode, message } = this.mapPrismaError(exception));
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      statusCode = HttpStatus.BAD_REQUEST;
      message = 'Los datos enviados no son válidos';
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} → ${statusCode}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} → ${statusCode}: ${message}`);
    }

    const body: ErrorBody = {
      success: false,
      statusCode,
      message,
      ...(errors ? { errors } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(statusCode).json(body);
  }

  private mapPrismaError(e: Prisma.PrismaClientKnownRequestError): {
    statusCode: number;
    message: string;
  } {
    const target = (e.meta?.target as string[] | string | undefined) ?? '';
    const field = Array.isArray(target) ? target.join(', ') : String(target);

    switch (e.code) {
      case 'P2002':
        return {
          statusCode: HttpStatus.CONFLICT,
          message: `Ya existe un registro con ese valor${field ? ` en: ${field}` : ''}`,
        };
      case 'P2003':
        return {
          statusCode: HttpStatus.CONFLICT,
          message: 'La operación afecta registros relacionados y no puede completarse',
        };
      case 'P2025':
        return { statusCode: HttpStatus.NOT_FOUND, message: 'El registro no existe' };
      case 'P2014':
        return {
          statusCode: HttpStatus.CONFLICT,
          message: 'La operación viola una relación requerida entre registros',
        };
      default:
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'No fue posible completar la operación en la base de datos',
        };
    }
  }
}
