
async function bannerRoutes(fastify, options) {
    // GET all banners
    fastify.get('/', async (request, reply) => {
        try {
            const banners = await fastify.prisma.banner.findMany({
                orderBy: [
                    { priority: 'desc' },
                    { createdAt: 'desc' }
                ]
            });

            return { success: true, data: banners };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to fetch banners'
            });
        }
    });

    // GET banner by ID
    fastify.get('/:id', async (request, reply) => {
        try {
            const { id } = request.params;

            const banner = await fastify.prisma.banner.findUnique({
                where: { id }
            });

            if (!banner) {
                return reply.status(404).send({
                    success: false,
                    error: 'Banner not found'
                });
            }

            return { success: true, data: banner };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to fetch banner'
            });
        }
    });

    // POST create new banner
    fastify.post('/', async (request, reply) => {
        try {
            const {
                title,
                description,
                imageUrl,
                redirectUrl,
                priority = 0,
                isActive = true
            } = request.body;

            // Basic validation
            if (!imageUrl) {
                return reply.status(400).send({
                    success: false,
                    error: 'Missing required field: imageUrl'
                });
            }

            // Validate imageUrl format (basic URL validation)
            try {
                new URL(imageUrl);
            } catch (err) {
                return reply.status(400).send({
                    success: false,
                    error: 'Invalid imageUrl format'
                });
            }

            // Validate redirectUrl if provided
            if (redirectUrl) {
                try {
                    new URL(redirectUrl);
                } catch (err) {
                    return reply.status(400).send({
                        success: false,
                        error: 'Invalid redirectUrl format'
                    });
                }
            }

            const banner = await fastify.prisma.banner.create({
                data: {
                    title,
                    description,
                    imageUrl,
                    redirectUrl,
                    priority: parseInt(priority),
                    isActive
                }
            });

            return reply.status(201).send({ success: true, data: banner });
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to create banner'
            });
        }
    });

    // PUT update banner
    fastify.put('/:id', async (request, reply) => {
        try {
            const { id } = request.params;
            const {
                title,
                description,
                imageUrl,
                redirectUrl,
                priority,
                isActive
            } = request.body;

            // Check if banner exists
            const existingBanner = await fastify.prisma.banner.findUnique({
                where: { id }
            });

            if (!existingBanner) {
                return reply.status(404).send({
                    success: false,
                    error: 'Banner not found'
                });
            }

            // Validate imageUrl if provided
            if (imageUrl) {
                try {
                    new URL(imageUrl);
                } catch (err) {
                    return reply.status(400).send({
                        success: false,
                        error: 'Invalid imageUrl format'
                    });
                }
            }

            // Validate redirectUrl if provided
            if (redirectUrl) {
                try {
                    new URL(redirectUrl);
                } catch (err) {
                    return reply.status(400).send({
                        success: false,
                        error: 'Invalid redirectUrl format'
                    });
                }
            }

            // Prepare update data
            const updateData = {};
            if (title !== undefined) updateData.title = title;
            if (description !== undefined) updateData.description = description;
            if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
            if (redirectUrl !== undefined) updateData.redirectUrl = redirectUrl;
            if (priority !== undefined) updateData.priority = parseInt(priority);
            if (isActive !== undefined) updateData.isActive = isActive;

            const updatedBanner = await fastify.prisma.banner.update({
                where: { id },
                data: updateData
            });

            return { success: true, data: updatedBanner };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to update banner'
            });
        }
    });

    // DELETE banner
    fastify.delete('/:id', async (request, reply) => {
        try {
            const { id } = request.params;

            // Check if banner exists
            const existingBanner = await fastify.prisma.banner.findUnique({
                where: { id }
            });

            if (!existingBanner) {
                return reply.status(404).send({
                    success: false,
                    error: 'Banner not found'
                });
            }

            await fastify.prisma.banner.delete({
                where: { id }
            });

            return { success: true, message: 'Banner deleted successfully' };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to delete banner'
            });
        }
    });

    // GET active banners (additional route for frontend)
    fastify.get('/active', async (request, reply) => {
        try {
            const activeBanners = await fastify.prisma.banner.findMany({
                where: { isActive: true },
                orderBy: [
                    { priority: 'desc' },
                    { createdAt: 'desc' }
                ]
            });

            return { success: true, data: activeBanners };
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to fetch active banners'
            });
        }
    });
}

module.exports = bannerRoutes;