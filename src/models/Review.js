import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Please add user']
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Please add product']
  },
  rating: {
    type: Number,
    required: [true, 'Please add a rating'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },
  title: {
    type: String,
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  comment: {
    type: String,
    required: [true, 'Please add a comment'],
    trim: true,
    maxlength: [500, 'Comment cannot be more than 500 characters']
  },
  images: [{
    type: String
  }],
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  helpful: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    helpful: {
      type: Boolean,
      default: true
    }
  }],
  reported: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      enum: ['inappropriate', 'spam', 'fake', 'other']
    },
    comment: String
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for helpful count
reviewSchema.virtual('helpfulCount').get(function() {
  return this.helpful.filter(h => h.helpful).length;
});

// Virtual for unhelpful count
reviewSchema.virtual('unhelpfulCount').get(function() {
  return this.helpful.filter(h => !h.helpful).length;
});

// Virtual for reported count
reviewSchema.virtual('reportedCount').get(function() {
  return this.reported.length;
});

// Compound index to ensure one review per user per product
reviewSchema.index({ user: 1, product: 1 }, { unique: true });

// Indexes for better query performance
reviewSchema.index({ product: 1 });
reviewSchema.index({ user: 1 });
reviewSchema.index({ rating: 1 });
reviewSchema.index({ isActive: 1 });
reviewSchema.index({ createdAt: -1 });

// Pre-save middleware to update product average rating
reviewSchema.post('save', async function() {
  const Product = mongoose.model('Product');
  const product = await Product.findById(this.product);
  if (product) {
    await product.updateAverageRating();
  }
});

// Pre-remove middleware to update product average rating
reviewSchema.post('remove', async function() {
  const Product = mongoose.model('Product');
  const product = await Product.findById(this.product);
  if (product) {
    await product.updateAverageRating();
  }
});

// Static method to get reviews by product
reviewSchema.statics.getReviewsByProduct = function(productId, limit = 10, skip = 0) {
  return this.find({ product: productId, isActive: true })
    .populate('user', 'name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to get reviews by user
reviewSchema.statics.getReviewsByUser = function(userId, limit = 10, skip = 0) {
  return this.find({ user: userId })
    .populate('product', 'name images')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Instance method to mark as helpful/unhelpful
reviewSchema.methods.markHelpful = async function(userId, helpful) {
  const existingIndex = this.helpful.findIndex(h => h.user.toString() === userId.toString());
  
  if (existingIndex > -1) {
    this.helpful[existingIndex].helpful = helpful;
  } else {
    this.helpful.push({ user: userId, helpful });
  }
  
  await this.save();
};

// Instance method to report review
reviewSchema.methods.reportReview = async function(userId, reason, comment) {
  const existingReport = this.reported.find(r => r.user.toString() === userId.toString());
  
  if (existingReport) {
    existingReport.reason = reason;
    existingReport.comment = comment;
  } else {
    this.reported.push({ user: userId, reason, comment });
  }
  
  await this.save();
};

export default mongoose.model('Review', reviewSchema); 