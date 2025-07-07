require('dotenv').config(); // Load environment variables
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

// =============================================
// Middleware Setup
// =============================================
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON

// =============================================
// MongoDB Connection Setup
// =============================================
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

    // =============================================
    // Example Routes - Database Operations
    // =============================================

    // Users
    app.get('/users', async (_req, res) => {
      const users = await usersCollection.find().toArray();
      res.json(users);
    });

    app.post('/users', async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.json(result);
    });

    // Products
    app.get('/products', async (_req, res) => {
      const products = await productsCollection.find().toArray();
      res.json(products);
    });

    app.post('/products', async (req, res) => {
      const product = req.body;
      const result = await productsCollection.insertOne(product);
      res.json(result);
    });

    // =============================================
    // Health Check & Root
    // =============================================
    app.get("/", (_req, res) => res.send("Server is running"));
    app.get("/health", (_req, res) =>
      res.json({
        status: "ok",
        time: new Date(),
        db: client.topology?.isConnected() ? "connected" : "disconnected",
      })
    );

    // =============================================
    // Server Startup
    // =============================================
    app.listen(port, () =>
      console.log(`🚀 Server running on port ${port}`)
    );
  } catch (err) {
    console.error("❌ MongoDB Connection Failed", err);
    process.exit(1);
  }
}

// Call the correct function
connectDB().catch(console.dir);

// Graceful Shutdown
["SIGINT", "SIGTERM"].forEach(signal =>
  process.on(signal, async () => {
    console.log(`👋 Received ${signal}, closing MongoDB`);
    await client.close();
    process.exit(0);
  })
);
