const mongoose = require("mongoose");
const { Schema } = mongoose;
const expenseSchema = new mongoose.Schema({
    date: { type: String, required: true },
    description: { type: String, required: true },
    amount: Number,
    paymentType: { type: String, required: true },
    type: { type: String, required: true },

    // userId is a reference use to link the tabel
    userId: {
        type: Schema.Types.ObjectId,
        ref: "users",
        require: true,
    },
});
module.exports = mongoose.model("expense", expenseSchema);
