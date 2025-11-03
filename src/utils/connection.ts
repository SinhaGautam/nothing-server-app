import mongoose from 'mongoose';

let cachedConnection: typeof mongoose | null = null;

export async function connectToDatabase() {
    if (cachedConnection) {
        return cachedConnection;
    }

    const DB = process.env.MONGO_URI?.replace('<PASSWORD>', process.env.DB_PASSWORD!);

    if (!DB) {
        throw new Error('Database connection string not found');
    }

    try {
        const connection = await mongoose.connect(DB);
        cachedConnection = connection;
        return connection;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
    }
}