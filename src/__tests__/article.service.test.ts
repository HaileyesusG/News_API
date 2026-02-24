import mockPrisma from './mocks/prisma.mock';
import { ArticleService } from '../services/article.service';

describe('ArticleService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create an article successfully', async () => {
      const mockArticle = {
        id: 'article-uuid',
        title: 'Test Article Title',
        content: 'This is a test article with enough content to pass the 50 char minimum validation requirement.',
        category: 'Tech',
        status: 'Draft',
        authorId: 'author-uuid',
        createdAt: new Date(),
        deletedAt: null,
        author: { id: 'author-uuid', name: 'John Doe', email: 'john@example.com' },
      };

      mockPrisma.article.create.mockResolvedValue(mockArticle);

      const result = await ArticleService.create(
        {
          title: 'Test Article Title',
          content: 'This is a test article with enough content to pass the 50 char minimum validation requirement.',
          category: 'Tech',
          status: 'Draft',
        },
        'author-uuid'
      );

      expect(result).toEqual(mockArticle);
      expect(mockPrisma.article.create).toHaveBeenCalledWith({
        data: {
          title: 'Test Article Title',
          content: 'This is a test article with enough content to pass the 50 char minimum validation requirement.',
          category: 'Tech',
          status: 'Draft',
          authorId: 'author-uuid',
        },
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
      });
    });
  });

  describe('update', () => {
    it('should update an article successfully when author owns it', async () => {
      const existingArticle = {
        id: 'article-uuid',
        authorId: 'author-uuid',
        deletedAt: null,
      };

      const updatedArticle = {
        ...existingArticle,
        title: 'Updated Title',
        author: { id: 'author-uuid', name: 'John', email: 'john@example.com' },
      };

      mockPrisma.article.findFirst.mockResolvedValue(existingArticle);
      mockPrisma.article.update.mockResolvedValue(updatedArticle);

      const result = await ArticleService.update('article-uuid', 'author-uuid', {
        title: 'Updated Title',
      });

      expect(result).toHaveProperty('article');
      expect(mockPrisma.article.update).toHaveBeenCalled();
    });

    it('should return 403 when updating another author\'s article', async () => {
      mockPrisma.article.findFirst.mockResolvedValue({
        id: 'article-uuid',
        authorId: 'other-author-uuid',
        deletedAt: null,
      });

      const result = await ArticleService.update('article-uuid', 'author-uuid', {
        title: 'Updated Title',
      });

      expect(result).toEqual({
        error: 'Forbidden: You can only edit your own articles',
        statusCode: 403,
      });
      expect(mockPrisma.article.update).not.toHaveBeenCalled();
    });

    it('should return 404 when article not found', async () => {
      mockPrisma.article.findFirst.mockResolvedValue(null);

      const result = await ArticleService.update('non-existent', 'author-uuid', {
        title: 'Updated Title',
      });

      expect(result).toEqual({
        error: 'Article not found',
        statusCode: 404,
      });
    });
  });

  describe('softDelete', () => {
    it('should soft delete an article successfully', async () => {
      mockPrisma.article.findFirst.mockResolvedValue({
        id: 'article-uuid',
        authorId: 'author-uuid',
        deletedAt: null,
      });
      mockPrisma.article.update.mockResolvedValue({});

      const result = await ArticleService.softDelete('article-uuid', 'author-uuid');

      expect(result).toEqual({ success: true });
      expect(mockPrisma.article.update).toHaveBeenCalledWith({
        where: { id: 'article-uuid' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should return 403 when deleting another author\'s article', async () => {
      mockPrisma.article.findFirst.mockResolvedValue({
        id: 'article-uuid',
        authorId: 'other-author-uuid',
        deletedAt: null,
      });

      const result = await ArticleService.softDelete('article-uuid', 'author-uuid');

      expect(result).toEqual({
        error: 'Forbidden: You can only delete your own articles',
        statusCode: 403,
      });
    });
  });

  describe('getPublicFeed', () => {
    it('should return only published, non-deleted articles', async () => {
      const mockArticles = [
        {
          id: '1',
          title: 'Published Article',
          status: 'Published',
          deletedAt: null,
          author: { id: 'a1', name: 'Author', email: 'a@b.com' },
        },
      ];

      mockPrisma.article.findMany.mockResolvedValue(mockArticles);
      mockPrisma.article.count.mockResolvedValue(1);

      const result = await ArticleService.getPublicFeed(1, 10);

      expect(result.articles).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockPrisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'Published', deletedAt: null },
        })
      );
    });

    it('should filter by category', async () => {
      mockPrisma.article.findMany.mockResolvedValue([]);
      mockPrisma.article.count.mockResolvedValue(0);

      await ArticleService.getPublicFeed(1, 10, 'Tech');

      expect(mockPrisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'Tech' }),
        })
      );
    });

    it('should filter by author name (partial match)', async () => {
      mockPrisma.article.findMany.mockResolvedValue([]);
      mockPrisma.article.count.mockResolvedValue(0);

      await ArticleService.getPublicFeed(1, 10, undefined, 'John');

      expect(mockPrisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            author: { name: { contains: 'John', mode: 'insensitive' } },
          }),
        })
      );
    });

    it('should search by keyword in title', async () => {
      mockPrisma.article.findMany.mockResolvedValue([]);
      mockPrisma.article.count.mockResolvedValue(0);

      await ArticleService.getPublicFeed(1, 10, undefined, undefined, 'breaking');

      expect(mockPrisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            title: { contains: 'breaking', mode: 'insensitive' },
          }),
        })
      );
    });
  });

  describe('getById', () => {
    it('should return article by id', async () => {
      const mockArticle = {
        id: 'article-uuid',
        title: 'Test',
        deletedAt: null,
        author: { id: 'a1', name: 'Author', email: 'a@b.com' },
      };

      mockPrisma.article.findFirst.mockResolvedValue(mockArticle);

      const result = await ArticleService.getById('article-uuid');

      expect(result).toEqual(mockArticle);
    });

    it('should return null when article not found', async () => {
      mockPrisma.article.findFirst.mockResolvedValue(null);

      const result = await ArticleService.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getAuthorDashboard', () => {
    it('should return articles with aggregated TotalViews', async () => {
      const mockArticles = [
        {
          id: '1',
          title: 'Article 1',
          createdAt: new Date(),
          status: 'Published',
          category: 'Tech',
          dailyAnalytics: [{ viewCount: 10 }, { viewCount: 25 }],
        },
      ];

      mockPrisma.article.findMany.mockResolvedValue(mockArticles);
      mockPrisma.article.count.mockResolvedValue(1);

      const result = await ArticleService.getAuthorDashboard('author-uuid', 1, 10);

      expect(result.articles[0].TotalViews).toBe(35);
      expect(result.total).toBe(1);
    });

    it('should return 0 TotalViews when no analytics', async () => {
      mockPrisma.article.findMany.mockResolvedValue([
        {
          id: '1',
          title: 'Article 1',
          createdAt: new Date(),
          status: 'Draft',
          category: 'Health',
          dailyAnalytics: [],
        },
      ]);
      mockPrisma.article.count.mockResolvedValue(1);

      const result = await ArticleService.getAuthorDashboard('author-uuid');

      expect(result.articles[0].TotalViews).toBe(0);
    });
  });
});
