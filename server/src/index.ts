import express from 'express';
import cors from 'cors';
import authRoutes         from './routes/auth.js';
import spacesRoutes       from './routes/spaces.js';
import productsRoutes     from './routes/products.js';
import bookingsRoutes     from './routes/bookings.js';
import notificationsRoutes from './routes/notifications.js';
import filesRoutes        from './routes/files.js';

const app  = express();
const PORT = Number(process.env.PORT ?? 3000);

app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }));
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/auth',          authRoutes);
app.use('/spaces',        spacesRoutes);
app.use('/products',      productsRoutes);
app.use('/bookings',      bookingsRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/',              filesRoutes);

app.listen(PORT, () => {
  console.log(`Kistle API läuft auf Port ${PORT}`);
});
