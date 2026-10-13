import Payment from "./payment.model.js";

// CHANGE: new import, needed by markPaymentSuccessIfNotPaid
import {
    PAYMENT_STATUS
} from "../../common/constants/paymentStatus.js";


// =======================================
// CREATE PAYMENT
// =======================================

export const createPayment = async (
    paymentData
) => {

    const payment =
        new Payment(paymentData);

    return await payment.save();

};


// =======================================
// GET PAYMENT COUNT
// =======================================

export const getPaymentCount = async () => {

    return await Payment.countDocuments({

        isDeleted: false

    });

};


// =======================================
// GET PAYMENT BY ID
// =======================================

export const getPaymentById = async (
    paymentId
) => {

    return await Payment.findById(
        paymentId
    )
        .populate(
            "user",
            "firstName lastName email"
        );

};


// =======================================
// CHANGE: NEW FUNCTION
// GET PAYMENT BY RAZORPAY ORDER ID
//
// Verify now finds the payment using the
// signed razorpayOrderId instead of a
// paymentId sent by the frontend.
// =======================================

export const getPaymentByRazorpayOrderId = async (
    razorpayOrderId
) => {

    return await Payment.findOne({

        razorpayOrderId:
            String(razorpayOrderId),

        isDeleted: false

    });

};


// =======================================
// GET PAYMENT BY REFERENCE
// =======================================

export const getPaymentByReference = async (

    paymentFor,

    referenceId

) => {

    return await Payment.findOne({

        paymentFor,

        referenceId,

        isDeleted: false

    });

};


// =======================================
// GET USER PAYMENTS
// =======================================

export const getUserPayments = async (
    userId
) => {

    return await Payment.find({

        user: userId,

        isDeleted: false

    })
        .sort({

            createdAt: -1

        });

};


// =======================================
// GET ALL PAYMENTS
// =======================================

export const getAllPayments = async () => {

    return await Payment.find({

        isDeleted: false

    })
        .populate(
            "user",
            "firstName lastName email"
        )
        .sort({

            createdAt: -1

        });

};


// =======================================
// UPDATE PAYMENT STATUS
// =======================================

export const updatePaymentStatus = async (

    paymentId,

    paymentStatus,

    transactionId = "",

    gatewayPaymentId = "",

    gateway = "",

    gatewayResponse = {},

    failureReason = ""

) => {

    return await Payment.findByIdAndUpdate(

        paymentId,

        {

            paymentStatus,

            transactionId,

            gatewayPaymentId,

            gateway,

            gatewayResponse,

            failureReason,

            paymentDate: new Date(),

            paidAt:
                paymentStatus === "SUCCESS"
                    ? new Date()
                    : undefined

        },

        {

            new: true,

            runValidators: true

        }

    );

};


// =======================================
// CHANGE: NEW FUNCTION
// MARK SUCCESS ONLY IF NOT ALREADY PAID
//
// The "paymentStatus: { $nin: [...] }" in
// the filter makes this atomic: if two
// verify calls arrive together, only one
// of them can match and update the
// document. The other one gets null.
// =======================================

export const markPaymentSuccessIfNotPaid = async (

    paymentId,

    razorpayPaymentId,

    gatewayResponse = {}

) => {

    return await Payment.findOneAndUpdate(

        {

            _id: paymentId,

            paymentStatus: {

                $nin: [

                    PAYMENT_STATUS.SUCCESS,

                    PAYMENT_STATUS.REFUNDED

                ]

            }

        },

        {

            paymentStatus:
                PAYMENT_STATUS.SUCCESS,

            transactionId:
                razorpayPaymentId,

            gatewayPaymentId:
                razorpayPaymentId,

            gateway:
                "RAZORPAY",

            gatewayResponse,

            failureReason: "",

            paymentDate: new Date(),

            paidAt: new Date()

        },

        {

            new: true,

            runValidators: true

        }

    );

};


// =======================================
// UPDATE PAYMENT FAILED
// =======================================

export const updatePaymentFailed = async (

    paymentId,

    reason = ""

) => {

    return await Payment.findByIdAndUpdate(

        paymentId,

        {

            paymentStatus: "FAILED",

            failureReason: reason,

            paymentDate: new Date()

        },

        {

            new: true,

            runValidators: true

        }

    );

};


// =======================================
// UPDATE REFUND STATUS
// =======================================

export const updateRefundStatus = async (

    paymentId,

    paymentStatus,

    refundReason,

    refundedAmount

) => {

    return await Payment.findByIdAndUpdate(

        paymentId,

        {

            paymentStatus,

            refundReason,

            refundedAmount,

            refundedAt: new Date()

        },

        {

            new: true,

            runValidators: true

        }

    );

};