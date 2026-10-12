import mongoose from "mongoose";
import Purchase from "./purchase.model.js";
import Product from "../products/product.model.js";
import RepairPart from "../repair/repairparts/repairParts.model.js";
import { PurchaseOrder } from "../Procurementt/purchaseOrder.model.js";


// ======================================================
// CREATE PURCHASE
// Procurement creates purchase record
// ======================================================

export const createPurchaseService = async (
  data,
  userId
) => {

  if (
    !data.vendorName ||
    !data.items ||
    !Array.isArray(data.items) ||
    data.items.length === 0
  ) {
    throw new Error(
      "Vendor and purchase items are required"
    );
  }


  // ------------------------------------------------------
  // OPTIONAL: validate + link a Purchase Order
  // Behaviour is unchanged when data.purchaseOrder is not sent
  // ------------------------------------------------------

  let linkedPurchaseOrderId = null;

  // NEW: PO number saved as text on the bill
  let linkedPurchaseOrderNumber = "";

  if (data.purchaseOrder) {

    if (
      !mongoose.Types.ObjectId.isValid(
        data.purchaseOrder
      )
    ) {
      throw new Error(
        "Invalid purchase order id"
      );
    }

    const po =
      await PurchaseOrder.findOne({
        _id: data.purchaseOrder,
        isDeleted: false
      });

    if (!po) {
      throw new Error(
        "Purchase order not found"
      );
    }

    if (po.status !== "RECEIVED") {
      throw new Error(
        "Only a received purchase order can be billed"
      );
    }

    const existingBill =
      await Purchase.findOne({
        purchaseOrder: po._id,
        isDeleted: false
      });

    if (existingBill) {
      throw new Error(
        "A bill already exists for this purchase order"
      );
    }

    linkedPurchaseOrderId = po._id;

    linkedPurchaseOrderNumber = po.poNumber || "";
  }


  const items = [];

  let subtotal = 0;
  let gstAmount = 0;


  for (const item of data.items) {

    const itemModel =
      item.itemModel === "RepairPart"
        ? "RepairPart"
        : "Product";

    const Model =
      itemModel === "RepairPart"
        ? RepairPart
        : Product;

    const product =
      await Model.findById(item.product);

    if (!product) {
      throw new Error(
        `${itemModel === "RepairPart" ? "Repair part" : "Product"} not found: ${item.product}`
      );
    }

    const displayName =
      itemModel === "RepairPart"
        ? product.partName
        : product.name;


    const quantity =
      Number(item.quantity);

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      throw new Error(
        `Invalid quantity for ${displayName}`
      );
    }


    const purchasePrice =
      Number(
        item.purchasePrice ??
        (itemModel === "RepairPart"
          ? product.purchaseCost
          : product.pricing?.purchasePrice) ??
        0
      );


    if (purchasePrice < 0) {
      throw new Error(
        `Invalid purchase price for ${displayName}`
      );
    }


    const gst =
      Number(
        item.gst ??
        (itemModel === "RepairPart"
          ? 0
          : product.pricing?.gst) ??
        0
      );


    const itemBaseAmount =
      purchasePrice * quantity;


    const itemGstAmount =
      itemBaseAmount * gst / 100;


    const itemTotal =
      itemBaseAmount + itemGstAmount;


    subtotal += itemBaseAmount;

    gstAmount += itemGstAmount;


    items.push({
      itemModel,

      product: product._id,

      productName:
        displayName,

      quantity,

      purchasePrice,

      gst,

      totalAmount:
        itemTotal,

      // NEW (optional)
      hsnCode:
        item.hsnCode || "",

      unit:
        item.unit || "NOS"
    });
  }


  const totalAmount =
    subtotal + gstAmount;


  try {

    const purchase =
      await Purchase.create({

        vendorName:
          data.vendorName,

        vendorPhone:
          data.vendorPhone || "",

        vendorEmail:
          data.vendorEmail || "",

        vendorInvoiceNumber:
          data.vendorInvoiceNumber || "",

        // NEW (optional)
        vendorGstNumber:
          data.vendorGstNumber || "",

        vendorAddress:
          data.vendorAddress || "",

        vendorState:
          data.vendorState || "",

        // NEW (optional): bank details snapshot
        vendorBankDetails: {
          accountHolderName:
            data.vendorBankDetails?.accountHolderName || "",

          bankName:
            data.vendorBankDetails?.bankName || "",

          accountNumber:
            data.vendorBankDetails?.accountNumber || "",

          ifscCode:
            data.vendorBankDetails?.ifscCode || ""
        },

        purchaseOrderNumber:
          linkedPurchaseOrderNumber,

        invoiceDate:
          data.invoiceDate || new Date(),

        items,

        subtotal,

        gstAmount,

        totalAmount,

        paidAmount:
          0,

        pendingAmount:
          totalAmount,

        paymentStatus:
          "PENDING",

        payments:
          [],

        verified:
          false,

        notes:
          data.notes || "",

        createdBy:
          userId,

        purchaseOrder:
          linkedPurchaseOrderId
      });


    return purchase;

  } catch (err) {

    if (err.code === 11000) {
      throw new Error(
        "A bill already exists for this purchase order"
      );
    }

    throw err;
  }
};


// ======================================================
// GET PURCHASE
// ======================================================

export const getPurchaseService =
  async (purchaseId) => {

    const purchase =
      await Purchase.findOne({
        _id: purchaseId,
        isDeleted: false
      })
        .populate(
          "items.product"
        )
        .populate(
          "createdBy",
          "firstName lastName email"
        )
        .populate(
          "verifiedBy",
          "firstName lastName email"
        )
        .populate(
          "payments.recordedBy",
          "firstName lastName email"
        );


    if (!purchase) {
      throw new Error(
        "Purchase not found"
      );
    }


    return purchase;
  };


// ======================================================
// GET ALL PURCHASES
// ======================================================

export const getAllPurchasesService =
  async (filters = {}) => {

    const query = {
      isDeleted: false
    };


    if (filters.paymentStatus) {
      query.paymentStatus =
        filters.paymentStatus;
    }


    if (
      filters.verified !== undefined
    ) {
      query.verified =
        filters.verified === "true";
    }


    return await Purchase.find(query)
      .populate(
        "createdBy",
        "firstName lastName"
      )
      .populate(
        "verifiedBy",
        "firstName lastName"
      )
      .sort({
        createdAt: -1
      });
  };


// ======================================================
// VERIFY PURCHASE
// Accountant verifies purchase amount/invoice
// ======================================================

export const verifyPurchaseService =
  async (
    purchaseId,
    userId
  ) => {

    const purchase =
      await Purchase.findOne({
        _id: purchaseId,
        isDeleted: false
      });


    if (!purchase) {
      throw new Error(
        "Purchase not found"
      );
    }


    if (purchase.verified) {
      throw new Error(
        "Purchase is already verified"
      );
    }


    purchase.verified =
      true;

    purchase.verifiedBy =
      userId;

    purchase.verifiedAt =
      new Date();


    await purchase.save();


    return purchase;
  };


// ======================================================
// RECORD VENDOR PAYMENT
// ======================================================

export const recordVendorPaymentService =
  async (
    purchaseId,
    data,
    userId,
    paymentFile
  ) => {

    const purchase =
      await Purchase.findOne({
        _id: purchaseId,
        isDeleted: false
      });


    if (!purchase) {
      throw new Error(
        "Purchase not found"
      );
    }


    if (!purchase.verified) {
      throw new Error(
        "Purchase must be verified before payment"
      );
    }


    const paymentAmount =
      Number(data.amount);


    if (
      !Number.isFinite(paymentAmount) ||
      paymentAmount <= 0
    ) {
      throw new Error(
        "Valid payment amount is required"
      );
    }


    const currentPaid =
      Number(purchase.paidAmount || 0);


    const pending =
      Number(purchase.totalAmount) -
      currentPaid;


    if (paymentAmount > pending) {
      throw new Error(
        "Payment cannot be greater than pending amount"
      );
    }


    // --------------------------------------------------
    // VALIDATE PAYMENT MODE
    // --------------------------------------------------

    const allowedPaymentModes = [
      "CASH",
      "UPI",
      "BANK_TRANSFER",
      "CHEQUE",
      "CARD",
      "OTHER"
    ];


    const paymentMode =
      data.paymentMode || "CASH";


    if (
      !allowedPaymentModes.includes(
        paymentMode
      )
    ) {
      throw new Error(
        "Invalid payment mode"
      );
    }


    // --------------------------------------------------
    // VALIDATE UTR
    // --------------------------------------------------

    /*
      UTR is optional.

      This is important because existing accountant
      payments such as CASH can continue without a UTR.

      If a UTR is provided, we normalize it and check
      the entire Purchase collection to make sure the
      same UTR has not already been used.
    */

    const utrNumber =
      String(
        data.utrNumber || ""
      )
        .trim()
        .toUpperCase();


    if (utrNumber) {

      const existingPayment =
        await Purchase.findOne({
          isDeleted: false,
          "payments.utrNumber": utrNumber
        });


      if (existingPayment) {
        throw new Error(
          "This UTR number has already been used for another payment"
        );
      }
    }


    // --------------------------------------------------
    // PAYMENT SLIP
    // --------------------------------------------------

    let paymentSlip = {
      fileName: "",
      fileUrl: "",
      originalName: "",
      mimeType: "",
      uploadedAt: null
    };


    if (paymentFile) {

      paymentSlip = {

        fileName:
          paymentFile.filename,

        fileUrl:
          `/uploads/payment-slips/${paymentFile.filename}`,

        originalName:
          paymentFile.originalname,

        mimeType:
          paymentFile.mimetype,

        uploadedAt:
          new Date()
      };
    }


    // --------------------------------------------------
    // CREATE PAYMENT RECORD
    // --------------------------------------------------

    const paymentRecord = {

      paymentNumber:
        data.paymentNumber || "",

      amount:
        paymentAmount,

      paymentMode,

      upiApp:
        data.upiApp || null,

      utrNumber,

      transactionReference:
        data.transactionReference || "",

      bankName:
        data.bankName || "",

      bankReference:
        data.bankReference || "",

      transferType:
        data.transferType || null,

      chequeNumber:
        data.chequeNumber || "",

      chequeDate:
        data.chequeDate || null,

      receiptNumber:
        data.receiptNumber || "",

      paymentSlip,

      paymentDate:
        data.paymentDate || new Date(),

      transactionStatus:
        data.transactionStatus || "SUCCESS",

      notes:
        data.notes || "",

      recordedBy:
        userId,

      recordedAt:
        new Date()
    };


    // --------------------------------------------------
    // ADD PAYMENT TO PAYMENT HISTORY
    // --------------------------------------------------

    purchase.payments.push(
      paymentRecord
    );


    // --------------------------------------------------
    // UPDATE PAYMENT TOTALS
    // --------------------------------------------------

    purchase.paidAmount =
      currentPaid + paymentAmount;


    purchase.pendingAmount =
      Math.max(
        purchase.totalAmount -
        purchase.paidAmount,
        0
      );


    if (
      purchase.pendingAmount === 0
    ) {
      purchase.paymentStatus =
        "PAID";
    } else {
      purchase.paymentStatus =
        "PARTIAL";
    }


    // --------------------------------------------------
    // SAVE
    // --------------------------------------------------

    await purchase.save();


    return purchase;
  };


// ======================================================
// PENDING VENDOR PAYMENTS
// ======================================================

export const getPendingVendorPaymentsService =
  async () => {

    return await Purchase.find({
      isDeleted: false,

      pendingAmount: {
        $gt: 0
      }
    })
      .populate(
        "createdBy",
        "firstName lastName"
      )
      .sort({
        createdAt: -1
      });
  };


// ======================================================
// DELETE PURCHASE
// ======================================================

export const deletePurchaseService =
  async (purchaseId) => {

    const purchase =
      await Purchase.findOne({
        _id: purchaseId,
        isDeleted: false
      });


    if (!purchase) {
      throw new Error(
        "Purchase not found"
      );
    }


    purchase.isDeleted =
      true;


    await purchase.save();


    return purchase;
  };