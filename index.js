require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.flzolds.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function connectDB() {
  try {
    await client.connect();
    console.log("✅ MongoDB Connected Successfully");

    const db = client.db("coredenz");
    const usersCollection = db.collection("users");
    const productsCollection = db.collection("products");
    const cartCollection = db.collection("cartData");

    // ======================
    // Enhanced User Routes
    // ======================
    app.get('/users', async (_req, res) => {
      const users = await usersCollection.find().toArray();
      res.json(users);
    });

    app.get('/users/:email', async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(user);
    });

    app.post('/users', async (req, res) => {
      const user = req.body;
      // Check if user already exists
      const existingUser = await usersCollection.findOne({ email: user.email });
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }
      
      const result = await usersCollection.insertOne({
        ...user,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      res.status(201).json(result);
    });

    // ======================
    // Product Routes
    // ======================
    app.get('/products', async (_req, res) => {
      const products = await productsCollection.find().toArray();
      res.json(products);
    });

    app.get('/products/:id', async (req, res) => {
      try {
        const product = await productsCollection.findOne({ 
          _id: new ObjectId(req.params.id) 
        });
        if (!product) {
          return res.status(404).json({ message: 'Product not found' });
        }
        res.json(product);
      } catch (err) {
        res.status(400).json({ message: 'Invalid product ID' });
      }
    });

    app.post('/products', async (req, res) => {
      const product = req.body;
      const result = await productsCollection.insertOne({
        ...product,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      res.status(201).json(result);
    });



  // ======================
// Cart Routes (Updated)
// ======================

// Get all cart items for a user
app.get('/cart/:email', async (req, res) => {
  try {
    const cartItems = await cartCollection.find({
      userEmail: req.params.email
    }).toArray();
    res.json(cartItems);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add item to cart (or update quantity if it exists)
app.post('/cart', async (req, res) => {
  const { userEmail, userId, productId, quantity = 1 } = req.body;

  if (!userEmail || !productId || !userId) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const existingItem = await cartCollection.findOne({
      userEmail,
      productId,
    });

    if (existingItem) {
      const result = await cartCollection.updateOne(
        { _id: existingItem._id },
        {
          $set: {
            quantity: existingItem.quantity + quantity,
            updatedAt: new Date()
          }
        }
      );

      const updatedItem = await cartCollection.findOne({ _id: existingItem._id });
      return res.json(updatedItem);
    }

    const newItem = {
      userEmail,
      userId,
      productId,
      quantity,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const insertResult = await cartCollection.insertOne(newItem);
    const insertedItem = await cartCollection.findOne({ _id: insertResult.insertedId });
    res.status(201).json(insertedItem);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});


// Update cart item quantity - using PATCH
app.patch('/cart/:productId', async (req, res) => {
  const { quantity, userEmail } = req.body;
  const productId = parseInt(req.params.productId); // Convert to number

  // Validate inputs
  if (!userEmail) {
    return res.status(400).json({ message: 'userEmail is required' });
  }

  if (!quantity || isNaN(quantity) || quantity < 1) {
    return res.status(400).json({ message: 'Invalid quantity' });
  }

  try {
    const result = await cartCollection.findOneAndUpdate(
      { 
        userEmail,
        productId // Using numeric productId
      },
      {
        $set: {
          quantity: parseInt(quantity),
          updatedAt: new Date()
        }
      },
      {
        returnDocument: 'after'
      }
    );

    if (!result.value) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    res.json(result.value);
  } catch (err) {
    console.error('Error updating cart quantity:', err);
    res.status(500).json({ 
      message: 'Failed to update cart item',
      error: err.message 
    });
  }
});

// Delete item from cart using productId (as a number)
app.delete('/cart/:productId', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);

    if (isNaN(productId)) {
      return res.status(400).json({ message: 'Invalid productId' });
    }

    const result = await cartCollection.deleteOne({ productId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    res.json({ message: 'Item removed from cart successfully' });
  } catch (err) {
    console.error('Error deleting cart item:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


    // ======================
    // Health Check & Root
    // ======================
    app.get("/", (_req, res) => res.send("Server is running"));
    app.get("/health", (_req, res) =>
      res.json({
        status: "ok",
        time: new Date(),
        db: client.topology?.isConnected() ? "connected" : "disconnected",
      })
    );

    // Start server
    app.listen(port, () =>
      console.log(`🚀 Server running on port ${port}`)
    );
  } catch (err) {
    console.error("❌ MongoDB Connection Failed", err);
    process.exit(1);
  }
}

connectDB().catch(console.dir);

// Graceful Shutdown
["SIGINT", "SIGTERM"].forEach(signal =>
  process.on(signal, async () => {
    console.log(`👋 Received ${signal}, closing MongoDB`);
    await client.close();
    process.exit(0);
  })
);