/**
 * MSW (Mock Service Worker) handlers for API mocking
 */

import { rest } from 'msw';
import { Customer, Job } from '../../types';

// Mock data
const mockCustomers: Customer[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '(808) 123-4567',
    address: '123 Ala Moana Blvd, Honolulu, HI 96813',
    customerType: 'current',
    reference: 'HOD',
    notes: 'Prefers morning appointments',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '(808) 987-6543',
    address: '456 Kalakaua Ave, Honolulu, HI 96815',
    customerType: 'lead',
    reference: 'Yelp',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
];

const mockJobs: Job[] = [
  {
    id: '1',
    customerId: '1',
    title: 'Kitchen Renovation',
    description: 'Complete kitchen remodel including cabinets and countertops',
    status: 'in-progress',
    photos: [],
    plans: [],
    lists: 'Cabinet installation\nCountertop installation\nBacksplash tiling',
    notes: 'Customer wants white shaker cabinets',
    comments: [],
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  },
  {
    id: '2',
    customerId: '2',
    title: 'Bathroom',
    description: 'Guest bathroom renovation',
    status: 'pending',
    photos: [],
    plans: [],
    createdAt: '2024-01-20T00:00:00Z',
    updatedAt: '2024-01-20T00:00:00Z',
  },
];

// Handlers
export const handlers = [
  // Customers endpoints
  rest.get('/api/customers', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({ data: mockCustomers, success: true })
    );
  }),

  rest.get('/api/customers/:id', (req, res, ctx) => {
    const { id } = req.params;
    const customer = mockCustomers.find(c => c.id === id);
    
    if (!customer) {
      return res(
        ctx.status(404),
        ctx.json({ error: 'Customer not found', success: false })
      );
    }
    
    return res(
      ctx.status(200),
      ctx.json({ data: customer, success: true })
    );
  }),

  rest.post('/api/customers', async (req, res, ctx) => {
    const body = await req.json();
    const newCustomer: Customer = {
      ...body,
      id: String(Date.now()),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    mockCustomers.push(newCustomer);
    
    return res(
      ctx.status(201),
      ctx.json({ data: newCustomer, success: true })
    );
  }),

  rest.put('/api/customers/:id', async (req, res, ctx) => {
    const { id } = req.params;
    const body = await req.json();
    const customerIndex = mockCustomers.findIndex(c => c.id === id);
    
    if (customerIndex === -1) {
      return res(
        ctx.status(404),
        ctx.json({ error: 'Customer not found', success: false })
      );
    }
    
    const updatedCustomer = {
      ...mockCustomers[customerIndex],
      ...body,
      updatedAt: new Date().toISOString(),
    };
    
    mockCustomers[customerIndex] = updatedCustomer;
    
    return res(
      ctx.status(200),
      ctx.json({ data: updatedCustomer, success: true })
    );
  }),

  rest.delete('/api/customers/:id', (req, res, ctx) => {
    const { id } = req.params;
    const customerIndex = mockCustomers.findIndex(c => c.id === id);
    
    if (customerIndex === -1) {
      return res(
        ctx.status(404),
        ctx.json({ error: 'Customer not found', success: false })
      );
    }
    
    mockCustomers.splice(customerIndex, 1);
    
    return res(
      ctx.status(204),
      ctx.json({ success: true })
    );
  }),

  // Jobs endpoints
  rest.get('/api/jobs', (req, res, ctx) => {
    const customerId = req.url.searchParams.get('customerId');
    
    const jobs = customerId 
      ? mockJobs.filter(j => j.customerId === customerId)
      : mockJobs;
    
    return res(
      ctx.status(200),
      ctx.json({ data: jobs, success: true })
    );
  }),

  rest.get('/api/jobs/:id', (req, res, ctx) => {
    const { id } = req.params;
    const job = mockJobs.find(j => j.id === id);
    
    if (!job) {
      return res(
        ctx.status(404),
        ctx.json({ error: 'Job not found', success: false })
      );
    }
    
    return res(
      ctx.status(200),
      ctx.json({ data: job, success: true })
    );
  }),

  rest.post('/api/jobs', async (req, res, ctx) => {
    const body = await req.json();
    const newJob: Job = {
      ...body,
      id: String(Date.now()),
      photos: [],
      plans: [],
      comments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    mockJobs.push(newJob);
    
    return res(
      ctx.status(201),
      ctx.json({ data: newJob, success: true })
    );
  }),

  rest.put('/api/jobs/:id', async (req, res, ctx) => {
    const { id } = req.params;
    const body = await req.json();
    const jobIndex = mockJobs.findIndex(j => j.id === id);
    
    if (jobIndex === -1) {
      return res(
        ctx.status(404),
        ctx.json({ error: 'Job not found', success: false })
      );
    }
    
    const updatedJob = {
      ...mockJobs[jobIndex],
      ...body,
      updatedAt: new Date().toISOString(),
    };
    
    mockJobs[jobIndex] = updatedJob;
    
    return res(
      ctx.status(200),
      ctx.json({ data: updatedJob, success: true })
    );
  }),

  rest.delete('/api/jobs/:id', (req, res, ctx) => {
    const { id } = req.params;
    const jobIndex = mockJobs.findIndex(j => j.id === id);
    
    if (jobIndex === -1) {
      return res(
        ctx.status(404),
        ctx.json({ error: 'Job not found', success: false })
      );
    }
    
    mockJobs.splice(jobIndex, 1);
    
    return res(
      ctx.status(204),
      ctx.json({ success: true })
    );
  }),

  // Health check
  rest.get('/api/health', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({ status: 'ok', timestamp: new Date().toISOString() })
    );
  }),
];

// Error handlers for testing error scenarios
export const errorHandlers = [
  rest.get('/api/customers', (req, res, ctx) => {
    return res(
      ctx.status(500),
      ctx.json({ error: 'Internal server error', success: false })
    );
  }),
  
  rest.post('/api/customers', (req, res, ctx) => {
    return res(
      ctx.status(400),
      ctx.json({ error: 'Invalid customer data', success: false })
    );
  }),
];