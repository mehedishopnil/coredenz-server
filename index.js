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
    // Cart Routes
    // ======================
    app.post('/cart', async (req, res) => {
      const cartItem = req.body;
      
      // Validate required fields
      if (!cartItem.userId || !cartItem.productId || !cartItem.quantity) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      try {
        // Check if product exists
        const product = await productsCollection.findOne({ 
          _id: new ObjectId(cartItem.productId) 
        });
        if (!product) {
          return res.status(404).json({ message: 'Product not found' });
        }

        // Check if item already in cart
        const existingItem = await cartCollection.findOne({
          userId: cartItem.userId,
          productId: cartItem.productId
        });

        let result;
        if (existingItem) {
          // Update quantity if item exists
          result = await cartCollection.updateOne(
            { _id: existingItem._id },
            { $set: { quantity: existingItem.quantity + cartItem.quantity } }
          );
        } else {
          // Add new item to cart
          result = await cartCollection.insertOne({
            ...cartItem,
            createdAt: new Date(),
            updatedAt: new Date(),
            productDetails: product // Store product details for easy access
          });
        }

        res.status(201).json(result);
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
      }
    });

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