// import mongoose from "mongoose";

// import {
//     PRODUCT_STATUS
// } from "../../common/constants/productStatus.js";


// const productSchema =
//     new mongoose.Schema(

//         {

//             // =================================================
//             // BASIC INFORMATION
//             // =================================================

//             name: {

//                 type: String,

//                 required: true,

//                 trim: true

//             },


//             slug: {

//                 type: String,

//                 unique: true,

//                 lowercase: true,

//                 trim: true

//             },


//             sku: {

//                 type: String,

//                 unique: true,

//                 trim: true

//             },


//             barcode: {

//                 type: String,

//                 unique: true,

//                 sparse: true

//             },


//             // =================================================
//             // CATEGORY
//             // =================================================

//             category: {

//                 type:
//                     mongoose.Schema.Types.ObjectId,

//                 ref: "Category",

//                 required: true

//             },


//             subcategory: {

//                 type:
//                     mongoose.Schema.Types.ObjectId,

//                 ref: "Category",

//                 default: null

//             },


//             // =================================================
//             // PRODUCT TYPE
//             // =================================================
//             // NEW / REFURBISHED = product condition
//             // RENTAL is NOT a productType.
//             // Rental is handled separately below.
//             // =================================================

//             productType: {

//                 type: String,

//                 enum: [

//                     "NEW",

//                     "REFURBISHED"

//                 ],

//                 default: "NEW"

//             },


//             // =================================================
//             // REFURBISHED DETAILS
//             // =================================================

//             refurbishedDetails: {

//                 grade: {

//                     type: String,

//                     enum: [
//                         "A+",
//                         "A",
//                         "B",
//                         "C"
//                     ],

//                     default: null

//                 },

//                 batteryHealth: {

//                     type: Number,

//                     min: 0,

//                     max: 100,

//                     default: null

//                 },

//                 warrantyMonths: {

//                     type: Number,

//                     min: 0,

//                     default: null

//                 },

//                 testingStatus: {

//                     type: String,

//                     enum: [
//                         "TESTED",
//                         "NOT_TESTED"
//                     ],

//                     default: null

//                 }

//             },


//             // =================================================
//             // BRAND
//             // =================================================

//             brand: {

//                 type:
//                     mongoose.Schema.Types.ObjectId,

//                 ref: "Brand",

//                 required: true

//             },


//             // =================================================
//             // DESCRIPTION
//             // =================================================

//             description: {

//                 type: String,

//                 default: ""

//             },


//             shortDescription: {

//                 type: String,

//                 default: ""

//             },


//             // =================================================
//             // IMAGES
//             // =================================================

//             images: [

//                 {

//                     url: {

//                         type: String,

//                         required: true

//                     },

//                     alt: {

//                         type: String,

//                         default: ""

//                     }

//                 }

//             ],


//             // =================================================
//             // PRICING
//             // =================================================
//             //
//             // purchasePrice  = company purchase/cost price
//             //
//             // retailPrice    = PERSONAL customer price
//             //
//             // wholesalePrice = BUSINESS customer price
//             //
//             // =================================================

//             pricing: {

//                 purchasePrice: {

//                     type: Number,

//                     default: 0

//                 },


//                 retailPrice: {

//                     type: Number,

//                     required: true

//                 },


//                 wholesalePrice: {

//                     type: Number,

//                     default: null

//                 },


//                 mrp: {

//                     type: Number,

//                     default: 0

//                 },


//                 discount: {

//                     type: Number,

//                     default: 0

//                 },


//                 gst: {

//                     type: Number,

//                     default: 0

//                 }

//             },


//             // =================================================
//             // SPECIFICATIONS
//             // =================================================

//             specifications: {

//                 type: Object,

//                 default: {}

//             },


//             // =================================================
//             // RENTAL
//             // =================================================
//             //
//             // Rental is independent of productType.
//             //
//             // Example:
//             //
//             // productType = NEW
//             // isAvailableForRent = true
//             //
//             // Same product can be:
//             //
//             // PERSONAL  -> retailPrice
//             // BUSINESS  -> wholesalePrice
//             // RENTAL    -> rental.monthlyRent
//             //
//             // =================================================

//             rental: {

//                 isAvailableForRent: {

//                     type: Boolean,

//                     default: false

//                 }

//             },


//             // =================================================
//             // SEO
//             // =================================================

//             metaTitle: {

//                 type: String,

//                 default: ""

//             },


//             metaDescription: {

//                 type: String,

//                 default: ""

//             },


//             // =================================================
//             // STATUS
//             // =================================================

//             status: {

//                 type: String,

//                 enum: [

//                     PRODUCT_STATUS.ACTIVE,

//                     PRODUCT_STATUS.INACTIVE,

//                     PRODUCT_STATUS.OUT_OF_STOCK,

//                     PRODUCT_STATUS.DISCONTINUED

//                 ],

//                 default:
//                     PRODUCT_STATUS.ACTIVE

//             },


//             // =================================================
//             // SOFT DELETE
//             // =================================================

//             isDeleted: {

//                 type: Boolean,

//                 default: false

//             },


//             // =================================================
//             // CREATED BY
//             // =================================================

//             createdBy: {

//                 type:
//                     mongoose.Schema.Types.ObjectId,

//                 ref: "User"

//             }

//         },

//         {

//             timestamps: true

//         }

//     );


// const Product =
//     mongoose.model(
//         "Product",
//         productSchema
//     );


// export default Product;


import mongoose from "mongoose";

import {
    PRODUCT_STATUS
} from "../../common/constants/productStatus.js";


const productSchema =
    new mongoose.Schema(

        {

            // =================================================
            // BASIC INFORMATION
            // =================================================

            name: {

                type: String,

                required: true,

                trim: true

            },


            slug: {

                type: String,

                unique: true,

                lowercase: true,

                trim: true

            },


            sku: {

                type: String,

                unique: true,

                trim: true

            },


            barcode: {

                type: String,

                unique: true,

                sparse: true

            },



            // =================================================
            // HSN CODE (used on tax invoices)
            // =================================================

            hsnCode: {

                type: String,

                trim: true,

                default: ""

            },



            // =================================================
            // CATEGORY
            // =================================================

            category: {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref: "Category",

                required: true

            },


            subcategory: {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref: "Category",

                default: null

            },


            // =================================================
            // PRODUCT TYPE
            // =================================================
            // NEW        = New product
            // REFURBISHED = Refurbished product
            // RENTAL      = Rental product
            //
            // RENTAL is now supported directly as a
            // productType.
            // =================================================

            productType: {

                type: String,

                enum: [

                    "NEW",

                    "REFURBISHED",

                    "RENTAL"

                ],

                default: "NEW"

            },


            // =================================================
            // REFURBISHED DETAILS
            // =================================================

            refurbishedDetails: {

                grade: {

                    type: String,

                    enum: [
                        "A+",
                        "A",
                        "B",
                        "C"
                    ],

                    default: null

                },

                batteryHealth: {

                    type: Number,

                    min: 0,

                    max: 100,

                    default: null

                },

                warrantyMonths: {

                    type: Number,

                    min: 0,

                    default: null

                },

                testingStatus: {

                    type: String,

                    enum: [
                        "TESTED",
                        "NOT_TESTED"
                    ],

                    default: null

                }

            },


            // =================================================
            // BRAND
            // =================================================

            brand: {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref: "Brand",

                required: true

            },


            // =================================================
            // DESCRIPTION
            // =================================================

            description: {

                type: String,

                default: ""

            },


            shortDescription: {

                type: String,

                default: ""

            },


            // =================================================
            // IMAGES
            // =================================================

            images: [

                {

                    url: {

                        type: String,

                        required: true

                    },

                    alt: {

                        type: String,

                        default: ""

                    }

                }

            ],


            // =================================================
            // PRICING
            // =================================================
            //
            // purchasePrice  = company purchase/cost price
            //
            // retailPrice    = PERSONAL customer price
            //
            // wholesalePrice = BUSINESS customer price
            //
            // =================================================

            pricing: {

                purchasePrice: {

                    type: Number,

                    default: 0

                },


                retailPrice: {

                    type: Number,

                    required: true

                },


                wholesalePrice: {

                    type: Number,

                    default: null

                },


                mrp: {

                    type: Number,

                    default: 0

                },


                discount: {

                    type: Number,

                    default: 0

                },


                gst: {

                    type: Number,

                    default: 0

                }

            },


            // =================================================
            // SPECIFICATIONS
            // =================================================

            specifications: {

                type: Object,

                default: {}

            },


            // =================================================
            // RENTAL
            // =================================================
            //
            // Rental details are still handled separately
            // through RentalProduct as per existing backend
            // flow.
            //
            // This field only tells whether this product
            // is available for rental.
            //
            // =================================================

            rental: {

                isAvailableForRent: {

                    type: Boolean,

                    default: false

                }

            },


            // =================================================
            // SEO
            // =================================================

            metaTitle: {

                type: String,

                default: ""

            },


            metaDescription: {

                type: String,

                default: ""

            },


            // =================================================
            // STATUS
            // =================================================

            status: {

                type: String,

                enum: [

                    PRODUCT_STATUS.ACTIVE,

                    PRODUCT_STATUS.INACTIVE,

                    PRODUCT_STATUS.OUT_OF_STOCK,

                    PRODUCT_STATUS.DISCONTINUED

                ],

                default:
                    PRODUCT_STATUS.ACTIVE

            },


            // =================================================
            // SOFT DELETE
            // =================================================

            isDeleted: {

                type: Boolean,

                default: false

            },


            // =================================================
            // CREATED BY
            // =================================================

            createdBy: {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref: "User"

            }

        },

        {

            timestamps: true

        }

    );


const Product =
    mongoose.model(
        "Product",
        productSchema
    );


export default Product;