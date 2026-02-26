require('dotenv').config();
const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors');
const app = express()
const port = 3000

const Product = require('./models/productModel')

app.use(express.json())

const allowedOrigins = [
  "http://127.0.0.1:5500", // Add this (VS Code Live Server default)
  "http://localhost:5500"  // Add this (Just to be safe)
];
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true // Important for sessions/cookies
}));

function normalize(str) {
  return str.toLowerCase().replace(/\s+/g, '').trim();
}

function generateModelKey(laptop) {
  return [
    normalize(laptop.brand),
    normalize(laptop.model),
    normalize(laptop.processor),
    normalize(laptop.ram),
    normalize(laptop.storage)
  ].join("-");
}


// POST - Create new product (no dateSold field needed)
app.post('/products', async (req, res) => {
  try {
    // Only accept fields defined in schema
    const laptopData = {
      serial: req.body.serial,
      brand: req.body.brand,
      model: req.body.model,
      processor: req.body.processor,
      ram: req.body.ram,
      storage: req.body.storage,
      purchaseDate: req.body.purchaseDate || null, // Allow null if not provided
      status: req.body.status || 'Available',
    };

    laptopData.modelKey = generateModelKey(laptopData);

    // Check if same model already exists
    const existingModel = await Product.findOne({
      modelKey: laptopData.modelKey
    });

    if (existingModel) {
      // Reuse existing image
      laptopData.imageUrl = existingModel.imageUrl;
    } else {
      // Accept imageUrl from frontend
      laptopData.imageUrl = req.body.imageUrl || null;
    }

    // Validate required fields
    if (!laptopData.serial || !laptopData.brand || !laptopData.model || 
        !laptopData.processor || !laptopData.ram || !laptopData.storage) 
        {
      return res.status(400).json({ 
        message: 'Missing required fields. Please provide: serial, brand, model, processor, ram, storage, purchaseDate' 
      });
    }

    // Check if serial already exists
    const existingLaptop = await Product.findOne({ serial: laptopData.serial });
    if (existingLaptop) {
      return res.status(400).json({ 
        message: 'A laptop with this serial number already exists' 
      });
    }

    const product = await Product.create(laptopData);
    res.status(201).json(product);
    
  } catch (error) {
    console.log('Error creating product:', error.message);
    
   
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// PUT - Update existing product
app.put('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Only include fields that exist in schema
    const laptopData = {
      serial: req.body.serial,
      brand: req.body.brand,
      model: req.body.model,
      processor: req.body.processor,
      ram: req.body.ram,
      storage: req.body.storage,
      purchaseDate: req.body.purchaseDate,
      status: req.body.status
    };

    if (req.body.imageUrl) {
      laptopData.imageUrl = req.body.imageUrl;
    }
    // Remove undefined fields
    Object.keys(laptopData).forEach(key => 
      laptopData[key] === undefined && delete laptopData[key]
    );

    // Check if laptop exists
    // First get existing product
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: `Cannot find laptop with ID ${id}` });
    }

    // If imageUrl is being updated
    if (req.body.imageUrl) {
      
      // Update all products with same modelKey
      await Product.updateMany(
        { modelKey: product.modelKey },
        { $set: { imageUrl: req.body.imageUrl } }
      );

      const updatedProducts = await Product.find({ modelKey: product.modelKey });
      return res.status(200).json(updatedProducts);
    }

    // If serial is being changed, check it doesn't conflict
    if (laptopData.serial && laptopData.serial !== product.serial) {
      const existingLaptop = await Product.findOne({ 
        serial: laptopData.serial,
        _id: { $ne: id }
      });
      if (existingLaptop) {
        return res.status(400).json({ 
          message: 'Another laptop with this serial number already exists' 
        });
      }
    }

    const updatedProduct = await Product.findByIdAndUpdate(id, laptopData, {
      new: true,
      runValidators: true
    });

    res.status(200).json(updatedProduct);
    
  } catch (error) {
    console.log('Error updating product:', error.message);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ message: 'Validation error', errors: messages });
    }
    
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid laptop ID format' });
    }
    
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});



//fetching all products
app.get('/products', async (req, res) => {
  try {
    const products = await Product.find({})
    res.status(200).json(products)
  } catch (error) {
    console.log(error.message)
    res.status(500).json({message: error.message})
  }
})

app.get('/products/unique', async (req, res) => {
  try {

    const uniqueProducts = await Product.aggregate([
      {
        $group: {
          _id: "$modelKey",
          product: { $first: "$$ROOT" }
        }
      },
      {
        // Replace root with actual product object
        $replaceRoot: { newRoot: "$product" }
      }
    ]);
    res.json(uniqueProducts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching unique products" });
  }
});

// ==================================================
// GET UNIQUE PRODUCTS BY BRAND (1 IMAGE PER MODEL)
// ==================================================

app.get('/products/brand/:brand', async (req, res) => {
  try {
    const brandName = req.params.brand;
    const products = await Product.aggregate([
      {
        $match: {
          brand: brandName
        }
      },

      // 🔹 Group by modelKey (1 per model)
      {
        $group: {
          _id: "$modelKey",
          product: { $first: "$$ROOT" }
        }
      },

      // 🔹 Replace output structure
      {
        $replaceRoot: { newRoot: "$product" }
      }

    ]);
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching brand products" });
  }
});

app.delete('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByIdAndDelete(id);
    
    if (!product) {
      return res.status(404).json({ message: `Cannot find laptop with ID ${id}` });
    }
    
    res.status(200).json({ 
      message: 'Laptop deleted successfully', 
      deletedProduct: product 
    });
    
  } catch (error) {
    console.log('Error deleting product:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

mongoose.connect(process.env.MONGODB_URL)
.then(()=>{
    console.log("connected to cictechInventory mongodb");
    app.listen(port, ()=>{
        console.log('cictechInventory API is running on port 3000');
    })
}).catch((error) => {  // ✅ include (error)
  console.log("MongoDB connection error:", error.message);
});
