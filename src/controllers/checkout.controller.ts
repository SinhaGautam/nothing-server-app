import { OrderConfirmSchema, PaymentDetailsSchema, Product } from './../schema/index';
import { Request, Response } from 'express';
import { CheckoutSchema } from '../schema';
import { sendConfirmationEmail } from '../utils/emailService';
import { v4 as uuidv4 } from 'uuid';
import { ProductModel, OrderModel } from '../models/model';
import { logger } from '../utils/logger';
import { ApiResponse } from '../utils/apiResponse';
import mongoose from 'mongoose';
import Razorpay from 'razorpay';
import crypto from 'crypto';

export class CheckoutController {

  /**
   * Handles the complete checkout process including:
   * - Request validation
   * - Product availability check
   * - Payment gateway integration
   * - Order creation
   * - Email notification
   * - Proper error handling and rollback mechanisms
   */
  constructor() { }

  // Initialize Razorpay with environment variables
  private readonly razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });


  async handleCheckout(req: Request, res: Response) {
    // Validate request body against schema
    logger.info('Initiating checkout process');
    const result = CheckoutSchema.safeParse(req.body);
    if (!result.success) {
      logger.error('CheckOut validation failed: ', result.error)
      new ApiResponse(res).error('CheckOut validation failed');
      return;
    }

    const { productId, customerEmail, customerName } = result.data;
    const receipt = uuidv4();
    logger.debug(`Processing checkout for productId: ${productId}`);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {

      // 1. Validate and fetch product details
      const product = await this.validateAndFetchProduct(productId, session);
      if (!product) {
        throw new Error('Product validation failed during checkout');
      }
      logger.debug(`Product validated: ${product.name} at price ${product.price}`);

      // 2. Create payment order with Razorpay
      const razorpayOrder = await this.createRazorpayOrder(
        product,
        customerName,
        customerEmail,
        receipt
      );
      if (!razorpayOrder) {
        throw new Error('Razorpay order creation failed during checkout');
      }
      logger.debug(`Razorpay order created with ID: ${razorpayOrder.id}`);

      // 3. Create order record in database
      const order = await this.createOrderRecord(
        product,
        customerEmail,
        customerName,
        razorpayOrder.id,
        session
      );
      if (!order) {
        throw new Error('Order creation failed during checkout');
      }
      logger.debug(`Order record created with Order ID: ${order.orderId}`);

      // 4. Commit transaction if all operations succeed
      await session.commitTransaction();
      logger.info(`Order ${order.orderId} created successfully`);

      return new ApiResponse(res).success('Checkout successful', razorpayOrder);

    } catch (error) {

      // Handle transaction rollback and error cases
      await session.abortTransaction();
      logger.error('Checkout failed:', error);
      if (error instanceof Error) {
        // Handle specific error types with appropriate responses
        if (error.message.includes('Product')) {
          return new ApiResponse(res).error(error.message);
        }

        if (error.message.includes('Razorpay')) {
          return new ApiResponse(res).error('Payment service unavailable');
        }
      }

      // Generic error response for unexpected errors
      return new ApiResponse(res).error('Checkout process failed');
    }
    finally {
      // Ensure session is always ended
      logger.debug('Ending database session for checkout process');
      session.endSession();
    }
  }

  async validatePayment(req: Request, res: Response) {

    logger.info('Validating payment request received.');
    const result = PaymentDetailsSchema.safeParse(req.body);
    if (!result.success) {
      logger.error('Payment Request validation failed: ', result.error)
      return new ApiResponse(res).error('Payment Request validation failed');

    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    try {
      logger.info('Verifying payment signature...');
      // Verify the signature
      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature !== razorpay_signature) {
        return new ApiResponse(res).error('Invalid signature');
      }
      logger.info('Payment signature verified successfully.');
      return new ApiResponse(res).success('Payment Validated');
    } catch (error) {
      logger.error('Payment verification error:', error);
      return new ApiResponse(res).error('Verification failed');
    }
  }

  async confirmOrder(req: Request, res: Response) {

    logger.info('Confirming order request received.');
    const result = OrderConfirmSchema.safeParse(req.body);
    if (!result.success) {
      logger.error('OrderConfirmSchema validation failed: ', result.error)
      return new ApiResponse(res).error('Order Confirm Request validation failed');
    }
    try {
      logger.info('Validating payment details...');
      const { customerName, customerEmail, productId, paymentDetails:
        {
          razorpay_payment_id,
          razorpay_order_id,
          razorpay_signature
        }
      } = req.body;

      const product = await ProductModel.findById(productId)
        .select('name price category inventory isActive')
        .lean()
        .exec();

      if (!product) {
        logger.error('Product not found during order confirmation.');
        return new ApiResponse(res).error('Order not found');
      } 
      const order = await OrderModel.findOne({ orderId: razorpay_order_id }).exec();
      if (!order) {
        logger.error('Order not found during order confirmation.');
        return new ApiResponse(res).error('Order not found');
      } else {
        logger.info('Order details validated successfully.');
        const productObj = product;
        this.sendConfirmationEmailAsync(
          customerEmail,
          customerName,
          productObj.name,
          razorpay_order_id
        );
        const result = {
          product: productObj.name,
          amount: productObj.price,
          orderNumber: razorpay_order_id
        }
        return new ApiResponse(res).success('Order confirmed',result)
      }

    } catch (error) {
      logger.error('Order confirmation error:', error);
      return new ApiResponse(res).error('Something Went wrong');
    }
  }

  /**
   * Validates and fetches product details
   * @param productId MongoDB product ID
   * @param session MongoDB session for transaction
   * @throws Error if product is invalid or unavailable
   */
  private async validateAndFetchProduct(
    productId: string,
    session: mongoose.ClientSession
  ): Promise<Product> {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new Error('Invalid product ID format');
    }
    logger.info(`Validating product with ID: ${productId}`);
    const product = await ProductModel.findById(productId)
      .session(session)
      .select('name price category inventory isActive')
      .lean()
      .exec();

    if (!product) {
      logger.error('Product not found with ID:', productId);
      throw new Error('Product not found');
    }
    // if (!product.isActive) {
    //   throw new Error('Product is not available for purchase');
    // }

    const productObj = product;

    return {
      _id: productObj._id.toString(),
      name: productObj.name,
      description: productObj.description,
      price: productObj.price,
      category: productObj.category
    };
  }

  /**
   * Creates Razorpay payment order
   * @param product Product details
   * @param customerName Customer name
   * @param customerEmail Customer email
   * @param receipt Unique receipt ID
   * @throws Error if payment gateway request fails
   */
  private async createRazorpayOrder(
    product: Product,
    customerName: string,
    customerEmail: string,
    receipt: string
  ) {
    try {
      logger.info(`Creating Razorpay order for product with ID: ${product._id}, amount: ${product.price}`);
      return await this.razorpay.orders.create({
        amount: product.price,
        currency: 'INR',
        receipt: receipt,
        payment_capture: true, // Auto-capture payment
        notes: {
          productId: product._id ?? null,
          customerName,
          customerEmail,
        },
      });
    } catch (error) {
      logger.error('Razorpay order creation failed:', error);
      throw new Error('Failed to create payment order');
    }
  }

  /**
   * Creates order record in database
   * @param product Product details
   * @param customerEmail Customer email
   * @param customerName Customer name
   * @param razorpayOrderId Razorpay order ID
   * @param session MongoDB session
   */
  private async createOrderRecord(
    product: Product,
    customerEmail: string,
    customerName: string,
    razorpayOrderId: string,
    session: mongoose.ClientSession
  ) {
    logger.info(`Creating order record for Razorpay order ID: ${razorpayOrderId}`);
    const order = new OrderModel({
      orderId: razorpayOrderId,
      productId: product._id,
      productName: product.name,
      productCategory: product.category,
      customerEmail,
      customerName,
      amount: product.price,
      status: 'confirmed',
      paymentStatus: 'pending',
    });

    try {
      logger.info('Saving order record to database...');
      await order.save({ session });
      return order;
    } catch (error) {
      logger.error('Order creation failed:', error);
      throw new Error('Failed to create order record');
    }
  }

  /**
   * Sends confirmation email without waiting for response
   * @param email Customer email
   * @param name Customer name
   * @param productName Product name
   * @param orderId Order ID
   */
  private async sendConfirmationEmailAsync(
    email: string,
    name: string,
    productName: string,
    orderId: string
  ) {
    try {
      await sendConfirmationEmail(email, name, productName, orderId);
    } catch (error) {
      logger.error('Email sending failed:', error);
      // Email failure shouldn't fail the checkout process
    }
  }

};


// async function validateAndFetchProduct(productId: string): Promise<Product> {
//   // Validate product ID format
//   if (!mongoose.Types.ObjectId.isValid(productId)) {
//     throw new Error('Invalid product ID format');
//   }
//   try {
//     // Fetch product from database with proper error handling
//     const product = await ProductModel.findById(productId)
//       .select('name price category isActive')
//       .lean()
//       .exec();

//     if (!product) {
//       throw new Error('Product not found');
//     }
//     if (!product.isActive) {
//       throw new Error('Product is not available');
//     }


//     const productObj = product;

//     return {
//       _id: productObj._id.toString(),
//       name: productObj.name,
//       description: productObj.description,
//       price: productObj.price,
//       category: productObj.category
//     };
//   }
//   catch (err) {
//     logger.error('Error Validating Product:', err);
//     throw new Error('Error Validating Product');
//   }
// }