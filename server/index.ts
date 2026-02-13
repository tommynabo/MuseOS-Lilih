import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes';
import { initializeSchedules } from './services/schedulerService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Initialize schedules when server starts
initializeSchedules().catch(err => {
  console.error('Failed to initialize schedules:', err);
});

// For local development
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Export for Vercel
export default app;
