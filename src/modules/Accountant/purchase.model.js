import mongoose from "mongoose";

const purchaseItemSchema = new mongoose.Schema(
  {
    itemModel: {
      type: String,
      enum: ["Product", "RepairPart"],
      default: "Product"
    },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "itemModel",
      required: true
    },

    productName: {
      type: String,
      required: true,
      trim: true
    },

    quantity: {
      type: Number,
      required: true,
      min: 1
    },

    purchasePrice: {
      type: Number,
      required: true,
      min: 0
    },

    gst: {
      type: Number,
      default: 0,
      min: 0
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },

    // NEW (optional): used by the printable invoice
    hsnCode: {
      type: String,
      trim: true,
      default: ""
    },

    // NEW (optional): used by the printable invoice
    unit: {
      type: String,
      trim: true,
      default: "NOS"
    }
  },
  { _id: true }
);


// ======================================================
// PAYMENT SCHEMA
// ======================================================

const paymentSchema = new mongoose.Schema(
  {
    paymentNumber: {
      type: String,
      trim: true,
      default: ""
    },

    amount: {
      type: Number,
      required: true,
      min: 0.01
    },

    paymentMode: {
      type: String,
      enum: [
        "CASH",
        "UPI",
        "BANK_TRANSFER",
        "CHEQUE",
        "CARD",
        "OTHER"
      ],
      required: true
    },

    // --------------------------------------------------
    // UPI DETAILS
    // --------------------------------------------------

    upiApp: {
      type: String,
      enum: [
        "PHONEPE",
        "GOOGLE_PAY",
        "PAYTM",
        "OTHER"
      ],
      default: null
    },

    utrNumber: {
      type: String,
      trim: true,
      default: ""
    },

    transactionReference: {
      type: String,
      trim: true,
      default: ""
    },

    // --------------------------------------------------
    // BANK TRANSFER DETAILS
    // --------------------------------------------------

    bankName: {
      type: String,
      trim: true,
      default: ""
    },

    bankReference: {
      type: String,
      trim: true,
      default: ""
    },

    transferType: {
      type: String,
      enum: [
        "NEFT",
        "RTGS",
        "IMPS",
        "OTHER"
      ],
      default: null
    },

    // --------------------------------------------------
    // CHEQUE DETAILS
    // --------------------------------------------------

    chequeNumber: {
      type: String,
      trim: true,
      default: ""
    },

    chequeDate: {
      type: Date,
      default: null
    },

    // --------------------------------------------------
    // CASH DETAILS
    // --------------------------------------------------

    receiptNumber: {
      type: String,
      trim: true,
      default: ""
    },

    // --------------------------------------------------
    // PAYMENT SLIP
    // --------------------------------------------------

    paymentSlip: {
      fileName: {
        type: String,
        default: ""
      },

      fileUrl: {
        type: String,
        default: ""
      },

      originalName: {
        type: String,
        default: ""
      },

      mimeType: {
        type: String,
        default: ""
      },

      uploadedAt: {
        type: Date,
        default: null
      }
    },

    // --------------------------------------------------
    // PAYMENT DATE / STATUS
    // --------------------------------------------------

    paymentDate: {
      type: Date,
      default: Date.now
    },

    transactionStatus: {
      type: String,
      enum: [
        "SUCCESS",
        "PENDING",
        "FAILED",
        "REVERSED"
      ],
      default: "SUCCESS"
    },

    // --------------------------------------------------
    // PAYMENT NOTES
    // --------------------------------------------------

    notes: {
      type: String,
      trim: true,
      default: ""
    },

    // --------------------------------------------------
    // AUDIT INFORMATION
    // --------------------------------------------------

    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    recordedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    _id: true
  }
);


const purchaseSchema = new mongoose.Schema(
  {
    purchaseNumber: {
      type: String,
      unique: true,
      index: true
    },

    // Optional link to a Procurement purchase order
    purchaseOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      default: null
    },

    vendorName: {
      type: String,
      required: true,
      trim: true
    },

    vendorPhone: {
      type: String,
      trim: true,
      default: ""
    },

    vendorEmail: {
      type: String,
      trim: true,
      default: ""
    },

    vendorInvoiceNumber: {
      type: String,
      trim: true,
      default: ""
    },

    // NEW (optional): vendor details copied onto the bill for the invoice
    vendorGstNumber: {
      type: String,
      trim: true,
      default: ""
    },

    vendorAddress: {
      type: String,
      trim: true,
      default: ""
    },

    vendorState: {
      type: String,
      trim: true,
      default: ""
    },

    // NEW (optional): vendor bank details snapshot for the invoice
    vendorBankDetails: {
      accountHolderName: {
        type: String,
        trim: true,
        default: ""
      },
      bankName: {
        type: String,
        trim: true,
        default: ""
      },
      accountNumber: {
        type: String,
        trim: true,
        default: ""
      },
      ifscCode: {
        type: String,
        trim: true,
        uppercase: true,
        default: ""
      }
    },

    // NEW (optional): PO number saved as text (purchaseOrder stays an id)
    purchaseOrderNumber: {
      type: String,
      trim: true,
      default: ""
    },

    invoiceDate: {
      type: Date,
      default: Date.now
    },

    items: {
      type: [purchaseItemSchema],
      required: true
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0
    },

    gstAmount: {
      type: Number,
      default: 0,
      min: 0
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },

    paidAmount: {
      type: Number,
      default: 0,
      min: 0
    },

    pendingAmount: {
      type: Number,
      default: 0,
      min: 0
    },

    paymentStatus: {
      type: String,
      enum: [
        "PENDING",
        "PARTIAL",
        "PAID"
      ],
      default: "PENDING"
    },

    // ==================================================
    // PAYMENT HISTORY
    // ==================================================

    payments: {
      type: [paymentSchema],
      default: []
    },

    verified: {
      type: Boolean,
      default: false
    },

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    verifiedAt: {
      type: Date,
      default: null
    },

    notes: {
      type: String,
      default: "",
      trim: true
    },

    isDeleted: {
      type: Boolean,
      default: false
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  {
    timestamps: true
  }
);


// ======================================================
// PURCHASE ORDER UNIQUE INDEX
// ======================================================

// Allow only one active bill per purchase order.
// Old bills, manual bills and deleted bills are ignored
// by this index.

purchaseSchema.index(
  { purchaseOrder: 1 },
  {
    unique: true,
    partialFilterExpression: {
      purchaseOrder: { $type: "objectId" },
      isDeleted: false
    }
  }
);


// ======================================================
// PURCHASE NUMBER GENERATION
// ======================================================

purchaseSchema.pre("save", async function () {
  if (!this.purchaseOrder && false) {}

  if (!this.purchaseNumber) {
    const count =
      await mongoose
        .model("Purchase")
        .countDocuments();

    this.purchaseNumber =
      `PUR${String(count + 1).padStart(6, "0")}`;
  }
});


export default mongoose.model(
  "Purchase",
  purchaseSchema
);