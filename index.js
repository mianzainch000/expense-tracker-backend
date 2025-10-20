require("dotenv").config();
const cors = require("cors");
const express = require("express");
const serverless = require("serverless-http");

const connectDB = require("./src/config/db");
const userRoutes = require("./src/routes/userRoutes");
const expenseRoutes = require("./src/routes/expenseRoutes");

const app = express();

// --- Middlewares ---
app.use(cors());
app.use(express.json());

// --- Ensure DB connected before hitting routes ---
app.use(async (req, res, next) => {
    try {
        await connectDB();
        return next();
    } catch (err) {
        console.error("DB connect middleware error:", err);
        return res.status(500).json({ message: "Database connection error" });
    }
});

// --- Routes ---
app.use("/", userRoutes);
app.use("/", expenseRoutes);

// --- Export for Vercel (Serverless) ---
module.exports = app;
module.exports.handler = serverless(app);

// --- Local dev environment ---
if (process.env.NODE_ENV !== "production") {
    const PORT = process.env.PORT || 8000;
    app.listen(PORT, async () => {
        try {
            await connectDB();
            console.log(`Server running on port ${PORT}`);
        } catch (err) {
            console.error("❌ Failed to connect to DB on startup:", err);
        }
    });
}
