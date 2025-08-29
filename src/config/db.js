const mongoose = require("mongoose");

// Cache across hot-reloads and serverless invocations
let cached = global.mongoose;
if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
    if (cached.conn) {
        return cached.conn;
    }

    if (!process.env.MONGO_URI) {
        throw new Error("❌ MONGO_URI missing in environment");
    }

    if (!cached.promise) {
        // Ek hi promise banega, parallel requests me multiple sockets nahi khulen ge
        cached.promise = mongoose
            .connect(process.env.MONGO_URI, {
                maxPoolSize: 10, // pool size (connections reuse honge)
                serverSelectionTimeoutMS: 15000, // 15s me fail if not connected
            })
            .then((mongooseInstance) => {
                console.log("✅ MongoDB connected");
                return mongooseInstance;
            })
            .catch((err) => {
                console.error("❌ MongoDB error:", err);
                throw err;
            });
    }

    cached.conn = await cached.promise;
    return cached.conn;
}

module.exports = connectDB;
