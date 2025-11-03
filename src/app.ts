import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import productRoutes from './routes/productRoutes';
import checkoutRoutes from './routes/checkoutRoutes';
import shareRoutes from './routes/shareRoutes';
import dotenv from 'dotenv';
import { connectToDatabase } from './utils/connection';

dotenv.config();

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'];
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Connect to database before handling requests
app.use(async (req, res, next) => {
    try {
        await connectToDatabase();
        next();
    } catch (error) {
        next(error);
    }
});

app.use("/api/v1/products", productRoutes);
app.use("/api/v1/checkout", checkoutRoutes);
app.use('/api/v1', shareRoutes);

app.use(errorHandler); 

export default app;
