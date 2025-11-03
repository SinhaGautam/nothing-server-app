import app from './app'
import dotenv from 'dotenv';


dotenv.config();
if (process.env.NODE_ENV !== 'production') {
    const PORT = parseInt(process.env.PORT || '3000', 10);
    const host = `0.0.0.0`;

    app.listen(PORT, host, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

// Handle serverless function errors
app.use((err: any, req: any, res: any, next: any) => {
    console.error(err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

export default app;