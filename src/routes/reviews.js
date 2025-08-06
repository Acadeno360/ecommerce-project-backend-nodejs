import express from 'express';
import asyncHandler from 'express-async-handler';

import Review from '../models/Review.js';
import Product from '../models/Product.js';
import { protect, admin, customer } from '../middleware/auth.js';
import { validateReview } from '../middleware/validation.js';

const router = express.Router();

/**
 * @swagger
 * /reviews/product/{productId}:
 *   get:
 *     summary: Get reviews for a product
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Reviews retrieved successfully
 */
router.get('/product/:productId', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const reviews = await Review.getReviewsByProduct(req.params.productId, limit, skip);
  const total = await Review.countDocuments({ product: req.params.productId, isActive: true });

  res.status(200).json({
    status: 'success',
    data: reviews,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
}));

/**
 * @swagger
 * /reviews/my:
 *   get:
 *     summary: Get user's reviews (Customer only)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: User reviews retrieved successfully
 */
router.get('/my', protect, customer, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const reviews = await Review.getReviewsByUser(req.user.id, limit, skip);
  const total = await Review.countDocuments({ user: req.user.id });

  res.status(200).json({
    status: 'success',
    data: reviews,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
}));

/**
 * @swagger
 * /reviews:
 *   post:
 *     summary: Create new review (Customer only)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - product
 *               - rating
 *               - comment
 *             properties:
 *               product:
 *                 type: string
 *                 description: Product ID
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               title:
 *                 type: string
 *               comment:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Review created successfully
 *       400:
 *         description: Validation error
 */
router.post('/', protect, customer, validateReview, asyncHandler(async (req, res) => {
  const { product, rating, title, comment, images } = req.body;

  // Check if product exists
  const productExists = await Product.findById(product);
  if (!productExists) {
    res.status(404);
    throw new Error('Product not found');
  }

  // Check if user already reviewed this product
  const existingReview = await Review.findOne({ user: req.user.id, product });
  if (existingReview) {
    res.status(400);
    throw new Error('You have already reviewed this product');
  }

  // Create review
  const review = await Review.create({
    user: req.user.id,
    product,
    rating,
    title,
    comment,
    images
  });

  await review.populate('user', 'name');
  await review.populate('product', 'name images');

  res.status(201).json({
    status: 'success',
    data: review
  });
}));

/**
 * @swagger
 * /reviews/{id}:
 *   put:
 *     summary: Update review (Customer only)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               title:
 *                 type: string
 *               comment:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Review updated successfully
 *       404:
 *         description: Review not found
 */
router.put('/:id', protect, customer, validateReview, asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    res.status(404);
    throw new Error('Review not found');
  }

  // Check if user owns this review
  if (review.user.toString() !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to update this review');
  }

  Object.assign(review, req.body);
  await review.save();

  await review.populate('user', 'name');
  await review.populate('product', 'name images');

  res.status(200).json({
    status: 'success',
    data: review
  });
}));

/**
 * @swagger
 * /reviews/{id}:
 *   delete:
 *     summary: Delete review (Customer or Admin)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Review deleted successfully
 *       404:
 *         description: Review not found
 */
router.delete('/:id', protect, asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    res.status(404);
    throw new Error('Review not found');
  }

  // Check if user can delete this review
  if (req.user.role === 'customer' && review.user.toString() !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to delete this review');
  }

  await review.remove();

  res.status(200).json({
    status: 'success',
    message: 'Review deleted successfully'
  });
}));

/**
 * @swagger
 * /reviews/{id}/helpful:
 *   post:
 *     summary: Mark review as helpful/unhelpful
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - helpful
 *             properties:
 *               helpful:
 *                 type: boolean
 *                 description: true for helpful, false for unhelpful
 *     responses:
 *       200:
 *         description: Review marked successfully
 *       404:
 *         description: Review not found
 */
router.post('/:id/helpful', protect, asyncHandler(async (req, res) => {
  const { helpful } = req.body;

  const review = await Review.findById(req.params.id);

  if (!review) {
    res.status(404);
    throw new Error('Review not found');
  }

  await review.markHelpful(req.user.id, helpful);

  res.status(200).json({
    status: 'success',
    message: 'Review marked successfully'
  });
}));

/**
 * @swagger
 * /reviews/{id}/report:
 *   post:
 *     summary: Report review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 enum: [inappropriate, spam, fake, other]
 *               comment:
 *                 type: string
 *     responses:
 *       200:
 *         description: Review reported successfully
 *       404:
 *         description: Review not found
 */
router.post('/:id/report', protect, asyncHandler(async (req, res) => {
  const { reason, comment } = req.body;

  const review = await Review.findById(req.params.id);

  if (!review) {
    res.status(404);
    throw new Error('Review not found');
  }

  await review.reportReview(req.user.id, reason, comment);

  res.status(200).json({
    status: 'success',
    message: 'Review reported successfully'
  });
}));

export default router; 