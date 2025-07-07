require('dotenv').config(); // Add this at the top to load environment variables
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

// =============================================
// Middleware Setup
// =============================================
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON request bodies

// =============================================
// MongoDB Connection Setup
// =============================================
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.flzolds.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with specific API version settings
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


/**
 * Connects to MongoDB and initializes database references
 */
async function connectDB() {
  try {
    await client.connect();
    const db = client.db("coredenz"); // Database name
    const usersCollection = db.collection("users"); // Users collection




    console.log("Successfully connected to MongoDB!");
  } catch (err) {
    console.error("Failed to connect to MongoDB", err);
    process.exit(1); // Exit if database connection fails
  }
}

// Initialize database connection
connectDB();

// =============================================
// API Routes
// =============================================

/**
 * POST /api/users - Create a new user
 */
app.post('/api/users', async (req, res) => {
  try {
    const userData = req.body;
    
    // Validate required fields
    if (!userData.email || !userData.uid) {
      return res.status(400).json({ 
        success: false,
        error: "Email and UID are required fields" 
      });
    }

    // Check if user already exists
    const existingUser = await usersCollection.findOne({ email: userData.email });
    if (existingUser) {
      return res.status(409).json({ 
        success: false,
        error: "User with this email already exists" 
      });
    }

    // Add timestamps and default role
    userData.createdAt = new Date();
    userData.updatedAt = new Date();
    userData.role = "user";

    // Insert new user document
    const result = await usersCollection.insertOne(userData);
    
    // Return success response
    const createdUser = {
      _id: result.insertedId,
      email: userData.email,
      displayName: userData.displayName || '',
      photoURL: userData.photoURL || '',
      role: userData.role,
      createdAt: userData.createdAt
    };

    res.status(201).json({
      success: true,
      data: createdUser
    });

  } catch (err) {
    console.error("Error creating user:", err);
    res.status(500).json({ 
      success: false,
      error: "Internal server error while creating user" 
    });
  }
});

/**
 * GET /api/users/:email - Get user by email
 */
app.get('/api/users/:email', async (req, res) => {
  try {
    const email = req.params.email;
    
    const user = await usersCollection.findOne(
      { email },
      { projection: { _id: 1, email: 1, displayName: 1, photoURL: 1, role: 1 } }
    );

    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: "User not found" 
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });

  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ 
      success: false,
      error: "Internal server error while fetching user" 
    });
  }
});

/**
 * PUT /api/users/:id - Update user information
 */
app.put('/api/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const updateData = req.body;

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ 
        success: false,
        error: "Invalid user ID format" 
      });
    }

    updateData.updatedAt = new Date();

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ 
        success: false,
        error: "User not found" 
      });
    }

    res.status(200).json({
      success: true,
      message: "User updated successfully"
    });

  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ 
      success: false,
      error: "Internal server error while updating user" 
    });
  }
});

// =============================================
// Server Startup
// =============================================
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Graceful shutdown handler
process.on('SIGINT', async () => {
  await client.close();
  process.exit(0);
});