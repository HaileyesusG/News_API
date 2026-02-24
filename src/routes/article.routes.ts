import { Router } from 'express';
import { ArticleController } from '../controllers/article.controller';
import { authenticate, optionalAuth, authorizeRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createArticleSchema, updateArticleSchema } from '../validators/article.validator';

const router = Router();

/**
 * GET /articles - Public news feed
 * Supports filters: category, author, q (keyword search)
 * Uses optional auth to capture reader ID for tracking
 */
router.get('/', optionalAuth, ArticleController.getPublicFeed);

/**
 * GET /articles/me - Author's own articles (Author only)
 * Must be defined BEFORE /:id to avoid route conflict
 */
router.get('/me', authenticate, authorizeRole('author'), ArticleController.getMyArticles);

/**
 * GET /articles/:id - Single article with read tracking
 * Optional auth to capture readerId if logged in
 */
router.get('/:id', optionalAuth, ArticleController.getById);

/**
 * POST /articles - Create article (Author only)
 */
router.post('/', authenticate, authorizeRole('author'), validate(createArticleSchema), ArticleController.create);

/**
 * PUT /articles/:id - Update article (Author only)
 */
router.put('/:id', authenticate, authorizeRole('author'), validate(updateArticleSchema), ArticleController.update);

/**
 * DELETE /articles/:id - Soft delete (Author only)
 */
router.delete('/:id', authenticate, authorizeRole('author'), ArticleController.delete);

export default router;
