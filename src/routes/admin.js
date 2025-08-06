import express from 'express';
import asyncHandler from 'express-async-handler';

import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Category from '../models/Category.js';
import Review from '../models/Review.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

// All routes require admin authentication
router.use(protect, admin);

/**
 * @swagger
 * /admin/dashboard:
 *   get:
 *     summary: Get admin dashboard statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
  // Get counts
  const userCount = await User.countDocuments();
  const productCount = await Product.countDocuments();
  const orderCount = await Order.countDocuments();
  const categoryCount = await Category.countDocuments();
  const reviewCount = await Review.countDocuments();

  // Get recent orders
  const recentOrders = await Order.find()
    .populate('user', 'name email')
    .sort({ createdAt: -1 })
    .limit(5);

  // Get low stock products
  const lowStockProducts = await Product.find({ stock: { $lte: 10 } })
    .select('name stock price')
    .limit(10);

  // Get top selling products
  const topSellingProducts = await Order.aggregate([
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        totalSold: { $sum: '$items.quantity' },
        totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
      }
    },
    { $sort: { totalSold: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: '$product' },
    {
      $project: {
        name: '$product.name',
        totalSold: 1,
        totalRevenue: 1
      }
    }
  ]);

  // Get monthly revenue
  const currentDate = new Date();
  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  const monthlyRevenue = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        status: { $ne: 'cancelled' }
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$totalAmount' },
        orderCount: { $sum: 1 }
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      counts: {
        users: userCount,
        products: productCount,
        orders: orderCount,
        categories: categoryCount,
        reviews: reviewCount
      },
      recentOrders,
      lowStockProducts,
      topSellingProducts,
      monthlyRevenue: monthlyRevenue[0] || { totalRevenue: 0, orderCount: 0 }
    }
  });
}));

/**
 * @swagger
 * /admin/analytics:
 *   get:
 *     summary: Get detailed analytics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *     responses:
 *       200:
 *         description: Analytics retrieved successfully
 */
router.get('/analytics', asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;
  
  let days;
  switch (period) {
    case '7d':
      days = 7;
      break;
    case '30d':
      days = 30;
      break;
    case '90d':
      days = 90;
      break;
    case '1y':
      days = 365;
      break;
    default:
      days = 30;
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Revenue analytics
  const revenueAnalytics = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
        status: { $ne: 'cancelled' }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        revenue: { $sum: '$totalAmount' },
        orders: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
  ]);

  // User registration analytics
  const userAnalytics = await User.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        registrations: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
  ]);

  // Product performance
  const productPerformance = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
        status: { $ne: 'cancelled' }
      }
    },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        totalSold: { $sum: '$items.quantity' },
        totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
      }
    },
    { $sort: { totalSold: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: '$product' },
    {
      $project: {
        name: '$product.name',
        totalSold: 1,
        totalRevenue: 1
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      revenueAnalytics,
      userAnalytics,
      productPerformance
    }
  });
}));

/**
 * @swagger
 * /admin/users/statistics:
 *   get:
 *     summary: Get user statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User statistics retrieved successfully
 */
router.get('/users/statistics', asyncHandler(async (req, res) => {
  const totalUsers = await User.countDocuments();
  const activeUsers = await User.countDocuments({ isActive: true });
  const customers = await User.countDocuments({ role: 'customer' });
  const admins = await User.countDocuments({ role: 'admin' });

  // Users by month
  const usersByMonth = await User.aggregate([
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
    { $limit: 12 }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      totalUsers,
      activeUsers,
      customers,
      admins,
      usersByMonth
    }
  });
}));

/**
 * @swagger
 * /admin/orders/statistics:
 *   get:
 *     summary: Get order statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Order statistics retrieved successfully
 */
router.get('/orders/statistics', asyncHandler(async (req, res) => {
  const totalOrders = await Order.countDocuments();
  const pendingOrders = await Order.countDocuments({ status: 'pending' });
  const processingOrders = await Order.countDocuments({ status: 'processing' });
  const shippedOrders = await Order.countDocuments({ status: 'shipped' });
  const deliveredOrders = await Order.countDocuments({ status: 'delivered' });
  const cancelledOrders = await Order.countDocuments({ status: 'cancelled' });

  // Total revenue
  const totalRevenue = await Order.aggregate([
    { $match: { status: { $ne: 'cancelled' } } },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
  ]);

  // Orders by status
  const ordersByStatus = await Order.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      totalOrders,
      pendingOrders,
      processingOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      totalRevenue: totalRevenue[0]?.total || 0,
      ordersByStatus
    }
  });
}));

/**
 * @swagger
 * /admin/products/statistics:
 *   get:
 *     summary: Get product statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Product statistics retrieved successfully
 */
router.get('/products/statistics', asyncHandler(async (req, res) => {
  const totalProducts = await Product.countDocuments();
  const activeProducts = await Product.countDocuments({ isActive: true });
  const featuredProducts = await Product.countDocuments({ isFeatured: true });
  const outOfStockProducts = await Product.countDocuments({ stock: 0 });
  const lowStockProducts = await Product.countDocuments({ stock: { $lte: 10, $gt: 0 } });

  // Products by category
  const productsByCategory = await Product.aggregate([
    {
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        as: 'category'
      }
    },
    { $unwind: '$category' },
    {
      $group: {
        _id: '$category.name',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      totalProducts,
      activeProducts,
      featuredProducts,
      outOfStockProducts,
      lowStockProducts,
      productsByCategory
    }
  });
}));

export default router; 