// JSON Schema definitions for validation
const orderQuerySchema = {
  type: 'object',
  properties: {
    page: { type: 'integer', minimum: 1, default: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
    status: { 
      type: 'string', 
      enum: ['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'] 
    },
    paymentStatus: { 
      type: 'string', 
      enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'] 
    },
    paymentMethod: { 
      type: 'string', 
      enum: ['COD', 'ONLINE', 'UPI', 'WALLET'] 
    },
    search: { type: 'string' },
    sortBy: { 
      type: 'string', 
      enum: ['orderNumber', 'total', 'createdAt', 'status'], 
      default: 'createdAt' 
    },
    sortOrder: { 
      type: 'string', 
      enum: ['asc', 'desc'], 
      default: 'desc' 
    },
    // Date filters
    dateFilter: { 
      type: 'string', 
      enum: ['today', 'week', 'month', 'quarter', 'year', 'custom'] 
    },
    startDate: { type: 'string', format: 'date' },
    endDate: { type: 'string', format: 'date' },
    // User filter
    userId: { type: 'string' }
  }
};

const updateOrderStatusSchema = {
  type: 'object',
  required: ['status'],
  properties: {
    status: { 
      type: 'string', 
      enum: ['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'] 
    },
    paymentStatus: { 
      type: 'string', 
      enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'] 
    }
  }
};

const orderStatsSchema = {
  type: 'object',
  properties: {
    dateFilter: { 
      type: 'string', 
      enum: ['today', 'week', 'month', 'quarter', 'year', 'custom'] 
    },
    startDate: { type: 'string', format: 'date' },
    endDate: { type: 'string', format: 'date' }
  }
};

async function orderRoutes(fastify, options) {
  // Helper function to build date filter
  function buildDateFilter(dateFilter, startDate, endDate) {
    const now = new Date();
    let filter = {};

    switch (dateFilter) {
      case 'today':
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        filter = {
          createdAt: {
            gte: today,
            lt: tomorrow
          }
        };
        break;

      case 'week':
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        filter = {
          createdAt: {
            gte: weekAgo
          }
        };
        break;

      case 'month':
        const monthAgo = new Date(now);
        monthAgo.setMonth(now.getMonth() - 1);
        filter = {
          createdAt: {
            gte: monthAgo
          }
        };
        break;

      case 'quarter':
        const quarterAgo = new Date(now);
        quarterAgo.setMonth(now.getMonth() - 3);
        filter = {
          createdAt: {
            gte: quarterAgo
          }
        };
        break;

      case 'year':
        const yearAgo = new Date(now);
        yearAgo.setFullYear(now.getFullYear() - 1);
        filter = {
          createdAt: {
            gte: yearAgo
          }
        };
        break;

      case 'custom':
        if (startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          end.setDate(end.getDate() + 1); // Include end date
          filter = {
            createdAt: {
              gte: start,
              lt: end
            }
          };
        }
        break;

      default:
        // No date filter
        break;
    }

    return filter;
  }

  // GET /orders - Get all orders with filtering, pagination, and search
  fastify.get('/', {
    schema: {
      querystring: orderQuerySchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                orders: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      orderNumber: { type: 'string' },
                      userId: { type: 'string' },
                      subtotal: { type: 'number' },
                      deliveryCharges: { type: 'number' },
                      tax: { type: 'number' },
                      discount: { type: 'number' },
                      total: { type: 'number' },
                      status: { type: 'string' },
                      paymentStatus: { type: 'string' },
                      paymentMethod: { type: ['string', 'null'] },
                      paymentGateway: { type: ['string', 'null'] },
                      createdAt: { type: 'string', format: 'date-time' },
                      user: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          name: { type: 'string' },
                          email: { type: ['string', 'null'] },
                          phone: { type: ['string', 'null'] }
                        }
                      },
                      address: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          fullName: { type: 'string' },
                          phone: { type: 'string' },
                          addressLine1: { type: 'string' },
                          city: { type: 'string' },
                          state: { type: 'string' },
                          pincode: { type: 'string' }
                        }
                      },
                      items: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            quantity: { type: 'integer' },
                            price: { type: 'number' },
                            product: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                name: { type: 'string' },
                                images: {
                                  type: 'array',
                                  items: {
                                    type: 'object',
                                    properties: {
                                      url: { type: 'string' }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      },
                      coupon: {
                        type: ['object', 'null'],
                        properties: {
                          id: { type: 'string' },
                          code: { type: 'string' },
                          discountType: { type: 'string' },
                          discountValue: { type: 'number' }
                        }
                      },
                      offer: {
                        type: ['object', 'null'],
                        properties: {
                          id: { type: 'string' },
                          title: { type: 'string' },
                          discountType: { type: 'string' },
                          discountValue: { type: 'number' }
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
      }
    }
  }, async (request, reply) => {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        paymentStatus,
        paymentMethod,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        dateFilter,
        startDate,
        endDate,
        userId
      } = request.query;

      // Build where clause
      const where = {};

      // Status filter
      if (status) {
        where.status = status;
      }

      // Payment status filter
      if (paymentStatus) {
        where.paymentStatus = paymentStatus;
      }

      // Payment method filter
      if (paymentMethod) {
        where.paymentMethod = paymentMethod;
      }

      // User filter
      if (userId) {
        where.userId = userId;
      }

      // Search filter
      if (search) {
        where.OR = [
          { orderNumber: { contains: search, mode: 'insensitive' } },
          { user: { name: { contains: search, mode: 'insensitive' } } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
          { user: { phone: { contains: search, mode: 'insensitive' } } },
          { address: { fullName: { contains: search, mode: 'insensitive' } } },
          { address: { phone: { contains: search, mode: 'insensitive' } } }
        ];
      }

      // Date filter
      const dateFilterClause = buildDateFilter(dateFilter, startDate, endDate);
      Object.assign(where, dateFilterClause);

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Get orders with relations
      const orders = await fastify.prisma.order.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          },
          address: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              addressLine1: true,
              city: true,
              state: true,
              pincode: true
            }
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  images: {
                    select: {
                      url: true
                    }
                  }
                }
              }
            }
          },
          coupon: {
            select: {
              id: true,
              code: true,
              discountType: true,
              discountValue: true
            }
          },
          offer: {
            select: {
              id: true,
              title: true,
              discountType: true,
              discountValue: true
            }
          }
        },
        orderBy: {
          [sortBy]: sortOrder
        },
        skip,
        take: limit
      });

      // Get total count for pagination
      const total = await fastify.prisma.order.count({ where });
      const totalPages = Math.ceil(total / limit);

      return reply.send({
        success: true,
        data: {
          orders,
          pagination: {
            page,
            limit,
            total,
            totalPages
          }
        }
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch orders'
      });
    }
  });

  // GET /orders/:id - Get order by ID
  fastify.get('/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params;

      const order = await fastify.prisma.order.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          },
          address: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              addressLine1: true,
              addressLine2: true,
              city: true,
              state: true,
              pincode: true,
              landmark: true
            }
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  price: true,
                  netWeight: true,
                  images: {
                    select: {
                      url: true
                    }
                  }
                }
              }
            }
          },
          coupon: {
            select: {
              id: true,
              code: true,
              description: true,
              discountType: true,
              discountValue: true
            }
          },
          offer: {
            select: {
              id: true,
              title: true,
              description: true,
              discountType: true,
              discountValue: true
            }
          },
          couponUsage: {
            select: {
              discount: true
            }
          },
          offerUsage: {
            select: {
              discount: true
            }
          }
        }
      });

      if (!order) {
        return reply.status(404).send({
          success: false,
          error: 'Order not found'
        });
      }

      return reply.send({
        success: true,
        data: order
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch order'
      });
    }
  });

  // PATCH /orders/:id/status - Update order status
  fastify.patch('/:id/status', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      body: updateOrderStatusSchema
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { status, paymentStatus } = request.body;

      // Check if order exists
      const existingOrder = await fastify.prisma.order.findUnique({
        where: { id }
      });

      if (!existingOrder) {
        return reply.status(404).send({
          success: false,
          error: 'Order not found'
        });
      }

      // Update order
      const updateData = {};
      if (status) updateData.status = status;
      if (paymentStatus) updateData.paymentStatus = paymentStatus;

      const updatedOrder = await fastify.prisma.order.update({
        where: { id },
        data: updateData,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          },
          address: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              addressLine1: true,
              city: true,
              state: true,
              pincode: true
            }
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  images: {
                    select: {
                      url: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      return reply.send({
        success: true,
        data: updatedOrder,
        message: 'Order status updated successfully'
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to update order status'
      });
    }
  });

  // GET /orders/stats/summary - Get order statistics
  fastify.get('/stats/summary', {
    schema: {
      querystring: orderStatsSchema
    }
  }, async (request, reply) => {
    try {
      const { dateFilter, startDate, endDate } = request.query;

      // Build date filter
      const dateFilterClause = buildDateFilter(dateFilter, startDate, endDate);

      // Get total orders
      const totalOrders = await fastify.prisma.order.count({
       where: { ...dateFilterClause, paymentStatus: 'PAID' }

      });

      // Get orders by status
      const ordersByStatus = await fastify.prisma.order.groupBy({
        by: ['status'],
        where: dateFilterClause,
        _count: {
          status: true
        }
      });

      // Get orders by payment status
      const ordersByPaymentStatus = await fastify.prisma.order.groupBy({
        by: ['paymentStatus'],
        where: dateFilterClause,
        _count: {
          paymentStatus: true
        }
      });

      // Get total revenue
      const revenueData = await fastify.prisma.order.aggregate({
        where: {
          ...dateFilterClause,
          paymentStatus: 'PAID'
        },
        _sum: {
          total: true
        }
      });

      // Get average order value
      const avgOrderValue = await fastify.prisma.order.aggregate({
        where: {
          ...dateFilterClause,
          paymentStatus: 'PAID'
        },
        _avg: {
          total: true
        }
      });

      // Get recent orders (last 5)
      const recentOrders = await fastify.prisma.order.findMany({
        where: dateFilterClause,
        include: {
          user: {
            select: {
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 5
      });

      // Format status data
      const statusStats = {};
      ordersByStatus.forEach(item => {
        statusStats[item.status] = item._count.status;
      });

      const paymentStats = {};
      ordersByPaymentStatus.forEach(item => {
        paymentStats[item.paymentStatus] = item._count.paymentStatus;
      });

      return reply.send({
        success: true,
        data: {
          totalOrders,
          totalRevenue: revenueData._sum.total || 0,
          averageOrderValue: avgOrderValue._avg.total || 0,
          ordersByStatus: statusStats,
          ordersByPaymentStatus: paymentStats,
          recentOrders
        }
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch order statistics'
      });
    }
  });

  // GET /orders/stats/daily - Get daily order statistics
  fastify.get('/stats/daily', {
    schema: {
      querystring: orderStatsSchema
    }
  }, async (request, reply) => {
    try {
      const { dateFilter, startDate, endDate } = request.query;

      // Build date filter
      const dateFilterClause = buildDateFilter(dateFilter, startDate, endDate);

      // Get daily order counts and revenue
      const dailyStats = await fastify.prisma.$queryRaw`
        SELECT 
          DATE(createdAt) as date,
          COUNT(*) as orderCount,
          SUM(CASE WHEN paymentStatus = 'PAID' THEN total ELSE 0 END) as revenue
        FROM \`Order\`
        WHERE createdAt >= ${dateFilterClause.createdAt?.gte || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)}
        GROUP BY DATE(createdAt)
        ORDER BY date DESC
        LIMIT 30
      `;

      return reply.send({
        success: true,
        data: dailyStats
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch daily statistics'
      });
    }
  });

  // GET /orders/export - Export orders to CSV
  fastify.get('/export', {
    schema: {
      querystring: orderQuerySchema
    }
  }, async (request, reply) => {
    try {
      const {
        status,
        paymentStatus,
        paymentMethod,
        search,
        dateFilter,
        startDate,
        endDate,
        userId
      } = request.query;

      // Build where clause (same as main orders endpoint)
      const where = {};

      if (status) where.status = status;
      if (paymentStatus) where.paymentStatus = paymentStatus;
      if (paymentMethod) where.paymentMethod = paymentMethod;
      if (userId) where.userId = userId;

      if (search) {
        where.OR = [
          { orderNumber: { contains: search, mode: 'insensitive' } },
          { user: { name: { contains: search, mode: 'insensitive' } } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
          { user: { phone: { contains: search, mode: 'insensitive' } } },
          { address: { fullName: { contains: search, mode: 'insensitive' } } },
          { address: { phone: { contains: search, mode: 'insensitive' } } }
        ];
      }

      const dateFilterClause = buildDateFilter(dateFilter, startDate, endDate);
      Object.assign(where, dateFilterClause);

      // Get all orders for export
      const orders = await fastify.prisma.order.findMany({
        where,
        include: {
          user: {
            select: {
              name: true,
              email: true,
              phone: true
            }
          },
          address: {
            select: {
              fullName: true,
              phone: true,
              addressLine1: true,
              city: true,
              state: true,
              pincode: true
            }
          },
          items: {
            include: {
              product: {
                select: {
                  name: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      // Convert to CSV format
      const csvHeaders = [
        'Order Number',
        'Customer Name',
        'Customer Email',
        'Customer Phone',
        'Delivery Address',
        'Order Status',
        'Payment Status',
        'Payment Method',
        'Subtotal',
        'Delivery Charges',
        'Tax',
        'Discount',
        'Total',
        'Order Date',
        'Items'
      ];

      const csvRows = orders.map(order => [
        order.orderNumber,
        order.user.name,
        order.user.email || '',
        order.user.phone || '',
        `${order.address.addressLine1}, ${order.address.city}, ${order.address.state} - ${order.address.pincode}`,
        order.status,
        order.paymentStatus,
        order.paymentMethod || '',
        order.subtotal,
        order.deliveryCharges,
        order.tax,
        order.discount,
        order.total,
        order.createdAt.toISOString().split('T')[0],
        order.items.map(item => `${item.product.name} (${item.quantity})`).join('; ')
      ]);

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', 'attachment; filename="orders-export.csv"');
      
      return reply.send(csvContent);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to export orders'
      });
    }
  });
}

module.exports = orderRoutes; 