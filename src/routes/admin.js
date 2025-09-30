
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// JWT secret - in production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

async function adminRoutes(fastify, options) {
  // Register admin
  fastify.post('/register', async (request, reply) => {
    try {
      const { email, password, name } = request.body;

      // Basic validation
      if (!email || !password || !name) {
        return reply.status(400).send({
          success: false,
          error: 'Missing required fields: email, password, name'
        });
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid email format'
        });
      }

      // Password validation
      if (password.length < 6) {
        return reply.status(400).send({
          success: false,
          error: 'Password must be at least 6 characters long'
        });
      }

      // Check if admin already exists
      const existingAdmin = await fastify.prisma.admin.findUnique({
        where: { email }
      });

      if (existingAdmin) {
        return reply.status(409).send({
          success: false,
          error: 'Admin with this email already exists'
        });
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create admin
      const admin = await fastify.prisma.admin.create({
        data: {
          email,
          password: hashedPassword,
          name
        },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          updatedAt: true
        }
      });

      return reply.status(201).send({ 
        success: true, 
        data: admin,
        message: 'Admin registered successfully'
      });
    } catch (error) {
      fastify.log.error(error);
      
      // Handle unique constraint violation
      if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
        return reply.status(409).send({
          success: false,
          error: 'Admin with this email already exists'
        });
      }
      
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to register admin' 
      });
    }
  });

  // Admin login
  fastify.post('/login', async (request, reply) => {
    try {
      const { email, password } = request.body;
      // Basic validation
      if (!email || !password) {
        return reply.status(400).send({
          success: false,
          error: 'Missing required fields: email, password'
        });
      }

      // Find admin by email
      const admin = await fastify.prisma.admin.findUnique({
        where: { email }
      });

      if (!admin) {
        return reply.status(401).send({
          success: false,
          error: 'Invalid email or password'
        });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, admin.password);
      if (!isPasswordValid) {
        return reply.status(401).send({
          success: false,
          error: 'Invalid email or password'
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          adminId: admin.id, 
          email: admin.email,
          name: admin.name
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Return admin data without password and token
      const adminData = {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt
      };

      return reply.send({ 
        success: true, 
        data: {
          admin: adminData,
          token
        },
        message: 'Login successful'
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ 
        success: false, 
        error: 'Login failed' 
      });
    }
  });

  // Get admin profile (protected route)
  fastify.get('/profile', {
    preHandler: async (request, reply) => {
      try {
        const token = request.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return reply.status(401).send({
            success: false,
            error: 'Access token is required'
          });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        request.admin = decoded;
      } catch (error) {
        return reply.status(401).send({
          success: false,
          error: 'Invalid or expired token'
        });
      }
    }
  }, async (request, reply) => {
    try {
      const admin = await fastify.prisma.admin.findUnique({
        where: { id: request.admin.adminId },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!admin) {
        return reply.status(404).send({
          success: false,
          error: 'Admin not found'
        });
      }

      return { success: true, data: admin };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to fetch profile' 
      });
    }
  });

  // Update admin profile (protected route)
  fastify.put('/profile', {
    preHandler: async (request, reply) => {
      try {
        const token = request.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return reply.status(401).send({
            success: false,
            error: 'Access token is required'
          });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        request.admin = decoded;
      } catch (error) {
        return reply.status(401).send({
          success: false,
          error: 'Invalid or expired token'
        });
      }
    }
  }, async (request, reply) => {
    try {
      const { name, email } = request.body;
      const adminId = request.admin.adminId;

      // Check if admin exists
      const existingAdmin = await fastify.prisma.admin.findUnique({
        where: { id: adminId }
      });

      if (!existingAdmin) {
        return reply.status(404).send({
          success: false,
          error: 'Admin not found'
        });
      }

      // Email validation if email is being updated
      if (email && email !== existingAdmin.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return reply.status(400).send({
            success: false,
            error: 'Invalid email format'
          });
        }

        // Check if new email already exists
        const emailExists = await fastify.prisma.admin.findUnique({
          where: { email }
        });

        if (emailExists) {
          return reply.status(409).send({
            success: false,
            error: 'Email already exists'
          });
        }
      }

      // Prepare update data
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;

      const updatedAdmin = await fastify.prisma.admin.update({
        where: { id: adminId },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          updatedAt: true
        }
      });

      return { success: true, data: updatedAdmin };
    } catch (error) {
      fastify.log.error(error);
      
      // Handle unique constraint violation
      if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
        return reply.status(409).send({
          success: false,
          error: 'Email already exists'
        });
      }
      
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to update profile' 
      });
    }
  });

  // Change password (protected route)
  fastify.put('/change-password', {
    preHandler: async (request, reply) => {
      try {
        const token = request.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return reply.status(401).send({
            success: false,
            error: 'Access token is required'
          });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        request.admin = decoded;
      } catch (error) {
        return reply.status(401).send({
          success: false,
          error: 'Invalid or expired token'
        });
      }
    }
  }, async (request, reply) => {
    try {
      const { currentPassword, newPassword } = request.body;
      const adminId = request.admin.adminId;

      // Basic validation
      if (!currentPassword || !newPassword) {
        return reply.status(400).send({
          success: false,
          error: 'Missing required fields: currentPassword, newPassword'
        });
      }

      if (newPassword.length < 6) {
        return reply.status(400).send({
          success: false,
          error: 'New password must be at least 6 characters long'
        });
      }

      // Find admin
      const admin = await fastify.prisma.admin.findUnique({
        where: { id: adminId }
      });

      if (!admin) {
        return reply.status(404).send({
          success: false,
          error: 'Admin not found'
        });
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, admin.password);
      if (!isCurrentPasswordValid) {
        return reply.status(401).send({
          success: false,
          error: 'Current password is incorrect'
        });
      }

      // Hash new password
      const saltRounds = 12;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await fastify.prisma.admin.update({
        where: { id: adminId },
        data: { password: hashedNewPassword }
      });

      return { 
        success: true, 
        message: 'Password changed successfully'
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to change password' 
      });
    }
  });

  // Get all users with filtering options (admin only)
  fastify.get('/users', {
    preHandler: async (request, reply) => {
      try {
        const token = request.headers.authorization?.replace('Bearer ', '');
     
        
        if (!token) {
          return reply.status(401).send({ success: false, error: 'Access token is required' });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        request.admin = decoded;
        
        // Verify admin exists
        const admin = await fastify.prisma.admin.findUnique({
          where: { id: request.admin.adminId }
        });
        
        if (!admin) {
          return reply.status(403).send({ success: false, error: 'Admin access required' });
        }
      } catch (error) {
        return reply.status(401).send({ success: false, error: 'Invalid or expired token' });
      }
    }
  }, async (request, reply) => {
    try {
      const { 
        search, 
        minRevenue, 
        maxRevenue, 
        minOrders, 
        maxOrders,
        emailVerified,
        phoneVerified,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        page = 1,
        limit = 10
      } = request.query;

      const skip = (page - 1) * limit;
      
      // Build where clause
      const where = {};
      
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { email: { contains: search } },
          { phone: { contains: search } }
        ];
      }
      
      if (emailVerified !== undefined) {
        where.emailVerified = emailVerified === 'true';
      }
      
      if (phoneVerified !== undefined) {
        where.phoneVerified = phoneVerified === 'true';
      }

      // Get users with order statistics
      const users = await fastify.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          emailVerified: true,
          phoneVerified: true,
          createdAt: true,
          orders: {
            select: {
              id: true,
              total: true,
              status: true,
              paymentStatus: true
            }
          }
        },
        orderBy: {
          [sortBy]: sortOrder
        },
        skip,
        take: parseInt(limit)
      });

      // Calculate revenue and order counts for each user
      const usersWithStats = users.map(user => {
        const totalRevenue = user.orders
          .filter(order => order.paymentStatus === 'PAID')
          .reduce((sum, order) => sum + order.total, 0);
        
        // Count all orders (including pending, cancelled, etc.)
        const orderCount = user.orders.length;
        
        // Count completed orders (delivered)
        const completedOrders = user.orders.filter(order => order.status === 'DELIVERED').length;
        
        return {
          ...user,
          totalRevenue,
          orderCount,
          completedOrders,
          orders: undefined // Remove orders array from response
        };
      });

      // Apply revenue and order filters
      let filteredUsers = usersWithStats;
      
      if (minRevenue !== undefined) {
        filteredUsers = filteredUsers.filter(user => user.totalRevenue >= parseFloat(minRevenue));
      }
      
      if (maxRevenue !== undefined) {
        filteredUsers = filteredUsers.filter(user => user.totalRevenue <= parseFloat(maxRevenue));
      }
      
      if (minOrders !== undefined) {
        filteredUsers = filteredUsers.filter(user => user.orderCount >= parseInt(minOrders));
      }
      
      if (maxOrders !== undefined) {
        filteredUsers = filteredUsers.filter(user => user.orderCount <= parseInt(maxOrders));
      }

      // Get total count for pagination
      const totalUsers = await fastify.prisma.user.count({ where });
      
      return {
        success: true,
        data: {
          users: filteredUsers,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalUsers,
            totalPages: Math.ceil(totalUsers / limit)
          }
        }
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ success: false, error: 'Failed to fetch users' });
    }
  });

  // Analytics Routes
  // Get orders count with percentage change
  fastify.get('/analytics/orders-count', async (request, reply) => {
    try {
      const { dateRange = 'last7days', status } = request.query;
      
      const { start, end } = getDateRange(dateRange);
      const previousPeriod = getPreviousPeriod({ start, end });
      
      const whereClause = {
        createdAt: {
          gte: start,
          lte: end
        }
      };
      
      if (status && status !== 'all') {
        whereClause.status = status;
      }

      const currentCount = await fastify.prisma.order.count({ where: whereClause });
      
      const previousWhereClause = { ...whereClause };
      previousWhereClause.createdAt = {
        gte: previousPeriod.start,
        lte: previousPeriod.end
      };
      
      const previousCount = await fastify.prisma.order.count({ where: previousWhereClause });
      
      const percentageChange = calculatePercentageChange(currentCount, previousCount);
      return {
        success: true,
        data: {
          count: currentCount,
          previousCount,
          percentageChange
        }
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ success: false, error: 'Failed to fetch orders count' });
    }
  });

  // Get revenue with percentage change
  fastify.get('/analytics/revenue', async (request, reply) => {
    try {
      const { dateRange = 'last7days', status } = request.query;
      
      const { start, end } = getDateRange(dateRange);
      const previousPeriod = getPreviousPeriod({ start, end });
      
      const whereClause = {
        createdAt: {
          gte: start,
          lte: end
        },
        paymentStatus: 'PAID'
      };
      
      if (status && status !== 'all') {
        whereClause.status = status;
      }

      const currentRevenue = await fastify.prisma.order.aggregate({
        where: whereClause,
        _sum: { total: true }
      });
      
      const previousWhereClause = { ...whereClause };
      previousWhereClause.createdAt = {
        gte: previousPeriod.start,
        lte: previousPeriod.end
      };
      
      const previousRevenue = await fastify.prisma.order.aggregate({
        where: previousWhereClause,
        _sum: { total: true }
      });
      
      const current = currentRevenue._sum.total || 0;
      const previous = previousRevenue._sum.total || 0;
      const percentageChange = calculatePercentageChange(current, previous);
      
      return {
        success: true,
        data: {
          revenue: current,
          previousRevenue: previous,
          percentageChange
        }
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ success: false, error: 'Failed to fetch revenue' });
    }
  });

  // Get AOV (Average Order Value)
  fastify.get('/analytics/aov', async (request, reply) => {
    try {
      const { dateRange = 'last7days', status } = request.query;
      
      const { start, end } = getDateRange(dateRange);
      const previousPeriod = getPreviousPeriod({ start, end });
      
      const whereClause = {
        createdAt: {
          gte: start,
          lte: end
        },
        paymentStatus: 'PAID'
      };
      
      if (status && status !== 'all') {
        whereClause.status = status;
      }

      const currentStats = await fastify.prisma.order.aggregate({
        where: whereClause,
        _sum: { total: true },
        _count: true
      });
      
      const previousWhereClause = { ...whereClause };
      previousWhereClause.createdAt = {
        gte: previousPeriod.start,
        lte: previousPeriod.end
      };
      
      const previousStats = await fastify.prisma.order.aggregate({
        where: previousWhereClause,
        _sum: { total: true },
        _count: true
      });
      
      const currentAOV = currentStats._count > 0 ? (currentStats._sum.total || 0) / currentStats._count : 0;
      const previousAOV = previousStats._count > 0 ? (previousStats._sum.total || 0) / previousStats._count : 0;
      const percentageChange = calculatePercentageChange(currentAOV, previousAOV);
      
      return {
        success: true,
        data: {
          aov: currentAOV,
          previousAOV,
          percentageChange
        }
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ success: false, error: 'Failed to fetch AOV' });
    }
  });

  // Get customers count
  fastify.get('/analytics/customers-count', async (request, reply) => {
    try {
      const { dateRange = 'last7days', status } = request.query;
      
      const { start, end } = getDateRange(dateRange);
      const previousPeriod = getPreviousPeriod({ start, end });
      
      const whereClause = {
        orders: {
          some: {
            createdAt: {
              gte: start,
              lte: end
            }
          }
        }
      };
      
      if (status && status !== 'all') {
        whereClause.orders.some.status = status;
      }

      const currentCount = await fastify.prisma.user.count({ where: whereClause });
      
      const previousWhereClause = { ...whereClause };
      previousWhereClause.orders.some.createdAt = {
        gte: previousPeriod.start,
        lte: previousPeriod.end
      };
      
      const previousCount = await fastify.prisma.user.count({ where: previousWhereClause });
      const percentageChange = calculatePercentageChange(currentCount, previousCount);
      
      return {
        success: true,
        data: {
          count: currentCount,
          previousCount,
          percentageChange
        }
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ success: false, error: 'Failed to fetch customers count' });
    }
  });

  // Get revenue over time
  fastify.get('/analytics/revenue-over-time', async (request, reply) => {
    try {
      const { dateRange = 'last7days', status } = request.query;
      
      const { start, end } = getDateRange(dateRange);
      
      const whereClause = {
        createdAt: {
          gte: start,
          lte: end
        },
        paymentStatus: 'PAID'
      };
      
      if (status && status !== 'all') {
        whereClause.status = status;
      }

      const orders = await fastify.prisma.order.findMany({
        where: whereClause,
        select: {
          total: true,
          createdAt: true
        },
        orderBy: { createdAt: 'asc' }
      });

      const duration = end.getTime() - start.getTime();
      const daysDiff = duration / (1000 * 60 * 60 * 24);
      
      const groupedData = new Map();
      
      orders.forEach(order => {
        let key;
        if (daysDiff <= 30) {
          key = order.createdAt.toISOString().split('T')[0];
        } else {
          key = `${order.createdAt.getFullYear()}-${String(order.createdAt.getMonth() + 1).padStart(2, '0')}`;
        }
        
        groupedData.set(key, (groupedData.get(key) || 0) + order.total);
      });

      const data = Array.from(groupedData.entries()).map(([date, revenue]) => ({
        date,
        revenue
      }));
      
      return {
        success: true,
        data
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ success: false, error: 'Failed to fetch revenue over time' });
    }
  });

  // Get orders over time
  fastify.get('/analytics/orders-over-time', async (request, reply) => {
    try {
      const { dateRange = 'last7days', status } = request.query;
      
      const { start, end } = getDateRange(dateRange);
      
      const whereClause = {
        createdAt: {
          gte: start,
          lte: end
        }
      };
      
      if (status && status !== 'all') {
        whereClause.status = status;
      }

      const orders = await fastify.prisma.order.findMany({
        where: whereClause,
        select: {
          createdAt: true
        },
        orderBy: { createdAt: 'asc' }
      });

      const duration = end.getTime() - start.getTime();
      const daysDiff = duration / (1000 * 60 * 60 * 24);
      
      const groupedData = new Map();
      
      orders.forEach(order => {
        let key;
        if (daysDiff <= 30) {
          key = order.createdAt.toISOString().split('T')[0];
        } else {
          key = `${order.createdAt.getFullYear()}-${String(order.createdAt.getMonth() + 1).padStart(2, '0')}`;
        }
        
        groupedData.set(key, (groupedData.get(key) || 0) + 1);
      });

      const data = Array.from(groupedData.entries()).map(([date, count]) => ({
        date,
        count
      }));
      
      return {
        success: true,
        data
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ success: false, error: 'Failed to fetch orders over time' });
    }
  });

  // Get revenue by category
  fastify.get('/analytics/revenue-by-category', async (request, reply) => {
    try {
      const { dateRange = 'last7days', status } = request.query;
      
      const { start, end } = getDateRange(dateRange);
      
      const whereClause = {
        order: {
          createdAt: {
            gte: start,
            lte: end
          },
          paymentStatus: 'PAID'
        }
      };
      
      if (status && status !== 'all') {
        whereClause.order.status = status;
      }

      const orderItems = await fastify.prisma.orderItem.findMany({
        where: whereClause,
        include: {
          product: {
            include: {
              category: true
            }
          }
        }
      });

      const categoryRevenue = new Map();
      
      orderItems.forEach(item => {
        const categoryName = item.product.category.name;
        const revenue = item.price * item.quantity;
        categoryRevenue.set(categoryName, (categoryRevenue.get(categoryName) || 0) + revenue);
      });

      const data = Array.from(categoryRevenue.entries()).map(([category, revenue]) => ({
        category,
        revenue
      })).sort((a, b) => b.revenue - a.revenue);
      
      return {
        success: true,
        data
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ success: false, error: 'Failed to fetch revenue by category' });
    }
  });

  // Get top products
  fastify.get('/analytics/top-products', async (request, reply) => {
    try {
      const { dateRange = 'last7days', status, limit = 5 } = request.query;
      
      const { start, end } = getDateRange(dateRange);
      
      const whereClause = {
        order: {
          createdAt: {
            gte: start,
            lte: end
          },
          paymentStatus: 'PAID'
        }
      };
      
      if (status && status !== 'all') {
        whereClause.order.status = status;
      }

      const orderItems = await fastify.prisma.orderItem.findMany({
        where: whereClause,
        include: {
          product: true
        }
      });

      const productRevenue = new Map();
      
      orderItems.forEach(item => {
        const productId = item.productId;
        const existing = productRevenue.get(productId);
        const revenue = item.price * item.quantity;
        
        if (existing) {
          existing.revenue += revenue;
          existing.quantity += item.quantity;
        } else {
          productRevenue.set(productId, {
            name: item.product.name,
            revenue,
            quantity: item.quantity
          });
        }
      });

      const data = Array.from(productRevenue.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, parseInt(limit));
      
      return {
        success: true,
        data
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ success: false, error: 'Failed to fetch top products' });
    }
  });

  // Get top customers
  fastify.get('/analytics/top-customers', async (request, reply) => {
    try {
      const { dateRange = 'last7days', status, limit = 10 } = request.query;
      
      const { start, end } = getDateRange(dateRange);
      
      const whereClause = {
        createdAt: {
          gte: start,
          lte: end
        },
        paymentStatus: 'PAID'
      };
      
      if (status && status !== 'all') {
        whereClause.status = status;
      }

      const customers = await fastify.prisma.user.findMany({
        where: {
          orders: {
            some: whereClause
          }
        },
        include: {
          orders: {
            where: whereClause,
            select: {
              total: true,
              id: true
            }
          }
        }
      });

      const customerStats = customers.map(customer => {
        const totalOrders = customer.orders.length;
        const totalRevenue = customer.orders.reduce((sum, order) => sum + order.total, 0);
        
        return {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          totalOrders,
          totalRevenue
        };
      });

      const data = customerStats
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, parseInt(limit));
      
      return {
        success: true,
        data
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ success: false, error: 'Failed to fetch top customers' });
    }
  });

  // Get live orders
  fastify.get('/analytics/live-orders', async (request, reply) => {
    try {
      const { limit = 10 } = request.query;
      
      const orders = await fastify.prisma.order.findMany({
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              name: true,
              email: true
            }
          }
        }
      });
      
      return {
        success: true,
        data: orders
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ success: false, error: 'Failed to fetch live orders' });
    }
  });

  // Helper functions
  function getDateRange(range) {
    const now = new Date();
    const start = new Date();
    
    switch (range) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        break;
      case 'last7days':
        start.setDate(now.getDate() - 7);
        break;
      case 'lastMonth':
        start.setMonth(now.getMonth() - 1);
        break;
      case 'lastQuarter':
        start.setMonth(now.getMonth() - 3);
        break;
      case 'lastYear':
        start.setFullYear(now.getFullYear() - 1);
        break;
      default:
        start.setDate(now.getDate() - 7);
    }
    
    return { start, end: now };
  }

  function getPreviousPeriod(dateRange) {
    const duration = dateRange.end.getTime() - dateRange.start.getTime();
    return {
      start: new Date(dateRange.start.getTime() - duration),
      end: new Date(dateRange.start.getTime())
    };
  }

  function calculatePercentageChange(current, previous) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  return fastify;
}

module.exports = adminRoutes;