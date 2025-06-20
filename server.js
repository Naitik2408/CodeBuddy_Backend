const express = require('express');
const app = express();
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config({ path: '../.env'});

const { apiLimiter } = require('./middlewares/rateLimiter');

// Security middleware
app.use(helmet());

// Multiple client URLs configuration
const allowedOrigins = [
  process.env.CLIENT_URL, 
  process.env.CLIENT_URL_2,
  process.env.CLIENT_URL_3
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`Blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count'] // If you need to expose custom headers
}));

// Logging
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use('/api', apiLimiter);

// Routes
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/groups', require('./routes/groupRoutes'));
app.use('/api/questions', require('./routes/questionRoutes'));
app.use('/api/feedback', require('./routes/feedbackRoutes'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    allowedOrigins: allowedOrigins.length,
    environment: process.env.NODE_ENV || 'development'
  });
});

// CORS info endpoint (for debugging)
app.get('/api/cors-info', (req, res) => {
  res.status(200).json({ 
    allowedOrigins: allowedOrigins,
    requestOrigin: req.headers.origin,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error(error.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV !== 'production' ? error.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

console.log('mongodb: ', process.env.MONGO_URI);
console.log('Allowed Origins:', allowedOrigins);

// Database connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/code-collab-platform')
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`CORS enabled for ${allowedOrigins.length} origins`);
});