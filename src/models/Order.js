import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     Order:
 *       type: object
 *       required:
 *         - user
 *         - items
 *         - totalAmount
 *         - shippingAddress
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated unique identifier
 *         user:
 *           type: string
 *           description: User ID who placed the order
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               product:
 *                 type: string
 *                 description: Product ID
 *               quantity:
 *                 type: number
 *                 description: Quantity ordered
 *               price:
 *                 type: number
 *                 description: Price at time of order
 *         totalAmount:
 *           type: number
 *           description: Total order amount
 *         status:
 *           type: string
 *           enum: [pending, processing, shipped, delivered, cancelled]
 *           description: Order status
 *         paymentStatus:
 *           type: string
 *           enum: [pending, paid, failed, refunded]
 *           description: Payment status
 *         shippingAddress:
 *           type: object
 *           description: Shipping address
 *         trackingNumber:
 *           type: string
 *           description: Shipping tracking number
 *         notes:
 *           type: string
 *           description: Order notes
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1']
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Price must be positive']
  },
  image: {
    type: String
  }
}, { _id: false });

const shippingAddressSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add recipient name']
  },
  street: {
    type: String,
    required: [true, 'Please add street address']
  },
  city: {
    type: String,
    required: [true, 'Please add city']
  },
  state: {
    type: String,
    required: [true, 'Please add state']
  },
  zipCode: {
    type: String,
    required: [true, 'Please add zip code']
  },
  country: {
    type: String,
    required: [true, 'Please add country'],
    default: 'USA'
  },
  phone: {
    type: String,
    required: [true, 'Please add phone number']
  }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Please add user']
  },
  items: [orderItemSchema],
  totalAmount: {
    type: Number,
    required: [true, 'Please add total amount'],
    min: [0, 'Total amount must be positive']
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: [0, 'Tax amount must be positive']
  },
  shippingAmount: {
    type: Number,
    default: 0,
    min: [0, 'Shipping amount must be positive']
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: [0, 'Discount amount must be positive']
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'paypal', 'stripe', 'cash_on_delivery'],
    required: [true, 'Please add payment method']
  },
  paymentIntentId: {
    type: String
  },
  shippingAddress: {
    type: shippingAddressSchema,
    required: [true, 'Please add shipping address']
  },
  trackingNumber: {
    type: String
  },
  trackingUrl: {
    type: String
  },
  estimatedDelivery: {
    type: Date
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot be more than 500 characters']
  },
  cancelledAt: {
    type: Date
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancellationReason: {
    type: String
  },
  refundAmount: {
    type: Number,
    default: 0,
    min: [0, 'Refund amount must be positive']
  },
  refundedAt: {
    type: Date
  },
  refundedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for order number
orderSchema.virtual('orderNumber').get(function() {
  return `ORD-${this._id.toString().slice(-8).toUpperCase()}`;
});

// Virtual for subtotal
orderSchema.virtual('subtotal').get(function() {
  return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
});

// Virtual for final total
orderSchema.virtual('finalTotal').get(function() {
  return this.totalAmount + this.taxAmount + this.shippingAmount - this.discountAmount;
});

// Indexes for better query performance
orderSchema.index({ user: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });

// Pre-save middleware to calculate totals
orderSchema.pre('save', function(next) {
  if (this.isModified('items')) {
    const subtotal = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    this.totalAmount = subtotal;
  }
  next();
});

// Static method to get orders by user
orderSchema.statics.getOrdersByUser = function(userId, limit = 10, skip = 0) {
  return this.find({ user: userId })
    .populate('user', 'name email')
    .populate('items.product', 'name images')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Instance method to cancel order
orderSchema.methods.cancelOrder = async function(userId, reason) {
  if (this.status === 'cancelled') {
    throw new Error('Order is already cancelled');
  }
  
  if (this.status === 'delivered') {
    throw new Error('Cannot cancel delivered order');
  }

  this.status = 'cancelled';
  this.cancelledAt = new Date();
  this.cancelledBy = userId;
  this.cancellationReason = reason;

  // Update product stock
  const Product = mongoose.model('Product');
  for (const item of this.items) {
    await Product.findByIdAndUpdate(item.product, {
      $inc: { stock: item.quantity }
    });
  }

  await this.save();
};

export default mongoose.model('Order', orderSchema); 