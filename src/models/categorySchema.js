const mongoose = require("mongoose");
const { Schema } = mongoose;

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["income", "expense"],
      lowercase: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
  },
  { timestamps: true },
);

categorySchema.index({ name: 1, type: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("category", categorySchema);
