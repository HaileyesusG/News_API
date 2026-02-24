import { Router } from 'express';
import authRoutes from './auth.routes';
import articleRoutes from './article.routes';
import authorRoutes from './author.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/articles', articleRoutes);
router.use('/author', authorRoutes);

export default router;
