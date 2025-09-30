// categories.js
async function categoryRoutes(fastify, options) {
    // GET all categories
    fastify.get('/categories', async (request, reply) => {
      try {
        const categories = await fastify.prisma.category.findMany({
          include: {
            products: {
              select: {
                id: true
              }
            }
          }
        });
        return reply.send(categories);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ message: 'Error fetching categories' });
      }
    });
  
    // GET single category by ID
    fastify.get('/categories/:id', async (request, reply) => {
      try {
        const { id } = request.params;
        const category = await fastify.prisma.category.findUnique({
          where: { id },
          include: {
            products: {
              select: {
                id: true,
                name: true
              }
            }
          }
        });
  
        if (!category) {
          return reply.status(404).send({ message: 'Category not found' });
        }
  
        return reply.send(category);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ message: 'Error fetching category' });
      }
    });
  
    // POST create new category
    fastify.post('/categories', async (request, reply) => {
      try {
        const { name, image } = request.body;
  
        // Check if category already exists
        const existingCategory = await fastify.prisma.category.findUnique({
          where: { name }
        });
  
        if (existingCategory) {
          return reply.status(400).send({ message: 'Category with this name already exists' });
        }
  
        const newCategory = await fastify.prisma.category.create({
          data: {
            name,
            image
          }
        });
  
        return reply.status(201).send(newCategory);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ message: 'Error creating category' });
      }
    });
  
    // PUT update category
    fastify.put('/categories/:id', async (request, reply) => {
      try {
        const { id } = request.params;
        const { name, image } = request.body;
  
        // Check if category exists
        const existingCategory = await fastify.prisma.category.findUnique({
          where: { id }
        });
  
        if (!existingCategory) {
          return reply.status(404).send({ message: 'Category not found' });
        }
  
        // Check if new name is already taken by another category
        if (name && name !== existingCategory.name) {
          const nameTaken = await fastify.prisma.category.findUnique({
            where: { name }
          });
  
          if (nameTaken) {
            return reply.status(400).send({ message: 'Category with this name already exists' });
          }
        }
  
        const updatedCategory = await fastify.prisma.category.update({
          where: { id },
          data: {
            name,
            image
          }
        });
  
        return reply.send(updatedCategory);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ message: 'Error updating category' });
      }
    });
  
    // DELETE category
    fastify.delete('/categories/:id', async (request, reply) => {
      try {
        const { id } = request.params;
  
        // Check if category exists
        const existingCategory = await fastify.prisma.category.findUnique({
          where: { id }
        });
  
        if (!existingCategory) {
          return reply.status(404).send({ message: 'Category not found' });
        }
  
        // Check if category has products
        const productsCount = await fastify.prisma.product.count({
          where: { categoryId: id }
        });
  
        if (productsCount > 0) {
          return reply.status(400).send({ 
            message: 'Cannot delete category with associated products' 
          });
        }
  
        await fastify.prisma.category.delete({
          where: { id }
        });
  
        return reply.status(204).send();
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ message: 'Error deleting category' });
      }
    });
  }
  
  module.exports = categoryRoutes;