import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: true;
  statusCode: number;
  data: T;
  timestamp: string;
}

/**
 * Normaliza todas las respuestas exitosas al sobre `{ success, statusCode, data }`.
 * Las descargas (Excel) se dejan pasar sin transformar.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | T> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T> | T> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        const contentType = response.getHeader('Content-Type');
        const isDownload =
          typeof contentType === 'string' && !contentType.includes('application/json');

        if (isDownload || Buffer.isBuffer(data)) return data;

        return {
          success: true as const,
          statusCode: response.statusCode,
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
