import * as paymentRepository from "./payment.repository.js";

import {
    PAYMENT_STATUS
} from "../../common/constants/paymentStatus.js";

import {
    createRazorpayOrder,
    verifyRazorpayPayment
} from "./razorpay.service.js";

import Order
    from "../orders/order.model.js";

import Repair from "../repair/repair.model.js";
import Rental from "../rental/rental.model.js";


// =======================================
// CHANGE: REPLACED FUNCTION
// CREATE RAZORPAY ORDER + PENDING PAYMENT
//
// Before: received (amount, receipt) from the
// client and only created the Razorpay order.
//
// Now: receives the DB order + logged-in user.
// The amount comes from order.totalAmount (not
// from the client), and the Payment document
// is created here with the razorpayOrderId
// saved on it. This link is what stops replay.
// =======================================

export const createRazorpayPaymentOrder = async ({
    order,
    userId
}) => {

    // CHANGE: amount always comes from the DB order
    const amount = Number(
        Number(order.finalAmount).toFixed(2)
    );

    const razorpayOrder =
        await createRazorpayOrder({
            amount,
            receipt: `order_${order._id}`
        });

    // CHANGE: create the Payment now and link it
    // to this Razorpay order
    const payment = await createPayment({
        user: userId,
        paymentFor: "ORDER",
        referenceId: order._id,
        amount,
        paymentMethod: "UPI",
        gateway: "RAZORPAY",
        razorpayOrderId: razorpayOrder.id
    });

    return {
        razorpayOrder,
        payment
    };
};


// =======================================
// CHANGE: REPLACED FUNCTION
// VERIFY RAZORPAY PAYMENT
//
// Before: found the Payment using a paymentId
// sent by the frontend, so an old signature
// could mark any new payment as paid.
//
// Now: takes only the 3 Razorpay values and
// finds the Payment using the signed
// razorpayOrderId.
// =======================================

export const verifyRazorpayPaymentService = async ({
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature
}) => {

    // ==========================================
    // 1. VERIFY RAZORPAY SIGNATURE FIRST
    // (CHANGE: moved before any DB lookup)
    // ==========================================

    const isValid =
        verifyRazorpayPayment({

            razorpayOrderId,

            razorpayPaymentId,

            razorpaySignature

        });

    if (!isValid) {

        throw new Error(
            "Invalid Razorpay payment signature"
        );

    }

    console.log(
        "SIGNATURE VERIFY SUCCESS"
    );


    // ==========================================
    // 2. FIND PAYMENT BY RAZORPAY ORDER ID
    // (CHANGE: was findById(paymentId) from client)
    // ==========================================

    const payment =
        await paymentRepository.getPaymentByRazorpayOrderId(
            razorpayOrderId
        );

    if (!payment) {

        throw new Error(
            "Payment not found for this Razorpay order"
        );

    }


    // ==========================================
    // 3. ATOMICALLY MARK PAYMENT = SUCCESS
    // (CHANGE: only succeeds if not already paid)
    // ==========================================

    const updatedPayment =
        await paymentRepository.markPaymentSuccessIfNotPaid(

            payment._id,

            razorpayPaymentId,

            {

                razorpayOrderId,

                razorpayPaymentId,

                razorpaySignature

            }

        );


    // CHANGE: already processed. Return it without
    // changing anything (safe for genuine retries).
    if (!updatedPayment) {

        if (
            payment.paymentStatus ===
            PAYMENT_STATUS.SUCCESS
        ) {

            return payment;

        }

        throw new Error(
            "Payment cannot be verified in its current state"
        );

    }

    console.log(
        "PAYMENT STATUS = SUCCESS"
    );


    // ==========================================
    // 4. FIND ORDER
    // (CHANGE: uses updatedPayment.referenceId)
    // ==========================================

    const orderId =
        updatedPayment.referenceId;

    if (!orderId) {

        throw new Error(
            "Order ID not found in payment"
        );

    }

    const order =
        await Order.findById(
            orderId
        );

    if (!order) {

        throw new Error(
            "Order not found"
        );

    }


    // ==========================================
    // 5. UPDATE ORDER = PAID
    // ==========================================

    order.paymentStatus = "PAID";

    order.paymentId =
        razorpayPaymentId;

    // CHANGE: online orders are now created as PENDING, so a real payment
    // must also confirm the order and record the amount paid.
    order.orderStatus = "CONFIRMED";

    order.paidAmount = updatedPayment.amount;

    await order.save();

    console.log(
        "ORDER PAYMENT STATUS = PAID"
    );


    // ==========================================
    // 6. RETURN PAYMENT
    // ==========================================

    return updatedPayment;

};


// =======================================
// CREATE PAYMENT
// (unchanged)
// =======================================

export const createPayment = async (
    paymentData
) => {

    // ---------------------------------------
    // BASIC VALIDATION
    // ---------------------------------------

    if (!paymentData) {
        throw new Error("Payment data is required");
    }

    if (!paymentData.paymentFor) {
        throw new Error("Payment For is required");
    }

    if (!paymentData.referenceId) {
        throw new Error("Reference ID is required");
    }

    if (
        paymentData.amount === undefined ||
        paymentData.amount === null ||
        Number(paymentData.amount) <= 0
    ) {
        throw new Error("Valid payment amount is required");
    }

    if (!paymentData.paymentMethod) {
        throw new Error("Payment method is required");
    }


    // ---------------------------------------
    // NORMALIZE PAYMENT FOR
    // ---------------------------------------

    paymentData.paymentFor =
        String(paymentData.paymentFor)
            .trim()
            .toUpperCase();


    // ---------------------------------------
    // NORMALIZE PAYMENT METHOD
    // ---------------------------------------

    paymentData.paymentMethod =
        String(paymentData.paymentMethod)
            .trim()
            .toUpperCase();


    // ---------------------------------------
    // AMOUNT
    // ---------------------------------------

    paymentData.amount =
        Number(
            Number(paymentData.amount).toFixed(2)
        );


    // ---------------------------------------
    // DETERMINE SALE SOURCE
    // ---------------------------------------

    try {

        paymentData.saleSource =
            await determineSaleSource(
                paymentData.paymentFor,
                paymentData.referenceId
            );

    }

    catch (error) {

        console.error(
            "SALE SOURCE DETECTION ERROR:",
            error
        );

        // Don't block payment if old orders
        // don't have source fields.
        paymentData.saleSource =
            paymentData.saleSource ||
            "ONLINE";
    }


    // ---------------------------------------
    // RECEIPT NUMBER
    // ---------------------------------------

    paymentData.receiptNumber =
        await generateReceiptNumber();


    // ---------------------------------------
    // CURRENCY
    // ---------------------------------------

    if (!paymentData.currency) {

        paymentData.currency = "INR";

    }


    // ---------------------------------------
    // PAYMENT STATUS
    // ---------------------------------------

    if (!paymentData.paymentStatus) {

        paymentData.paymentStatus =
            PAYMENT_STATUS.PENDING;

    }


    // ---------------------------------------
    // LOG FINAL DATA
    // ---------------------------------------

    console.log(
        "======================================"
    );

    console.log(
        "FINAL PAYMENT DATA"
    );

    console.log(
        JSON.stringify(
            paymentData,
            null,
            2
        )
    );

    console.log(
        "======================================"
    );


    // ---------------------------------------
    // CREATE PAYMENT
    // ---------------------------------------

    return await paymentRepository.createPayment(
        paymentData
    );
};


// =======================================
// GENERATE RECEIPT NUMBER
// =======================================

const generateReceiptNumber = async () => {

    const count =
        await paymentRepository.getPaymentCount();

    const nextNumber = count + 1;

    return `PAY${new Date().getFullYear()}${String(
        nextNumber
    ).padStart(6, "0")}`;
};


// =======================================
// GET PAYMENT BY ID
// =======================================

export const getPaymentById = async (
    paymentId
) => {

    const payment =
        await paymentRepository.getPaymentById(
            paymentId
        );

    if (!payment) {
        throw new Error(
            "Payment not found"
        );
    }

    return payment;
};


// =======================================
// GET PAYMENT BY REFERENCE
// =======================================

export const getPaymentByReference = async (
    paymentFor,
    referenceId
) => {

    return await paymentRepository.getPaymentByReference(
        paymentFor,
        referenceId
    );
};


// =======================================
// GET USER PAYMENTS
// =======================================

export const getUserPayments = async (
    userId
) => {

    return await paymentRepository.getUserPayments(
        userId
    );
};


// =======================================
// GET ALL PAYMENTS
// =======================================

export const getAllPayments = async () => {

    return await paymentRepository.getAllPayments();
};


// =======================================
// MARK PAYMENT SUCCESS
// (unchanged; the route to this is for tomorrow)
// =======================================

export const markPaymentSuccess = async (
    paymentId,
    transactionId,
    gatewayPaymentId,
    gateway,
    gatewayResponse
) => {

    const payment =
        await paymentRepository.getPaymentById(
            paymentId
        );

    if (!payment) {
        throw new Error(
            "Payment not found"
        );
    }

    return await paymentRepository.updatePaymentStatus(

        paymentId,

        PAYMENT_STATUS.SUCCESS,

        transactionId,

        gatewayPaymentId,

        gateway,

        gatewayResponse,

        ""
    );
};


// =======================================
// MARK PAYMENT FAILED
// =======================================

export const markPaymentFailed = async (
    paymentId,
    reason
) => {

    const payment =
        await paymentRepository.getPaymentById(
            paymentId
        );

    if (!payment) {
        throw new Error(
            "Payment not found"
        );
    }

    return await paymentRepository.updatePaymentFailed(
        paymentId,
        reason
    );
};


// =======================================
// REFUND PAYMENT
// =======================================

export const refundPayment = async (
    paymentId,
    refundReason,
    refundedAmount
) => {

    const payment =
        await paymentRepository.getPaymentById(
            paymentId
        );

    if (!payment) {
        throw new Error(
            "Payment not found"
        );
    }

    return await paymentRepository.updateRefundStatus(

        paymentId,

        PAYMENT_STATUS.REFUNDED,

        refundReason,

        refundedAmount
    );
};


// =======================================
// GET PAYMENT COUNT
// =======================================

export const getPaymentCount = async () => {

    return await paymentRepository.getPaymentCount();
};


// =====================================================
// DETERMINE SALE SOURCE
// (unchanged)
// =====================================================

const determineSaleSource = async (
    paymentFor,
    referenceId
) => {

    // -------------------------------------------------
    // ORDER
    // -------------------------------------------------

    if (paymentFor === "ORDER") {

        const order =
            await Order.findById(referenceId)
                .select("orderSource source");

        if (!order) {
            throw new Error("Order not found");
        }

        // Different possible existing field names
        const source =
            order.orderSource ||
            order.source;

        if (
            String(source || "").toUpperCase() === "WALK_IN" ||
            String(source || "").toUpperCase() === "WALKIN"
        ) {
            return "WALK_IN";
        }

        return "ONLINE";
    }


    // -------------------------------------------------
    // REPAIR
    // -------------------------------------------------

    if (paymentFor === "REPAIR") {

        const repair =
            await Repair.findById(referenceId)
                .select("repairSource source");

        if (!repair) {
            throw new Error("Repair not found");
        }

        const source =
            repair.repairSource ||
            repair.source;

        if (
            String(source || "").toUpperCase() === "WALK_IN" ||
            String(source || "").toUpperCase() === "WALKIN"
        ) {
            return "WALK_IN";
        }

        return "ONLINE";
    }


    // -------------------------------------------------
    // RENTAL
    // -------------------------------------------------

    if (paymentFor === "RENTAL") {

        const rental =
            await Rental.findById(referenceId)
                .select("rentalSource source");

        if (!rental) {
            throw new Error("Rental not found");
        }

        const source =
            rental.rentalSource ||
            rental.source;

        if (
            String(source || "").toUpperCase() === "WALK_IN" ||
            String(source || "").toUpperCase() === "WALKIN"
        ) {
            return "WALK_IN";
        }

        return "ONLINE";
    }


    // -------------------------------------------------
    // DEFAULT
    // -------------------------------------------------

    return "ONLINE";
};