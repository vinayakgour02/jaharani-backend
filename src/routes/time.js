async function AfterTimeRoutes(fastify, routes) {
  // Create new afterTime
  fastify.post("/after-time", async (request, reply) => {
    try {
      const { time, text } = request.body;

      if (!time || !text) {
        return reply.status(400).send({
          success: false,
          error: "Both time and text are required",
        });
      }

      const newRecord = await fastify.prisma.afterTime.create({
        data: { time, text },
      });

      return reply.status(201).send({
        success: true,
        data: newRecord,
        message: "afterTime created successfully",
      });
    } catch (error) {
      fastify.log.error(error);

      if (error.code === "P2002") {
        // Unique constraint violation
        return reply.status(409).send({
          success: false,
          error: "A record with this time already exists",
        });
      }

      return reply.status(500).send({
        success: false,
        error: "Failed to create afterTime",
      });
    }
  });

  // Get all
  fastify.get("/after-time", async (request, reply) => {
    try {
      const records = await fastify.prisma.afterTime.findMany();
      return reply.send({
        success: true,
        data: records,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: "Failed to fetch afterTime records",
      });
    }
  });

  // Get single
  fastify.get("/after-time/:time", async (request, reply) => {
    try {
      const { time } = request.params;
      const record = await fastify.prisma.afterTime.findUnique({
        where: { time },
      });

      if (!record) {
        return reply.status(404).send({
          success: false,
          error: "Record not found",
        });
      }

      return reply.send({
        success: true,
        data: record,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: "Failed to fetch afterTime record",
      });
    }
  });

  // Update
  fastify.put("/after-time/:id", async (request, reply) => {
    try {
      const { id } = request.params;
      const { text, time } = request.body;

      if (!text) {
        return reply.status(400).send({
          success: false,
          error: "Text is required for update",
        });
      }

      const updated = await fastify.prisma.afterTime.update({
        where: { id },
        data: { time, text },
      });

      return reply.send({
        success: true,
        data: updated,
        message: "afterTime updated successfully",
      });
    } catch (error) {
      fastify.log.error(error);

      if (error.code === "P2025") {
        return reply.status(404).send({
          success: false,
          error: "Record not found",
        });
      }

      return reply.status(500).send({
        success: false,
        error: "Failed to update afterTime",
      });
    }
  });

  // Delete
  fastify.delete("/after-time/:time", async (request, reply) => {
    try {
      const { time } = request.params;

      const deleted = await fastify.prisma.afterTime.delete({
        where: { time },
      });

      return reply.send({
        success: true,
        data: deleted,
        message: "afterTime deleted successfully",
      });
    } catch (error) {
      fastify.log.error(error);

      if (error.code === "P2025") {
        return reply.status(404).send({
          success: false,
          error: "Record not found",
        });
      }

      return reply.status(500).send({
        success: false,
        error: "Failed to delete afterTime",
      });
    }
  });
}

module.exports = AfterTimeRoutes;
