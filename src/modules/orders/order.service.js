import User from "../users/user.model.js";

import * as orderRepository from "./order.repository.js";

import {
  getInventoryByProductId
} from "../inventory/inventory.repository.js";

import {
  removeStockService
} from "../inventory/inventory.service.js";

import Order from "./order.model.js";
import Product from "../products/product.model.js";

import {
  getActiveOffersDB
} from "../offer/offer.repository.js";

import {
  calculateDiscountedPrice,
  matchOfferToProduct
} from "../../common/utils/offerCalculator.js";

import {
  createNotificationService,
  notifyAdminsService
} from "../notification/notification.service.js";

import {
  validateCouponService,
  incrementCouponUsageService
} from "../coupons/coupon.service.js";


const GST_PERCENTAGE = 18; // apne checkout wala GST % yaha rakho


// CHANGE: fixed shipping for online orders. Set by the backend only,
// never read from the request.
const ONLINE_SHIPPING_CHARGE = 100;

const round2 = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

// ======================================================
// HELPER: BUILD SECURE ORDER ITEMS
// ======================================================
const buildSecureOrderItems = async (rawItems, customerType) => {

  if (
    !rawItems ||
    !Array.isArray(rawItems) ||
    rawItems.length === 0
  ) {
    throw new Error("Order must contain products");
  }

  const activeOffers = await getActiveOffersDB();

  const secureItems = [];

  let totalAmount = 0;
  let subtotal = 0;
  let offerDiscount = 0;

  for (const item of rawItems) {

    if (!item.product) {
      throw new Error("Product ID is required");
    }

    const productData =
      await Product.findById(item.product);

    if (!productData) {
      throw new Error(
        `Product not found: ${item.product}`
      );
    }

    // -----------------------------------------------
    // SECURE PRICE FROM DATABASE
    // BUSINESS -> wholesale, everyone else -> retail
    // Old products fall back to sellingPrice
    // -----------------------------------------------

    const pricing = productData.pricing || {};
    const isBusiness = customerType === "BUSINESS";

    const originalPrice = Number(
      (isBusiness ? pricing.wholesalePrice : pricing.retailPrice) ||
      pricing.retailPrice ||
      pricing.sellingPrice ||
      0
    );

    if (originalPrice <= 0) {
      throw new Error(
        `Price not set for product: ${productData.name}`
      );
    }

    // -----------------------------------------------
    // QUANTITY
    // -----------------------------------------------

    const quantity =
      Number(item.quantity);

    if (
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      throw new Error(
        `Invalid quantity for ${productData.name}`
      );
    }

    // -----------------------------------------------
    // ACTIVE OFFER
    // -----------------------------------------------

    const offer =
      matchOfferToProduct(
        productData,
        activeOffers
      );

    const finalPrice =
      calculateDiscountedPrice(
        originalPrice,
        offer
      );

    const discountAmount =
      Math.max(
        originalPrice - finalPrice,
        0
      );

    // -----------------------------------------------
    // SECURE ORDER ITEM
    // -----------------------------------------------

    secureItems.push({

      product: productData._id,

      title: productData.name,

      quantity,

      originalPrice,

      discountAmount,

      price: finalPrice,

      appliedOffer: offer
        ? {
          offerId: offer._id,
          title: offer.title,
          discountType:
            offer.discountType,
          discountValue:
            offer.discountValue
        }
        : null,

      imageUrl:
        productData.images?.[0]?.url || ""

    });

    totalAmount +=
      finalPrice * quantity;
    subtotal += originalPrice * quantity;
    offerDiscount += discountAmount * quantity;
  }

  return {
    secureItems,
    totalAmount,
    subtotal,
    offerDiscount
  };
};


// ======================================================
// CREATE ORDER
// ======================================================

export const createOrder = async (
  orderData,
  createdBy
) => {

  // ==========================================
  // GET CUSTOMER
  // ==========================================

  // ==========================================
  // GET CUSTOMER
  // ==========================================

  // const customer = await User.findById(
  //   orderData.user
  // ).select(
  //   "customerType role"
  // );

  // if (!customer) {
  //   throw new Error(
  //     "Customer not found."
  //   );
  // }


  // ==========================================
  // CUSTOMER / WALK-IN ORDER HANDLING
  // ==========================================

  const isWalkIn =
    orderData.orderSource === "WALK_IN";

  let customer;

  if (isWalkIn) {

    // Walk-In order staff create karta hai,
    // isliye customer user ki zarurat nahi hai.
    if (!createdBy) {
      throw new Error(
        "Authenticated staff user is required for walk-in order."
      );
    }

    // Order schema me user required ho sakta hai,
    // isliye authenticated staff ko reference ke liye use karenge.
    orderData.user =
      orderData.user || createdBy;

    // Walk-In ko Personal/B2C pricing ke saath process karo.
    customer = {
      role: "CUSTOMER",
      customerType: "PERSONAL",
    };

  } else {

    // ==========================================
    // EXISTING ONLINE CUSTOMER VALIDATION
    // ==========================================

    customer = await User.findById(
      orderData.user
    ).select(
      "customerType role"
    );

    if (!customer) {
      throw new Error(
        "Customer not found."
      );
    }

    // ==========================================
    // CUSTOMER CHECK
    // ==========================================

    if (customer.role !== "CUSTOMER") {
      throw new Error(
        "Only customers can create this order."
      );
    }

    // ==========================================
    // CUSTOMER TYPE CHECK
    // ==========================================

    if (
      !["PERSONAL", "BUSINESS"].includes(
        customer.customerType
      )
    ) {
      throw new Error(
        "Customer type is not configured properly."
      );
    }

  }

  // ==========================================
  // CUSTOMER CHECK
  // ==========================================

  if (customer.role !== "CUSTOMER") {
    throw new Error(
      "Only customers can create this order."
    );
  }

  // ==========================================
  // CUSTOMER TYPE CHECK
  // ==========================================

  if (
    !["PERSONAL", "BUSINESS"].includes(
      customer.customerType
    )
  ) {
    throw new Error(
      "Customer type is not configured properly."
    );
  }

  // ==========================================
  // AUTO DETERMINE ORDER TYPE
  // ==========================================

  orderData.orderType =
    customer.customerType === "BUSINESS"
      ? "B2B"
      : "B2C";
  // ==========================================
  // EXISTING CODE
  // ==========================================

  // const isWalkIn =
  //   orderData.orderSource === "WALK_IN";


  // ====================================================
  // BUILD SECURE ORDER ITEMS
  // ====================================================

  // const {
  //   secureItems,
  //   totalAmount
  // } =
  //   await buildSecureOrderItems(
  //     orderData.orderItems,
  //       customer.customerType
  //   );


  // orderData.orderItems =
  //   secureItems;


  // orderData.totalAmount =
  //   totalAmount;


  const {
    secureItems,
    totalAmount,
    subtotal,
    offerDiscount
  } =
    await buildSecureOrderItems(
      orderData.orderItems,
      customer.customerType
    );

  orderData.orderItems = secureItems;
  orderData.totalAmount = totalAmount;
  orderData.subtotal = round2(subtotal);
  orderData.offerDiscount = round2(offerDiscount);

  // ====================================================
  // COUPON VALIDATION
  // ====================================================

  let couponDiscount = 0;

  let couponData = null;


  if (orderData.couponCode) {

    const result =
      await validateCouponService(

        orderData.couponCode,

        totalAmount,

        orderData.user

      );


    couponDiscount =
      Number(
        result.discountAmount || 0
      );




    couponData =
      result.coupon;


    if (!couponData) {
      throw new Error(
        "Invalid coupon"
      );
    }


    orderData.coupon =
      couponData.couponId;


    orderData.couponCode =
      couponData.code;


    orderData.couponDiscount =
      couponDiscount;

  }




  // ====================================================
  // FINAL AMOUNT
  // ====================================================

  // orderData.finalAmount =
  //   Math.max(
  //     totalAmount - couponDiscount,
  //     0
  //   );


  // ====================================================
  // FINAL AMOUNT (offer + coupon + GST + shipping)
  // ====================================================

  couponDiscount = round2(couponDiscount);

  const taxableAmount =
    Math.max(totalAmount - couponDiscount, 0);

  const gstPercentage = GST_PERCENTAGE;

  const gstAmount =
    round2((taxableAmount * gstPercentage) / 100);

  // CHANGE: was Math.max(Number(orderData.shippingCharge) || 0, 0), which
  // was always 0 because the controller never sends it.
  // Online orders get the fixed shipping charge. Walk-in (counter) sales
  // have no shipping.
  const shippingCharge =
    isWalkIn ? 0 : ONLINE_SHIPPING_CHARGE;

  const otherCharges =
    Math.max(Number(orderData.otherCharges) || 0, 0);

  orderData.couponDiscount = couponDiscount;
  orderData.taxableAmount = round2(taxableAmount);
  orderData.gstPercentage = gstPercentage;
  orderData.gstAmount = gstAmount;
  orderData.shippingCharge = round2(shippingCharge);
  orderData.otherCharges = round2(otherCharges);

  orderData.finalAmount =
    round2(
      taxableAmount +
      gstAmount +
      shippingCharge +
      otherCharges
    );

  // CHANGE: walk-in (counter) orders are saved as PAID by the controller,
  // so the paid amount must be the full final amount. Before this, it
  // stayed 0, and the invoice showed Paid 0 / Balance = full amount.
  // Online orders stay 0 until the payment is verified.
  orderData.paidAmount =
    isWalkIn ? orderData.finalAmount : 0;

  // ====================================================
  // WALK-IN STOCK CHECK
  // ====================================================

  if (isWalkIn) {

    if (
      !orderData.orderItems ||
      !Array.isArray(
        orderData.orderItems
      ) ||
      orderData.orderItems.length === 0
    ) {

      throw new Error(
        "Walk-in order must contain products"
      );

    }


    for (
      const item
      of orderData.orderItems
    ) {

      const quantity =
        Number(item.quantity);


      if (
        !Number.isInteger(quantity) ||
        quantity < 1
      ) {

        throw new Error(
          `Invalid quantity for ${item.title || "product"
          }`
        );

      }


      const inventory =
        await getInventoryByProductId(
          item.product
        );


      if (!inventory) {

        throw new Error(
          `Inventory not found for ${item.title ||
          item.product
          }`
        );

      }


      const currentStock =
        Number(
          inventory.currentStock || 0
        );


      const reservedStock =
        Number(
          inventory.reservedStock || 0
        );


      const availableStock =
        currentStock -
        reservedStock;


      if (
        availableStock <
        quantity
      ) {

        throw new Error(

          `${item.title ||
          "Product"
          } has only ${availableStock
          } stock available`

        );

      }

    }

  }


  // ====================================================
  // CREATE ORDER IN DATABASE
  // ====================================================

  const order =
    await orderRepository.createOrder(
      orderData
    );


  // ====================================================
  // INCREMENT COUPON USAGE
  // ====================================================

  if (couponData) {

    try {

      await incrementCouponUsageService(

        couponData.couponId,

        orderData.user

      );

    }
    catch (couponError) {

      // Coupon usage failure should not
      // break already-created order

      console.error(
        "COUPON USAGE INCREMENT ERROR:",
        couponError
      );

    }

  }


  // ====================================================
  // ORDER PLACED NOTIFICATIONS
  // ====================================================

  try {

    const isWalkInOrder =
      orderData.orderSource === "WALK_IN";


    // -----------------------------------------------
    // CUSTOMER NOTIFICATION
    // -----------------------------------------------

    if (!isWalkInOrder) {

      await createNotificationService({

        user:
          orderData.user,

        type:
          "ORDER_PLACED",

        title:
          "Order Placed",

        message:
          "Your order has been placed successfully.",

        relatedId:
          order._id,

        relatedModel:
          "Order"

      });

    }


    // -----------------------------------------------
    // ADMIN NOTIFICATION
    // -----------------------------------------------

    await notifyAdminsService({

      type:
        "ORDER_PLACED",

      title:
        isWalkInOrder
          ? "New Walk-in Order"
          : "New Order Received",

      message:
        isWalkInOrder

          ? `A walk-in order of ₹${orderData.finalAmount} was created.`

          : `A new order of ₹${orderData.finalAmount} has been placed.`,

      relatedId:
        order._id,

      relatedModel:
        "Order"

    });

  }
  catch (notifError) {

    // Notification should NEVER
    // break order creation

    console.error(
      "ORDER NOTIFICATION ERROR:",
      notifError
    );

  }


  // ====================================================
  // INITIAL TRACKING HISTORY
  // ====================================================

  try {

    const orderForTracking =
      await Order.findById(
        order._id
      );


    if (orderForTracking) {

      // -----------------------------------------------
      // CREATE TRACKING OBJECT
      // -----------------------------------------------

      if (
        !orderForTracking.tracking
      ) {

        orderForTracking.tracking = {

          history: [],

          courierName: "",

          trackingNumber: "",

          trackingUrl: "",

          expectedDeliveryDate:
            null

        };

      }


      // -----------------------------------------------
      // ENSURE HISTORY ARRAY
      // -----------------------------------------------

      if (
        !orderForTracking.tracking.history ||
        !Array.isArray(
          orderForTracking.tracking.history
        )
      ) {

        orderForTracking.tracking.history =
          [];

      }


      // -----------------------------------------------
      // INITIAL HISTORY
      // -----------------------------------------------

      orderForTracking.tracking.history.push({

        status:
          orderForTracking.orderStatus,

        message:
          orderForTracking.orderSource ===
            "WALK_IN"

            ? "Walk-in order created"

            : "Order placed successfully",

        updatedBy:
          createdBy,

        createdAt:
          new Date()

      });


      await orderForTracking.save();

    }

  }
  catch (trackingError) {

    // Tracking should NEVER
    // break order creation

    console.error(
      "TRACKING INITIALIZATION ERROR:",
      trackingError
    );

  }


  // ====================================================
  // WALK-IN STOCK DECREASE
  // ====================================================

  if (isWalkIn) {

    for (
      const item
      of orderData.orderItems
    ) {

      await removeStockService(

        item.product,

        Number(
          item.quantity
        ),

        createdBy,

        "ORDER",

        `Walk-in sale - Order ${order._id}`

      );

    }

  }


  // ====================================================
  // ONLINE ORDER
  // ====================================================

  if (
    orderData.orderSource ===
    "ONLINE"
  ) {

    console.log(
      "ONLINE ORDER CREATED - STOCK NOT CHANGED"
    );

  }


  // ====================================================
  // RETURN CREATED ORDER
  // ====================================================

  return order;

};


// ======================================================
// GET ORDER BY ID
// ======================================================

export const getOrderById =
  async (
    orderId
  ) => {

    const order =
      await orderRepository.findOrderById(
        orderId
      );


    if (!order) {

      throw new Error(
        "Order not found"
      );

    }


    return order;

  };


// ======================================================
// GET USER ORDERS
// ======================================================

export const getUserOrders =
  async (
    userId
  ) => {

    return await
      orderRepository.findOrdersByUserId(
        userId
      );

  };


// ======================================================
// GET ALL ORDERS
// ======================================================

export const getAllOrders =
  async () => {

    return await
      orderRepository.findAllOrders();

  };


// ======================================================
// UPDATE ORDER STATUS + TRACKING
// ======================================================

export const updateOrderStatus =
  async (

    orderId,

    status,

    updatedBy = null,

    message = ""

  ) => {

    // ==================================================
    // CHECK ORDER
    // ==================================================

    const order =
      await orderRepository.findOrderById(
        orderId
      );


    if (!order) {

      throw new Error(
        "Order not found"
      );

    }


    // ==================================================
    // UPDATE ORDER STATUS
    // ==================================================

    await orderRepository.updateOrderStatus(

      orderId,

      status

    );


    // ==================================================
    // TRACKING HISTORY
    // ==================================================

    try {

      const trackingOrder =
        await Order.findById(
          orderId
        );


      if (trackingOrder) {

        // ---------------------------------------------
        // CREATE TRACKING OBJECT
        // ---------------------------------------------

        if (
          !trackingOrder.tracking
        ) {

          trackingOrder.tracking = {

            history: [],

            courierName: "",

            trackingNumber: "",

            trackingUrl: "",

            expectedDeliveryDate:
              null

          };

        }


        // ---------------------------------------------
        // ENSURE HISTORY ARRAY
        // ---------------------------------------------

        if (
          !trackingOrder.tracking.history ||
          !Array.isArray(
            trackingOrder.tracking.history
          )
        ) {

          trackingOrder.tracking.history =
            [];

        }


        const history =
          trackingOrder.tracking.history;


        // ---------------------------------------------
        // PREVENT DUPLICATE CONSECUTIVE STATUS
        // ---------------------------------------------

        const lastHistory =
          history.length > 0
            ? history[
            history.length - 1
            ]
            : null;


        if (
          !lastHistory ||
          lastHistory.status !== status
        ) {

          history.push({

            status,

            message:
              message ||
              getDefaultTrackingMessage(
                status
              ),

            updatedBy,

            createdAt:
              new Date()

          });

        }


        // ---------------------------------------------
        // DELIVERED DATE
        // ---------------------------------------------

        if (
          status === "DELIVERED"
        ) {

          trackingOrder.deliveryDate =
            new Date();

        }


        await trackingOrder.save();


        // ==================================================
        // ORDER STATUS NOTIFICATIONS
        // ==================================================

        try {

          const customerMessages = {

            CONFIRMED:
              "Your order is confirmed.",

            PROCESSING:
              "Your order is being processed.",

            SHIPPED:
              "Your order has been shipped.",

            OUT_FOR_DELIVERY:
              "Your order is out for delivery.",

            DELIVERED:
              "Your order has been delivered successfully.",

            CANCELLED:
              "Your order has been cancelled.",

            RETURN_REQUESTED:
              "Your return request has been received.",

            RETURNED:
              "Your order has been returned successfully."



          };


          // ---------------------------------------------
          // CUSTOMER
          // ---------------------------------------------

          if (
            trackingOrder.user
          ) {

            await createNotificationService({

              user:
                trackingOrder.user,

              type:
                "ORDER_STATUS",

              title:
                "Order Status Updated",

              message:
                customerMessages[status] ||
                `Your order status is now ${status}.`,

              relatedId:
                orderId,

              relatedModel:
                "Order"

            });

          }


          // ---------------------------------------------
          // ADMIN
          // ---------------------------------------------

          if (
            status === "SHIPPED" ||
            status === "DELIVERED"
          ) {

            await notifyAdminsService({

              type:
                "ORDER_STATUS",

              title:
                `Order ${status}`,

              message:
                `Order #${orderId
                  .toString()
                  .slice(-6)} has been marked as ${status}.`,

              relatedId:
                orderId,

              relatedModel:
                "Order"

            });

          }

        }
        catch (notifError) {

          // Notification failure should
          // never break status update

          console.error(
            "ORDER STATUS NOTIFICATION ERROR:",
            notifError
          );

        }

      }

    }
    catch (trackingError) {

      // Tracking failure should
      // never break order status update

      console.error(
        "TRACKING UPDATE ERROR:",
        trackingError
      );

    }


    // ==================================================
    // RETURN FRESH ORDER
    // ==================================================

    return await
      orderRepository.findOrderById(
        orderId
      );

  };


// ======================================================
// UPDATE PAYMENT STATUS
// ======================================================

export const updatePaymentStatus =
  async (

    orderId,

    paymentStatus,

    paymentId = ""

  ) => {

    // ==================================================
    // CHECK ORDER
    // ==================================================

    const order =
      await orderRepository.findOrderById(
        orderId
      );


    if (!order) {

      throw new Error(
        "Order not found"
      );

    }


    // ==================================================
    // UPDATE PAYMENT IN DATABASE
    // ==================================================

    const updatedOrder =
      await orderRepository.updatePaymentStatus(

        orderId,

        paymentStatus,

        paymentId

      );


    // ==================================================
    // PAYMENT NOTIFICATIONS
    // ==================================================

    try {

      // -----------------------------------------------
      // PAYMENT SUCCESS
      // -----------------------------------------------

      if (
        paymentStatus === "PAID"
      ) {

        if (
          order.user
        ) {

          await createNotificationService({

            user:
              order.user,

            type:
              "PAYMENT",

            title:
              "Payment Successful",

            message:
              `Your payment for order #${orderId
                .toString()
                .slice(-6)} was successful.`,

            relatedId:
              order._id,

            relatedModel:
              "Order"

          });

        }


        // ---------------------------------------------
        // ADMIN PAYMENT NOTIFICATION
        // ---------------------------------------------

        await notifyAdminsService({

          type:
            "PAYMENT",

          title:
            "Payment Received",

          message:
            `Payment received for order #${orderId
              .toString()
              .slice(-6)}.`,

          relatedId:
            order._id,

          relatedModel:
            "Order"

        });

      }


      // -----------------------------------------------
      // PAYMENT FAILED
      // -----------------------------------------------

      if (
        paymentStatus === "FAILED"
      ) {

        if (
          order.user
        ) {

          await createNotificationService({

            user:
              order.user,

            type:
              "PAYMENT",

            title:
              "Payment Failed",

            message:
              `Your payment for order #${orderId
                .toString()
                .slice(-6)} failed. Please try again.`,

            relatedId:
              order._id,

            relatedModel:
              "Order"

          });

        }

      }

    }
    catch (notifError) {

      // Notification failure should
      // never break payment update

      console.error(
        "PAYMENT NOTIFICATION ERROR:",
        notifError
      );

    }


    // ==================================================
    // RETURN UPDATED ORDER
    // ==================================================

    return updatedOrder;

  };


// ======================================================
// DEFAULT TRACKING MESSAGE
// ======================================================

const getDefaultTrackingMessage =
  (status) => {

    switch (status) {

      case "PENDING":

        return (
          "Your order has been placed."
        );


      case "CONFIRMED":

        return (
          "Your order has been confirmed."
        );


      case "PROCESSING":

        return (
          "Your order is being prepared."
        );


      case "SHIPPED":

        return (
          "Your order has been shipped."
        );


      case "OUT_FOR_DELIVERY":

        return (
          "Your order is out for delivery."
        );


      case "DELIVERED":

        return (
          "Your order has been delivered."
        );


      case "CANCELLED":

        return (
          "Your order has been cancelled."
        );

      case "RETURN_REQUESTED":

        return "Your return request has been received.";


      case "RETURNED":

        return "Your order has been returned successfully.";


      default:

        return (
          "Order status updated."
        );

    }

  };


// ======================================================
// FIND ORDER FOR PRODUCT REVIEW
// ======================================================

export const findOrderForReview = async (
  orderId,
  userId,
  productId
) => {

  return await Order.findOne({

    _id: orderId,

    // Order isi customer ka hona chahiye
    user: userId,

    // Sirf delivered order review kar sakta hai
    orderStatus: "DELIVERED",

    // Product order ke andar hona chahiye
    orderItems: {
      $elemMatch: {
        product: productId
      }
    }

  });

};