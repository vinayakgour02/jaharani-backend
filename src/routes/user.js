const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

async function userRoutes(fastify, options) {
  // Get user profile (protected)
  fastify.get('/me', {
    preHandler: async (request, reply) => {
      try {
        const token = request.headers.authorization?.replace('Bearer ', '');
        if (!token) {
          return reply.status(401).send({ success: false, error: 'Access token is required' });
        }
        const decoded = jwt.verify(token, JWT_SECRET);
        request.user = decoded;
      } catch (error) {
        return reply.status(401).send({ success: false, error: 'Invalid or expired token' });
      }
    }
  }, async (request, reply) => {
    try {
      const user = await fastify.prisma.user.findUnique({
        where: { id: request.user.userId },
        select: { id: true, name: true, email: true, phone: true }
      });
      if (!user) {
        return reply.status(404).send({ success: false, error: 'User not found' });
      }
      return { success: true, data: user };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ success: false, error: 'Failed to fetch profile' });
    }
  });

  // Update user profile (protected, cannot update phone)
  fastify.put('/me', {
    preHandler: async (request, reply) => {
      try {
        const token = request.headers.authorization?.replace('Bearer ', '');
        if (!token) {
          return reply.status(401).send({ success: false, error: 'Access token is required' });
        }
        const decoded = jwt.verify(token, JWT_SECRET);
        request.user = decoded;
      } catch (error) {
        return reply.status(401).send({ success: false, error: 'Invalid or expired token' });
      }
    }
  }, async (request, reply) => {
    try {
      const { name, email } = request.body;
      const userId = request.user.userId;
      const existingUser = await fastify.prisma.user.findUnique({ where: { id: userId } });
      if (!existingUser) {
        return reply.status(404).send({ success: false, error: 'User not found' });
      }
      // Email validation if email is being updated
      if (email && email !== existingUser.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return reply.status(400).send({ success: false, error: 'Invalid email format' });
        }
        // Check if new email already exists
        const emailExists = await fastify.prisma.user.findUnique({ where: { email } });
        if (emailExists) {
          return reply.status(409).send({ success: false, error: 'Email already exists' });
        }
      }
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      const updatedUser = await fastify.prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: { id: true, name: true, email: true, phone: true }
      });
      return { success: true, data: updatedUser };
    } catch (error) {
      fastify.log.error(error);
      if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
        return reply.status(409).send({ success: false, error: 'Email already exists' });
      }
      return reply.status(500).send({ success: false, error: 'Failed to update profile' });
    }
  });

  // Get all addresses for the user (protected)
  fastify.get('/addresses', {
    preHandler: async (request, reply) => {
      try {
        const token = request.headers.authorization?.replace('Bearer ', '');
        if (!token) {
          return reply.status(401).send({ success: false, error: 'Access token is required' });
        }
        const decoded = jwt.verify(token, JWT_SECRET);
        request.user = decoded;
      } catch (error) {
        return reply.status(401).send({ success: false, error: 'Invalid or expired token' });
      }
    }
  }, async (request, reply) => {
    try {
      const addresses = await fastify.prisma.address.findMany({
        where: { userId: request.user.userId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      });
      return { success: true, data: addresses };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ success: false, error: 'Failed to fetch addresses' });
    }
  });

  // Add a new address (protected)
  fastify.post('/addresses', {
    preHandler: async (request, reply) => {
      try {
        const token = request.headers.authorization?.replace('Bearer ', '');
        if (!token) {
          return reply.status(401).send({ success: false, error: 'Access token is required' });
        }
        const decoded = jwt.verify(token, JWT_SECRET);
        request.user = decoded;
      } catch (error) {
        return reply.status(401).send({ success: false, error: 'Invalid or expired token' });
      }
    }
  }, async (request, reply) => {
    try {
      const { fullName, phone, addressLine1, city, state, pincode, landmark } = request.body;
      if (!addressLine1 || !city || !state || !pincode) {
        return reply.status(400).send({ success: false, error: 'Missing required fields' });
      }
      const userId = request.user.userId;
      const addressCount = await fastify.prisma.address.count({ where: { userId } });
      const isDefault = addressCount === 0;
      if (isDefault) {
        // If first address, set as default
        // (no need to unset others, since there are none)
      }
      const address = await fastify.prisma.address.create({
        data: {
          userId,
          fullName: fullName || '',
          phone: phone || '',
          addressLine1,
          city,
          state,
          pincode,
          landmark: landmark || '',
          isDefault,
        },
      });
      return { success: true, data: address };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ success: false, error: 'Failed to add address' });
    }
  });

  // Set an address as default (protected)
  fastify.put('/addresses/:id/default', {
    preHandler: async (request, reply) => {
      try {
        const token = request.headers.authorization?.replace('Bearer ', '');
        if (!token) {
          return reply.status(401).send({ success: false, error: 'Access token is required' });
        }
        const decoded = jwt.verify(token, JWT_SECRET);
        request.user = decoded;
      } catch (error) {
        return reply.status(401).send({ success: false, error: 'Invalid or expired token' });
      }
    }
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const addressId = request.params.id;
      // Unset all other addresses
      await fastify.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
      // Set selected address as default
      const updated = await fastify.prisma.address.update({
        where: { id: addressId },
        data: { isDefault: true },
      });
      return { success: true, data: updated };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ success: false, error: 'Failed to set default address' });
    }
  });

  // Get all orders for the user (protected)
  fastify.get('/orders', {
    preHandler: async (request, reply) => {
      try {
        const token = request.headers.authorization?.replace('Bearer ', '');
        if (!token) {
          return reply.status(401).send({ success: false, error: 'Access token is required' });
        }
        const decoded = jwt.verify(token, JWT_SECRET);
        request.user = decoded;
      } catch (error) {
        return reply.status(401).send({ success: false, error: 'Invalid or expired token' });
      }
    }
  }, async (request, reply) => {
    try {
      const orders = await fastify.prisma.order.findMany({
        where: { userId: request.user.userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          createdAt: true,
          status: true,
          paymentStatus: true,
          total: true,
          subtotal: true,
          deliveryCharges: true,
          tax: true,
          discount: true,
          couponId: true,
        }
      });
      return { success: true, data: orders };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ success: false, error: 'Failed to fetch orders' });
    }
  });

  // Get a specific order with all details (protected)
  fastify.get('/orders/:id', {
    preHandler: async (request, reply) => {
      try {
        const token = request.headers.authorization?.replace('Bearer ', '');
        if (!token) {
          return reply.status(401).send({ success: false, error: 'Access token is required' });
        }
        const decoded = jwt.verify(token, JWT_SECRET);
        request.user = decoded;
      } catch (error) {
        return reply.status(401).send({ success: false, error: 'Invalid or expired token' });
      }
    }
  }, async (request, reply) => {
    try {
      const order = await fastify.prisma.order.findFirst({
        where: { id: request.params.id, userId: request.user.userId },
        include: {
          items: { include: { product: true } },
          address: true,
          coupon: true,
          offer: true,
        }
      });
      if (!order) {
        return reply.status(404).send({ success: false, error: 'Order not found' });
      }
      return { success: true, data: order };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ success: false, error: 'Failed to fetch order details' });
    }
  });
}

module.exports = userRoutes; 