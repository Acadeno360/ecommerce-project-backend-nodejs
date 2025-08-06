import express from 'express';
import asyncHandler from 'express-async-handler';

import Category from '../models/Category.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * /categories:
 *   get:
 *     summary: Get all categories
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 */
router.get('/', asyncHandler(async (req, res) => {
  const categories = await Category.find({ isActive: true })
    .populate('children', 'name slug')
    .sort({ order: 1, name: 1 });

  res.status(200).json({
    status: 'success',
    data: categories
  });
}));

/**
 * @swagger
 * /categories/with-counts:
 *   get:
 *     summary: Get categories with product counts
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: Categories with counts retrieved successfully
 */
router.get('/with-counts', asyncHandler(async (req, res) => {
  const categories = await Category.getCategoriesWithProductCount();

  res.status(200).json({
    status: 'success',
    data: categories
  });
}));

/**
 * @swagger
 * /categories/{id}:
 *   get:
 *     summary: Get category by ID
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category retrieved successfully
 *       404:
 *         description: Category not found
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id)
    .populate('children', 'name slug');

  if (!category) {
    res.status(404);
    throw new Error('Category not found');
  }

  res.status(200).json({
    status: 'success',
    data: category
  });
}));

/**
 * @swagger
 * /categories:
 *   post:
 *     summary: Create new category (Admin only)
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               parent:
 *                 type: string
 *               image:
 *                 type: string
 *               order:
 *                 type: number
 *     responses:
 *       201:
 *         description: Category created successfully
 *       403:
 *         description: Not authorized as admin
 */
router.post('/', protect, admin, asyncHandler(async (req, res) => {
  const category = await Category.create(req.body);

  res.status(201).json({
    status: 'success',
    data: category
  });
}));

/**
 * @swagger
 * /categories/{id}:
 *   put:
 *     summary: Update category (Admin only)
 *     tags: [Categories]
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
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               parent:
 *                 type: string
 *               image:
 *                 type: string
 *               order:
 *                 type: number
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Category updated successfully
 *       404:
 *         description: Category not found
 */
router.put('/:id', protect, admin, asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    res.status(404);
    throw new Error('Category not found');
  }

  Object.assign(category, req.body);
  await category.save();

  res.status(200).json({
    status: 'success',
    data: category
  });
}));

/**
 * @swagger
 * /categories/{id}:
 *   delete:
 *     summary: Delete category (Admin only)
 *     tags: [Categories]
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
 *         description: Category deleted successfully
 *       404:
 *         description: Category not found
 */
router.delete('/:id', protect, admin, asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    res.status(404);
    throw new Error('Category not found');
  }

  await category.remove();

  res.status(200).json({
    status: 'success',
    message: 'Category deleted successfully'
  });
}));

export default router; 