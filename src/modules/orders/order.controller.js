import * as orderService
  from "./order.service.js";


// ======================================================
// CREATE ORDER
// ONLINE + WALK_IN
// ======================================================

export const createOrder = async (
  req,
  res
) => {

  try {

    // ================================================
    // USER
    // ================================================

    const userId =
      req.user._id;

    const createdBy =
      req.user._id;


    // ================================================
    // ORDER SOURCE
    // ================================================

    const orderSource =
      req.body.orderSource === "WALK_IN"
        ? "WALK_IN"
        : "ONLINE";


    // ================================================
    // NORMALIZE SHIPPING ADDRESS
    // ================================================

    const shippingAddress = {

      ...req.body.shippingAddress,

      country:
        req.body.shippingAddress?.country ||
        "India",

      landmark:
        req.body.shippingAddress?.landmark ||
        "",

    };


    // ================================================
    // NORMALIZE ORDER ITEMS
    // ================================================

    const orderItems =
      req.body.orderItems.map(
        (item) => ({

          product:
            item.product,

          title:
            item.title,
          //      couponCode:
          // req.body.couponCode || "",  

          quantity:
            Number(item.quantity),

          originalPrice:
            Number(item.originalPrice),

          discountAmount:
            Number(item.discountAmount || 0),

          price:
            Number(item.price),

          offer:
            item.offer || null,

          imageUrl:
            item.imageUrl || "",

        })
      );


    // // ================================================
    // // ORDER DATA
    // // ================================================

    // const orderData = {

    //   orderItems,

    //   shippingAddress,

    //   totalAmount:
    //     Number(req.body.totalAmount),

    //   orderSource,

    //   user:
    //     userId,

    //   soldBy:
    //     orderSource === "WALK_IN"
    //       ? userId
    //       : null,

    // };


    const orderData = {

      orderItems,

      shippingAddress,

      totalAmount:
        Number(req.body.totalAmount),

      couponCode:
        req.body.couponCode || "",


      paymentMethod:
        req.body.paymentMethod || "CASH",


      // CHANGE: online orders start unpaid. Only walk-in (counter) orders
      // are saved as paid and confirmed. Verify sets PAID for online orders.
      paymentStatus:
        orderSource === "WALK_IN" ? "PAID" : "PENDING",

      orderStatus:
        orderSource === "WALK_IN" ? "CONFIRMED" : "PENDING",


      orderSource,


      user:
        userId,


      soldBy:
        orderSource === "WALK_IN"
          ? userId
          : null

    };


    console.log(
      "================================="
    );

    console.log(
      "FINAL BACKEND ORDER DATA:"
    );

    console.log(
      JSON.stringify(
        orderData,
        null,
        2
      )
    );

    console.log(
      "================================="
    );


    // ================================================
    // CREATE ORDER
    // ================================================

    const order =
      await orderService.createOrder(

        orderData,

        createdBy

      );


    // ================================================
    // RESPONSE
    // ================================================

    return res.status(201).json({

      success: true,

      message:
        "Order created successfully",

      order,

    });

  }

  catch (error) {

    console.error(
      "CREATE ORDER ERROR:"
    );

    console.error(
      error
    );


    return res.status(400).json({

      success: false,

      message:
        error.message,

      errors:
        error.details ||
        error.errors ||
        [],

    });

  }

};


// ======================================================
// GET MY ORDERS
// ======================================================

export const getMyOrders = async (
  req,
  res
) => {

  try {

    const orders =
      await orderService.getUserOrders(
        req.user._id
      );


    return res.status(200).json({

      success: true,

      orders,

    });

  }

  catch (error) {

    return res.status(400).json({

      success: false,

      message:
        error.message,

    });

  }

};


// ======================================================
// GET SINGLE ORDER
// ======================================================

export const getOrderById = async (
  req,
  res
) => {

  try {

    const order =
      await orderService.getOrderById(
        req.params.id
      );


    return res.status(200).json({

      success: true,

      order,

    });

  }

  catch (error) {

    return res.status(404).json({

      success: false,

      message:
        error.message,

    });

  }

};


// ======================================================
// UPDATE ORDER STATUS
// ======================================================

export const updateOrderStatus =
  async (
    req,
    res
  ) => {

    try {

      // const order =
      //   await orderService.updateOrderStatus(

      //     req.params.id,

      //     req.body.status

      //   );


      const order =
        await orderService.updateOrderStatus(

          req.params.id,

          req.body.status,

          req.user?._id || null,

          req.body.message || ""

        );

      return res.status(200).json({

        success: true,

        message:
          "Order status updated",

        order,

      });

    }

    catch (error) {

      return res.status(400).json({

        success: false,

        message:
          error.message,

      });

    }

  };


// ======================================================
// UPDATE PAYMENT STATUS
// ======================================================

export const updatePaymentStatus =
  async (
    req,
    res
  ) => {

    try {

      const order =
        await orderService.updatePaymentStatus(

          req.params.id,

          req.body.paymentStatus,

          req.body.paymentId

        );


      return res.status(200).json({

        success: true,

        message:
          "Payment status updated",

        order,

      });

    }

    catch (error) {

      return res.status(400).json({

        success: false,

        message:
          error.message,

      });

    }

  };


// ======================================================
// GET ALL ORDERS
// ======================================================

export const getAllOrders =
  async (
    req,
    res
  ) => {

    try {

      const orders =
        await orderService.getAllOrders();


      return res.status(200).json({

        success: true,

        orders,

      });

    }

    catch (error) {

      return res.status(400).json({

        success: false,

        message:
          error.message,

      });

    }

  };