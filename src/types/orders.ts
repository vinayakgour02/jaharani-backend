// Order Status Types
export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PREPARING = 'PREPARING',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED'
}

// Payment Status Types
export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED'
}

// Payment Method Types
export enum PaymentMethod {
  COD = 'COD',
  ONLINE = 'ONLINE',
  UPI = 'UPI',
  WALLET = 'WALLET'
}

// Date Filter Types
export enum DateFilter {
  TODAY = 'today',
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year',
  CUSTOM = 'custom'
}

// Order Item Interface
export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  price: number;
  product: {
    id: string;
    name: string;
    description?: string;
    netWeight: string;
    images: Array<{
      url: string;
    }>;
  };
}

// User Interface for Orders
export interface OrderUser {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

// Address Interface for Orders
export interface OrderAddress {
  id: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
}

// Coupon Interface
export interface OrderCoupon {
  id: string;
  code: string;
  description?: string;
  discountType: string;
  discountValue: number;
}

// Offer Interface
export interface OrderOffer {
  id: string;
  title: string;
  description?: string;
  discountType: string;
  discountValue: number;
}

// Main Order Interface
export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  subtotal: number;
  deliveryCharges: number;
  tax: number;
  discount: number;
  total: number;
  couponId?: string;
  offerId?: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  paymentGateway?: string;
  gatewayOrderId?: string;
  gatewayResponse?: any;
  addressId: string;
  createdAt: Date;
  user: OrderUser;
  address: OrderAddress;
  items: OrderItem[];
  coupon?: OrderCoupon;
  offer?: OrderOffer;
  couponUsage?: {
    discount: number;
  };
  offerUsage?: {
    discount: number;
  };
}

// Order Query Parameters
export interface OrderQueryParams {
  page?: number;
  limit?: number;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  search?: string;
  sortBy?: 'orderNumber' | 'total' | 'createdAt' | 'status';
  sortOrder?: 'asc' | 'desc';
  dateFilter?: DateFilter;
  startDate?: string;
  endDate?: string;
  userId?: string;
}

// Update Order Status Request
export interface UpdateOrderStatusRequest {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
}

// Order Statistics Response
export interface OrderStats {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  ordersByStatus: Record<OrderStatus, number>;
  ordersByPaymentStatus: Record<PaymentStatus, number>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    total: number;
    status: OrderStatus;
    createdAt: Date;
    user: {
      name: string;
    };
  }>;
}

// Daily Statistics Response
export interface DailyStats {
  date: string;
  orderCount: number;
  revenue: number;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    orders: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

// Order Statistics Query Parameters
export interface OrderStatsQueryParams {
  dateFilter?: DateFilter;
  startDate?: string;
  endDate?: string;
} 