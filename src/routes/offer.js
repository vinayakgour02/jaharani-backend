// offers.js
async function offerRoutes(fastify, options) {
    // GET all offers
    fastify.get('/', async (request, reply) => {
        try {
            const offers = await fastify.prisma.offer.findMany({
                orderBy: {
                    createdAt: 'desc'
                }
            });

            return { success: true, data: offers };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to fetch offers'
            });
        }
    });

    // GET offer by ID
    fastify.get('/:id', async (request, reply) => {
        try {
            const { id } = request.params;

            const offer = await fastify.prisma.offer.findUnique({
                where: { id },
                include: {
                    orders: true,
                    offerUsage: true
                }
            });

            if (!offer) {
                return reply.status(404).send({
                    success: false,
                    error: 'Offer not found'
                });
            }

            return { success: true, data: offer };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to fetch offer'
            });
        }
    });

    // POST create new offer
    fastify.post('/', async (request, reply) => {
        try {
            const {
                title,
                description,
                discountType,
                discountValue,
                minCartAmount,
                maxDiscount,
                validFrom,
                validTill,
                usageLimit,
                userLimit,
                isActive = true
            } = request.body;

            // Basic validation
            if (!title || !discountType || !discountValue || !minCartAmount || !validFrom || !validTill) {
                return reply.status(400).send({
                    success: false,
                    error: 'Missing required fields: title, discountType, discountValue, minCartAmount, validFrom, validTill'
                });
            }

            if (!['flat', 'percentage'].includes(discountType)) {
                return reply.status(400).send({
                    success: false,
                    error: 'discountType must be either "flat" or "percentage"'
                });
            }

            const offer = await fastify.prisma.offer.create({
                data: {
                    title,
                    description,
                    discountType,
                    discountValue: parseFloat(discountValue),
                    minCartAmount: parseFloat(minCartAmount),
                    maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
                    validFrom: new Date(validFrom),
                    validTill: new Date(validTill),
                    usageLimit: usageLimit ? parseInt(usageLimit) : null,
                    userLimit: userLimit ? parseInt(userLimit) : null,
                    isActive
                }
            });

            return reply.status(201).send({ success: true, data: offer });
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to create offer'
            });
        }
    });

    // PUT update offer
    fastify.put('/:id', async (request, reply) => {
        try {
            const { id } = request.params;
            const {
                title,
                description,
                discountType,
                discountValue,
                minCartAmount,
                maxDiscount,
                validFrom,
                validTill,
                usageLimit,
                userLimit,
                isActive
            } = request.body;

            // Check if offer exists
            const existingOffer = await fastify.prisma.offer.findUnique({
                where: { id }
            });

            if (!existingOffer) {
                return reply.status(404).send({
                    success: false,
                    error: 'Offer not found'
                });
            }

            // Validate discount type if provided
            if (discountType && !['flat', 'percentage'].includes(discountType)) {
                return reply.status(400).send({
                    success: false,
                    error: 'discountType must be either "flat" or "percentage"'
                });
            }

            // Prepare update data
            const updateData = {};
            if (title !== undefined) updateData.title = title;
            if (description !== undefined) updateData.description = description;
            if (discountType !== undefined) updateData.discountType = discountType;
            if (discountValue !== undefined) updateData.discountValue = parseFloat(discountValue);
            if (minCartAmount !== undefined) updateData.minCartAmount = parseFloat(minCartAmount);
            if (maxDiscount !== undefined) updateData.maxDiscount = maxDiscount ? parseFloat(maxDiscount) : null;
            if (validFrom !== undefined) updateData.validFrom = new Date(validFrom);
            if (validTill !== undefined) updateData.validTill = new Date(validTill);
            if (usageLimit !== undefined) updateData.usageLimit = usageLimit ? parseInt(usageLimit) : null;
            if (userLimit !== undefined) updateData.userLimit = userLimit ? parseInt(userLimit) : null;
            if (isActive !== undefined) updateData.isActive = isActive;

            const updatedOffer = await fastify.prisma.offer.update({
                where: { id },
                data: updateData
            });

            return { success: true, data: updatedOffer };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to update offer'
            });
        }
    });

    // DELETE offer
    fastify.delete('/:id', async (request, reply) => {
        try {
            const { id } = request.params;

            // Check if offer exists
            const existingOffer = await fastify.prisma.offer.findUnique({
                where: { id }
            });

            if (!existingOffer) {
                return reply.status(404).send({
                    success: false,
                    error: 'Offer not found'
                });
            }

            await fastify.prisma.offer.delete({
                where: { id }
            });

            return { success: true, message: 'Offer deleted successfully' };
        } catch (error) {
            fastify.log.error(error);

            // Handle foreign key constraint violation
            if (error.code === 'P2003') {
                return reply.status(409).send({
                    success: false,
                    error: 'Cannot delete offer as it is being used in orders'
                });
            }

            return reply.status(500).send({
                success: false,
                error: 'Failed to delete offer'
            });
        }
    });
}

module.exports = offerRoutes;