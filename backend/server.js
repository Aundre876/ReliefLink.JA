const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS: Allow React frontend (ports 3000, 3001, 3002) to send requests
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'RescueNet backend running' });
});

// POST /shipments - Create shipment
app.post('/shipments', (req, res) => {
  const { pickup, destination, packageType, packageSize, priority, deadline, distanceKm, etaMinutes } = req.body;
  const id = `RN-JM-${Date.now()}`;
  res.status(201).json({
    id,
    pickup,
    destination,
    package_type: packageType,
    package_size: packageSize,
    priority,
    deadline,
    distance_km: distanceKm,
    eta_minutes: etaMinutes,
    status: 'Processed',
    created_at: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`RescueNet backend listening on http://localhost:${PORT}`);
});
