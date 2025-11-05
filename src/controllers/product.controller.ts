import mongoose from 'mongoose';
import { ApiResponse } from '../utils/apiResponse';
import { logger } from '../utils/logger';
import { ProductModel } from './../models/model';
import { Request, Response } from 'express';


export class ProductController {
    /**
     *
     */
    constructor() { }

    async getProduct(req: Request, res: Response) {
        try {
            logger.info('Fetching products with query:', req.query);
            const { featured } = req.query;
            let query : any= {};
            if (featured) {
                query.featured = featured === 'true';
            }
            
            const products = await ProductModel.find(query);
            if (products.length === 0) {
                logger.warn('No products found with the given query:', req.query);
                return new ApiResponse(res).notFound('No products found');
            }
            logger.info('Products fetched successfully.', products);
            new ApiResponse(res).success('Products fetched successfully', products);
        } catch (error) {
            logger.error('Error fetching products:', error);
            new ApiResponse(res).error('Error fetching products');
        }
    };

    async getProductById(req: Request, res: Response) {
        try {
            logger.info(`Fetching product with ID: ${req.params.id}`);
            const products = await ProductModel.findById(req.params.id);
            if (!products) {
                logger.warn(`Product with ID: ${req.params.id} not found`);
                return new ApiResponse(res).notFound('Product not found');
            }
            logger.info('Product fetched successfully.');
            new ApiResponse(res).success('Product fetched successfully', products);
        } catch (error) {
            logger.error('Error fetching products', error)
            new ApiResponse(res).error('Error fetching product');
        }
    };
}