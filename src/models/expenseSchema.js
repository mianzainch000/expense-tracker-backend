const mongoose = require("mongoose");
const { Schema } = mongoose;

const expenseSchema = new mongoose.Schema({
    date: {
        type: String,
        required: true,
        set: (value) => value.trim(),
    },
    description: {
        type: String,
        required: true,
        set: (value) => value.trim(),
    },
    amount: {
        type: Number,
        required: true,
    },
    paymentType: {
        type: String,
        required: true,
        set: (value) => value.trim(),
    },
    type: {
        type: String,
        required: true,
        set: (value) => value.trim(),
    },
    // userId is a reference to link the expense to a user
    userId: {
        type: Schema.Types.ObjectId,
        ref: "users",
        required: true,
    },
});

module.exports = mongoose.model("expense", expenseSchema);
