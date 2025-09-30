
// JSON Schema definitions for validation
const productSchema = {
  type: 'object',
  required: ['name', 'description', 'price', 'netWeight', 'categoryId'],
  properties: {
    name: { type: 'string', minLength: 1 },
    description: { type: 'string', minLength: 1 },
    price: { type: 'number', minimum: 0 },
    netWeight: { type: 'string', minLength: 1 },
    ingredients: { type: 'string' },
    nutritionalInfo: { type: 'string' },
    storageInstructions: { type: 'string' },
    shelfLife: { type: 'string' },
    isActive: { type: 'boolean' },
    isFeatured: { type: 'boolean' },
    categoryId: { type: 'string', minLength: 1 },
    images: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          url: { type: 'string', minLength: 1 }
        },
        required: ['url']
      }
    }
  }
};

const updateProductSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    description: { type: 'string', minLength: 1 },
    price: { type: 'number', minimum: 0 },
    netWeight: { type: 'string', minLength: 1 },
    ingredients: { type: 'string' },
    nutritionalInfo: { type: 'string' },
    storageInstructions: { type: 'string' },
    shelfLife: { type: 'string' },
    isActive: { type: 'boolean' },
    isFeatured: { type: 'boolean' },
    categoryId: { type: 'string', minLength: 1 },
    images: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          url: { type: 'string', minLength: 1 }
        },
        required: ['url']
      }
    }
  }
};

const querySchema = {
  type: 'object',
  properties: {
    page: { type: 'integer', minimum: 1, default: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
    categoryId: { type: 'string' },
    isActive: { type: 'boolean' },
    isFeatured: { type: 'boolean' },
    search: { type: 'string' },
    sortBy: { type: 'string', enum: ['name', 'price', 'rating', 'createdAt'], default: 'createdAt' },
    sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
  }
};

async function productRoutes(fastify, options) {
  // GET /products - Get all products with filtering, pagination, and search
  fastify.get('/', {
    schema: {
      querystring: querySchema,
      response: {
        200: {
          type: 'object',
          properties: {
            products: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  price: { type: 'number' },
                  netWeight: { type: 'string' },
                  ingredients: { type: ['string', 'null'] },
                  nutritionalInfo: { type: ['string', 'null'] },
                  storageInstructions: { type: ['string', 'null'] },
                  shelfLife: { type: ['string', 'null'] },
                  isActive: { type: 'boolean' },
                  isFeatured: { type: 'boolean' },
                  rating: { type: 'number' },
                  reviewCount: { type: 'integer' },
                  createdAt: { type: 'string', format: 'date-time' },
                  categoryId: { type: 'string' },
                  category: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      image: { type: ['string', 'null'] }
                    }
                  },
                  images: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        url: { type: 'string' }
                      }
                    }
                  }
                }
              }
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                totalPages: { type: 'integer' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { 
        page = 1, 
        limit = 10, 
        categoryId, 
        isActive, 
        isFeatured, 
        search, 
        sortBy = 'createdAt', 
        sortOrder = 'desc' 
      } = request.query;
      const skip = (page - 1) * limit;
      // Build where clause from scratch
      let where = {};
      if (search && typeof search === 'string' && search.trim().length > 0) {
        // Find category IDs matching search
        const matchingCategories = await fastify.prisma.category.findMany({
          where: { name: { contains: search } },
          select: { id: true }
        });
        const categoryIds = matchingCategories.map(cat => cat.id);
        where = {
          OR: [
            { name: { contains: search } },
            { description: { contains: search } },
            ...(categoryIds.length > 0 ? [{ categoryId: { in: categoryIds } }] : [])
          ]
        };
      } else if (categoryId) {
        where = { categoryId };
      }
      if (typeof isActive === 'boolean') where.isActive = isActive;
      if (typeof isFeatured === 'boolean') where.isFeatured = isFeatured;
      
      // Query products and count
      const [total, products] = await Promise.all([
        fastify.prisma.product.count({ where }),
        fastify.prisma.product.findMany({
          where,
          include: { category: true, images: true },
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limit
        })
      ]);
      return {
        products,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('GET /products error:', error);
      reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /products/:id - Get single product by ID
  fastify.get('/:id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      
      const product = await fastify.prisma.product.findUnique({
        where: { id },
        include: {
          category: true,
          images: true,
          reviews: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  avatar: true
                }
              }
            },
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      if (!product) {
        return reply.status(404).send({ error: 'Product not found' });
      }

      return product;
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /products - Create new product
  fastify.post('/', {
    schema: {
      body: productSchema
    }
  }, async (request, reply) => {
    try {
      const { images, ...productData } = request.body;

      // Verify category exists
      const categoryExists = await fastify.prisma.category.findUnique({
        where: { id: productData.categoryId }
      });

      if (!categoryExists) {
        return reply.status(400).send({ error: 'Invalid category ID' });
      }

      // Create product with images
      const product = await fastify.prisma.product.create({
        data: {
          ...productData,
          images: images ? {
            create: images.map(img => ({ url: img.url }))
          } : undefined
        },
        include: {
          category: true,
          images: true
        }
      });

      reply.status(201).send(product);
    } catch (error) {
      fastify.log.error(error);
      if (error.code === 'P2002') {
        reply.status(400).send({ error: 'Product with this name already exists' });
      } else {
        reply.status(500).send({ error: 'Internal server error' });
      }
    }
  });

  // POST /products/bulk - Bulk create products
fastify.post('/bulk', {
  schema: {
    body: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'price', 'netWeight', 'categoryId'],
        properties: {
          name: { type: 'string', minLength: 1 },
          description: { type: 'string' },
          price: { type: 'number', minimum: 0 },
          netWeight: { type: 'string', minLength: 1 },
          categoryId: { type: 'string', minLength: 1 },
          imageUrl: { type: 'string' }
        }
      }
    }
  }
}, async (request, reply) => {
  try {
    const productsData = request.body;

    const createdProducts = await fastify.prisma.$transaction(
      productsData.map(prod => fastify.prisma.product.create({
        data: {
          name: prod.name,
          description: prod.description || '',
          price: prod.price,
          netWeight: prod.netWeight,
          categoryId: prod.categoryId,
          isActive: true,
          images: prod.imageUrl
            ? { create: [{ url: prod.imageUrl }] }
            : undefined
        },
        include: { category: true, images: true }
      }))
    );

    reply.status(201).send({ products: createdProducts });
  } catch (error) {
    fastify.log.error(error);
    reply.status(500).send({ error: 'Internal server error' });
  }
});


  // PUT /products/:id - Update product
  fastify.put('/:id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      body: updateProductSchema
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { images, ...updateData } = request.body;

      // Check if product exists
      const existingProduct = await fastify.prisma.product.findUnique({
        where: { id }
      });

      if (!existingProduct) {
        return reply.status(404).send({ error: 'Product not found' });
      }

      // If categoryId is provided, verify it exists
      if (updateData.categoryId) {
        const categoryExists = await fastify.prisma.category.findUnique({
          where: { id: updateData.categoryId }
        });

        if (!categoryExists) {
          return reply.status(400).send({ error: 'Invalid category ID' });
        }
      }

      // Update product
      const updateQuery = {
        where: { id },
        data: updateData,
        include: {
          category: true,
          images: true
        }
      };

      // Handle images update if provided
      if (images) {
        updateQuery.data.images = {
          deleteMany: {}, // Delete all existing images
          create: images.map(img => ({ url: img.url })) // Create new images
        };
      }

      const updatedProduct = await fastify.prisma.product.update(updateQuery);

      return updatedProduct;
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // DELETE /products/:id - Delete product
  fastify.delete('/:id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params;

      // Check if product exists
      const existingProduct = await fastify.prisma.product.findUnique({
        where: { id }
      });

      if (!existingProduct) {
        return reply.status(404).send({ error: 'Product not found' });
      }

      // Check if product is referenced in any orders or cart items
      const orderItems = await fastify.prisma.orderItem.count({
        where: { productId: id }
      });

      const cartItems = await fastify.prisma.cartItem.count({
        where: { productId: id }
      });

      if (orderItems > 0 || cartItems > 0) {
        return reply.status(400).send({ 
          error: 'Cannot delete product as it is referenced in orders or cart items. Consider deactivating instead.' 
        });
      }

      // Delete the product (images will be deleted due to cascade)
      await fastify.prisma.product.delete({
        where: { id }
      });

      reply.status(204).send();
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // PATCH /products/:id/toggle-active - Toggle product active status
  fastify.patch('/:id/toggle-active', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params;

      const product = await fastify.prisma.product.findUnique({
        where: { id }
      });

      if (!product) {
        return reply.status(404).send({ error: 'Product not found' });
      }

      const updatedProduct = await fastify.prisma.product.update({
        where: { id },
        data: { isActive: !product.isActive },
        include: {
          category: true,
          images: true
        }
      });

      return updatedProduct;
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // PATCH /products/:id/toggle-featured - Toggle product featured status
  fastify.patch('/:id/toggle-featured', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params;

      const product = await fastify.prisma.product.findUnique({
        where: { id }
      });

      if (!product) {
        return reply.status(404).send({ error: 'Product not found' });
      }

      const updatedProduct = await fastify.prisma.product.update({
        where: { id },
        data: { isFeatured: !product.isFeatured },
        include: {
          category: true,
          images: true
        }
      });

      return updatedProduct;
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Internal server error' });
    }
  });
}

module.exports = productRoutes;