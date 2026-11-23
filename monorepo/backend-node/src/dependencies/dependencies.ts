/**
 * Lazily-built singleton service container used by controllers, middleware and jobs.
 */

import { buildContainer, Container, disconnectDatabase } from './register';

export { disconnectDatabase };

let instance: Container | null = null;

export const services = (): Container => {
  if (!instance) instance = buildContainer();
  return instance;
};
