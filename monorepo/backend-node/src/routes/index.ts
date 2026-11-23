/**
 * Route aggregator for /api/v1.
 */

import { Router } from 'express';
import { authRoutes } from './v1/authRoutes';
import { catalogRoutes } from './v1/catalogRoutes';
import { operationsRoutes } from './v1/operationsRoutes';
import { financeRoutes } from './v1/financeRoutes';
import { customerAppRoutes, technicianRoutes } from './v1/appRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/me', customerAppRoutes);
router.use('/technician', technicianRoutes);
router.use('/', catalogRoutes);
router.use('/', operationsRoutes);
router.use('/', financeRoutes);

export { router as routes };
