# Ecommerce Backend API

A comprehensive, scalable ecommerce backend built with Express.js, MongoDB, and advanced system design patterns. This API provides complete functionality for an ecommerce platform with separate admin and customer modules.

## 🚀 Features

### Core Features
- **User Authentication & Authorization**: JWT-based authentication with role-based access control
- **Product Management**: Complete CRUD operations with categories, inventory tracking, and search
- **Order Management**: Comprehensive order processing with status tracking
- **Review System**: Product reviews with rating and moderation features
- **Admin Dashboard**: Analytics, statistics, and administrative functions
- **Customer Portal**: Personal dashboard, order history, and profile management

### Advanced Features
- **Modular Architecture**: Clean separation of concerns with organized code structure
- **Comprehensive Validation**: Input validation using express-validator
- **Error Handling**: Centralized error handling with proper logging
- **Rate Limiting**: API rate limiting for security
- **Security**: Helmet, CORS, XSS protection, and MongoDB sanitization
- **Logging**: Winston-based logging with different levels
- **Email Integration**: Transactional emails for order confirmations and notifications
- **Swagger Documentation**: Complete API documentation with interactive testing

## 🏗️ System Architecture

```
src/
├── config/           # Configuration files
│   ├── database.js   # MongoDB connection
│   ├── logger.js     # Winston logging setup
│   └── swagger.js    # Swagger documentation config
├── middleware/       # Custom middleware
│   ├── auth.js       # JWT authentication & authorization
│   ├── errorHandler.js # Global error handling
│   ├── notFound.js   # 404 handler
│   └── validation.js # Input validation
├── models/          # Mongoose models
│   ├── User.js      # User model with auth methods
│   ├── Product.js   # Product model with search
│   ├── Order.js     # Order model with status tracking
│   ├── Category.js  # Category model with hierarchy
│   └── Review.js    # Review model with moderation
├── routes/          # API routes
│   ├── auth.js      # Authentication routes
│   ├── users.js     # User management
│   ├── products.js  # Product management
│   ├── orders.js    # Order management
│   ├── categories.js # Category management
│   ├── reviews.js   # Review management
│   ├── admin.js     # Admin-specific routes
│   └── customers.js # Customer-specific routes
├── utils/           # Utility functions
│   └── email.js     # Email service
└── app.js          # Main application file
```

## 🛠️ Technology Stack

- **Runtime**: Node.js (ES6+)
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: express-validator
- **Security**: bcryptjs, helmet, cors, rate-limiting
- **Logging**: Winston
- **Documentation**: Swagger/OpenAPI
- **Email**: Nodemailer

## 📋 Prerequisites

- Node.js (v18 or higher)
- MongoDB Atlas account
- npm or yarn package manager

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ecommerce-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp env.example .env
   ```
   
   Update the `.env` file with your configuration:
   ```env
   # Server Configuration
   NODE_ENV=development
   PORT=3000

   # MongoDB Configuration
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ecommerce?retryWrites=true&w=majority

   # JWT Configuration
   JWT_SECRET=your-super-secret-jwt-key-here
   JWT_EXPIRES_IN=7d

   # Email Configuration
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   ```

4. **Start the server**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api
```

### Interactive Documentation
Access the Swagger UI at: `http://localhost:3000/api-docs`

### Authentication
All protected routes require a Bearer token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## 🔐 Authentication Endpoints

### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "Password123",
  "role": "customer"
}
```

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "Password123"
}
```

### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```

## 🛍️ Product Endpoints

### Get All Products
```http
GET /api/products?page=1&limit=20&category=electronics&search=laptop&minPrice=100&maxPrice=1000&sort=price_asc
```

### Get Product by ID
```http
GET /api/products/:id
```

### Create Product (Admin)
```http
POST /api/products
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "name": "Laptop",
  "description": "High-performance laptop",
  "price": 999.99,
  "category": "category-id",
  "stock": 50,
  "images": ["image1.jpg", "image2.jpg"]
}
```

## 📦 Order Endpoints

### Create Order (Customer)
```http
POST /api/orders
Authorization: Bearer <customer-token>
Content-Type: application/json

{
  "items": [
    {
      "product": "product-id",
      "quantity": 2
    }
  ],
  "shippingAddress": {
    "name": "John Doe",
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "phone": "+1234567890"
  },
  "paymentMethod": "credit_card"
}
```

### Get User Orders
```http
GET /api/orders?page=1&limit=10&status=pending
Authorization: Bearer <token>
```

## 👥 User Management

### Get All Users (Admin)
```http
GET /api/users?page=1&limit=10&role=customer&isActive=true
Authorization: Bearer <admin-token>
```

### Update User Profile
```http
PUT /api/users/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Name",
  "phone": "+1234567890",
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001"
  }
}
```

## 📊 Admin Dashboard

### Get Dashboard Statistics
```http
GET /api/admin/dashboard
Authorization: Bearer <admin-token>
```

### Get Analytics
```http
GET /api/admin/analytics?period=30d
Authorization: Bearer <admin-token>
```

## 🛒 Customer Features

### Get Customer Dashboard
```http
GET /api/customers/dashboard
Authorization: Bearer <customer-token>
```

### Get Customer Orders
```http
GET /api/customers/orders?page=1&limit=10
Authorization: Bearer <customer-token>
```

## ⭐ Review System

### Create Review
```http
POST /api/reviews
Authorization: Bearer <customer-token>
Content-Type: application/json

{
  "product": "product-id",
  "rating": 5,
  "title": "Great Product!",
  "comment": "Excellent quality and fast delivery"
}
```

### Get Product Reviews
```http
GET /api/reviews/product/:productId?page=1&limit=10
```

## 🔧 Development

### Available Scripts
```bash
# Start development server
npm run dev

# Start production server
npm start

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `3000` |
| `MONGODB_URI` | MongoDB connection string | - |
| `JWT_SECRET` | JWT signing secret | - |
| `JWT_EXPIRES_IN` | JWT expiration time | `7d` |
| `SMTP_HOST` | SMTP server host | - |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USER` | SMTP username | - |
| `SMTP_PASS` | SMTP password | - |

## 🚀 Deployment

### Production Checklist
1. Set `NODE_ENV=production`
2. Configure MongoDB Atlas connection
3. Set strong JWT secret
4. Configure email service
5. Set up proper logging
6. Configure rate limiting
7. Set up monitoring and health checks

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Role-based Access Control**: Admin and customer role separation
- **Input Validation**: Comprehensive request validation
- **Rate Limiting**: API rate limiting to prevent abuse
- **Security Headers**: Helmet for security headers
- **CORS Protection**: Cross-origin resource sharing protection
- **XSS Protection**: XSS attack prevention
- **MongoDB Sanitization**: NoSQL injection protection
- **Password Hashing**: bcryptjs for secure password storage

## 📈 Performance Features

- **Database Indexing**: Optimized MongoDB queries
- **Pagination**: Efficient data pagination
- **Compression**: Response compression
- **Caching Ready**: Redis integration ready
- **Async Operations**: Non-blocking I/O operations

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the API documentation at `/api-docs`
- Review the code comments for implementation details

## 🔮 Future Enhancements

- [ ] Payment gateway integration (Stripe, PayPal)
- [ ] Real-time notifications (WebSocket)
- [ ] Advanced search with Elasticsearch
- [ ] Image upload and CDN integration
- [ ] Multi-language support
- [ ] Advanced analytics and reporting
- [ ] Mobile app API optimization
- [ ] Microservices architecture
- [ ] GraphQL API
- [ ] Advanced caching with Redis 