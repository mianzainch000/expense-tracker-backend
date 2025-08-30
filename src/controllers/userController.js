require("dotenv").config();
const User = require("../models/userSchema");
const nodemailer = require("nodemailer");
const { otpEmail } = require("../emailTemplate");
const { check, validationResult } = require("express-validator");
const {
  verifyToken,
  generateToken,
  comparePassword,
  generateHashPassword,
} = require("../helper/authFunction");

exports.signup = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    let errorMsg = errors.array()[0].msg;
    return res.status(400).json({ errors: errorMsg });
  }
  try {
    const { firstName, lastName, email, password } = req.body;

    // Check for duplicate email
    let existingUserEmail = await User.findOne({ email });
    if (existingUserEmail) {
      return res.status(409).send({ message: "Email already in use" });
    }

    // Hash the password
    const hashedPassword = await generateHashPassword(password);

    // Create new user
    let user = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
    });

    // Save user to the database
    let result = await user.save();

    // Remove password from the response
    result = result.toObject();
    delete result.password;

    res
      .status(201)
      .send({ message: "Account created successfully", user: result });
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "Internal Server Error." }); // ✅ 500 for server error
  }
};

exports.login = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    let errorMsg = errors.array()[0].msg;
    return res.status(400).json({ errors: errorMsg });
  }
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).send({ message: "Invalid email" });
    }

    // Compare password with hashed password stored in the database
    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(401).send({ message: "Invalid password" });
    }

    const userResponse = user.toObject();
    delete userResponse.password;

    // Get the expiration time from environment variable or use a default value
    const expiresIn = process.env.JWT_EXPIRATION;

    // Use generateToken function to create JWT token
    const token = generateToken(
      { userId: userResponse._id },
      process.env.SECRET_KEY,
      expiresIn
    );

    // Send response with user data and token
    return res.status(200).send({
      // ✅ 200 OK for successful login
      message: "Login successful",
      user: userResponse,
      token: token,
    });
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error." });
  }
};

exports.googleLogin = async (req, res) => {
  try {
    const { email, firstName, lastName, googleId } = req.body;

    // 1️⃣ Check if user already exists
    let user = await User.findOne({ email });

    // 2️⃣ If not, create a new user WITHOUT password
    if (!user) {
      user = new User({
        email,
        firstName,
        lastName,
        googleId: googleId || "google_temp_id", // temporary id if frontend doesn't send it
      });
      await user.save();
    }

    const expiresInGoogle = process.env.JWT_EXPIRATION_Google;

    // 3️⃣ Generate JWT token
    const token = generateToken(
      { userId: user._id },
      process.env.SECRET_KEY,
      expiresInGoogle
    );

    // 4️⃣ Send response
    return res.status(200).send({
      message: "Login successful",
      user,
      token,
    });
  } catch (error) {
    console.error("Google Login Error:", error);
    return res
      .status(500)
      .send({ message: "Something went wrong, please try again." });
  }
};

exports.forgotPassword = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    let errorMsg = errors.array()[0].msg;
    return res.status(400).json({ errors: errorMsg });
  }
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).send({ message: "User not found" });

    // Generate OTP

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryMinutes = parseInt(process.env.OTP_EXPIRE_MINUTES?.trim(), 10);
    user.otp = otp;
    user.otpExpiry = Date.now() + expiryMinutes * 60 * 1000;
    await user.save();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      secure: true,
      auth: {
        user: process.env.OWNER_EMAIL,
        pass: process.env.OWNER_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.OWNER_EMAIL,
      to: email,
      subject: "Your OTP for Password Reset",
      html: otpEmail(otp), // 👈 ye template use ho raha hai
    });

    return res.status(200).send({ message: "OTP sent to your email" });
  } catch (error) {
    console.error("ForgotPasswordOTP Error:", error);
    return res.status(500).send({ message: "Internal Server Error" });
  }
};

exports.resetPassword = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMsg = errors.array()[0].msg;
    return res.status(400).json({ errors: errorMsg });
  }

  try {
    const { email, otp, newPassword } = req.body;

    // Find user by email
    const user = await User.findOne({ email });

    // Find user by OTP (if OTP exists)
    const otpUser = await User.findOne({ otp });

    // Case 1: Email not found
    if (!user) {
      if (otpUser) {
        // OTP exists but for another email
        return res
          .status(400)
          .send({ message: "OTP does not belong to this email" });
      } else {
        return res.status(400).send({ message: "User not found" });
      }
    }

    // Case 2: OTP exists but belongs to another user
    if (otpUser && otpUser.email !== email) {
      return res
        .status(400)
        .send({ message: "OTP does not belong to this email" });
    }

    // Case 3: OTP expired
    if (!user.otp || user.otpExpiry < Date.now()) {
      return res
        .status(400)
        .send({ message: "OTP has expired. Please request a new one." });
    }

    // Case 4: OTP mismatch
    if (user.otp !== otp) {
      return res.status(400).send({ message: "Invalid OTP" });
    }

    // Case 5: Everything is valid → hash password
    const hashedPassword = await generateHashPassword(newPassword);

    // Update password and clear OTP
    user.password = hashedPassword;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    return res.status(200).send({ message: "Password reset successful" });
  } catch (error) {
    console.error("ResetPasswordWithOTP Error:", error);
    return res.status(500).send({ message: "Internal Server Error" });
  }
};

exports.validate = (method) => {
  switch (method) {
    case "signup": {
      return [
        check("firstName")
          .notEmpty()
          .withMessage("First name is required")
          .isAlpha()
          .withMessage("First name must contain only alphabetic characters")
          .custom((value) => value.trim()),
        check("lastName")
          .notEmpty()
          .withMessage("Last name is required")
          .isAlpha()
          .withMessage("Last name must contain only alphabetic characters")
          .custom((value) => value.trim()),
        check("email")
          .notEmpty()
          .withMessage("Email is required")
          .isEmail()
          .withMessage("Please enter a valid email address")
          .custom((value) => value.trim()),
        check("password")
          .notEmpty()
          .withMessage("Password is required")
          .isLength({ min: 8 })
          .withMessage("Password must be at least 8 characters")
          .matches(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
          )
          .withMessage(
            "Password must contain at least one uppercase letter, one number, and one special character"
          ),
      ];
    }

    case "login": {
      return [
        check("email")
          .notEmpty()
          .withMessage("Email is required")
          .isEmail()
          .withMessage("Please enter a valid email address")
          .custom((value) => value.trim()),
        check("password").notEmpty().withMessage("Password is required"),
      ];
    }

    case "forgotPassword": {
      return [
        check("email")
          .notEmpty()
          .withMessage("Email is required")
          .isEmail()
          .withMessage("Please enter a valid email address")
          .custom((value) => value.trim()),
      ];
    }

    case "resetPassword": {
      return [
        check("email")
          .notEmpty()
          .withMessage("Email is required")
          .isEmail()
          .withMessage("Please enter a valid email address")
          .custom((value) => value.trim()),
        check("otp").notEmpty().withMessage("OTP is required"),
        check("newPassword")
          .notEmpty()
          .withMessage("Password is required")
          .isLength({ min: 8 })
          .withMessage("Password must be at least 8 characters")
          .matches(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
          )
          .withMessage(
            "Password must contain at least one uppercase letter, one number, and one special character"
          ),
      ];
    }
  }
};
