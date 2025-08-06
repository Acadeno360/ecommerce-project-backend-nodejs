import express from 'express';
import asyncHandler from 'express-async-handler';

import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { protect, admin, customer } from '../middleware/auth.js';
import { validateOrder } from '../middleware/validation.js';
import { sendOrderConfirmationEmail, sendOrderStatusUpdateEmail } from '../utils/email.js';

const router = express.Router();

/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: Get user orders (Customer) or all orders (Admin)
 *     tags: [Orders]
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
 *         description: Orders retrieved successfully
 */
router.get('/', protect, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter = {};
  
  // If customer, only show their orders
  if (req.user.role === 'customer') {
    filter.user = req.user.id;
  }
  
  if (req.query.status) {
    filter.status = req.query.status;
  }

  const orders = await Order.find(filter)
    .populate('user', 'name email')
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
 * /api/orders/{id}:
 *   get:
 *     summary: Get order by ID
 *     tags: [Orders]
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
 *         description: Order retrieved successfully
 *       404:
 *         description: Order not found
 */
router.get('/:id', protect, asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('user', 'name email')
    .populate('items.product', 'name images price');

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  // Check if user can access this order
  if (req.user.role === 'customer' && order.user.toString() !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to access this order');
  }

  res.status(200).json({
    status: 'success',
    data: order
  });
}));

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Create new order (Customer only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Order'
 *     responses:
 *       201:
 *         description: Order created successfully
 *       400:
 *         description: Validation error
 */
router.post('/', protect, customer, validateOrder, asyncHandler(async (req, res) => {
  const { items, shippingAddress, paymentMethod, notes } = req.body;

  // Validate products and calculate totals
  let totalAmount = 0;
  const orderItems = [];

  for (const item of items) {
    const product = await Product.findById(item.product);
    
    if (!product) {
      res.status(404);
      throw new Error(`Product ${item.product} not found`);
    }

    if (!product.isActive) {
      res.status(400);
      throw new Error(`Product ${product.name} is not available`);
    }

    if (product.stock < item.quantity) {
      res.status(400);
      throw new Error(`Insufficient stock for ${product.name}`);
    }

    // Update product stock
    product.stock -= item.quantity;
    await product.save();

    orderItems.push({
      product: product._id,
      name: product.name,
      quantity: item.quantity,
      price: product.price,
      image: product.images[0]
    });

    totalAmount += product.price * item.quantity;
  }

  // Create order
  const order = await Order.create({
    user: req.user.id,
    items: orderItems,
    totalAmount,
    shippingAddress,
    paymentMethod,
    notes
  });

  // Populate order for response
  await order.populate('user', 'name email');
  await order.populate('items.product', 'name images price');

  // Send confirmation email
  try {
    await sendOrderConfirmationEmail(req.user, order);
  } catch (error) {
    console.error('Failed to send order confirmation email:', error);
  }

  res.status(201).json({
    status: 'success',
    data: order
  });
}));

/**
 * @swagger
 * /api/orders/{id}/cancel:
 *   post:
 *     summary: Cancel order (Customer or Admin)
 *     tags: [Orders]
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
 *               reason:
 *                 type: string
 *                 description: Cancellation reason
 *     responses:
 *       200:
 *         description: Order cancelled successfully
 *       404:
 *         description: Order not found
 */
router.post('/:id/cancel', protect, asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  // Check if user can cancel this order
  if (req.user.role === 'customer' && order.user.toString() !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to cancel this order');
  }

  await order.cancelOrder(req.user.id, reason);

  res.status(200).json({
    status: 'success',
    message: 'Order cancelled successfully',
    data: order
  });
}));

/**
 * @swagger
 * /api/orders/{id}/status:
 *   put:
 *     summary: Update order status (Admin only)
 *     tags: [Orders]
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
 *               status:
 *                 type: string
 *                 enum: [processing, shipped, delivered]
 *               trackingNumber:
 *                 type: string
 *               trackingUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Order status updated successfully
 *       404:
 *         description: Order not found
 */
router.put('/:id/status', protect, admin, asyncHandler(async (req, res) => {
  const { status, trackingNumber, trackingUrl } = req.body;

  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  order.status = status;
  if (trackingNumber) order.trackingNumber = trackingNumber;
  if (trackingUrl) order.trackingUrl = trackingUrl;

  await order.save();

  // Send status update email
  try {
    await sendOrderStatusUpdateEmail(order.user, order);
  } catch (error) {
    console.error('Failed to send status update email:', error);
  }

  res.status(200).json({
    status: 'success',
    message: 'Order status updated successfully',
    data: order
  });
}));

export default router; 