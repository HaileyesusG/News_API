import { Request, Response } from 'express';
import { ArticleService, isArticleServiceError } from '../services/article.service';
import { sendSuccess, sendError, sendPaginated } from '../utils/response.util';

// In-memory rate limiter for read tracking
// Key: `${userId || 'guest'}-${articleId}`, Value: last read timestamp
const readRateLimit = new Map<string, number>();
const READ_RATE_LIMIT_MS = 10000; // 10 seconds

export class ArticleController {
  /**
   * POST /articles - Create article (Author only)
   */
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const article = await ArticleService.create(req.body, req.user!.userId);
      sendSuccess(res, 'Article created successfully', article, 201);
    } catch (error) {
      console.error('Create article error:', error);
      sendError(res, 500, 'Internal server error', ['An unexpected error occurred']);
    }
  }

  /**
   * GET /articles/me - Author's own articles
   */
  static async getMyArticles(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 10;
      const includeDeleted = req.query.includeDeleted === 'true';

      const { articles, total } = await ArticleService.getMyArticles(
        req.user!.userId,
        page,
        pageSize,
        includeDeleted
      );

      sendPaginated(res, 'Articles retrieved successfully', articles, page, pageSize, total);
    } catch (error) {
      console.error('Get my articles error:', error);
      sendError(res, 500, 'Internal server error', ['An unexpected error occurred']);
    }
  }

  /**
   * PUT /articles/:id - Update article (Author only)
   */
  static async update(req: Request, res: Response): Promise<void> {
    try {
      const result = await ArticleService.update(req.params.id as string, req.user!.userId, req.body);

      if (isArticleServiceError(result)) {
        sendError(res, result.statusCode, result.error, [result.error]);
        return;
      }

      sendSuccess(res, 'Article updated successfully', result.article);
    } catch (error) {
      console.error('Update article error:', error);
      sendError(res, 500, 'Internal server error', ['An unexpected error occurred']);
    }
  }

  /**
   * DELETE /articles/:id - Soft delete (Author only)
   */
  static async delete(req: Request, res: Response): Promise<void> {
    try {
      const result = await ArticleService.softDelete(req.params.id as string, req.user!.userId);

      if (isArticleServiceError(result)) {
        sendError(res, result.statusCode, result.error, [result.error]);
        return;
      }

      sendSuccess(res, 'Article deleted successfully');
    } catch (error) {
      console.error('Delete article error:', error);
      sendError(res, 500, 'Internal server error', ['An unexpected error occurred']);
    }
  }

  /**
   * GET /articles - Public feed with filters
   */
  static async getPublicFeed(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 10;
      const category = req.query.category as string | undefined;
      const author = req.query.author as string | undefined;
      const q = req.query.q as string | undefined;

      const { articles, total } = await ArticleService.getPublicFeed(
        page,
        pageSize,
        category,
        author,
        q
      );

      sendPaginated(res, 'Articles retrieved successfully', articles, page, pageSize, total);
    } catch (error) {
      console.error('Get public feed error:', error);
      sendError(res, 500, 'Internal server error', ['An unexpected error occurred']);
    }
  }

  /**
   * GET /articles/:id - Single article with read tracking
   */
  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const articleId = req.params.id as string;
      const article = await ArticleService.getById(articleId);

      if (!article) {
        sendError(res, 404, 'Article not found', ['Article not found']);
        return;
      }

      // Check if article is soft-deleted
      if (article.deletedAt) {
        sendError(res, 410, 'News article no longer available', [
          'News article no longer available',
        ]);
        return;
      }

      // Rate limiting for read tracking
      const userId = req.user?.userId || 'guest';
      const rateLimitKey = `${userId}-${articleId}`;
      const lastRead = readRateLimit.get(rateLimitKey);
      const now = Date.now();

      if (!lastRead || now - lastRead > READ_RATE_LIMIT_MS) {
        // Create read log entry (non-blocking, fire-and-forget)
        ArticleService.createReadLog(articleId, req.user?.userId as string | undefined);
        readRateLimit.set(rateLimitKey, now);
      }

      // Clean up old rate limit entries periodically (prevent memory leak)
      if (readRateLimit.size > 10000) {
        const cutoff = now - READ_RATE_LIMIT_MS;
        for (const [key, timestamp] of readRateLimit.entries()) {
          if (timestamp < cutoff) {
            readRateLimit.delete(key);
          }
        }
      }

      sendSuccess(res, 'Article retrieved successfully', article);
    } catch (error) {
      console.error('Get article error:', error);
      sendError(res, 500, 'Internal server error', ['An unexpected error occurred']);
    }
  }

  /**
   * GET /author/dashboard - Author performance dashboard
   */
  static async getDashboard(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 10;

      const { articles, total } = await ArticleService.getAuthorDashboard(
        req.user!.userId,
        page,
        pageSize
      );

      sendPaginated(res, 'Dashboard data retrieved successfully', articles, page, pageSize, total);
    } catch (error) {
      console.error('Dashboard error:', error);
      sendError(res, 500, 'Internal server error', ['An unexpected error occurred']);
    }
  }
}
