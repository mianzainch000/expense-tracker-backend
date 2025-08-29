require("dotenv").config();
const { verifyToken } = require("../helper/authFunction");

const authenticate = (req, res, next) => {
  let token = req.header("Authorization")?.split(" ")[1];
  if (!token) {
    return res
      .status(400)
      .send({ message: "Token is missing. Access Denied." });
  }
  try {
    const decoded = verifyToken(token, process.env.SECRET_KEY);
    req.user = decoded;
    // we can write any name req.user
    next();
  } catch (err) {
    return res.status(400).send({ message: err.message });
  }
};

module.exports = authenticate;
