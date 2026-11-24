/**
 * Zod request validation middleware. Parsed (trimmed/coerced) values replace the raw input.
 */

import { NextFunction, Request, Response } from 'express';
import { ZodTypeAny } from 'zod';

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export const validate =
  (schemas: Schemas) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params);
      if (schemas.query) req.query = schemas.query.parse(req.query);
      if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
      next();
    } catch (err) {
      next(err);
    }
  };

/**
 * Body validation whose schema depends on the (already validated) request, e.g. a route
 * parameter that selects the section being saved.
 */
export const validateBodyBy =
  (pick: (req: Request) => ZodTypeAny | undefined) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const schema = pick(req);
      if (schema) req.body = schema.parse(req.body ?? {});
      next();
    } catch (err) {
      next(err);
    }
  };
