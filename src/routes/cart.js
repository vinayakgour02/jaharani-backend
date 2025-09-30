const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

async function cartRoutes(fastify, options) {
  // Auth middleware
  async function requireAuth(request, reply) {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return reply.status(401).send({ success: false, error: 'Access token is required' });
      }
      const decoded = jwt.verify(token, JWT_SECRET);
      if (!decoded?.userId) {
        return reply.status(401).send({ success: false, error: 'User access token is required' });
      }
      const user = await fastify.prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user) {
        return reply.status(401).send({ success: false, error: 'User not found' });
      }
      request.user = { userId: user.id, phone: user.phone };
    } catch (error) {
      return reply.status(401).send({ success: false, error: 'Invalid or expired token' });
    }
  }

  // GET / - Get all cart items for user
  fastify.get('/', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const cartItems = await fastify.prisma.cartItem.findMany({
        where: { userId },
        include: { product: { include: { images: true } } }
      });
      return { success: true, data: cartItems };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ success: false, error: 'Failed to fetch cart' });
    }
  });

  // POST / - Add item to cart (or update quantity if exists)
  fastify.post('/', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { productId, quantity } = request.body;
      if (!productId || !quantity || quantity < 1) {
        return reply.status(400).send({ success: false, error: 'productId and quantity >= 1 required' });
      }
      // Check if product exists
      const product = await fastify.prisma.product.findUnique({ where: { id: productId } });
      if (!product) {
        return reply.status(404).send({ success: false, error: 'Product not found' });
      }
      // Upsert cart item
      const cartItem = await fastify.prisma.cartItem.upsert({
        where: { userId_productId: { userId, productId } },
        update: { quantity: { increment: quantity } },
        create: { userId, productId, quantity },
        include: { product: true }
      });
      return { success: true, data: cartItem };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ success: false, error: 'Failed to add to cart' });
    }
  });

  // PUT /:productId - Set quantity for a cart item
  fastify.put('/:productId', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { productId } = request.params;
      const { quantity } = request.body;
      if (!quantity || quantity < 1) {
        return reply.status(400).send({ success: false, error: 'Quantity >= 1 required' });
      }
      // Check if cart item exists
      const cartItem = await fastify.prisma.cartItem.findUnique({ where: { userId_productId: { userId, productId } } });
      if (!cartItem) {
        return reply.status(404).send({ success: false, error: 'Cart item not found' });
      }
      const updated = await fastify.prisma.cartItem.update({
        where: { userId_productId: { userId, productId } },
        data: { quantity },
        include: { product: true }
      });
      return { success: true, data: updated };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ success: false, error: 'Failed to update cart item' });
    }
  });

  // DELETE /:productId - Remove item from cart
  fastify.delete('/:productId', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { productId } = request.params;
      // Check if cart item exists
      const cartItem = await fastify.prisma.cartItem.findUnique({ where: { userId_productId: { userId, productId } } });
      if (!cartItem) {
        return reply.status(404).send({ success: false, error: 'Cart item not found' });
      }
      await fastify.prisma.cartItem.delete({ where: { userId_productId: { userId, productId } } });
      return { success: true };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ success: false, error: 'Failed to remove cart item' });
    }
  });
  fastify.delete('/', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      await fastify.prisma.cartItem.deleteMany({
        where: { userId }
      });
      return { success: true };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ success: false, error: 'Failed to remove cart item' });
    }
  });



  // POST /apply-coupon - Validate and apply a coupon code to the current user's cart (stateless)
  fastify.post('/apply-coupon', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { code } = request.body;
      if (!code) {
        return reply.status(400).send({ success: false, error: 'Coupon code is required' });
      }

      // MySQL: Case-insensitive coupon code search in JS
      const allCoupons = await fastify.prisma.coupon.findMany({
        where: { isActive: true }
      });
      const coupon = allCoupons.find(c => c.code.toLowerCase() === code.trim().toLowerCase());
      if (!coupon) {
        return reply.status(404).send({ success: false, error: 'Invalid or inactive coupon code' });
      }

      const now = new Date();
      if (now < coupon.validFrom || now > coupon.validTill) {
        return reply.status(400).send({ success: false, error: 'Coupon is not valid at this time' });
      }

      // Check global usage limit
      if (coupon.usageLimit !== null && coupon.usageLimit !== undefined) {
        const totalUsage = await fastify.prisma.couponUsage.count({ where: { couponId: coupon.id } });
        if (totalUsage >= coupon.usageLimit) {
          return reply.status(400).send({ success: false, error: 'Coupon usage limit reached' });
        }
      }

      // Check per-user usage limit
      if (coupon.userLimit !== null && coupon.userLimit !== undefined) {
        const userUsage = await fastify.prisma.couponUsage.count({ where: { couponId: coupon.id, userId } });
        if (userUsage >= coupon.userLimit) {
          return reply.status(400).send({ success: false, error: 'You have already used this coupon the maximum number of times' });
        }
      }

      // Get user's cart items
      const cartItems = await fastify.prisma.cartItem.findMany({
        where: { userId },
        include: { product: true },
      });
      if (!cartItems.length) {
        return reply.status(400).send({ success: false, error: 'Cart is empty' });
      }
      const subtotal = cartItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

      // Check minAmount
      if (coupon.minAmount && subtotal < coupon.minAmount) {
        return reply.status(400).send({ success: false, error: `Minimum cart amount for this coupon is ₹${coupon.minAmount}` });
      }

      // Calculate discount
      let discount = 0;
      if (coupon.discountType === 'flat') {
        discount = coupon.discountValue;
      } else if (coupon.discountType === 'percentage') {
        discount = subtotal * (coupon.discountValue / 100);
        if (coupon.maxDiscount) {
          discount = Math.min(discount, coupon.maxDiscount);
        }
      }
      discount = Math.floor(discount); // round down to nearest integer (optional)

      return reply.send({
        success: true,
        data: {
          code: coupon.code,
          discount,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          maxDiscount: coupon.maxDiscount,
          minAmount: coupon.minAmount,
          message: `Coupon applied. You saved ₹${discount}!`,
        },
      });
    } catch (error) {
      console.log(error);
      fastify.log.error(error);
      return reply.status(500).send({ success: false, error: 'Failed to apply coupon' });
    }
  });

  // POST /remove-coupon - Stateless, always succeeds
  fastify.post('/remove-coupon', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send({ success: true, message: 'Coupon removed' });
  });
}

module.exports = cartRoutes; 