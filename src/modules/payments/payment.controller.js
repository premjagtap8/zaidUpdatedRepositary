import * as paymentService
    from "./payment.service.js";

import Order
    from "../orders/order.model.js";


// =======================================
// CHANGE: REPLACED FUNCTION
// CREATE RAZORPAY ORDER
//
// Before: took orderId AND amount from the
// client, and only created the Razorpay order.
//
// Now: takes only orderId. The amount comes
// from order.totalAmount in the DB. The
// service also creates the Payment document
// linked to this Razorpay order.
// =======================================

export const createRazorpayOrder = async (
    req,
    res
) => {

    try {

        // CHANGE: amount is no longer read from the client
        const {
            orderId
        } = req.body;


        console.log(
            "======================================"
        );

        console.log(
            "CREATE RAZORPAY ORDER REQUEST"
        );

        console.log(
            "ORDER ID:",
            orderId
        );

        console.log(
            "======================================"
        );


        if (!orderId) {

            return res.status(400).json({

                success: false,

                message:
                    "Order ID is required"

            });

        }


        // -----------------------------------
        // FIND ORDER
        // -----------------------------------

        const order =
            await Order.findById(
                orderId
            );


        if (!order) {

            return res.status(404).json({

                success: false,

                message:
                    "Order not found"

            });

        }


        // -----------------------------------
        // CHANGE: OWNERSHIP CHECK
        // Only the customer who owns the order
        // can pay for it.
        // NOTE: change "order.user" if your Order
        // model uses a different field name.
        // -----------------------------------

        if (
            order.user &&
            String(order.user) !==
            String(req.user._id)
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "You are not allowed to pay for this order"

            });

        }


        // -----------------------------------
        // CHANGE: ALREADY PAID CHECK
        // paymentId is only set by a real verify. Don't use paymentStatus here.
        // -----------------------------------

        if (order.paymentId) {

            return res.status(400).json({

                success: false,

                message:
                    "Order is already paid"

            });

        }


        // -----------------------------------
        // CHANGE: AMOUNT FROM DATABASE ORDER
        // -----------------------------------

        const amount = Number(order.finalAmount);


        if (
            !Number.isFinite(amount) ||
            amount <= 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid order amount"

            });

        }


        console.log(
            "ORDER DATABASE TOTAL:",
            order.totalAmount
        );


        // -----------------------------------
        // CHANGE: CREATE RAZORPAY ORDER AND
        // THE LINKED PAYMENT DOCUMENT
        // -----------------------------------

        const {
            razorpayOrder
        } =
            await paymentService.createRazorpayPaymentOrder({

                order,

                userId:
                    req.user._id

            });


        console.log(
            "RAZORPAY ORDER CREATED =",
            razorpayOrder
        );


        // -----------------------------------
        // RESPONSE
        // (same shape as before, so the
        // frontend keeps working)
        // -----------------------------------

        return res.status(200).json({

            success: true,

            message:
                "Razorpay order created successfully",

            order:
                razorpayOrder,

            razorpayOrderId:
                razorpayOrder.id,

            amount:
                razorpayOrder.amount,

            currency:
                razorpayOrder.currency,

            paymentAmount:
                amount

        });

    }

    catch (error) {

        console.error(
            "CREATE RAZORPAY ORDER ERROR =",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                error.message ||
                "Unable to create Razorpay order"

        });

    }

};


// =======================================
// CHANGE: REPLACED FUNCTION
// VERIFY RAZORPAY PAYMENT
//
// Before: required paymentId from the client.
//
// Now: takes only razorpayOrderId,
// razorpayPaymentId and razorpaySignature.
// The payment is found by razorpayOrderId.
// =======================================

export const verifyRazorpayPaymentController =
    async (
        req,
        res
    ) => {

        try {

            // CHANGE: paymentId removed
            const {

                razorpayOrderId,

                razorpayPaymentId,

                razorpaySignature

            } = req.body;

            console.log(
                "VERIFY PAYMENT REQUEST =",
                req.body
            );

            if (!razorpayOrderId) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Razorpay Order ID is required"

                });

            }

            if (!razorpayPaymentId) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Razorpay Payment ID is required"

                });

            }

            if (!razorpaySignature) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Razorpay Signature is required"

                });

            }

            const payment =
                await paymentService.verifyRazorpayPaymentService({

                    razorpayOrderId,

                    razorpayPaymentId,

                    razorpaySignature

                });

            return res.status(200).json({

                success: true,

                message:
                    "Payment verified successfully",

                payment

            });

        }

        catch (error) {

            console.error(
                "VERIFY RAZORPAY PAYMENT ERROR =",
                error
            );

            return res.status(400).json({

                success: false,

                message:
                    error.message

            });

        }

    };


// =======================================
// CREATE PAYMENT
// =======================================

export const createPayment = async (
    req,
    res
) => {

    try {

        const userId =
            req.user?._id;


        if (!userId) {

            return res.status(401).json({

                success: false,

                message:
                    "Authenticated user not found"

            });

        }


        // CHANGE: razorpayOrderId is removed from the
        // client body. Only the backend may set it
        // (inside createRazorpayPaymentOrder), so a
        // client can't attach a Razorpay order to a
        // payment of its own.
        const {

            razorpayOrderId,

            ...safeBody

        } = req.body;


        const paymentData = {

            ...safeBody,

            user: userId

        };


        console.log(
            "======================================"
        );

        console.log(
            "CREATE PAYMENT REQUEST"
        );

        console.log(
            "USER:",
            userId
        );

        console.log(
            "BODY:",
            req.body
        );

        console.log(
            "FINAL PAYMENT DATA:",
            paymentData
        );

        console.log(
            "======================================"
        );


        const payment =
            await paymentService.createPayment(
                paymentData
            );


        return res.status(201).json({

            success: true,

            message:
                "Payment created successfully",

            payment

        });

    }

    catch (error) {

        console.error(
            "======================================"
        );

        console.error(
            "CREATE PAYMENT ERROR"
        );

        console.error(
            error
        );

        console.error(
            "MESSAGE:",
            error.message
        );

        console.error(
            "======================================"
        );


        return res.status(400).json({

            success: false,

            message:
                error.message ||
                "Unable to create payment"

        });

    }

};


// =======================================
// GET PAYMENT BY ID
// =======================================

export const getPaymentById = async (
    req,
    res
) => {

    try {

        const {
            id
        } = req.params;

        const payment =
            await paymentService.getPaymentById(
                id
            );

        return res.status(200).json({

            success: true,

            payment

        });

    }

    catch (error) {

        return res.status(404).json({

            success: false,

            message:
                error.message

        });

    }

};


// =======================================
// GET MY PAYMENTS
// =======================================

export const getMyPayments = async (
    req,
    res
) => {

    try {

        const userId =
            req.user._id;

        const payments =
            await paymentService.getUserPayments(
                userId
            );

        return res.status(200).json({

            success: true,

            payments

        });

    }

    catch (error) {

        return res.status(400).json({

            success: false,

            message:
                error.message

        });

    }

};


// =======================================
// GET ALL PAYMENTS
// =======================================

export const getAllPayments = async (
    req,
    res
) => {

    try {

        const payments =
            await paymentService.getAllPayments();

        return res.status(200).json({

            success: true,

            payments

        });

    }

    catch (error) {

        return res.status(400).json({

            success: false,

            message:
                error.message

        });

    }

};


// =======================================
// PAYMENT SUCCESS
// (unchanged; locking this route down is
// tomorrow's task)
// =======================================

export const paymentSuccess = async (
    req,
    res
) => {

    try {

        const {
            id
        } = req.params;

        const {

            transactionId,

            gatewayPaymentId,

            gateway,

            gatewayResponse

        } = req.body;

        const payment =
            await paymentService.markPaymentSuccess(

                id,

                transactionId,

                gatewayPaymentId,

                gateway,

                gatewayResponse

            );

        return res.status(200).json({

            success: true,

            message:
                "Payment successful",

            payment

        });

    }

    catch (error) {

        return res.status(400).json({

            success: false,

            message:
                error.message

        });

    }

};


// =======================================
// PAYMENT FAILED
// =======================================

export const paymentFailed = async (
    req,
    res
) => {

    try {

        const {
            id
        } = req.params;

        const {
            failureReason
        } = req.body;

        const payment =
            await paymentService.markPaymentFailed(

                id,

                failureReason

            );

        return res.status(200).json({

            success: true,

            message:
                "Payment failed",

            payment

        });

    }

    catch (error) {

        return res.status(400).json({

            success: false,

            message:
                error.message

        });

    }

};


// =======================================
// REFUND PAYMENT
// =======================================

export const refundPayment = async (
    req,
    res
) => {

    try {

        const {
            id
        } = req.params;

        const {

            refundReason,

            refundedAmount

        } = req.body;

        const payment =
            await paymentService.refundPayment(

                id,

                refundReason,

                refundedAmount

            );

        return res.status(200).json({

            success: true,

            message:
                "Payment refunded",

            payment

        });

    }

    catch (error) {

        return res.status(400).json({

            success: false,

            message:
                error.message

        });

    }

};