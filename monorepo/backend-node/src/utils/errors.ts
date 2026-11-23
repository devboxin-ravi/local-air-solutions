/**
 * Application error hierarchy. Services throw these; the error middleware maps them to HTTP.
 */

import { StatusCodes } from '../constants/api';
import { ErrorCodes, ErrorMessages } from '../constants/errors';

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR, code: string = ErrorCodes.INTERNAL_ERROR, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string) {
    super(ErrorMessages.NOT_FOUND(entity), StatusCodes.NOT_FOUND, ErrorCodes.NOT_FOUND);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = ErrorMessages.VALIDATION_FAILED, details?: unknown) {
    super(message, StatusCodes.UNPROCESSABLE, ErrorCodes.VALIDATION_ERROR, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code: string = ErrorCodes.CONFLICT) {
    super(message, StatusCodes.CONFLICT, code);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = ErrorMessages.UNAUTHORIZED, code: string = ErrorCodes.UNAUTHORIZED) {
    super(message, StatusCodes.UNAUTHORIZED, code);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = ErrorMessages.FORBIDDEN) {
    super(message, StatusCodes.FORBIDDEN, ErrorCodes.FORBIDDEN);
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string, code: string = ErrorCodes.BUSINESS_RULE) {
    super(message, StatusCodes.UNPROCESSABLE, code);
  }
}

export class IntegrationDisabledError extends AppError {
  constructor(message: string) {
    super(message, StatusCodes.SERVICE_UNAVAILABLE, ErrorCodes.INTEGRATION_DISABLED);
  }
}
