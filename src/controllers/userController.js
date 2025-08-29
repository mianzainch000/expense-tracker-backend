require("dotenv").config();
const User = require("../models/userSchema");
const nodemailer = require("nodemailer");
const ForgetPasswordEmail = require("../emailTemplate");
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

    // 3️⃣ Generate JWT token
    const token = generateToken(
      { userId: user._id },
      process.env.SECRET_KEY,
      "2d"
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

    // Check if the user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).send({ message: "User not found." });
    }

    // Generate JWT token using helper function
    const tokenEmail = generateToken(
      { email },
      process.env.SECRET_KEY,
      process.env.JWT_EXPIRATION_EMAIL
    );

    // Prepare email transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      secure: true,
      auth: {
        user: process.env.OWNER_EMAIL,
        pass: process.env.OWNER_PASS,
      },
    });

    // Email content
    const html = ForgetPasswordEmail.email(
      "https://my-expense-tracker-frontend.vercel.app/auth/resetPassword",
      // "http://localhost:3000/auth/resetPassword",
      tokenEmail
    );
    const emailOptions = {
      from: process.env.OWNER_EMAIL,
      to: email,
      subject: "Here's your password reset link!",
      text: "click on Button to Reset ",
      html: html,
    };

    // Send the email
    await transporter.sendMail(emailOptions);

    return res
      .status(200)
      .send({ message: "Password reset email sent successfully." });
  } catch (error) {
    return res.status(500).send({ message: "Internal server error." });
  }
};

exports.resetPassword = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    let errorMsg = errors.array()[0].msg;
    return res.status(400).json({ errors: errorMsg });
  }
  try {
    const { tokenEmail: token } = req.params;
    const { newPassword } = req.body;

    // Validate inputs
    if (!token || !newPassword) {
      return res
        .status(400)
        .send({ message: "Token and new password are required" });
    }

    // Verify the token using the helper function
    let decoded;
    try {
      decoded = verifyToken(token, process.env.SECRET_KEY);
    } catch (err) {
      return res.status(401).send({ message: err.message });
    }

    // Extract email from the token
    const { email } = decoded;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    // Hash the new password using helper function
    const hashedPassword = await generateHashPassword(newPassword);

    // Update the user's password
    user.password = hashedPassword;
    await user.save();

    res.status(200).send({ message: "Password reset successful" });
  } catch (error) {
    console.error("Error in ResetPassword:", error.message);
    res.status(500).send({ message: "Internal server error" });
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
          .withMessage("First name must contain only alphabetic characters"),
        check("lastName")
          .notEmpty()
          .withMessage("Last name is required")
          .isAlpha()
          .withMessage("Last name must contain only alphabetic characters"),
        check("email")
          .notEmpty()
          .withMessage("Email is required")
          .isEmail()
          .withMessage("Please enter a valid email address"),

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
          .withMessage("Please enter a valid email address"),

        check("password").notEmpty().withMessage("Password is required"),
      ];
    }

    case "forgotPassword": {
      return [
        check("email")
          .notEmpty()
          .withMessage("Email is required")
          .isEmail()
          .withMessage("Please enter a valid email address"),
      ];
    }

    case "resetPassword": {
      return [
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
