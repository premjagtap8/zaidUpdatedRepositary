import mongoose from "mongoose";

import { PAYMENT_STATUS } from "../../common/constants/paymentStatus.js";
import { PAYMENT_METHOD } from "../../common/constants/paymentMethod.js";
import { PAYMENT_FOR } from "../../common/constants/paymentFor.js";

const paymentSchema = new mongoose.Schema(
    {

        // Customer
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        // ORDER / REPAIR / RENTAL
        paymentFor: {
            type: String,
            enum: Object.values(PAYMENT_FOR),
            required: true
        },

        // =====================================================
        // SALE SOURCE
        // ONLINE / WALK_IN
        // =====================================================
        saleSource: {
            type: String,
            enum: ["ONLINE", "WALK_IN"],
            default: "ONLINE",
            index: true
        },

        // Payment Type
        paymentType: {
            type: String,
            enum: [
                "SECURITY_DEPOSIT",
                "RENTAL_MONTHLY",
                "DAMAGE_CHARGE",
                "OTHER"
            ],
            default: null
        },

        // Order Id / Repair Id / Rental Id
        referenceId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true
        },

        // =====================================================
        // RAZORPAY ORDER ID
        // Set by the backend only, when the Razorpay order is
        // created. Used to find this payment during verify.
        // IMPORTANT: no default value (an empty string would
        // break the unique index).
        // =====================================================
        razorpayOrderId: {
            type: String,
            unique: true,
            sparse: true,
            default: undefined,
            trim: true
        },

        // Receipt Number
        receiptNumber: {
            type: String,
            unique: true,
            required: true,
            trim: true
        },

        // Amount
        amount: {
            type: Number,
            required: true,
            min: 0
        },

        // Currency
        currency: {
            type: String,
            default: "INR",
            uppercase: true
        },

        // Payment Method
        paymentMethod: {
            type: String,
            enum: Object.values(PAYMENT_METHOD),
            required: true
        },

        // Payment Status
        paymentStatus: {
            type: String,
            enum: Object.values(PAYMENT_STATUS),
            default: PAYMENT_STATUS.PENDING
        },

        // Payment Gateway
        gateway: {
            type: String,
            default: ""
        },

        // Gateway Transaction Id
        transactionId: {
            type: String,
            default: "",
            trim: true
        },

        // Gateway Payment Id
        gatewayPaymentId: {
            type: String,
            default: "",
            trim: true
        },

        // Complete Gateway Response
        gatewayResponse: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },

        // Failure Reason
        failureReason: {
            type: String,
            default: ""
        },

        isDeleted: {
            type: Boolean,
            default: false
        },

        // Refund Amount
        refundedAmount: {
            type: Number,
            default: 0,
            min: 0
        },

        // Refund Reason
        refundReason: {
            type: String,
            default: ""
        },

        // Payment Date
        paymentDate: {
            type: Date
        },

        // Paid At
        paidAt: {
            type: Date
        },

        // Refunded At
        refundedAt: {
            type: Date
        }

    },
    {
        timestamps: true
    }
);

// Helpful indexes
paymentSchema.index({
    paymentFor: 1,
    referenceId: 1
});


const Payment = mongoose.model(
    "Payment",
    paymentSchema
);

export default Payment;