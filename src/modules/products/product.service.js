import {
    createProductDB,
    getProductsDB,
    getProductByIdDB,
    getProductByNameDB,
    updateProductDB,
    deleteProductDB,
    searchProductsDB,
    getShopProductsDB,
    getProductByBarcodeDB,
    findProductsByReceptionist
} from "./product.repository.js";


import Category from "../categories/category.model.js";


import Brand from "../brands/brand.model.js";


import RentalProduct from "../rental/rentalProduct.model.js";


import Inventory from "../inventory/inventory.model.js";


import generateSlug from "../../common/utils/generateSlug.js";


import generateSKU from "../../common/utils/generateSKU.js";


import {
    calculateDiscountedPrice,
    matchOfferToProduct
} from "../../common/utils/offerCalculator.js";


import {
    getActiveOffersDB
} from "../offer/offer.repository.js";


// =====================================================
// CUSTOMER PRICE HELPER
// =====================================================
//
// PERSONAL  -> retailPrice
// BUSINESS  -> wholesalePrice
//
// =====================================================
const getCustomerPrice = (
    product,
    customerType = "PERSONAL"
) => {

    if (customerType === "BUSINESS") {

        return (
            product.pricing?.wholesalePrice
            ??
            product.pricing?.retailPrice
            ??
            0
        );

    }

    return (
        product.pricing?.retailPrice
        ?? 0
    );

};


// =====================================================
// SAFE CUSTOMER PRICING
// =====================================================
//
// IMPORTANT:
// PERSONAL customer ko wholesalePrice
// response mein nahi bhejna.
//
// BUSINESS customer ko wholesalePrice
// sellingPrice ke naam se milega.
//
// =====================================================

const getSafePricing = (
    product,
    customerType
) => {

    const customerPrice =
        getCustomerPrice(
            product,
            customerType
        );

    return {

        mrp:
            product.pricing?.mrp
            ?? 0,

        discount:
            product.pricing?.discount
            ?? 0,

        gst:
            product.pricing?.gst
            ?? 0,

        sellingPrice:
            customerPrice

    };

};


// =====================================================
// PRODUCTS ADDED BY RECEPTIONIST
// =====================================================

export const fetchProductsAddedByReceptionist = async (
    receptionistId
) => {

    const products =
        await findProductsByReceptionist(
            receptionistId
        );


    return products;

};


// =====================================================
// CREATE PRODUCT
// =====================================================

export const createProductService = async (
    data,
    userId,
    files = []
) => {

    try {

        console.log(
            "========== CREATE PRODUCT SERVICE =========="
        );


        console.log(
            "Incoming Product Data:",
            data
        );


        console.log(
            "Files:",
            files
        );


        // =================================================
        // DUPLICATE PRODUCT
        // =================================================

        const existingProduct =
            await getProductByNameDB(
                data.name
            );


        if (existingProduct) {

            throw new Error(
                "Product already exists"
            );

        }


        // =================================================
        // DUPLICATE BARCODE
        // =================================================

        if (data.barcode) {

            const barcodeExists =
                await getProductByBarcodeDB(
                    data.barcode
                );


            if (barcodeExists) {

                throw new Error(
                    "Barcode already exists"
                );

            }

        }


        // =================================================
        // CATEGORY VALIDATION
        // =================================================

        const category =
            await Category.findById(
                data.category
            );


        if (!category) {

            throw new Error(
                "Category not found"
            );

        }


        console.log(
            "PARENT CATEGORY:",
            category._id,
            category.name
        );


        // =================================================
        // SUBCATEGORY VALIDATION
        // =================================================

        let subcategory = null;


        if (data.subcategory) {

            subcategory =
                await Category.findById(
                    data.subcategory
                );


            if (!subcategory) {

                throw new Error(
                    "Subcategory not found"
                );

            }


            console.log(
                "SUBCATEGORY:",
                subcategory._id,
                subcategory.name
            );

        }


        // =================================================
        // BRAND VALIDATION
        // =================================================

        const brand =
            await Brand.findById(
                data.brand
            );


        if (!brand) {

            throw new Error(
                "Brand not found"
            );

        }


        // =================================================
        // PRICING
        // =================================================

        const pricing = {

            purchasePrice:
                Number(
                    data.pricing?.purchasePrice
                    ?? 0
                ),


            retailPrice:
                Number(
                    data.pricing?.retailPrice
                    ?? 0
                ),


            wholesalePrice:
                data.pricing?.wholesalePrice !== null &&
                data.pricing?.wholesalePrice !== undefined &&
                data.pricing?.wholesalePrice !== ""
                    ? Number(
                        data.pricing.wholesalePrice
                    )
                    : null,


            mrp:
                Number(
                    data.pricing?.mrp
                    ?? 0
                ),


            discount:
                Number(
                    data.pricing?.discount
                    ?? 0
                ),


            gst:
                Number(
                    data.pricing?.gst
                    ?? 0
                )

        };


        // =================================================
        // SLUG
        // =================================================

        const slug =
            generateSlug(
                data.name
            );


        // =================================================
        // SKU
        // =================================================

        const products =
            await getProductsDB();


        const sku =
            generateSKU(

                category.name,

                brand.name,

                products.length + 1

            );


        // =================================================
        // IMAGES
        // =================================================

        let images = [];


        if (
            files &&
            files.length > 0
        ) {

            images =
                files.map(
                    (file) => ({

                        url:
                            `/uploads/products/${file.filename}`,

                        alt:
                            data.name

                    })
                );

        }


        // =================================================
        // FINAL PRODUCT DATA
        // =================================================

        const productData = {

            name:
                data.name,


            // =============================================
            // HSN CODE
            //
            // CHANGE: Added hsnCode field.
            // Reason: productData is built field by field,
            // so without this line the hsnCode sent from
            // the AddProduct form would be silently dropped
            // and never saved in the database.
            // It is later copied into invoice items by
            // createInvoiceFromOrder (invoice.service.js).
            // Falls back to "" when not provided.
            // =============================================

            hsnCode:
                data.hsnCode
                    ? String(data.hsnCode).trim()
                    : "",


            category:
                data.category,


            subcategory:
                data.subcategory
                || null,


            productType:
                data.productType
                || "NEW",


            brand:
                data.brand,


            shortDescription:
                data.shortDescription
                || "",


            description:
                data.description
                || "",


            pricing,


            slug,


            sku,


            images,


            rental: {

                isAvailableForRent:
                    data.rental?.isAvailableForRent
                    === true

            },


            createdBy:
                userId

        };


        // =================================================
        // REFURBISHED DETAILS
        // =================================================

        if (
            data.productType
            === "REFURBISHED"
        ) {

            productData.refurbishedDetails = {

                grade:
                    data.refurbishedDetails?.grade
                    || null,


                batteryHealth:
                    Number(
                        data.refurbishedDetails
                            ?.batteryHealth
                        ?? 0
                    ),


                warrantyMonths:
                    Number(
                        data.refurbishedDetails
                            ?.warrantyMonths
                        ?? 0
                    ),


                testingStatus:
                    data.refurbishedDetails
                        ?.testingStatus
                    || null

            };

        }


        // =================================================
        // BARCODE
        // =================================================

        if (data.barcode) {

            productData.barcode =
                data.barcode;

        }


        // =================================================
        // SPECIFICATIONS
        // =================================================

        if (data.specifications) {

            productData.specifications =
                data.specifications;

        }


        // =================================================
        // SEO
        // =================================================

        if (data.metaTitle) {

            productData.metaTitle =
                data.metaTitle;

        }


        if (data.metaDescription) {

            productData.metaDescription =
                data.metaDescription;

        }


        // =================================================
        // STATUS
        // =================================================

        if (data.status) {

            productData.status =
                data.status;

        }


        // =================================================
        // DEBUG
        // =================================================

        console.log(
            "FINAL PRODUCT DATA:",
            productData
        );


        // =================================================
        // CREATE PRODUCT
        // =================================================

        const product =
            await createProductDB(
                productData
            );


        // =====================================================
        // CREATE RENTAL PRODUCT
        // =====================================================
        //
        // Rental is controlled only by:
        //
        // data.rental.isAvailableForRent
        //
        // NOT by productType.
        //
        // =====================================================

        if (
            data.rental?.isAvailableForRent
            === true
        ) {

            const rentalAvailableQuantity =
                Number(
                    data.rental
                        ?.availableQuantity
                    ?? 0
                );


            const rentalData = {

                productId:
                    product._id,


                isAvailableForRent:
                    true,


                monthlyRent:
                    Number(
                        data.rental
                            ?.monthlyRent
                        ?? 0
                    ),


                securityDeposit:
                    Number(
                        data.rental
                            ?.securityDeposit
                        ?? 0
                    ),


                minimumRentalMonths:
                    Math.max(

                        Number(
                            data.rental
                                ?.minimumRentalMonths
                            ?? 3
                        ),

                        3

                    ),


                gst:
                    Number(
                        data.rental
                            ?.gst
                        ?? 0
                    ),


                totalQuantity:
                    rentalAvailableQuantity,


                availableQuantity:
                    rentalAvailableQuantity,


                rentedQuantity:
                    0,


                basicSoftwareInstalled:
                    data.rental
                        ?.basicSoftwareInstalled
                    ?? true,


                includedItems:
                    data.rental
                        ?.includedItems
                        ?.length

                        ? data.rental
                            .includedItems

                        : [

                            "LAPTOP",

                            "CHARGING_ADAPTER",

                            "BACKPACK"

                        ],


                status:
                    "ACTIVE",


                notes:
                    data.rental
                        ?.notes
                    ?? "",


                createdBy:
                    userId

            };


            await RentalProduct.create(
                rentalData
            );

        }


        // =================================================
        // AUTO CREATE INVENTORY
        // =================================================

        await Inventory.create({

            product:
                product._id,


            currentStock:
                0,


            reservedStock:
                0,


            minimumStock:
                0,


            maximumStock:
                0,


            warehouseLocation:
                "",


            createdBy:
                userId

        });


        // =================================================
        // RETURN
        // =================================================

        return product;


    } catch (error) {

        console.error(
            "CREATE PRODUCT SERVICE ERROR:",
            error
        );


        throw error;

    }

};


// =====================================================
// GET PRODUCTS - ADMIN
// =====================================================

export const getProductsService = async () => {

    return await getProductsDB();

};


// =====================================================
// GET SINGLE PRODUCT
// =====================================================

export const getProductService = async (
    id,
    customerType = "PERSONAL"
) => {

    const product =
        await getProductByIdDB(
            id
        );


    if (!product) {

        throw new Error(
            "Product not found"
        );

    }


    // =================================================
    // GET ACTIVE OFFERS
    // =================================================

    const activeOffers =
        await getActiveOffersDB();


    // =================================================
    // MATCH OFFER
    // =================================================

    const offer =
        matchOfferToProduct(
            product,
            activeOffers
        );


    // =================================================
    // CUSTOMER PRICE
    // =================================================

    const customerPrice =
        getCustomerPrice(
            product,
            customerType
        );


    // =================================================
    // FINAL PRICE
    // =================================================

    const finalPrice =
        customerPrice !== null

            ? calculateDiscountedPrice(
                customerPrice,
                offer
            )

            : null;


    // =================================================
    // PRODUCT DATA
    // =================================================

    const productData =
        product.toObject();


    // =================================================
    // SAFE PRICING
    // =================================================

    const safePricing =
        getSafePricing(
            productData,
            customerType
        );


    // =================================================
    // RETURN
    // =================================================

    return {

        ...productData,


        pricing:
            safePricing,


        customerType,


        customerPrice,


        offer:
            offer
            || null,


        finalPrice

    };

};


// =====================================================
// UPDATE PRODUCT
// =====================================================
//
// NOTE (hsnCode): No change needed here.
// `data` is passed straight to updateProductDB, so
// hsnCode is saved automatically once the update
// validation (product.validation.js) allows it.
//
// =====================================================

export const updateProductService = async (
    id,
    data
) => {

    // =================================================
    // HANDLE FLAT PRICING
    // =================================================

    const hasFlatPricing =

        data.purchasePrice !== undefined ||

        data.retailPrice !== undefined ||

        data.wholesalePrice !== undefined ||

        data.sellingPrice !== undefined ||

        data.mrp !== undefined ||

        data.discount !== undefined ||

        data.gst !== undefined;


    if (hasFlatPricing) {

        data.pricing = {

            purchasePrice:
                data.purchasePrice !== undefined
                    ? Number(data.purchasePrice)
                    : 0,


            // PERSONAL CUSTOMER PRICE
            retailPrice:
                data.retailPrice !== undefined
                    ? Number(data.retailPrice)
                    : (
                        data.sellingPrice !== undefined
                            ? Number(data.sellingPrice)
                            : 0
                    ),


            // BUSINESS CUSTOMER PRICE
            wholesalePrice:
                data.wholesalePrice !== undefined &&
                data.wholesalePrice !== null &&
                data.wholesalePrice !== ""

                    ? Number(data.wholesalePrice)

                    : null,


            mrp:
                data.mrp !== undefined
                    ? Number(data.mrp)
                    : 0,


            discount:
                data.discount !== undefined
                    ? Number(data.discount)
                    : 0,


            gst:
                data.gst !== undefined
                    ? Number(data.gst)
                    : 0

        };


        // Remove flat fields
        delete data.purchasePrice;

        delete data.retailPrice;

        delete data.wholesalePrice;

        delete data.sellingPrice;

        delete data.mrp;

        delete data.discount;

        delete data.gst;

    }


    // =================================================
    // SLUG
    // =================================================

    if (data.name) {

        data.slug =
            generateSlug(
                data.name
            );

    }


    // =================================================
    // UPDATE PRODUCT
    // =================================================

    const product =
        await updateProductDB(
            id,
            data
        );


    if (!product) {

        throw new Error(
            "Product not found"
        );

    }


    return product;

};


// =====================================================
// DELETE PRODUCT
// =====================================================

export const deleteProductService = async (
    id
) => {

    const product =
        await deleteProductDB(
            id
        );


    if (!product) {

        throw new Error(
            "Product not found"
        );

    }


    return product;

};


// =====================================================
// SEARCH PRODUCTS
// =====================================================

export const searchProductService = async (
    keyword
) => {

    return await searchProductsDB(
        keyword
    );

};


// =====================================================
// CUSTOMER SHOP PRODUCTS
// =====================================================

export const getShopProductsService = async (
    customerType = "PERSONAL"
) => {

    try {

        console.log(
            "======================================"
        );


        console.log(
            "GET SHOP PRODUCTS SERVICE"
        );


        console.log(
            "CUSTOMER TYPE:",
            customerType
        );


        console.log(
            "======================================"
        );


        // =================================================
        // GET ACTIVE PRODUCTS
        // =================================================

        const products =
            await getShopProductsDB();


        console.log(
            "SHOP PRODUCTS COUNT:",
            products.length
        );


        // =================================================
        // GET ACTIVE OFFERS
        // =================================================

        const activeOffers =
            await getActiveOffersDB();


        console.log(
            "ACTIVE OFFERS COUNT:",
            activeOffers.length
        );


        // =================================================
        // APPLY OFFERS
        // =================================================

        const productsWithOffers =
            products.map(
                (product) => {

                    // -----------------------------------------
                    // MONGOOSE DOCUMENT -> OBJECT
                    // -----------------------------------------

                    const productData =
                        typeof product.toObject
                        === "function"

                            ? product.toObject()

                            : product;


                    // -----------------------------------------
                    // FIND OFFER
                    // -----------------------------------------

                    const offer =
                        matchOfferToProduct(
                            productData,
                            activeOffers
                        );


                    // -----------------------------------------
                    // CUSTOMER PRICE
                    // -----------------------------------------

                    const customerPrice =
                        getCustomerPrice(
                            productData,
                            customerType
                        );


                    // -----------------------------------------
                    // FINAL PRICE
                    // -----------------------------------------

                    const finalPrice =
                        customerPrice !== null

                            ? calculateDiscountedPrice(
                                customerPrice,
                                offer
                            )

                            : null;


                    // -----------------------------------------
                    // SAFE PRICING
                    // -----------------------------------------

                    const safePricing =
                        getSafePricing(
                            productData,
                            customerType
                        );


                    // -----------------------------------------
                    // RETURN PRODUCT
                    // -----------------------------------------

                    return {

                        ...productData,


                        pricing:
                            safePricing,


                        customerType,


                        customerPrice,


                        offer:
                            offer
                            || null,


                        finalPrice

                    };

                }
            );


        console.log(
            "FINAL SHOP PRODUCTS:",
            productsWithOffers.length
        );


        return productsWithOffers;


    } catch (error) {

        console.error(
            "GET SHOP PRODUCTS SERVICE ERROR:",
            error
        );


        throw error;

    }

};