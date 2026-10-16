import Joi from "joi";


// =====================================================
// CREATE PRODUCT VALIDATION
// =====================================================

export const createProductValidation = Joi.object({

    // =================================================
    // BASIC INFORMATION
    // =================================================

    name: Joi.string()
        .trim()
        .min(2)
        .max(150)
        .required(),

    barcode: Joi.string()
        .trim()
        .allow("")
        .optional(),

    // =================================================
    // HSN CODE (used on tax invoices)
    // Optional. 4, 6 or 8 digits.
    //
    // CHANGE: Added hsnCode field.
    // Reason: Joi rejects unknown keys by default, so
    // without this the AddProduct form would fail with
    // '"hsnCode" is not allowed'.
    // Empty string is allowed so the field stays optional.
    // =================================================

    hsnCode: Joi.string()
        .trim()
        .pattern(/^\d{4}(\d{2}(\d{2})?)?$/)
        .allow("")
        .optional()
        .messages({
            "string.pattern.base":
                "HSN code must be 4, 6 or 8 digits"
        }),

    category: Joi.string()
        .trim()
        .required(),

    subcategory: Joi.string()
        .trim()
        .allow("")
        .allow(null)
        .optional(),

    productType: Joi.string()
        .valid("NEW", "REFURBISHED", "RENTAL")
        .default("NEW"),

    refurbishedDetails: Joi.when("productType", {
        is: "REFURBISHED",

        then: Joi.object({

            grade: Joi.string()
                .valid("A+", "A", "B", "C")
                .required(),

            batteryHealth: Joi.number()
                .min(0)
                .max(100)
                .required(),

            warrantyMonths: Joi.number()
                .min(0)
                .required(),

            testingStatus: Joi.string()
                .valid("TESTED", "NOT_TESTED")
                .required()

        }).required(),

        otherwise: Joi.forbidden()

    }),

    brand: Joi.string()
        .trim()
        .required(),

    description: Joi.string()
        .allow("")
        .optional(),

    shortDescription: Joi.string()
        .allow("")
        .optional(),


    // =================================================
    // PRICING
    // purchasePrice   = company purchase/cost price
    // retailPrice     = PERSONAL customer price (required)
    // wholesalePrice  = BUSINESS / CORPORATE customer price (optional)
    // =================================================

    pricing: Joi.object({

        purchasePrice: Joi.number()
            .min(0)
            .required(),

        retailPrice: Joi.number()
            .min(0)
            .required(),

        wholesalePrice: Joi.number()
            .min(0)
            .allow(null)
            .optional(),

        mrp: Joi.number()
            .min(0)
            .required(),

        discount: Joi.number()
            .min(0)
            .max(100)
            .default(0),

        gst: Joi.number()
            .min(0)
            .max(100)
            .default(0)

    }).required(),


    // =================================================
    // SEO
    // =================================================

    metaTitle: Joi.string()
        .allow("")
        .optional(),

    metaDescription: Joi.string()
        .allow("")
        .optional(),


    // =================================================
    // SPECIFICATIONS
    // =================================================

    specifications: Joi.object()
        .default({}),


    // =====================================================
    // RENTAL
    // =====================================================

    rental: Joi.object({

        isAvailableForRent:
            Joi.boolean()
                .required(),

        monthlyRent:
            Joi.number()
                .min(0)
                .when("isAvailableForRent", {
                    is: true,
                    then: Joi.required(),
                    otherwise: Joi.optional()
                }),

        securityDeposit:
            Joi.number()
                .min(0)
                .when("isAvailableForRent", {
                    is: true,
                    then: Joi.required(),
                    otherwise: Joi.optional()
                }),

        minimumRentalMonths:
            Joi.number()
                .integer()
                .min(1)
                .when("isAvailableForRent", {
                    is: true,
                    then: Joi.required(),
                    otherwise: Joi.optional()
                }),

        gst:
            Joi.number()
                .min(0)
                .max(100)
                .default(0),

        availableQuantity:
            Joi.number()
                .integer()
                .min(0)
                .required(),

        basicSoftwareInstalled:
            Joi.boolean()
                .default(false),

        includedItems:
            Joi.array()
                .items(
                    Joi.string().trim()
                )
                .default([]),

        notes:
            Joi.string()
                .allow("")
                .default("")

    })

});




// =====================================================
// UPDATE PRODUCT VALIDATION
// =====================================================

export const updateProductValidation = Joi.object({

    // =================================================
    // BASIC INFORMATION
    // =================================================

    name: Joi.string()
        .trim()
        .min(2)
        .max(150),

    barcode: Joi.string()
        .trim()
        .allow(""),

    // =================================================
    // HSN CODE (used on tax invoices)
    // Optional. 4, 6 or 8 digits.
    //
    // CHANGE: Added hsnCode field.
    // Reason: Allows HSN code to be edited later from
    // the EditProduct form. Without this, update requests
    // containing hsnCode would be rejected by Joi.
    // =================================================

    hsnCode: Joi.string()
        .trim()
        .pattern(/^\d{4}(\d{2}(\d{2})?)?$/)
        .allow("")
        .messages({
            "string.pattern.base":
                "HSN code must be 4, 6 or 8 digits"
        }),

    category: Joi.string()
        .trim(),

    subcategory: Joi.string()
        .trim()
        .allow("")
        .allow(null),

    // =================================================
    // PRODUCT TYPE
    // =================================================

    productType: Joi.string()
        .valid(
            "NEW",
            "REFURBISHED",
            "RENTAL"
        )
        .default("NEW"),

    // =================================================
    // REFURBISHED DETAILS
    // =================================================

    refurbishedDetails: Joi.object({

        grade: Joi.string()
            .valid("A+", "A", "B", "C"),

        batteryHealth: Joi.number()
            .min(0)
            .max(100),

        warrantyMonths: Joi.number()
            .min(0),

        testingStatus: Joi.string()
            .valid("TESTED", "NOT_TESTED")

    }),

    // =================================================
    // BRAND
    // =================================================

    brand: Joi.string()
        .trim(),

    // =================================================
    // DESCRIPTION
    // =================================================

    description: Joi.string()
        .allow(""),

    shortDescription: Joi.string()
        .allow(""),

    // =================================================
    // PRICING
    // purchasePrice   = company purchase/cost price
    // retailPrice     = PERSONAL customer price
    // wholesalePrice  = BUSINESS / CORPORATE customer price
    // =================================================

    pricing: Joi.object({

        purchasePrice: Joi.number()
            .min(0),

        retailPrice: Joi.number()
            .min(0),

        wholesalePrice: Joi.number()
            .min(0)
            .allow(null),

        mrp: Joi.number()
            .min(0),

        discount: Joi.number()
            .min(0)
            .max(100),

        gst: Joi.number()
            .min(0)
            .max(100)

    }),

    // =================================================
    // SEO
    // =================================================

    metaTitle: Joi.string()
        .allow(""),

    metaDescription: Joi.string()
        .allow(""),

    // =================================================
    // SPECIFICATIONS
    // =================================================

    specifications: Joi.object(),

    // =====================================================
    // RENTAL
    // =====================================================

    rental: Joi.object({

        isAvailableForRent: Joi.boolean().required(),

        monthlyRent: Joi.number()
            .min(0)
            .when("isAvailableForRent", {
                is: true,
                then: Joi.required(),
                otherwise: Joi.optional()
            }),

        securityDeposit: Joi.number()
            .min(0)
            .when("isAvailableForRent", {
                is: true,
                then: Joi.required(),
                otherwise: Joi.optional()
            }),

        minimumRentalMonths: Joi.number()
            .integer()
            .min(3)
            .when("isAvailableForRent", {
                is: true,
                then: Joi.required(),
                otherwise: Joi.optional()
            }),

        gst: Joi.number()
            .min(0)
            .max(100)
            .default(0),

        availableQuantity: Joi.number()
            .integer()
            .min(1)
            .when("isAvailableForRent", {
                is: true,
                then: Joi.required(),
                otherwise: Joi.optional()
            }),

        basicSoftwareInstalled: Joi.boolean()
            .default(true),

        includedItems: Joi.array()
            .items(Joi.string().trim())
            .default([]),

        notes: Joi.string()
            .allow("")
            .default("")

    })

});