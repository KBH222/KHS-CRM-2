const express = require('express');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();


const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// JWT secret - in production, use a secure environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'khs-crm-jwt-secret-2024';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'khs-crm-refresh-secret-2024';

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.static(path.join(__dirname, 'frontend/dist')));

// Auth middleware - enforces authentication
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No authorization token provided' });
  }
  
  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    req.userRole = decoded.role;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'KHS CRM API on Railway'
  });
});

// Authentication Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validate input
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with WORKER role by default
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'WORKER'
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    });

    // Generate tokens
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });

    res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check for default admin credentials
    if (email === 'admin@khscrm.com' && password === 'admin123') {
      // Create or get admin user
      let adminUser = await prisma.user.findUnique({
        where: { email: 'admin@khscrm.com' }
      });

      if (!adminUser) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        adminUser = await prisma.user.create({
          data: {
            email: 'admin@khscrm.com',
            password: hashedPassword,
            name: 'Admin',
            role: 'OWNER'
          }
        });
      }

      // Generate tokens for admin
      const token = jwt.sign(
        { userId: adminUser.id, email: adminUser.email, role: adminUser.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      const refreshToken = jwt.sign(
        { userId: adminUser.id },
        JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
      );

      // Store refresh token
      await prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: adminUser.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });

      // Update last login
      await prisma.user.update({
        where: { id: adminUser.id },
        data: { lastLoginAt: new Date() }
      });

      return res.json({
        token,
        refreshToken,
        user: {
          id: adminUser.id,
          email: adminUser.email,
          name: adminUser.name,
          role: adminUser.role
        }
      });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate tokens
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    
    // Check if refresh token exists in database
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true }
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Generate new access token
    const token = jwt.sign(
      { 
        userId: storedToken.user.id, 
        email: storedToken.user.email, 
        role: storedToken.user.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ error: 'Failed to refresh token' });
  }
});

app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      // Remove refresh token from database
      await prisma.refreshToken.deleteMany({
        where: { 
          token: refreshToken,
          userId: req.userId
        }
      });
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

// Check database schema
app.get('/api/check-schema', async (req, res) => {
  try {
    // Try to query a job with photos field
    const testQuery = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Job' 
      AND column_name IN ('photos', 'plans')
    `;
    
    res.json({
      status: 'ok',
      schema: testQuery,
      message: testQuery.length > 0 ? 'Photos/plans columns exist' : 'Photos/plans columns missing - migration needed'
    });
  } catch (error) {
    res.json({
      status: 'error',
      error: error.message,
      message: 'Failed to check schema - migration may be needed'
    });
  }
});

// Test photo size limits
app.post('/api/test-photo-size-limit', async (req, res) => {
  try {
    const { customerId } = req.body;
    if (!customerId) {
      return res.status(400).json({ error: 'customerId required' });
    }
    
    const results = [];
    const sizes = [1, 10, 50, 100, 500, 1000, 5000]; // KB sizes to test
    
    for (const sizeKB of sizes) {
      try {
        // Create a test photo with specific size
        const sizeBytes = sizeKB * 1024;
        const base64Size = Math.floor(sizeBytes * 0.75); // Account for base64 encoding
        const testData = 'A'.repeat(base64Size);
        const testPhoto = {
          id: Date.now(),
          name: `test-${sizeKB}KB.jpg`,
          url: `data:image/jpeg;base64,${testData}`
        };
        
        // Create job with test photo
        const job = await prisma.job.create({
          data: {
            title: `Photo Size Test ${sizeKB}KB`,
            customerId: customerId,
            status: 'QUOTED',
            priority: 'low',
            photos: JSON.stringify([testPhoto])
          }
        });
        
        // Verify it was saved
        const verification = await prisma.job.findUnique({
          where: { id: job.id }
        });
        
        const saved = verification?.photos?.length === job.photos.length;
        
        results.push({
          sizeKB,
          jobId: job.id,
          savedSuccessfully: saved,
          originalLength: job.photos.length,
          verifiedLength: verification?.photos?.length,
          truncated: !saved
        });
        
        // Clean up test job
        await prisma.job.delete({ where: { id: job.id } });
        
      } catch (error) {
        results.push({
          sizeKB,
          savedSuccessfully: false,
          error: error.message
        });
      }
    }
    
    res.json({
      status: 'ok',
      results,
      maxSuccessfulSize: results.filter(r => r.savedSuccessfully).pop()?.sizeKB || 0
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test photo save and retrieve
app.get('/api/test-photo-save/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // First, let's see what's currently in the database
    const currentJob = await prisma.job.findUnique({
      where: { id: jobId }
    });
    
    // Try to update a job with test photo data
    const testPhotos = [{
      id: Date.now(),
      name: 'test-photo.jpg',
      url: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwABmX/9k='
    }];
    
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        photos: JSON.stringify(testPhotos)
      }
    });
    
    // Read it back
    const readJob = await prisma.job.findUnique({
      where: { id: jobId }
    });
    
    res.json({
      status: 'ok',
      message: 'Test photo save successful',
      currentPhotos: currentJob?.photos,
      savedPhotos: readJob.photos,
      parsedPhotos: readJob.photos ? JSON.parse(readJob.photos) : null,
      photosLength: readJob.photos ? readJob.photos.length : 0
    });
  } catch (error) {
    console.error('Test photo save error:', error);
    res.json({
      status: 'error',
      error: error.message,
      stack: error.stack,
      message: 'Failed to save test photo'
    });
  }
});

// Check maximum field size in database
app.get('/api/debug/field-limits', async (req, res) => {
  try {
    // For PostgreSQL, check the maximum size of text fields
    const result = await prisma.$queryRaw`
      SELECT 
        table_name,
        column_name,
        data_type,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'Job' 
      AND column_name IN ('photos', 'plans', 'notes', 'description')
    `;
    
    // Test with a large string
    const testSize = 1024 * 1024; // 1MB
    const testString = 'x'.repeat(testSize);
    
    res.json({
      status: 'ok',
      database: 'PostgreSQL',
      textFieldInfo: result,
      testStringSize: testSize,
      postgresTextLimit: 'PostgreSQL TEXT type can store up to 1GB',
      recommendation: 'Photos should be stored without issue unless hitting 1GB limit'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      error: error.message,
      note: 'Could not determine field limits'
    });
  }
});

// Debug endpoint to check job data
app.get('/api/debug/job/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await prisma.job.findUnique({
      where: { id: jobId }
    });
    
    // If job not found, try to find all jobs to help debug
    let allJobs = [];
    if (!job) {
      allJobs = await prisma.job.findMany({
        select: { id: true, title: true }
      });
    }
    
    res.json({
      requestedJobId: jobId,
      job: job,
      jobFound: !!job,
      photosField: job?.photos,
      photosLength: job?.photos ? job.photos.length : 0,
      parsedPhotos: job?.photos ? JSON.parse(job.photos) : null,
      allJobIds: !job ? allJobs : []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug Express configuration
app.get('/api/debug/express-config', async (req, res) => {
  try {
    res.json({
      status: 'ok',
      expressConfig: {
        jsonLimit: '50mb',
        urlEncodedLimit: '50mb',
        middlewareStack: app._router.stack
          .filter(layer => layer.name)
          .map(layer => ({
            name: layer.name,
            regexp: layer.regexp?.toString()
          }))
      },
      requestLimits: {
        maxJsonSize: '50mb',
        maxUrlEncodedSize: '50mb',
        recommendation: 'Current limits should handle photos up to 50MB'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint to list all jobs
app.get('/api/debug/jobs', async (req, res) => {
  try {
    const jobs = await prisma.job.findMany({
      select: {
        id: true,
        title: true,
        customerId: true,
        photos: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json({
      totalJobs: jobs.length,
      jobs: jobs.map(job => ({
        id: job.id,
        title: job.title,
        customerId: job.customerId,
        hasPhotos: !!job.photos && job.photos !== '[]',
        photosLength: job.photos ? job.photos.length : 0,
        createdAt: job.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Auth routes
app.get('/api/auth/check', authMiddleware, (req, res) => {
  // If we get here, the token is valid
  const userStr = req.headers['x-user-data'];
  const user = userStr ? JSON.parse(userStr) : null;
  res.json({ 
    authenticated: true,
    user: user || { id: 'admin-id', email: 'admin@khscrm.com', name: 'Admin User', role: 'OWNER' }
  });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    // For now, still use hardcoded credentials
    // In production, you would check against database with bcrypt
    if (email === 'admin@khscrm.com' && password === 'admin123') {
      const token = 'railway-token-' + Date.now();
      const refreshToken = 'railway-refresh-' + Date.now();
      
      res.json({
        token,
        refreshToken,
        user: {
          id: 'admin-id',
          email: 'admin@khscrm.com',
          name: 'Admin User',
          role: 'OWNER'
        }
      });
    } else {
      res.status(401).json({ error: 'Invalid email or password' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Customer routes
app.get('/api/customers', authMiddleware, async (req, res) => {
  try {
    const { type } = req.query;
    const where = { isArchived: false };
    
    // Filter by customer type if provided
    if (type && (type === 'ACTIVE' || type === 'SOON_TO_BE')) {
      where.customerType = type;
    }
    
    const customers = await prisma.customer.findMany({
      where,
      include: {
        jobs: {
          select: {
            id: true,
            title: true,
            status: true,
            description: true,
            priority: true,
            startDate: true,
            endDate: true,
            completedDate: true,
            notes: true,
            photos: true,
            plans: true,
            customerId: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Parse photos and plans for each job
    const customersWithParsedJobs = customers.map(customer => {
      const parsedCustomer = { ...customer };
      if (customer.jobs) {
        parsedCustomer.jobs = customer.jobs.map(job => {
          const parsedJob = { ...job };
          
          // Parse photos
          if (job.photos) {
            try {
              parsedJob.photos = JSON.parse(job.photos);
            } catch (e) {
              console.error('Failed to parse photos for job:', job.id, e);
              parsedJob.photos = [];
            }
          } else {
            parsedJob.photos = [];
          }
          
          // Parse plans
          if (job.plans) {
            try {
              parsedJob.plans = JSON.parse(job.plans);
            } catch (e) {
              console.error('Failed to parse plans for job:', job.id, e);
              parsedJob.plans = [];
            }
          } else {
            parsedJob.plans = [];
          }
          
          return parsedJob;
        });
      }
      return parsedCustomer;
    });
    
    res.json(customersWithParsedJobs);
  } catch (error) {
    console.error('Error fetching customers:', error);
    // Check if it's a Prisma/DB error
    if (error.code === 'P2021') {
      console.error('Table does not exist - migrations may need to run');
      res.status(500).json({ error: 'Database table not found. Migrations may need to run.' });
    } else {
      res.status(500).json({ error: 'Failed to fetch customers: ' + error.message });
    }
  }
});

app.post('/api/customers', authMiddleware, async (req, res) => {
  try {
    const { reference, name, phone, email, address, notes, customerType } = req.body;
    
    let customerReference = reference;
    if (!customerReference) {
      const count = await prisma.customer.count();
      const letter = String.fromCharCode(65 + Math.floor(count / 100));
      const number = (count % 100) + 1;
      customerReference = `${letter}${number}`;
    }

    const customer = await prisma.customer.create({
      data: {
        reference: customerReference,
        name,
        phone,
        email,
        address,
        notes,
        customerType: customerType || 'ACTIVE'
      }
    });

    res.status(201).json(customer);
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

app.put('/api/customers/:id', authMiddleware, async (req, res) => {
  try {
    const { name, phone, email, address, notes, customerType } = req.body;
    
    const updateData = { name, phone, email, address, notes };
    if (customerType && (customerType === 'ACTIVE' || customerType === 'SOON_TO_BE')) {
      updateData.customerType = customerType;
    }
    
    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: updateData
    });
    
    res.json(customer);
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

app.delete('/api/customers/:id', authMiddleware, async (req, res) => {
  try {
    await prisma.customer.update({
      where: { id: req.params.id },
      data: { isArchived: true }
    });
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

// Job routes
app.get('/api/jobs', authMiddleware, async (req, res) => {
  try {
    const jobs = await prisma.job.findMany({
      include: {
        customer: {
          select: { id: true, reference: true, name: true, address: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Parse photos and plans from JSON strings to arrays
    const jobsWithParsedData = jobs.map(job => {
      const parsed = { ...job };
      if (job.photos) {
        try {
          parsed.photos = JSON.parse(job.photos);
        } catch (e) {
          parsed.photos = [];
        }
      }
      if (job.plans) {
        try {
          parsed.plans = JSON.parse(job.plans);
        } catch (e) {
          parsed.plans = [];
        }
      }
      return parsed;
    });
    
    res.json(jobsWithParsedData);
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

app.post('/api/jobs', authMiddleware, async (req, res) => {
  try {
    const jobData = {
      title: req.body.title,
      description: req.body.description,
      customerId: req.body.customerId,
      status: req.body.status || 'QUOTED',
      priority: req.body.priority || 'medium',
      startDate: req.body.startDate ? new Date(req.body.startDate) : null,
      endDate: req.body.endDate ? new Date(req.body.endDate) : null,
      completedDate: req.body.completedDate ? new Date(req.body.completedDate) : null,
      notes: req.body.notes
    };
    
    // Handle photos and plans - stringify arrays for storage
    if (req.body.photos && Array.isArray(req.body.photos)) {
      jobData.photos = JSON.stringify(req.body.photos);
    }
    if (req.body.plans && Array.isArray(req.body.plans)) {
      jobData.plans = JSON.stringify(req.body.plans);
    }
    
    const job = await prisma.job.create({
      data: jobData,
      include: {
        customer: true
      }
    });
    
    // Parse back to arrays for response
    if (job.photos) {
      try {
        job.photos = JSON.parse(job.photos);
      } catch (e) {
        console.error('Failed to parse photos:', e);
        job.photos = [];
      }
    } else {
      job.photos = [];
    }
    
    if (job.plans) {
      try {
        job.plans = JSON.parse(job.plans);
      } catch (e) {
        console.error('Failed to parse plans:', e);
        job.plans = [];
      }
    } else {
      job.plans = [];
    }
    
    // Immediately verify what was saved in database
    const verification = await prisma.job.findUnique({
      where: { id: job.id }
    });
    
    res.status(201).json(job);
  } catch (error) {
    console.error('Error creating job:', error);
    console.error('Request body:', req.body);
    res.status(500).json({ error: 'Failed to create job', details: error.message });
  }
});

// Update job
app.put('/api/jobs/:id', authMiddleware, async (req, res) => {
  try {
    const updateData = {
      title: req.body.title,
      description: req.body.description,
      customerId: req.body.customerId,
      status: req.body.status,
      priority: req.body.priority,
      startDate: req.body.startDate ? new Date(req.body.startDate) : null,
      endDate: req.body.endDate ? new Date(req.body.endDate) : null,
      completedDate: req.body.completedDate ? new Date(req.body.completedDate) : null,
      notes: req.body.notes
    };
    
    // Handle photos and plans - stringify arrays for storage
    if (req.body.photos !== undefined) {
      updateData.photos = Array.isArray(req.body.photos) ? JSON.stringify(req.body.photos) : null;
    }
    if (req.body.plans !== undefined) {
      updateData.plans = Array.isArray(req.body.plans) ? JSON.stringify(req.body.plans) : null;
    }
    
    
    const job = await prisma.job.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        customer: true
      }
    });
    
    
    // Parse back to arrays for response
    if (job.photos) {
      try {
        job.photos = JSON.parse(job.photos);
      } catch (e) {
        console.error('Failed to parse photos:', e);
        job.photos = [];
      }
    } else {
      job.photos = [];
    }
    
    if (job.plans) {
      try {
        job.plans = JSON.parse(job.plans);
      } catch (e) {
        console.error('Failed to parse plans:', e);
        job.plans = [];
      }
    } else {
      job.plans = [];
    }
    
    // Immediately verify what was saved in database
    const verification = await prisma.job.findUnique({
      where: { id: req.params.id }
    });
    
    res.json(job);
  } catch (error) {
    console.error('Error updating job:', error);
    console.error('Request params:', req.params);
    console.error('Request body:', req.body);
    res.status(500).json({ error: 'Failed to update job', details: error.message });
  }
});

// Delete job
app.delete('/api/jobs/:id', authMiddleware, async (req, res) => {
  try {
    await prisma.job.delete({
      where: { id: req.params.id }
    });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(500).json({ error: 'Failed to delete job', details: error.message });
  }
});

// Worker routes
app.get('/api/workers', authMiddleware, async (req, res) => {
  try {
    const workers = await prisma.worker.findMany({
      orderBy: { name: 'asc' }
    });
    
    // Parse timesheet JSON for each worker
    const workersWithParsedTimesheet = workers.map(worker => ({
      ...worker,
      timesheet: worker.timesheet ? worker.timesheet : null
    }));
    
    res.json(workersWithParsedTimesheet);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch workers' });
  }
});

app.get('/api/workers/:id', authMiddleware, async (req, res) => {
  try {
    const worker = await prisma.worker.findUnique({
      where: { id: req.params.id }
    });
    
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }
    
    res.json(worker);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch worker' });
  }
});

app.post('/api/workers', authMiddleware, async (req, res) => {
  try {
    const worker = await prisma.worker.create({
      data: {
        name: req.body.name,
        fullName: req.body.fullName,
        phone: req.body.phone,
        email: req.body.email,
        specialty: req.body.specialty,
        status: req.body.status || 'Available',
        currentJob: req.body.currentJob,
        color: req.body.color,
        notes: req.body.notes,
        timesheet: req.body.timesheet || {}
      }
    });
    
    res.status(201).json(worker);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create worker' });
  }
});

app.put('/api/workers/:id', authMiddleware, async (req, res) => {
  try {
    const worker = await prisma.worker.update({
      where: { id: req.params.id },
      data: {
        name: req.body.name,
        fullName: req.body.fullName,
        phone: req.body.phone,
        email: req.body.email,
        specialty: req.body.specialty,
        status: req.body.status,
        currentJob: req.body.currentJob,
        color: req.body.color,
        notes: req.body.notes,
        timesheet: req.body.timesheet
      }
    });
    
    res.json(worker);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update worker' });
  }
});

app.delete('/api/workers/:id', authMiddleware, async (req, res) => {
  try {
    await prisma.worker.delete({
      where: { id: req.params.id }
    });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete worker' });
  }
});

// Sync Routes
app.post('/api/sync/push', authMiddleware, async (req, res) => {
  try {
    const { deviceId, customers, jobs, workers, timestamp } = req.body;
    
    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID required for sync' });
    }
    
    console.log(`[Sync Push] Received sync data from device ${deviceId} at ${new Date().toISOString()}`);
    console.log(`[Sync Push] Data size: ${customers?.length || 0} customers, ${jobs?.length || 0} jobs, ${workers?.length || 0} workers`);
    
    // Process customers
    if (customers && Array.isArray(customers)) {
      for (const customer of customers) {
        if (customer.id && customer.id.startsWith('temp_')) {
          // Create new customer
          const { id, ...customerData } = customer;
          await prisma.customer.create({
            data: customerData
          });
        } else if (customer.id) {
          // Update existing customer
          const { id, ...customerData } = customer;
          await prisma.customer.update({
            where: { id },
            data: customerData
          });
        }
      }
    }
    
    // Process jobs
    if (jobs && Array.isArray(jobs)) {
      for (const job of jobs) {
        if (job.id && job.id.startsWith('temp_')) {
          // Create new job
          const { id, ...jobData } = job;
          // Handle date conversions
          if (jobData.startDate) jobData.startDate = new Date(jobData.startDate);
          if (jobData.endDate) jobData.endDate = new Date(jobData.endDate);
          if (jobData.completedDate) jobData.completedDate = new Date(jobData.completedDate);
          
          await prisma.job.create({
            data: jobData
          });
        } else if (job.id) {
          // Update existing job
          const { id, ...jobData } = job;
          // Handle date conversions
          if (jobData.startDate) jobData.startDate = new Date(jobData.startDate);
          if (jobData.endDate) jobData.endDate = new Date(jobData.endDate);
          if (jobData.completedDate) jobData.completedDate = new Date(jobData.completedDate);
          
          await prisma.job.update({
            where: { id },
            data: jobData
          });
        }
      }
    }
    
    // Process workers
    if (workers && Array.isArray(workers)) {
      for (const worker of workers) {
        if (worker.id && worker.id.startsWith('temp_')) {
          // Create new worker
          const { id, ...workerData } = worker;
          await prisma.worker.create({
            data: workerData
          });
        } else if (worker.id) {
          // Update existing worker
          const { id, ...workerData } = worker;
          await prisma.worker.update({
            where: { id },
            data: workerData
          });
        }
      }
    }
    
    // Also save to file for backup/debugging
    const filename = path.join(__dirname, 'data', `sync-${deviceId}.json`);
    try {
      fs.writeFileSync(filename, JSON.stringify({
        deviceId,
        customers: customers || [],
        jobs: jobs || [],
        workers: workers || [],
        timestamp: new Date().toISOString(),
        lastPush: new Date().toISOString()
      }, null, 2));
      console.log(`[Sync Push] Saved sync data to file: ${filename}`);
    } catch (fileError) {
      console.error(`[Sync Push] Failed to save to file: ${fileError.message}`);
    }
    
    res.json({ 
      success: true, 
      deviceId,
      timestamp: new Date().toISOString(),
      message: 'Data synced successfully'
    });
  } catch (error) {
    console.error('[Sync Push] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sync/pull', authMiddleware, async (req, res) => {
  try {
    const { deviceId, lastSyncTime } = req.body;
    
    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID required for sync' });
    }
    
    console.log(`[Sync Pull] Device ${deviceId} requesting data since: ${lastSyncTime || 'beginning'}`);
    
    let whereClause = {};
    if (lastSyncTime) {
      const syncDate = new Date(lastSyncTime);
      whereClause = {
        updatedAt: {
          gt: syncDate
        }
      };
    }
    
    // Get all data modified since lastSyncTime
    const [customers, jobs, workers] = await Promise.all([
      prisma.customer.findMany({
        where: whereClause,
        include: {
          jobs: true
        }
      }),
      prisma.job.findMany({
        where: whereClause
      }),
      prisma.worker.findMany({
        where: whereClause
      })
    ]);
    
    console.log(`[Sync Pull] Sending ${customers.length} customers, ${jobs.length} jobs, ${workers.length} workers`);
    
    res.json({
      customers,
      jobs,
      workers,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Sync Pull] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Initialize tool data if needed
async function initializeToolData() {
  try {
    // Check if we have any categories
    const categoryCount = await prisma.toolCategory.count();
    
    if (categoryCount === 0) {
      console.log('[Tools] Initializing tool data...');
      
      // Create categories
      const demoCategory = await prisma.toolCategory.create({
        data: {
          name: 'Demo',
          description: 'Demolition tools and equipment',
          sortOrder: 1
        }
      });
      
      const installCategory = await prisma.toolCategory.create({
        data: {
          name: 'Install',
          description: 'Installation tools and equipment',
          sortOrder: 2
        }
      });
      
      // Create some initial lists and items
      const toolData = {
        Demo: {
          Kitchen: ['Sledgehammer (20lb)', 'Crowbar (36")', 'Reciprocating saw', 'Utility knife', 'Safety glasses'],
          Bathroom: ['Sledgehammer (10lb)', 'Pry bar', 'Pipe wrench', 'Safety glasses', 'Dust masks'],
          Flooring: ['Floor scraper', 'Pry bar', 'Hammer', 'Utility knife', 'Knee pads'],
          Framing: ['Reciprocating saw', 'Circular saw', 'Sledgehammer', 'Pry bar', 'Safety glasses'],
          Drywall: ['Drywall saw', 'Utility knife', 'Pry bar', 'Hammer', 'Dust masks']
        },
        Install: {
          Cabinets: ['Drill/Driver set', 'Level (4ft)', 'Stud finder', 'Tape measure', 'Cabinet jacks'],
          Drywall: ['Drywall lift', 'Screw gun', 'Drywall saw', 'T-square (4ft)', 'Tape measure'],
          Flooring: ['Flooring nailer', 'Miter saw', 'Jigsaw', 'Tape measure', 'Knee pads'],
          Framing: ['Framing hammer', 'Circular saw', 'Speed square', 'Level (4ft)', 'Tape measure'],
          Decking: ['Circular saw', 'Miter saw', 'Drill/Driver set', 'Level (4ft)', 'Tape measure'],
          Painting: ['Drop cloths', 'Painters tape', 'Brushes', 'Rollers', 'Paint trays']
        }
      };
      
      // Create lists and items
      for (const [categoryName, lists] of Object.entries(toolData)) {
        const category = categoryName === 'Demo' ? demoCategory : installCategory;
        let listOrder = 0;
        
        for (const [listName, items] of Object.entries(lists)) {
          const toolList = await prisma.toolList.create({
            data: {
              categoryId: category.id,
              name: listName,
              isProtected: true,
              sortOrder: listOrder++
            }
          });
          
          let itemOrder = 0;
          for (const itemName of items) {
            await prisma.toolItem.create({
              data: {
                listId: toolList.id,
                name: itemName,
                isChecked: false,
                sortOrder: itemOrder++
              }
            });
          }
        }
      }
      
      console.log('[Tools] Tool data initialized successfully');
    }
  } catch (error) {
    console.error('[Tools] Error initializing tool data:', error);
  }
}

// Tool Lists API endpoints
app.get('/api/tools/settings', authMiddleware, async (req, res) => {
  try {
    // Initialize tool data if needed
    await initializeToolData();
    
    // Get or create the single settings record
    let settings = await prisma.toolSettings.findFirst();
    
    if (!settings) {
      // Create default settings if none exist
      settings = await prisma.toolSettings.create({
        data: {
          selectedCategories: [],
          isLocked: false,
          showDemo: false,
          showInstall: false
        }
      });
    }
    
    res.json(settings);
  } catch (error) {
    console.error('[Tools] Error fetching settings:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tools/settings', authMiddleware, async (req, res) => {
  try {
    const { selectedCategories, isLocked, showDemo, showInstall } = req.body;
    
    // Get existing settings
    let settings = await prisma.toolSettings.findFirst();
    
    if (settings) {
      // Update existing settings
      settings = await prisma.toolSettings.update({
        where: { id: settings.id },
        data: {
          selectedCategories,
          isLocked,
          showDemo,
          showInstall
        }
      });
    } else {
      // Create new settings
      settings = await prisma.toolSettings.create({
        data: {
          selectedCategories,
          isLocked,
          showDemo,
          showInstall
        }
      });
    }
    
    res.json(settings);
  } catch (error) {
    console.error('[Tools] Error updating settings:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tools/items', authMiddleware, async (req, res) => {
  try {
    // Get all tool items with their lists and categories
    const toolItems = await prisma.toolItem.findMany({
      include: {
        list: {
          include: {
            category: true
          }
        }
      },
      orderBy: [
        { list: { category: { sortOrder: 'asc' } } },
        { list: { sortOrder: 'asc' } },
        { sortOrder: 'asc' }
      ]
    });
    
    res.json(toolItems);
  } catch (error) {
    console.error('[Tools] Error fetching tool items:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tools/items/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { isChecked } = req.body;
    
    const updatedItem = await prisma.toolItem.update({
      where: { id },
      data: { isChecked }
    });
    
    res.json(updatedItem);
  } catch (error) {
    console.error('[Tools] Error updating tool item:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tools/items', authMiddleware, async (req, res) => {
  try {
    const { listId, name, quantity, notes } = req.body;
    
    // Get the highest sort order for this list
    const maxSortOrder = await prisma.toolItem.findFirst({
      where: { listId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true }
    });
    
    const newItem = await prisma.toolItem.create({
      data: {
        listId,
        name,
        quantity,
        notes,
        sortOrder: (maxSortOrder?.sortOrder || 0) + 1
      }
    });
    
    res.json(newItem);
  } catch (error) {
    console.error('[Tools] Error creating tool item:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tools/items/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.toolItem.delete({
      where: { id }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('[Tools] Error deleting tool item:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tools/lists/:listId/clear', authMiddleware, async (req, res) => {
  try {
    const { listId } = req.params;
    
    // Uncheck all items in this list
    await prisma.toolItem.updateMany({
      where: { listId },
      data: { isChecked: false }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('[Tools] Error clearing tool list:', error);
    res.status(500).json({ error: error.message });
  }
});

// KHS Tools Sync API endpoints
// GET /api/khs-tools-sync - Get the current tools sync data
app.get('/api/khs-tools-sync', authMiddleware, async (req, res) => {
  try {
    let toolsSync = await prisma.kHSToolsSync.findUnique({
      where: { id: 'main' }
    });

    // If no data exists, create default data
    if (!toolsSync) {
      const defaultData = {
        id: 'main',
        tools: {},
        selectedDemoCategories: [],
        selectedInstallCategories: [],
        lockedCategories: [],
        showDemo: false,
        showInstall: false,
        version: 1
      };

      toolsSync = await prisma.kHSToolsSync.create({
        data: defaultData
      });
    }

    res.json(toolsSync);
  } catch (error) {
    console.error('[KHSToolsSync] Error fetching tools sync data:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/khs-tools-sync - Update the tools sync data
app.put('/api/khs-tools-sync', authMiddleware, async (req, res) => {
  try {
    const {
      tools,
      selectedDemoCategories,
      selectedInstallCategories,
      lockedCategories,
      showDemo,
      showInstall,
      version
    } = req.body;

    // Get current data to check version
    const currentData = await prisma.kHSToolsSync.findUnique({
      where: { id: 'main' }
    });

    if (currentData && currentData.version > version) {
      // Version conflict - return current data
      return res.status(409).json({
        error: 'Version conflict',
        currentData
      });
    }

    // Update or create the data
    const updatedData = await prisma.kHSToolsSync.upsert({
      where: { id: 'main' },
      create: {
        id: 'main',
        tools: tools || {},
        selectedDemoCategories: selectedDemoCategories || [],
        selectedInstallCategories: selectedInstallCategories || [],
        lockedCategories: lockedCategories || [],
        showDemo: showDemo || false,
        showInstall: showInstall || false,
        lastUpdatedBy: req.userId,
        version: (currentData?.version || 0) + 1
      },
      update: {
        tools: tools || {},
        selectedDemoCategories: selectedDemoCategories || [],
        selectedInstallCategories: selectedInstallCategories || [],
        lockedCategories: lockedCategories || [],
        showDemo: showDemo || false,
        showInstall: showInstall || false,
        lastUpdatedBy: req.userId,
        lastUpdated: new Date(),
        version: (currentData?.version || 0) + 1
      }
    });

    res.json(updatedData);
  } catch (error) {
    console.error('[KHSToolsSync] Error updating tools sync data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
});

// Start server
app.listen(PORT, () => {
});