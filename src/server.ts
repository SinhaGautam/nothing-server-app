import app from './app'
import dotenv from 'dotenv';


dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);
const host = `0.0.0.0`;

app.listen(PORT, host, () => {
    console.log(`Server running on port ${PORT}`);
});
