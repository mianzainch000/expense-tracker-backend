const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    set: (value) => value.trim(),
  },
  lastName: {
    type: String,
    required: true,
    set: (value) => value.trim(),
  },
  email: {
    type: String,
    required: true,
    unique: true,
    set: (value) => value.trim(),
  },
  password: {
    type: String,
    required: function () {
      return !this.googleId;
    },
    set: (value) => value.trim(),
  },
  googleId: { type: String }, // optional, Google login
  otp: String,
  otpExpiry: Date,
});

module.exports = mongoose.model("User", userSchema);
