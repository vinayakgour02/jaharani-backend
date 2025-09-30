// coupons.js
async function couponRoutes(fastify, options) {
    // GET all coupons
    fastify.get('/', async (request, reply) => {
      try {
        const coupons = await fastify.prisma.coupon.findMany({
          orderBy: {
            createdAt: 'desc'
          }
        });
        
        return { success: true, data: coupons };
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ 
          success: false, 
          error: 'Failed to fetch coupons' 
        });
      }
    });
  
    // GET coupon by ID
    fastify.get('/:id', async (request, reply) => {
      try {
        const { id } = request.params;
        
        const coupon = await fastify.prisma.coupon.findUnique({
          where: { id },
          include: {
            orders: true,
            couponUsage: true
          }
        });
        
        if (!coupon) {
          return reply.status(404).send({ 
            success: false, 
            error: 'Coupon not found' 
          });
        }
        
        return { success: true, data: coupon };
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ 
          success: false, 
          error: 'Failed to fetch coupon' 
        });
      }
    });
  
    // POST create new coupon
    fastify.post('/', async (request, reply) => {
      try {
        const {
          code,
          description,
          discountType,
          discountValue,
          validFrom,
          validTill,
          minAmount,
          maxDiscount,
          usageLimit,
          userLimit,
          isActive = true
        } = request.body;
  
        // Basic validation
        if (!code || !discountType || !discountValue || !validFrom || !validTill) {
          return reply.status(400).send({
            success: false,
            error: 'Missing required fields: code, discountType, discountValue, validFrom, validTill'
          });
        }
  
        if (!['percentage', 'flat'].includes(discountType)) {
          return reply.status(400).send({
            success: false,
            error: 'discountType must be either "percentage" or "flat"'
          });
        }
  
        const coupon = await fastify.prisma.coupon.create({
          data: {
            code,
            description,
            discountType,
            discountValue: parseFloat(discountValue),
            validFrom: new Date(validFrom),
            validTill: new Date(validTill),
            minAmount: minAmount ? parseFloat(minAmount) : null,
            maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
            usageLimit: usageLimit ? parseInt(usageLimit) : null,
            userLimit: userLimit ? parseInt(userLimit) : null,
            isActive
          }
        });
  
        return reply.status(201).send({ success: true, data: coupon });
      } catch (error) {
        fastify.log.error(error);
        
        // Handle unique constraint violation
        if (error.code === 'P2002' && error.meta?.target?.includes('code')) {
          return reply.status(409).send({
            success: false,
            error: 'Coupon code already exists'
          });
        }
        
        return reply.status(500).send({ 
          success: false, 
          error: 'Failed to create coupon' 
        });
      }
    });
  
    // PUT update coupon
    fastify.put('/:id', async (request, reply) => {
      try {
        const { id } = request.params;
        const {
          code,
          description,
          discountType,
          discountValue,
          validFrom,
          validTill,
          minAmount,
          maxDiscount,
          usageLimit,
          userLimit,
          isActive
        } = request.body;
  
        // Check if coupon exists
        const existingCoupon = await fastify.prisma.coupon.findUnique({
          where: { id }
        });
  
        if (!existingCoupon) {
          return reply.status(404).send({ 
            success: false, 
            error: 'Coupon not found' 
          });
        }
  
        // Validate discount type if provided
        if (discountType && !['percentage', 'flat'].includes(discountType)) {
          return reply.status(400).send({
            success: false,
            error: 'discountType must be either "percentage" or "flat"'
          });
        }
  
        // Prepare update data
        const updateData = {};
        if (code !== undefined) updateData.code = code;
        if (description !== undefined) updateData.description = description;
        if (discountType !== undefined) updateData.discountType = discountType;
        if (discountValue !== undefined) updateData.discountValue = parseFloat(discountValue);
        if (validFrom !== undefined) updateData.validFrom = new Date(validFrom);
        if (validTill !== undefined) updateData.validTill = new Date(validTill);
        if (minAmount !== undefined) updateData.minAmount = minAmount ? parseFloat(minAmount) : null;
        if (maxDiscount !== undefined) updateData.maxDiscount = maxDiscount ? parseFloat(maxDiscount) : null;
        if (usageLimit !== undefined) updateData.usageLimit = usageLimit ? parseInt(usageLimit) : null;
        if (userLimit !== undefined) updateData.userLimit = userLimit ? parseInt(userLimit) : null;
        if (isActive !== undefined) updateData.isActive = isActive;
  
        const updatedCoupon = await fastify.prisma.coupon.update({
          where: { id },
          data: updateData
        });
  
        return { success: true, data: updatedCoupon };
      } catch (error) {
        fastify.log.error(error);
        
        // Handle unique constraint violation
        if (error.code === 'P2002' && error.meta?.target?.includes('code')) {
          return reply.status(409).send({
            success: false,
            error: 'Coupon code already exists'
          });
        }
        
        return reply.status(500).send({ 
          success: false, 
          error: 'Failed to update coupon' 
        });
      }
    });
  
    // DELETE coupon
    fastify.delete('/:id', async (request, reply) => {
      try {
        const { id } = request.params;
  
        // Check if coupon exists
        const existingCoupon = await fastify.prisma.coupon.findUnique({
          where: { id }
        });
  
        if (!existingCoupon) {
          return reply.status(404).send({ 
            success: false, 
            error: 'Coupon not found' 
          });
        }
  
        await fastify.prisma.coupon.delete({
          where: { id }
        });
  
        return { success: true, message: 'Coupon deleted successfully' };
      } catch (error) {
        fastify.log.error(error);
        
        // Handle foreign key constraint violation
        if (error.code === 'P2003') {
          return reply.status(409).send({
            success: false,
            error: 'Cannot delete coupon as it is being used in orders'
          });
        }
        
        return reply.status(500).send({ 
          success: false, 
          error: 'Failed to delete coupon' 
        });
      }
    });
  }
  
  module.exports = couponRoutes;