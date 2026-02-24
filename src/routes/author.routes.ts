import { Router } from 'express';
import { ArticleController } from '../controllers/article.controller';
import { authenticate, authorizeRole } from '../middleware/auth.middleware';

const router = Router();

/**
 * GET /author/dashboard - Author performance dashboard
 * Returns articles with TotalViews from DailyAnalytics
 */
router.get('/dashboard', authenticate, authorizeRole('author'), ArticleController.getDashboard);

export default router;
