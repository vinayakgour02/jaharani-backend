const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key";

async function DeliveryRoutes(fastify, routes) {

  fastify.post("/register", async (request, reply) => {
    try {
      const { email, password, name } = request.body;

      // Basic validation
      if (!email || !password || !name) {
        return reply.status(400).send({
          success: false,
          error: "Missing required fields: email, password, name",
        });
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return reply.status(400).send({
          success: false,
          error: "Invalid email format",
        });
      }

      // Password validation
      if (password.length < 6) {
        return reply.status(400).send({
          success: false,
          error: "Password must be at least 6 characters long",
        });
      }

      const existingpartner = await fastify.prisma.deliveryPartner.findUnique({
        where: { email },
      });

      if (existingpartner) {
        return reply.status(409).send({
          success: false,
          error: "partner with this email already exists",
        });
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create partner
      const partner = await fastify.prisma.deliveryPartner.create({
        data: {
          email,
          password: hashedPassword,
          name,
        },
        select: {
          id: true,
          email: true,
          name: true,
        },
      });

      return reply.status(201).send({
        success: true,
        data: partner,
        message: "partner registered successfully",
      });
    } catch (error) {
      fastify.log.error(error);

      // Handle unique constraint violation
      if (error.code === "P2002" && error.meta?.target?.includes("email")) {
        return reply.status(409).send({
          success: false,
          error: "partner with this email already exists",
        });
      }

      return reply.status(500).send({
        success: false,
        error: "Failed to register partner",
      });
    }
  });

  fastify.put("/delivery-partners/:id", async (request, reply) => {
    try {
      const { id } = request.params;
      const { name, email, password } = request.body;

      if (!id) {
        return reply.status(400).send({
          success: false,
          error: "Delivery partner ID is required",
        });
      }

      // Build update data dynamically
      const updateData = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (password) {
        if (password.length < 6) {
          return reply.status(400).send({
            success: false,
            error: "Password must be at least 6 characters long",
          });
        }
        const saltRounds = 12;
        updateData.password = await bcrypt.hash(password, saltRounds);
      }

      const updatedPartner = await fastify.prisma.deliveryPartner.update({
        where: { id: Number(id) }, // ID is Int
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
        },
      });

      return reply.send({
        success: true,
        data: updatedPartner,
        message: "Delivery partner updated successfully",
      });
    } catch (error) {
      fastify.log.error(error);

      if (error.code === "P2002" && error.meta?.target?.includes("email")) {
        return reply.status(409).send({
          success: false,
          error: "Partner with this email already exists",
        });
      }

      return reply.status(500).send({
        success: false,
        error: "Failed to update partner",
      });
    }
  });

  fastify.delete("/delivery-partners/:id", async (request, reply) => {
    try {
      const { id } = request.params;

      if (!id) {
        return reply.status(400).send({
          success: false,
          error: "Delivery partner ID is required",
        });
      }

      // Delete partner
      const deletedPartner = await fastify.prisma.deliveryPartner.delete({
        where: { id: Number(id) }, // id is Int
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      return reply.send({
        success: true,
        message: "Delivery partner deleted successfully",
        data: deletedPartner,
      });
    } catch (error) {
      fastify.log.error(error);

      if (error.code === "P2025") {
        // Record not found
        return reply.status(404).send({
          success: false,
          error: "Delivery partner not found",
        });
      }

      return reply.status(500).send({
        success: false,
        error: "Failed to delete partner",
      });
    }
  });



  fastify.post("/login", async (request, reply) => {
    try {
      const { email, password } = request.body;
      const partner = await fastify.prisma.deliveryPartner.findUnique({
        where: { email },
      });
      if (!partner) return res.status(404).json({ error: "Not found" });

      const isPasswordValid = await bcrypt.compare(password, partner.password);
      if (!isPasswordValid) {
        return reply.status(401).send({
          success: false,
          error: "Invalid email or password",
        });
      }

      const token = jwt.sign(
        {
          partnerId: partner.id,
          email: partner.email,
          name: partner.name,
        },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      const partnerData = {
        id: partner.id,
        email: partner.email,
        name: partner.name,
      };

      return reply.send({
        success: true,
        data: {
          partner: partnerData,
          token,
        },
        message: "Login successful",
      });
    } catch (error) {
      console.log(error);
      return reply.status(500).send({ message: "Error login Delivery" });
    }
  });

  fastify.get("/delivery", async (request, reply) => {
    try {
      const partner = await fastify.prisma.deliveryPartner.findMany();

      return reply.send({
        success: true,
        data: {
          partner,
        },
      });
    } catch (error) {
      console.log(error);
      return reply.status(500).send({ message: "Failed to get Partners" });
    }
  });

  fastify.put("/order/status", async (request, reply) => {
    try {
      const { orderId, status, deliveryPartnerId } = request.body;

      if (!orderId || !status) {
        return reply
          .status(400)
          .send({ message: "Order Id and status are required" });
      }

      // validate status against enum
      const validStatuses = [
        "PENDING",
        "CONFIRMED",
        "PREPARING",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "USER_NOT_REACHABLE",
        "CANCELLED",
      ];
      if (!validStatuses.includes(status)) {
        return reply.status(400).send({ message: "Invalid order status" });
      }

      const updatedOrder = await fastify.prisma.order.update({
        where: { id: orderId },
        data: {
          status,
          ...(deliveryPartnerId && { deliveryPartnerId }), // assign delivery partner if provided
        },
        include: {
          user: true,
          deliveryPartner: true,
        },
      });

      return reply.send({
        message: "Order updated successfully",
        order: updatedOrder,
      });
    } catch (error) {
      console.error(error);
      return reply.status(500).send({ message: "Failed to update order" });
    }
  });

 fastify.get("/orders", async (request, reply) => {
  try {
    const deliveryPartnerId = request.query.deliveryPartnerId
      ? Number(request.query.deliveryPartnerId)
      : undefined

    console.log(deliveryPartnerId) // should log 3, 'number'

    const confirmedOrders = await fastify.prisma.order.findMany({
      where: {
        status: "CONFIRMED",
        ...(deliveryPartnerId && { deliveryPartnerId }),
      },
      include: {
        user: { select: { id: true, name: true, phone: true, email: true } },
        address: true,
        items: { include: { product: true } },
        deliveryPartner: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    })
    console.log(confirmedOrders)

    return reply.send({
      success: true,
      message: "Confirmed orders fetched successfully",
      data: confirmedOrders,
    })
  } catch (error) {
    fastify.log.error(error)
    return reply.status(500).send({
      success: false,
      message: "Failed to fetch confirmed orders",
    })
  }
})



  fastify.get("/delivery-partner/:partnerId/stats", async (request, reply) => {
    const { partnerId } = request.params

    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // Total orders assigned
      const totalOrders = await fastify.prisma.order.count({
        where: { deliveryPartnerId: Number(partnerId) },
      })

      // Pending deliveries
      const pendingDeliveries = await fastify.prisma.order.count({
        where: {
          deliveryPartnerId: Number(partnerId),
          status: { in: ["CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY"] },
        },
      })

      // Completed today
      const completedToday = await fastify.prisma.order.count({
        where: {
          deliveryPartnerId: Number(partnerId),
          status: "DELIVERED",
          createdAt: { gte: today },
        },
      })

      // Unreachable today
      const unreachableToday = await fastify.prisma.order.count({
        where: {
          deliveryPartnerId: Number(partnerId),
          status: "USER_NOT_REACHABLE",
          createdAt: { gte: today },
        },
      })

      return reply.send({
        stats: {
          totalOrders,
          pendingDeliveries,
          completedToday,
          unreachableToday,
        },
      })
    } catch (error) {
      console.error(error)
      return reply.status(500).send({ message: "Failed to fetch stats" })
    }
  })

  fastify.put("/order/assign", async (request, reply) => {
    try {
      const { orderId, deliveryPartnerId } = request.body;

      if (!orderId || !deliveryPartnerId) {
        return reply.status(400).send({
          success: false,
          message: "Both orderId and deliveryPartnerId are required",
        });
      }

      // Verify the delivery partner exists
      const partner = await fastify.prisma.deliveryPartner.findUnique({
        where: { id: Number(deliveryPartnerId) },
      });

      if (!partner) {
        return reply.status(404).send({
          success: false,
          message: "Delivery partner not found",
        });
      }

      // Update the order with delivery partner assignment
      const updatedOrder = await fastify.prisma.order.update({
        where: { id: orderId },
        data: { deliveryPartnerId: Number(deliveryPartnerId) },
        include: {
          user: {
            select: { id: true, name: true, phone: true, email: true },
          },
          deliveryPartner: {
            select: { id: true, name: true, email: true },
          },
          items: {
            include: { product: true },
          },
          address: true,
        },
      });

      return reply.send({
        success: true,
        message: `Order assigned to delivery partner ${partner.name} successfully`,
        data: updatedOrder,
      });
    } catch (error) {
      console.error(error);
      return reply.status(500).send({
        success: false,
        message: "Failed to assign delivery partner",
      });
    }
  });


}

module.exports = DeliveryRoutes;
