async function shippingRoutes(fastify, options){
    fastify.post('/', async(request, reply) => {
        try {
          const {price} = request.body;
          const existing = await fastify.prisma.shipping.findFirst()
          let shipping;
          if (existing) {
            shipping = await fastify.prisma.shipping.update({
              where: { id: existing.id },
              data: { price }
            })
          } else {
            shipping = await fastify.prisma.shipping.create({ data: { price } })
          }
          return reply.status(200).send({success: true, data: shipping})
        } catch(error) {
          fastify.log.error(error)
          return reply.status(500).send({success: false, error: 'Failed to save shipping'})
        }
      })
      

    fastify.put('/', async(request, reply) => {
        try{
            const {price, id} = request.body;
            const shipping = await fastify.prisma.shipping.update({
                where:{id: id},
                data: {price}
            })
            return reply.status(200).send({success: true, data: shipping})
        } catch(error){
            fastify.log.error(error)
            return reply.status(500).send({success: false, error: 'Failed to update shipping'})
        }
    })

    fastify.get('/', async(request, reply) => {
        try{
            const shipping = await fastify.prisma.shipping.findMany()
            return reply.status(200).send({success: true, data: shipping})
        } catch(error){
            fastify.log.error(error)
            return reply.status(500).send({success: false, error: 'Failed to get shipping'})
        }
    })
}

module.exports = shippingRoutes;