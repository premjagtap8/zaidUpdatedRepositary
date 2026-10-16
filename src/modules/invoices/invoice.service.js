import Invoice from "./invoice.model.js";
import * as invoiceRepository from "./invoice.repository.js";

import Order from "../orders/order.model.js";
import Payment from "../payments/payment.model.js";

// ==========================================
// GENERATE INVOICE NUMBER
// ==========================================

const generateInvoiceNumber = async () => {
  const year = new Date().getFullYear();

  const count = await Invoice.countDocuments();

  const nextNumber = count + 1;

  return `INV${year}${String(nextNumber).padStart(6, "0")}`;
};

// ==========================================
// CREATE INVOICE FROM ORDER
// ==========================================

export const createInvoiceFromOrder = async (orderId) => {
  console.log("=================================");
  console.log("CREATE INVOICE STARTED");
  console.log("ORDER ID:", orderId);

  // ==========================================
  // 1. CHECK EXISTING INVOICE
  // ==========================================

  const existingInvoice =
    await invoiceRepository.findInvoiceByOrderId(orderId);

  if (existingInvoice) {
    console.log(
      "INVOICE ALREADY EXISTS:",
      existingInvoice.invoiceNumber
    );

    return existingInvoice;
  }

  // ==========================================
  // 2. FIND ORDER
  // ==========================================

  const order = await Order.findById(orderId)
    .populate("user")
    .populate("soldBy")
    .populate("orderItems.product");

  if (!order) {
    throw new Error("Order not found");
  }

  console.log("ORDER FOUND:", order._id);
  console.log("ORDER SOURCE:", order.orderSource);
  console.log("ORDER PAYMENT STATUS:", order.paymentStatus);
  console.log("ORDER PAID AMOUNT:", order.paidAmount);

  // ==========================================
  // 3. USER VALIDATION
  // ==========================================

  if (!order.user?._id) {
    throw new Error(
      "Customer/user is missing from order"
    );
  }

  // ==========================================
  // 4. ORDER MUST BE PAID
  // ==========================================

  if (order.paymentStatus !== "PAID") {
    throw new Error(
      `Invoice can only be generated for paid order. Current status: ${order.paymentStatus}`
    );
  }

  // ==========================================
  // 5. FIND SUCCESSFUL PAYMENT
  // ==========================================

  const payment = await Payment.findOne({
    referenceId: order._id,
    paymentFor: "ORDER",
    paymentStatus: "SUCCESS",
    isDeleted: false,
  })
    .sort({
      createdAt: -1,
    });

  console.log(
    "SUCCESSFUL PAYMENT FOUND:",
    payment
  );

  // ==========================================
  // IMPORTANT
  //
  // Walk-in payment may not have a Payment
  // document.
  //
  // Therefore DO NOT force payment to exist.
  // ==========================================

  // ==========================================
  // 6. ITEMS
  // ==========================================


  // ==========================================
  // 6. ITEMS
  //
  // Each invoice item is built from the order item.
  // The product is populated (.populate("orderItems.product")),
  // so we copy the HSN code from the product into the item.
  // This way the invoice keeps the HSN that was valid
  // on the invoice date, even if the product is edited later.
  // ==========================================

  const items = (order.orderItems || []).map(
    (item) => {
      // Populated product document (or empty object if only an ID)
      const productDoc =
        item.product && typeof item.product === "object"
          ? item.product
          : {};

      return {
        itemType: "PRODUCT",

        referenceId:
          item.product?._id ||
          item.product ||
          null,

        product:
          item.product?._id ||
          item.product ||
          null,

        title:
          item.title ||
          productDoc.name ||
          "Product",

        description:
          item.description ||
          "",

        // ==========================================
        // HSN CODE
        // Copied from the product at invoice creation
        // ==========================================

        hsnCode:
          productDoc.hsnCode ||
          "",

        quantity:
          Number(item.quantity || 1),

        originalPrice:
          Number(item.originalPrice || 0),

        discountAmount:
          Number(item.discountAmount || 0),

        price:
          Number(item.price || 0),

        total:
          Number(item.price || 0) *
          Number(item.quantity || 1),

        imageUrl:
          item.imageUrl ||
          "",
      };
    }
  );

  // ==========================================
  // 7. SUBTOTAL
  // ==========================================

  const subtotal = items.reduce(
    (sum, item) => {
      return (
        sum +
        Number(item.originalPrice || 0) *
        Number(item.quantity || 1)
      );
    },
    0
  );

  // ==========================================
  // 8. DISCOUNT
  // ==========================================

  const discount = items.reduce(
    (sum, item) => {
      return (
        sum +
        Number(item.discountAmount || 0) *
        Number(item.quantity || 1)
      );
    },
    0
  );

  // ==========================================
  // 9. TOTAL
  // ==========================================

  // const totalAmount =
  //   Number(order.totalAmount || 0);

  // ==========================================
  // 9. TOTAL
  // ==========================================

  // order.totalAmount = product/offer ke baad amount
  // order.finalAmount = GST + coupon + shipping ke baad
  // actual payable amount

  const totalAmount =
    Number(
      order.finalAmount ??
      order.totalAmount ??
      0
    );


  // ==========================================
  // 9A. FINANCIAL BREAKDOWN
  // ==========================================

  const orderSubtotal =
    Number(
      order.subtotal ??
      subtotal ??
      0
    );

  const orderOfferDiscount =
    Number(
      order.offerDiscount ??
      discount ??
      0
    );

  const couponDiscount =
    Number(
      order.couponDiscount ??
      0
    );

  const taxableAmount =
    Number(
      order.taxableAmount ??
      Math.max(
        Number(order.totalAmount || 0) -
        couponDiscount,
        0
      )
    );

  const gstPercentage =
    Number(
      order.gstPercentage ??
      18
    );

  const gstAmount =
    Number(
      order.gstAmount ??
      (
        taxableAmount *
        gstPercentage
      ) / 100
    );

  const shippingCharge =
    Number(
      order.shippingCharge ??
      0
    );

  const otherCharges =
    Number(
      order.otherCharges ??
      0
    );

  const finalAmount =
    Number(
      order.finalAmount ??
      (
        taxableAmount +
        gstAmount +
        shippingCharge +
        otherCharges
      )
    );

  // ==========================================
  // 10. PAID AMOUNT
  // ==========================================

  let paidAmount =
    Number(order.paidAmount || 0);

  // ==========================================
  // ONLINE PAYMENT FALLBACK
  //
  // If order.paidAmount is 0 but successful
  // Razorpay payment exists, use payment amount.
  // ==========================================

  if (
    paidAmount <= 0 &&
    payment
  ) {
    paidAmount =
      Number(
        payment.amount ||
        payment.paidAmount ||
        0
      );
  }

  // ==========================================
  // 11. BALANCE
  // ==========================================

  const balanceAmount = Math.max(
    totalAmount - paidAmount,
    0
  );

  // ==========================================
  // 12. ORDER SOURCE
  // ==========================================

  const orderSource =
    order.orderSource === "WALK_IN"
      ? "WALK_IN"
      : "ONLINE";

  // ==========================================
  // 13. PAYMENT METHOD
  // ==========================================

  let paymentMethod =
    payment?.paymentMethod ||
    order.paymentMethod ||
    "";

  // ==========================================
  // WALK-IN FALLBACK
  // ==========================================

  if (
    orderSource === "WALK_IN" &&
    !paymentMethod
  ) {
    paymentMethod = "CASH";
  }

  // ==========================================
  // 14. CREATE INVOICE
  // ==========================================

  // const invoiceData = {
  //   invoiceNumber:
  //     await generateInvoiceNumber(),

  //   order:
  //     order._id,

  //   user:
  //     order.user._id,

  //   invoiceFor:
  //     "ORDER",

  //   referenceId:
  //     order._id,

  //   orderSource,

  //   soldBy:
  //     order.soldBy?._id ||
  //     null,

  //   items,

  //   subtotal,

  //   discount,

  //   totalAmount,

  //   paidAmount,

  //   balanceAmount,

  //   paymentStatus:
  //     order.paymentStatus,

  //   paymentMethod,

  //   payment:
  //     payment?._id ||
  //     null,

  //   billingAddress:
  //     order.shippingAddress || {},

  //   invoiceDate:
  //     new Date(),
  // };

  const invoiceData = {
    invoiceNumber:
      await generateInvoiceNumber(),

    order:
      order._id,

    user:
      order.user._id,

    invoiceFor:
      "ORDER",

    referenceId:
      order._id,

    orderSource,

    soldBy:
      order.soldBy?._id ||
      null,

    items,

    // =========================================
    // FINANCIAL BREAKDOWN
    // =========================================

    subtotal:
      orderSubtotal,

    // Offer / product discount
    discount:
      orderOfferDiscount,

    // Coupon discount
    couponDiscount:
      couponDiscount,

    // Amount after coupon
    taxableAmount:
      taxableAmount,

    // GST
    gstPercentage:
      gstPercentage,

    gstAmount:
      gstAmount,

    // Shipping
    shippingCharge:
      shippingCharge,

    // Other charges
    otherCharges:
      otherCharges,

    // Original order amount after offer
    // Keep this for backward compatibility
    productTotalAmount:
      Number(order.totalAmount || 0),

    // FINAL CUSTOMER PAYABLE
    totalAmount:
      finalAmount,

    finalAmount:
      finalAmount,

    paidAmount,

    balanceAmount,

    paymentStatus:
      order.paymentStatus,

    paymentMethod,

    payment:
      payment?._id ||
      null,

    billingAddress:
      order.shippingAddress || {},

    invoiceDate:
      new Date(),
  };

  console.log(
    "FINAL INVOICE DATA:",
    invoiceData
  );

  // ==========================================
  // 15. CREATE
  // ==========================================

  const invoice =
    await invoiceRepository.createInvoice(
      invoiceData
    );

  console.log(
    "INVOICE CREATED SUCCESSFULLY:",
    invoice._id
  );

  return invoice;
};

// ==========================================
// GET BY ID
// ==========================================

export const getInvoiceById = async (
  invoiceId
) => {
  const invoice =
    await invoiceRepository.findInvoiceById(
      invoiceId
    );

  if (!invoice) {
    throw new Error(
      "Invoice not found"
    );
  }

  return invoice;
};

// ==========================================
// GET BY ORDER
// ==========================================

export const getInvoiceByOrderId = async (
  orderId
) => {
  const invoice =
    await invoiceRepository.findInvoiceByOrderId(
      orderId
    );

  if (!invoice) {
    throw new Error(
      "Invoice not found"
    );
  }

  return invoice;
};

// ==========================================
// GET ALL
// ==========================================

export const getAllInvoices = async () => {
  return await invoiceRepository.findAllInvoices();
};

// ==========================================
// GET MY INVOICES
// Logged-in user only
// ==========================================

export const getMyInvoices = async (userId) => {
  return await invoiceRepository.findInvoicesByUser(userId);
};