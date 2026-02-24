import prisma from '../config/database';
import { CreateArticleInput, UpdateArticleInput } from '../validators/article.validator';

interface ServiceError {
  error: string;
  statusCode: number;
}

export class ArticleService {
  /**
   * Create a new article (Author only)
   */
  static async create(data: CreateArticleInput, authorId: string) {
    const article = await prisma.article.create({
      data: {
        title: data.title,
        content: data.content,
        category: data.category,
        status: data.status || 'Draft',
        authorId,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return article;
  }

  /**
   * Get author's own articles (including drafts, optionally deleted)
   */
  static async getMyArticles(
    authorId: string,
    page: number = 1,
    pageSize: number = 10,
    includeDeleted: boolean = false
  ) {
    const where: Record<string, any> = { authorId };

    if (!includeDeleted) {
      where.deletedAt = null;
    }

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.article.count({ where }),
    ]);

    return { articles, total };
  }

  /**
   * Update an article (Author only, own articles)
   */
  static async update(articleId: string, authorId: string, data: UpdateArticleInput): Promise<ServiceError | { article: any }> {
    // Find the article
    const article = await prisma.article.findFirst({
      where: { id: articleId, deletedAt: null },
    });

    if (!article) {
      return { error: 'Article not found', statusCode: 404 };
    }

    if (article.authorId !== authorId) {
      return { error: 'Forbidden: You can only edit your own articles', statusCode: 403 };
    }

    const updated = await prisma.article.update({
      where: { id: articleId },
      data,
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return { article: updated };
  }

  /**
   * Soft delete an article (sets deletedAt timestamp)
   */
  static async softDelete(articleId: string, authorId: string): Promise<ServiceError | { success: true }> {
    const article = await prisma.article.findFirst({
      where: { id: articleId, deletedAt: null },
    });

    if (!article) {
      return { error: 'Article not found', statusCode: 404 };
    }

    if (article.authorId !== authorId) {
      return { error: 'Forbidden: You can only delete your own articles', statusCode: 403 };
    }

    await prisma.article.update({
      where: { id: articleId },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  /**
   * Public feed: published, non-deleted articles with filters
   */
  static async getPublicFeed(
    page: number = 1,
    pageSize: number = 10,
    category?: string,
    author?: string,
    q?: string
  ) {
    const where: Record<string, any> = {
      status: 'Published',
      deletedAt: null,
    };

    if (category) {
      where.category = category;
    }

    if (author) {
      where.author = {
        name: {
          contains: author,
          mode: 'insensitive',
        },
      };
    }

    if (q) {
      where.title = {
        contains: q,
        mode: 'insensitive',
      };
    }

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.article.count({ where }),
    ]);

    return { articles, total };
  }

  /**
   * Get single article by ID (for reading)
   */
  static async getById(articleId: string) {
    const article = await prisma.article.findFirst({
      where: { id: articleId },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return article;
  }

  /**
   * Create a read log entry (non-blocking)
   */
  static createReadLog(articleId: string, readerId?: string) {
    // Fire and forget — does not block the response
    prisma.readLog
      .create({
        data: {
          articleId,
          readerId: readerId || null,
        },
      })
      .catch((err: Error) => {
        console.error('Failed to create read log:', err);
      });
  }

  /**
   * Get author dashboard data
   */
  static async getAuthorDashboard(authorId: string, page: number = 1, pageSize: number = 10) {
    const where: Record<string, any> = {
      authorId,
      deletedAt: null,
    };

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          createdAt: true,
          status: true,
          category: true,
          dailyAnalytics: {
            select: {
              viewCount: true,
            },
          },
        },
      }),
      prisma.article.count({ where }),
    ]);

    // Sum up TotalViews from DailyAnalytics
    const articlesWithViews = articles.map((article: any) => ({
      id: article.id,
      title: article.title,
      createdAt: article.createdAt,
      status: article.status,
      category: article.category,
      TotalViews: article.dailyAnalytics.reduce((sum: number, da: any) => sum + da.viewCount, 0),
    }));

    return { articles: articlesWithViews, total };
  }
}

// Type guard helper
export function isArticleServiceError(result: any): result is ServiceError {
  return 'error' in result;
}
