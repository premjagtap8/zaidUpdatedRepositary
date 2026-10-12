import mongoose from "mongoose";

import { PurchaseOrder } from "./purchaseOrder.model.js";
import Vendor from "./vendor.model.js";
import Product from "../products/product.model.js";
import RepairPart from "../repair/repairparts/repairParts.model.js";
import Inventory from "../inventory/inventory.model.js";
import { addStockService } from "../inventory/inventory.service.js";
import Purchase from "../Accountant/purchase.model.js";


// ======================================================
// CREATE PURCHASE ORDER
// Items can be a Product or a RepairPart
//
// item: { itemModel: "Product" | "RepairPart", product: "<id>", quantity, price, gstRate, hsnCode }
// itemModel is optional and defaults to "Product"
// gstRate and hsnCode are optional and default to 0 / ""
// ======================================================

export const createPurchaseOrderService = async (data, userId) => {

  // ---------- basic checks ----------

  if (!data.vendor || !mongoose.Types.ObjectId.isValid(data.vendor)) {
    throw new Error("Valid vendor is required");
  }

  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error("At least one item is required");
  }

  if (!data.expectedDeliveryDate) {
    throw new Error("Expected delivery date is required");
  }

  const deliveryDate = new Date(data.expectedDeliveryDate);

  if (isNaN(deliveryDate.getTime())) {
    throw new Error("Expected delivery date is not valid");
  }


  // ---------- vendor check ----------

  const vendor = await Vendor.findOne({
    _id: data.vendor,
    isDeleted: false
  });

  if (!vendor) {
    throw new Error("Vendor not found");
  }

  if (!vendor.isActive) {
    throw new Error("Vendor is inactive");
  }


  // ---------- items check ----------

  const items = [];
  const seenItems = new Set();
  let totalAmount = 0;
  let gstAmount = 0;

  for (const item of data.items) {

    const itemModel = item.itemModel || "Product";

    if (!["Product", "RepairPart"].includes(itemModel)) {
      throw new Error("Item type must be Product or RepairPart");
    }

    if (!item.product || !mongoose.Types.ObjectId.isValid(item.product)) {
      throw new Error("Valid product is required for every item");
    }

    const itemKey = `${itemModel}:${item.product}`;

    if (seenItems.has(itemKey)) {
      throw new Error("Same item cannot be added twice in one order");
    }

    seenItems.add(itemKey);


    let found;
    let itemName;

    if (itemModel === "RepairPart") {

      found = await RepairPart.findById(item.product);

      itemName = found ? found.partName : "";

    } else {

      found = await Product.findById(item.product);

      itemName = found ? found.name : "";
    }

    if (!found) {
      throw new Error(`${itemModel} not found: ${item.product}`);
    }


    const quantity = Number(item.quantity);

    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error(`Invalid quantity for ${itemName}`);
    }


    const price = Number(item.price);

    if (!Number.isFinite(price) || price < 0) {
      throw new Error(`Invalid price for ${itemName}`);
    }


    // GST rate
    const gstRate =
      item.gstRate !== undefined
        ? Number(item.gstRate)
        : 0;

    if (!Number.isFinite(gstRate) || gstRate < 0) {
      throw new Error(`Invalid GST rate for ${itemName}`);
    }


    // HSN code
    const hsnCode =
      typeof item.hsnCode === "string"
        ? item.hsnCode.trim()
        : "";


    const lineSubtotal = quantity * price;
    const lineGst = (lineSubtotal * gstRate) / 100;

    totalAmount += lineSubtotal;
    gstAmount += lineGst;

    items.push({
      itemModel,
      product: found._id,
      quantity,
      price,
      gstRate,
      hsnCode
    });
  }


  // ---------- save ----------

  const purchaseOrder = await PurchaseOrder.create({
    vendor: vendor._id,
    items,
    expectedDeliveryDate: deliveryDate,
    totalAmount,
    gstAmount,
    grandTotal: totalAmount + gstAmount,
    notes: data.notes || "",
    createdBy: userId
  });


  return purchaseOrder;
};


// ======================================================
// GET SINGLE PURCHASE ORDER
// ======================================================

export const getPurchaseOrderService = async (purchaseOrderId) => {

  if (!mongoose.Types.ObjectId.isValid(purchaseOrderId)) {
    throw new Error("Purchase order not found");
  }

  const purchaseOrder = await PurchaseOrder.findOne({
    _id: purchaseOrderId,
    isDeleted: false
  })
    .populate("vendor")
    .populate("items.product", "name sku partName partSku")
    .populate("createdBy", "firstName lastName email");

  if (!purchaseOrder) {
    throw new Error("Purchase order not found");
  }

  return purchaseOrder;
};


// ======================================================
// GET ALL PURCHASE ORDERS
// ======================================================

export const getAllPurchaseOrdersService = async (filters = {}) => {

  const query = {
    isDeleted: false
  };

  if (filters.status) {
    query.status = String(filters.status).toUpperCase();
  }

  return await PurchaseOrder.find(query)
    .populate("vendor", "vendorName phone email")
    .populate("createdBy", "firstName lastName")
    .sort({ createdAt: -1 });
};


// ======================================================
// GET PURCHASE ORDERS AVAILABLE FOR BILLING
// RECEIVED purchase orders that have no active bill yet.
// Used to fill the "Add purchase bill" dropdown.
// ======================================================

export const getPurchaseOrdersForBillingService = async () => {

  const billedPurchaseOrders = await Purchase.find({
    purchaseOrder: { $ne: null },
    isDeleted: false
  }).distinct("purchaseOrder");

  return await PurchaseOrder.find({
    isDeleted: false,
    status: "RECEIVED",
    _id: { $nin: billedPurchaseOrders }
  })
    .populate(
      "vendor",
      "vendorName phone email gstNumber address city state pincode bankDetails"
    )
    .populate("items.product", "name sku partName partSku")
    .sort({ receivedAt: -1 });
};


// ======================================================
// MARK PURCHASE ORDER AS ORDERED
// ======================================================

export const markPurchaseOrderOrderedService = async (purchaseOrderId) => {

  if (!mongoose.Types.ObjectId.isValid(purchaseOrderId)) {
    throw new Error("Purchase order not found");
  }

  const purchaseOrder = await PurchaseOrder.findOne({
    _id: purchaseOrderId,
    isDeleted: false
  });

  if (!purchaseOrder) {
    throw new Error("Purchase order not found");
  }

  if (purchaseOrder.status !== "DRAFT") {
    throw new Error(
      `Only a draft purchase order can be marked as ordered. Current status: ${purchaseOrder.status}`
    );
  }

  purchaseOrder.status = "ORDERED";
  purchaseOrder.orderedAt = new Date();

  await purchaseOrder.save();

  return purchaseOrder;
};


// ======================================================
// MARK PURCHASE ORDER AS RECEIVED
// ======================================================

export const markPurchaseOrderReceivedService = async (
  purchaseOrderId,
  data = {},
  userId
) => {

  if (!mongoose.Types.ObjectId.isValid(purchaseOrderId)) {
    throw new Error("Purchase order not found");
  }

  const purchaseOrder = await PurchaseOrder.findOne({
    _id: purchaseOrderId,
    isDeleted: false
  });

  if (!purchaseOrder) {
    throw new Error("Purchase order not found");
  }

  if (purchaseOrder.status !== "ORDERED") {
    throw new Error(
      `Only an ordered purchase order can be marked as received. Current status: ${purchaseOrder.status}`
    );
  }

  const requested = new Map();

  if (data.items !== undefined) {

    if (!Array.isArray(data.items)) {
      throw new Error("Items must be an array");
    }

    for (const entry of data.items) {

      if (!entry.product || !mongoose.Types.ObjectId.isValid(entry.product)) {
        throw new Error("Valid product is required for every received item");
      }

      requested.set(String(entry.product), entry.receivedQuantity);
    }
  }

  const receivedList = [];
  let totalReceived = 0;

  for (const item of purchaseOrder.items) {

    const productId = String(item.product);
    const itemModel = item.itemModel || "Product";

    let receivedQuantity;

    if (data.items === undefined) {

      receivedQuantity = item.quantity;

    } else {

      if (!requested.has(productId)) {
        throw new Error(
          "Received quantity is required for every item in the purchase order"
        );
      }

      receivedQuantity = Number(requested.get(productId));
    }

    if (!Number.isInteger(receivedQuantity) || receivedQuantity < 0) {
      throw new Error("Received quantity must be a whole number, 0 or more");
    }

    if (receivedQuantity > item.quantity) {
      throw new Error(
        `Received quantity cannot be more than the ordered quantity (${item.quantity})`
      );
    }

    if (receivedQuantity > 0) {

      if (itemModel === "RepairPart") {

        const part = await RepairPart.findById(item.product);

        if (!part) {
          throw new Error(`Repair part not found: ${productId}`);
        }

      } else {

        const inventory = await Inventory.findOne({
          product: item.product,
          isDeleted: false
        });

        if (!inventory) {
          throw new Error(
            `Inventory not found for product ${productId}. Create its inventory record first`
          );
        }
      }
    }

    totalReceived += receivedQuantity;

    receivedList.push({
      itemModel,
      product: item.product,
      receivedQuantity
    });
  }

  if (totalReceived === 0) {
    throw new Error("At least one item must be received");
  }

  const setFields = {
    status: "RECEIVED",
    receivedAt: new Date()
  };

  receivedList.forEach((entry, index) => {
    setFields[`items.${index}.receivedQuantity`] =
      entry.receivedQuantity;
  });

  const receivedOrder = await PurchaseOrder.findOneAndUpdate(
    {
      _id: purchaseOrderId,
      isDeleted: false,
      status: "ORDERED"
    },
    { $set: setFields },
    { new: true }
  );

  if (!receivedOrder) {
    throw new Error(
      "Purchase order was already received or its status changed"
    );
  }

  let stockAdded = 0;

  try {

    for (const entry of receivedList) {

      if (entry.receivedQuantity > 0) {

        if (entry.itemModel === "RepairPart") {

          const updatedPart = await RepairPart.findByIdAndUpdate(
            entry.product,
            {
              $inc: {
                stockQuantity: entry.receivedQuantity
              }
            },
            { new: true }
          );

          if (!updatedPart) {
            throw new Error(
              `Repair part not found: ${entry.product}`
            );
          }

        } else {

          await addStockService(
            entry.product,
            entry.receivedQuantity,
            userId
          );
        }

        stockAdded++;
      }
    }

  } catch (error) {

    if (stockAdded === 0) {

      await PurchaseOrder.updateOne(
        { _id: purchaseOrderId },
        {
          $set: {
            status: "ORDERED",
            receivedAt: null
          }
        }
      );

      throw error;
    }

    throw new Error(
      `Stock was already added for ${stockAdded} item(s) before an error happened: ${error.message}. Check the stock before trying again`
    );
  }

  return receivedOrder;
};


// ======================================================
// CANCEL PURCHASE ORDER
// ======================================================

export const cancelPurchaseOrderService = async (
  purchaseOrderId,
  data = {}
) => {

  if (!mongoose.Types.ObjectId.isValid(purchaseOrderId)) {
    throw new Error("Purchase order not found");
  }

  const purchaseOrder = await PurchaseOrder.findOne({
    _id: purchaseOrderId,
    isDeleted: false
  });

  if (!purchaseOrder) {
    throw new Error("Purchase order not found");
  }

  if (purchaseOrder.status === "CANCELLED") {
    throw new Error("Purchase order is already cancelled");
  }

  if (purchaseOrder.status === "RECEIVED") {
    throw new Error(
      "A received purchase order cannot be cancelled because the goods have already arrived"
    );
  }

  const reason =
    typeof data.reason === "string"
      ? data.reason.trim()
      : "";

  if (purchaseOrder.status === "ORDERED" && !reason) {
    throw new Error(
      "Cancellation reason is required for an order that was already sent to the vendor"
    );
  }

  let notes = purchaseOrder.notes || "";

  if (reason) {

    const cancelNote = `Cancelled: ${reason}`;

    notes = notes
      ? `${notes}\n${cancelNote}`
      : cancelNote;
  }

  const cancelledOrder = await PurchaseOrder.findOneAndUpdate(
    {
      _id: purchaseOrderId,
      isDeleted: false,
      status: {
        $in: ["DRAFT", "ORDERED"]
      }
    },
    {
      $set: {
        status: "CANCELLED",
        notes
      }
    },
    { new: true }
  );

  if (!cancelledOrder) {
    throw new Error(
      "Purchase order status changed and it can no longer be cancelled"
    );
  }

  return cancelledOrder;
};


// ======================================================
// SOFT DELETE PURCHASE ORDER
// ======================================================

export const deletePurchaseOrderService = async (
  purchaseOrderId
) => {

  if (!mongoose.Types.ObjectId.isValid(purchaseOrderId)) {
    throw new Error("Purchase order not found");
  }

  const purchaseOrder = await PurchaseOrder.findOne({
    _id: purchaseOrderId,
    isDeleted: false
  });

  if (!purchaseOrder) {
    throw new Error("Purchase order not found");
  }

  // Do not allow deletion of a received PO because
  // receiving has already affected inventory.
  if (purchaseOrder.status === "RECEIVED") {
    throw new Error(
      "A received purchase order cannot be deleted because the goods have already been received"
    );
  }

  purchaseOrder.isDeleted = true;

  await purchaseOrder.save();

  return purchaseOrder;
};


// ======================================================
// UPDATE PURCHASE ORDER
// ======================================================
//
// Only DRAFT purchase orders can be edited.
//
// Editable:
// - Vendor
// - Items
// - Quantity
// - Price
// - GST
// - HSN
// - Expected delivery date
// - Notes
//
// Not editable:
// - PO number
// - Status
// - Created by
// - Ordered/received dates
// - isDeleted
// ======================================================

export const updatePurchaseOrderService = async (
  purchaseOrderId,
  data
) => {

  // ---------- ID check ----------

  if (!mongoose.Types.ObjectId.isValid(purchaseOrderId)) {
    throw new Error("Purchase order not found");
  }


  // ---------- find existing PO ----------

  const purchaseOrder = await PurchaseOrder.findOne({
    _id: purchaseOrderId,
    isDeleted: false
  });

  if (!purchaseOrder) {
    throw new Error("Purchase order not found");
  }


  // ---------- status check ----------

  if (purchaseOrder.status !== "DRAFT") {
    throw new Error(
      `Only a draft purchase order can be updated. Current status: ${purchaseOrder.status}`
    );
  }


  // ---------- vendor check ----------

  if (!data.vendor || !mongoose.Types.ObjectId.isValid(data.vendor)) {
    throw new Error("Valid vendor is required");
  }

  const vendor = await Vendor.findOne({
    _id: data.vendor,
    isDeleted: false
  });

  if (!vendor) {
    throw new Error("Vendor not found");
  }

  if (!vendor.isActive) {
    throw new Error("Vendor is inactive");
  }


  // ---------- delivery date check ----------

  if (!data.expectedDeliveryDate) {
    throw new Error("Expected delivery date is required");
  }

  const deliveryDate = new Date(
    data.expectedDeliveryDate
  );

  if (isNaN(deliveryDate.getTime())) {
    throw new Error(
      "Expected delivery date is not valid"
    );
  }


  // ---------- items check ----------

  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error("At least one item is required");
  }


  const items = [];
  const seenItems = new Set();

  let totalAmount = 0;
  let gstAmount = 0;


  for (const item of data.items) {

    const itemModel =
      item.itemModel || "Product";


    if (!["Product", "RepairPart"].includes(itemModel)) {
      throw new Error(
        "Item type must be Product or RepairPart"
      );
    }


    if (
      !item.product ||
      !mongoose.Types.ObjectId.isValid(item.product)
    ) {
      throw new Error(
        "Valid product is required for every item"
      );
    }


    // Prevent duplicate item + item type
    const itemKey =
      `${itemModel}:${item.product}`;

    if (seenItems.has(itemKey)) {
      throw new Error(
        "Same item cannot be added twice in one order"
      );
    }

    seenItems.add(itemKey);


    // ---------- find item ----------

    let found;
    let itemName;


    if (itemModel === "RepairPart") {

      found = await RepairPart.findById(
        item.product
      );

      itemName = found
        ? found.partName
        : "";

    } else {

      found = await Product.findById(
        item.product
      );

      itemName = found
        ? found.name
        : "";
    }


    if (!found) {
      throw new Error(
        `${itemModel} not found: ${item.product}`
      );
    }


    // ---------- quantity ----------

    const quantity =
      Number(item.quantity);

    if (
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      throw new Error(
        `Invalid quantity for ${itemName}`
      );
    }


    // ---------- price ----------

    const price =
      Number(item.price);

    if (
      !Number.isFinite(price) ||
      price < 0
    ) {
      throw new Error(
        `Invalid price for ${itemName}`
      );
    }


    // ---------- GST ----------

    const gstRate =
      item.gstRate !== undefined
        ? Number(item.gstRate)
        : 0;

    if (
      !Number.isFinite(gstRate) ||
      gstRate < 0
    ) {
      throw new Error(
        `Invalid GST rate for ${itemName}`
      );
    }


    // ---------- HSN ----------

    const hsnCode =
      typeof item.hsnCode === "string"
        ? item.hsnCode.trim()
        : "";


    // ---------- calculate totals ----------

    const lineSubtotal =
      quantity * price;

    const lineGst =
      (lineSubtotal * gstRate) / 100;

    totalAmount += lineSubtotal;
    gstAmount += lineGst;


    // Since this is still a DRAFT,
    // receivedQuantity must remain 0.
    items.push({
      itemModel,
      product: found._id,
      quantity,
      price,
      gstRate,
      hsnCode,
      receivedQuantity: 0
    });
  }


  // ---------- update ----------

  purchaseOrder.vendor = vendor._id;
  purchaseOrder.items = items;
  purchaseOrder.expectedDeliveryDate = deliveryDate;

  purchaseOrder.totalAmount = totalAmount;
  purchaseOrder.gstAmount = gstAmount;
  purchaseOrder.grandTotal =
    totalAmount + gstAmount;

  purchaseOrder.notes =
    typeof data.notes === "string"
      ? data.notes.trim()
      : "";


  await purchaseOrder.save();


  return purchaseOrder;
};