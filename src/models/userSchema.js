const mongoose = require("mongoose"); // ✅ Make sure mongoose is installed

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: {
    type: String,
    required: function () {
      return !this.googleId; // password required only for normal signup
    },
  },
  googleId: { type: String }, // optional, Google login
});

module.exports = mongoose.model("User", userSchema);
