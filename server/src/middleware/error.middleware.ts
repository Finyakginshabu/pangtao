import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export interface ApiErrorDetail {
  field?: string;
  issue: string;
}

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: ApiErrorDetail[]
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const requestId = req.requestId || 'unknown';
  res.setHeader('X-Request-Id', requestId);

  // Zod schema validation errors
  if (err instanceof ZodError) {
    const details: ApiErrorDetail[] = err.errors.map((e) => ({
      field: e.path.join('.'),
      issue: e.message,
    }));
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input payload',
        details,
      },
    });
  }

  // Known application errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && err.details.length > 0 ? { details: err.details } : {}),
      },
    });
  }

  // Malformed JSON body parser error
  if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && 'body' in err)) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Malformed JSON payload',
      },
    });
  }

  // Unexpected internal server errors (sanitize completely per NFR-04)
  console.error(`[INTERNAL_ERROR] [${requestId}]`, err);

  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected internal error occurred. Please contact support.',
    },
  });
}

