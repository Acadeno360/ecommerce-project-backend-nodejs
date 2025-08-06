import nodemailer from 'nodemailer';
import { logger } from '../config/logger.js';

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Send email
export const sendEmail = async (options) => {
  try {
    const transporter = createTransporter();

    const message = {
      from: `${process.env.SMTP_FROM_NAME || 'Ecommerce Store'} <${process.env.SMTP_USER}>`,
      to: options.email,
      subject: options.subject,
      text: options.message,
      html: options.html
    };

    const info = await transporter.sendMail(message);

    logger.info(`Email sent: ${info.messageId}`);

    return info;
  } catch (error) {
    logger.error('Email sending failed:', error);
    throw new Error('Email could not be sent');
  }
};

// Send welcome email
export const sendWelcomeEmail = async (user) => {
  const subject = 'Welcome to Our Ecommerce Store!';
  const message = `
    Hi ${user.name},
    
    Welcome to our ecommerce store! We're excited to have you as a customer.
    
    You can now:
    - Browse our products
    - Place orders
    - Track your shipments
    - Write reviews
    
    If you have any questions, feel free to contact our support team.
    
    Best regards,
    The Ecommerce Team
  `;

  await sendEmail({
    email: user.email,
    subject,
    message
  });
};

// Send order confirmation email
export const sendOrderConfirmationEmail = async (user, order) => {
  const subject = `Order Confirmation - ${order.orderNumber}`;
  const message = `
    Hi ${user.name},
    
    Thank you for your order! Here are your order details:
    
    Order Number: ${order.orderNumber}
    Order Date: ${new Date(order.createdAt).toLocaleDateString()}
    Total Amount: $${order.totalAmount}
    
    Order Status: ${order.status}
    
    We'll send you updates as your order progresses.
    
    Best regards,
    The Ecommerce Team
  `;

  await sendEmail({
    email: user.email,
    subject,
    message
  });
};

// Send password reset email
export const sendPasswordResetEmail = async (user, resetToken) => {
  const subject = 'Password Reset Request';
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
  
  const message = `
    Hi ${user.name},
    
    You requested a password reset. Please click the link below to reset your password:
    
    ${resetUrl}
    
    This link will expire in 10 minutes.
    
    If you didn't request this, please ignore this email.
    
    Best regards,
    The Ecommerce Team
  `;

  await sendEmail({
    email: user.email,
    subject,
    message
  });
};

// Send order status update email
export const sendOrderStatusUpdateEmail = async (user, order) => {
  const subject = `Order Status Update - ${order.orderNumber}`;
  const message = `
    Hi ${user.name},
    
    Your order status has been updated:
    
    Order Number: ${order.orderNumber}
    New Status: ${order.status}
    
    ${order.trackingNumber ? `Tracking Number: ${order.trackingNumber}` : ''}
    ${order.trackingUrl ? `Tracking URL: ${order.trackingUrl}` : ''}
    
    Best regards,
    The Ecommerce Team
  `;

  await sendEmail({
    email: user.email,
    subject,
    message
  });
}; 