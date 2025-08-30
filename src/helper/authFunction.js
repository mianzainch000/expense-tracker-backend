const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const generateHashPassword = async (pass) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(pass, salt);
};

const comparePassword = async (pass, hashedPassword) => {
  return await bcrypt.compare(pass, hashedPassword);
};

const generateToken = (payload, secret, expiresIn) => {
  return jwt.sign(payload, secret, { expiresIn });
};

const verifyToken = (token, secret) => {
  try {
    return jwt.verify(token, secret);
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new Error("Expired token");
    } else if (err instanceof jwt.JsonWebTokenError) {
      throw new Error("Invalid token");
    } else {
      throw new Error("An error occurred during token verification");
    }
  }
};

module.exports = {
  generateHashPassword,
  comparePassword,
  generateToken,
  verifyToken,
};
