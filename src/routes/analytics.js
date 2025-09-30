async function analyticsRoutes(fastify, options) {
  function getDateRange(period) {
    const now = new Date();
    const start = new Date();

    switch (period) {
      case "today":
        start.setHours(0, 0, 0, 0);
        return { start, end: now };
      case "last1week":
        start.setDate(now.getDate() - 7);
        return { start, end: now };
      case "last1month":
        start.setMonth(now.getMonth() - 1);
        return { start, end: now };
      case "last1quarter":
        start.setMonth(now.getMonth() - 3);
        return { start, end: now };
      case "last1year":
        start.setFullYear(now.getFullYear() - 1);
        return { start, end: now };
      default:
        start.setDate(now.getDate() - 7);
        return { start, end: now };
    }
  }

  function getPreviousPeriod({ start, end }) {
    const duration = end.getTime() - start.getTime();
    const previousEnd = new Date(start.getTime());
    const previousStart = new Date(start.getTime() - duration);
    return { start: previousStart, end: previousEnd };
  }

  function calculatePercentageChange(current, previous) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  // Multi-period analytics endpoint
  fastify.get("/multi-period-stats", async (request, reply) => {
    try {
      const { status } = request.query;

      const periods = [
        "today",
        "last1week",
        "last1month",
        "last1quarter",
        "last1year",
      ];
      const results = {
        orders: {},
        revenue: {},
      };

      for (const period of periods) {
        const { start, end } = getDateRange(period);

        const whereClause = {
          createdAt: {
            gte: start,
            lte: end,
          },
        };

        const revenueWhereClause = {
          ...whereClause,
          paymentStatus: "PAID",
        };

        if (status && status !== "all") {
          whereClause.status = status;
          revenueWhereClause.status = status;
        }

        // Get orders count
        const ordersCount = await fastify.prisma.order.count({
          where: whereClause,
        });

        // Get revenue
        const revenueData = await fastify.prisma.order.aggregate({
          where: revenueWhereClause,
          _sum: { total: true },
        });

        results.orders[period] = ordersCount;
        results.revenue[period] = revenueData._sum.total || 0;
      }

      return {
        success: true,
        data: results,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply
        .status(500)
        .send({ success: false, error: "Failed to fetch multi-period stats" });
    }
  });

  // Enhanced users analytics with filtering
  fastify.get("/users", async (request, reply) => {
    try {
      const {
        minRevenue,
        maxRevenue,
        minOrders,
        maxOrders,
        dateRange = "last1month",
        limit = 50,
        offset = 0,
        sortBy = "totalRevenue",
        sortOrder = "desc",
        search,
      } = request.query;

      const { start, end } = getDateRange(dateRange);

      // Build the where clause for orders
      const orderWhereClause = {
        createdAt: {
          gte: start,
          lte: end,
        },
        paymentStatus: "PAID",
      };

      // Get users with their order statistics
      const users = await fastify.prisma.user.findMany({
        where: {
          ...(search && {
            OR: [
              { name: { contains: search } },
              { email: { contains: search } },
              { phone: { contains: search } },
            ],
          }),
          orders: {
            some: orderWhereClause,
          },
        },
        include: {
          orders: {
            where: orderWhereClause,
            select: {
              id: true,
              total: true,
              createdAt: true,
            },
          },
        },
        skip: parseInt(offset),
        take: parseInt(limit),
      });

      // Process and filter users based on criteria
      const processedUsers = users
        .map((user) => {
          const totalOrders = user.orders.length;
          const totalRevenue = user.orders.reduce(
            (sum, order) => sum + order.total,
            0
          );
          const avgOrderValue =
            totalOrders > 0 ? totalRevenue / totalOrders : 0;
          const lastOrderDate =
            user.orders.length > 0
              ? Math.max(
                  ...user.orders.map((o) => new Date(o.createdAt).getTime())
                )
              : null;

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            totalOrders,
            totalRevenue,
            avgOrderValue,
            lastOrderDate: lastOrderDate ? new Date(lastOrderDate) : null,
            registrationDate: user.createdAt,
          };
        })
        .filter((user) => {
          // Apply revenue filters
          if (minRevenue && user.totalRevenue < parseFloat(minRevenue))
            return false;
          if (maxRevenue && user.totalRevenue > parseFloat(maxRevenue))
            return false;

          // Apply order count filters
          if (minOrders && user.totalOrders < parseInt(minOrders)) return false;
          if (maxOrders && user.totalOrders > parseInt(maxOrders)) return false;

          return true;
        });

      // Sort users
      processedUsers.sort((a, b) => {
        const aValue = a[sortBy] || 0;
        const bValue = b[sortBy] || 0;

        if (sortOrder === "desc") {
          return bValue > aValue ? 1 : bValue < aValue ? -1 : 0;
        } else {
          return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        }
      });

      // Get total count for pagination
      const totalUsers = await fastify.prisma.user.count({
        where: {
          ...(search && {
            OR: [
              { name: { contains: search } },
              { email: { contains: search } },
              { phone: { contains: search } },
            ],
          }),
          orders: {
            some: orderWhereClause,
          },
        },
      });

      return {
        success: true,
        data: {
          users: processedUsers,
          totalCount: totalUsers,
          hasMore: parseInt(offset) + parseInt(limit) < totalUsers,
        },
      };
    } catch (error) {
      fastify.log.error(error);
      return reply
        .status(500)
        .send({ success: false, error: "Failed to fetch users analytics" });
    }
  });

  // User segments analytics
  fastify.get("/user-segments", async (request, reply) => {
    try {
      const { dateRange = "last1month" } = request.query;
      const { start, end } = getDateRange(dateRange);

      const orderWhereClause = {
        createdAt: {
          gte: start,
          lte: end,
        },
        paymentStatus: "PAID",
      };

      // Get all users with their orders in the specified period
      const users = await fastify.prisma.user.findMany({
        where: {
          orders: {
            some: orderWhereClause,
          },
        },
        include: {
          orders: {
            where: orderWhereClause,
            select: {
              total: true,
            },
          },
        },
      });

      // Categorize users
      const segments = {
        new: { count: 0, revenue: 0 }, // 1 order
        returning: { count: 0, revenue: 0 }, // 2-5 orders
        loyal: { count: 0, revenue: 0 }, // 6-10 orders
        vip: { count: 0, revenue: 0 }, // 10+ orders
      };

      users.forEach((user) => {
        const orderCount = user.orders.length;
        const totalRevenue = user.orders.reduce(
          (sum, order) => sum + order.total,
          0
        );

        if (orderCount === 1) {
          segments.new.count++;
          segments.new.revenue += totalRevenue;
        } else if (orderCount <= 5) {
          segments.returning.count++;
          segments.returning.revenue += totalRevenue;
        } else if (orderCount <= 10) {
          segments.loyal.count++;
          segments.loyal.revenue += totalRevenue;
        } else {
          segments.vip.count++;
          segments.vip.revenue += totalRevenue;
        }
      });

      return {
        success: true,
        data: segments,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply
        .status(500)
        .send({ success: false, error: "Failed to fetch user segments" });
    }
  });

  // Enhanced orders summary with all periods
  fastify.get("/orders-summary", async (request, reply) => {
    try {
      const { status } = request.query;

      const periods = [
        "today",
        "last1week",
        "last1month",
        "last1quarter",
        "last1year",
      ];
      const results = {};

      for (const period of periods) {
        const { start, end } = getDateRange(period);
        const previousPeriod = getPreviousPeriod({ start, end });

        const whereClause = {
          createdAt: {
            gte: start,
            lte: end,
          },
        };

        if (status && status !== "all") {
          whereClause.status = status;
        }

        const currentCount = await fastify.prisma.order.count({
          where: whereClause,
        });

        const previousWhereClause = { ...whereClause };
        previousWhereClause.createdAt = {
          gte: previousPeriod.start,
          lte: previousPeriod.end,
        };

        const previousCount = await fastify.prisma.order.count({
          where: previousWhereClause,
        });
        const percentageChange = calculatePercentageChange(
          currentCount,
          previousCount
        );

        results[period] = {
          count: currentCount,
          previousCount,
          percentageChange,
        };
      }

      return {
        success: true,
        data: results,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply
        .status(500)
        .send({ success: false, error: "Failed to fetch orders summary" });
    }
  });

  // Enhanced revenue summary with all periods
  fastify.get("/revenue-summary", async (request, reply) => {
    try {
      const { status } = request.query;

      const periods = [
        "today",
        "last1week",
        "last1month",
        "last1quarter",
        "last1year",
      ];
      const results = {};

      for (const period of periods) {
        const { start, end } = getDateRange(period);
        const previousPeriod = getPreviousPeriod({ start, end });

        const whereClause = {
          createdAt: {
            gte: start,
            lte: end,
          },
          paymentStatus: "PAID",
        };

        if (status && status !== "all") {
          whereClause.status = status;
        }

        const currentRevenue = await fastify.prisma.order.aggregate({
          where: whereClause,
          _sum: { total: true },
        });

        const previousWhereClause = { ...whereClause };
        previousWhereClause.createdAt = {
          gte: previousPeriod.start,
          lte: previousPeriod.end,
        };

        const previousRevenue = await fastify.prisma.order.aggregate({
          where: previousWhereClause,
          _sum: { total: true },
        });

        const current = currentRevenue._sum.total || 0;
        const previous = previousRevenue._sum.total || 0;
        const percentageChange = calculatePercentageChange(current, previous);

        results[period] = {
          revenue: current,
          previousRevenue: previous,
          percentageChange,
        };
      }

      return {
        success: true,
        data: results,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply
        .status(500)
        .send({ success: false, error: "Failed to fetch revenue summary" });
    }
  });

  // Dashboard overview - single endpoint for all key metrics
  fastify.get("/dashboard-overview", async (request, reply) => {
    try {
      const { dateRange = "last1week", status } = request.query;
      const { start, end } = getDateRange(dateRange);

      // Parallel execution of all queries
      const [
        ordersData,
        revenueData,
        customersData,
        aovData,
        topProducts,
        topCustomers,
        revenueByCategory,
        liveOrders,
      ] = await Promise.all([
        // Orders count
        fastify.prisma.order.count({
          where: {
            createdAt: { gte: start, lte: end },
            ...(status && status !== "all" && { status }),
          },
        }),

        // Revenue
        fastify.prisma.order.aggregate({
          where: {
            createdAt: { gte: start, lte: end },
            paymentStatus: "PAID",
            ...(status && status !== "all" && { status }),
          },
          _sum: { total: true },
        }),

        // Unique customers
        fastify.prisma.user.count({
          where: {
            orders: {
              some: {
                createdAt: { gte: start, lte: end },
                ...(status && status !== "all" && { status }),
              },
            },
          },
        }),

        // AOV data
        fastify.prisma.order.aggregate({
          where: {
            createdAt: { gte: start, lte: end },
            paymentStatus: "PAID",
            ...(status && status !== "all" && { status }),
          },
          _avg: { total: true },
          _count: true,
        }),

        // Top products (limited query)
        fastify.prisma.orderItem.groupBy({
          by: ["productId"],
          where: {
            order: {
              createdAt: { gte: start, lte: end },
              paymentStatus: "PAID",
              ...(status && status !== "all" && { status }),
            },
          },
          _sum: { quantity: true },
          _count: true,
          orderBy: { _sum: { quantity: "desc" } },
          take: 5,
        }),

        // Top customers (limited query)
        fastify.prisma.order.groupBy({
          by: ["userId"],
          where: {
            createdAt: { gte: start, lte: end },
            paymentStatus: "PAID",
            ...(status && status !== "all" && { status }),
          },
          _sum: { total: true },
          _count: true,
          orderBy: { _sum: { total: "desc" } },
          take: 5,
        }),

        // Revenue by category
        fastify.prisma.orderItem.findMany({
          where: {
            order: {
              createdAt: { gte: start, lte: end },
              paymentStatus: "PAID",
              ...(status && status !== "all" && { status }),
            },
          },
          include: {
            product: {
              include: { category: true },
            },
          },
        }),

        // Live orders
        fastify.prisma.order.findMany({
          take: 10,
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: { name: true, email: true },
            },
          },
        }),
      ]);

      // Process revenue by category
      const categoryRevenue = new Map();
      revenueByCategory.forEach((item) => {
        const categoryName = item.product.category.name;
        const revenue = item.price * item.quantity;
        categoryRevenue.set(
          categoryName,
          (categoryRevenue.get(categoryName) || 0) + revenue
        );
      });

      return {
        success: true,
        data: {
          summary: {
            orders: ordersData,
            revenue: revenueData._sum.total || 0,
            customers: customersData,
            aov: aovData._avg.total || 0,
          },
          charts: {
            revenueByCategory: Array.from(categoryRevenue.entries())
              .map(([category, revenue]) => ({
                category,
                revenue,
              }))
              .sort((a, b) => b.revenue - a.revenue),
          },
          tables: {
            liveOrders,
          },
        },
      };
    } catch (error) {
      fastify.log.error(error);
      return reply
        .status(500)
        .send({ success: false, error: "Failed to fetch dashboard overview" });
    }
  });
}

module.exports = analyticsRoutes;