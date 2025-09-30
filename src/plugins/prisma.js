const fp = require('fastify-plugin');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = fp(async function (fastify, opts) {
  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async (fastifyInstance, done) => {
    await prisma.$disconnect();
    done();
  });
});
