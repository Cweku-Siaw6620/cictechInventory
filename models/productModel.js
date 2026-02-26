const mongoose = require('mongoose');

const productSchema = mongoose.Schema(
    {
        serial: {
            type: String,
            required: [true, "Please enter a serial number"],
            unique: true
        },
        brand: {
            type: String,
            required: [true, "Please enter a brand"]
        },
        model: {
            type: String,
            required: [true, "Please enter a model"]
        },
        processor: {
            type: String,
            required: [true, "Please enter processor details"]
        },
        ram: {
            type: String,
            required: [true, "Please enter RAM size"]
        },
        storage: {
            type: String,
            required: false
        },
        purchaseDate: {
            type: Date,
            required: false
        },
        status: {
            type: String,
            required: true,
            enum: ['Available', 'Sold'],
            default: 'Available'
        },
        modelKey: {
            type: String,
            required: true
        },
        imageUrl: {
            type: String,
            default: null
        }
    },
    {
        timestamps: true
    }
);

const Product = mongoose.model('Product', productSchema);

module.exports = Product;