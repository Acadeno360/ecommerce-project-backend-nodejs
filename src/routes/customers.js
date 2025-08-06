import express from 'express';
import asyncHandler from 'express-async-handler';

import User from '../models/User.js';
import Order from '../models/Order.js';
import Review from '../models/Review.js';
import Product from '../models/Product.js';
import { protect, customer } from '../middleware/auth.js';

const router = express.Router();

// All routes require customer authentication
router.use(protect, customer);

/**
 * @swagger
 * /customers/dashboard:
 *   get:
 *     summary: Get customer dashboard
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Customer dashboard retrieved successfully
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
  // Get user's order statistics
  const totalOrders = await Order.countDocuments({ user: req.user.id });
  const pendingOrders = await Order.countDocuments({ user: req.user.id, status: 'pending' });
  const deliveredOrders = await Order.countDocuments({ user: req.user.id, status: 'delivered' });

  // Get total spent
  const totalSpent = await Order.aggregate([
    { $match: { user: req.user._id, status: { $ne: 'cancelled' } } },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
  ]);

  // Get recent orders
  const recentOrders = await Order.find({ user: req.user.id })
    .populate('items.product', 'name images')
    .sort({ createdAt: -1 })
    .limit(5);

  // Get user's reviews
  const userReviews = await Review.find({ user: req.user.id })
    .populate('product', 'name images')
    .sort({ createdAt: -1 })
    .limit(5);

  // Get recommended products (based on user's purchase history)
  const userCategories = await Order.aggregate([
    { $match: { user: req.user._id } },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'products',
        localField: 'items.product',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: '$product' },
    {
      $group: {
        _id: '$product.category',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 3 }
  ]);

  let recommendedProducts = [];
  if (userCategories.length > 0) {
    const categoryIds = userCategories.map(cat => cat._id);
    recommendedProducts = await Product.find({
      category: { $in: categoryIds },
      isActive: true,
      _id: { $nin: recentOrders.flatMap(order => order.items.map(item => item.product)) }
    })
      .populate('category', 'name')
      .limit(10);
  }

  res.status(200).json({
    status: 'success',
    data: {
      orderStats: {
        total: totalOrders,
        pending: pendingOrders,
        delivered: deliveredOrders
      },
      totalSpent: totalSpent[0]?.total || 0,
      recentOrders,
      userReviews,
      recommendedProducts
    }
  });
}));

/**
 * @swagger
 * /customers/profile:
 *   get:
 *     summary: Get customer profile
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Customer profile retrieved successfully
 */
router.get('/profile', asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');

  res.status(200).json({
    status: 'success',
    data: user
  });
}));

/**
 * @swagger
 * /customers/profile:
 *   put:
 *     summary: Update customer profile
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: object
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.put('/profile', asyncHandler(async (req, res) => {
  const { name, phone, address } = req.body;

  const user = await User.findById(req.user.id);

  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (address) user.address = address;

  await user.save();

  res.status(200).json({
    status: 'success',
    data: user
  });
}));

/**
 * @swagger
 * /customers/orders:
 *   get:
 *     summary: Get customer orders
 *     tags: [Customers]
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
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processing, shipped, delivered, cancelled]
 *     responses:
 *       200:
 *         description: Customer orders retrieved successfully
 */
router.get('/orders', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter = { user: req.user.id };
  if (req.query.status) {
    filter.status = req.query.status;
  }

  const orders = await Order.find(filter)
    .populate('items.product', 'name images price')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Order.countDocuments(filter);

  res.status(200).json({
    status: 'success',
    data: orders,
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
 * /customers/reviews:
 *   get:
 *     summary: Get customer reviews
 *     tags: [Customers]
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
 *         description: Customer reviews retrieved successfully
 */
router.get('/reviews', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const reviews = await Review.find({ user: req.user.id })
    .populate('product', 'name images')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

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
 * /customers/wishlist:
 *   get:
 *     summary: Get customer wishlist (placeholder for future implementation)
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wishlist retrieved successfully
 */
router.get('/wishlist', asyncHandler(async (req, res) => {
  // Placeholder for wishlist functionality
  res.status(200).json({
    status: 'success',
    data: [],
    message: 'Wishlist functionality coming soon'
  });
}));

/**
 * @swagger
 * /customers/addresses:
 *   get:
 *     summary: Get customer addresses
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Customer addresses retrieved successfully
 */
router.get('/addresses', asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('address');

  res.status(200).json({
    status: 'success',
    data: user.address ? [user.address] : []
  });
}));

/**
 * @swagger
 * /customers/addresses:
 *   post:
 *     summary: Add customer address
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - street
 *               - city
 *               - state
 *               - zipCode
 *             properties:
 *               street:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               zipCode:
 *                 type: string
 *               country:
 *                 type: string
 *     responses:
 *       200:
 *         description: Address added successfully
 */
router.post('/addresses', asyncHandler(async (req, res) => {
  const { street, city, state, zipCode, country = 'USA' } = req.body;

  const user = await User.findById(req.user.id);
  user.address = { street, city, state, zipCode, country };
  await user.save();

  res.status(200).json({
    status: 'success',
    data: user.address
  });
}));

export default router; 