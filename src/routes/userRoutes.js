const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

router.post(
    "/signup",
    userController.validate("signup"),
    userController.signup
);
router.post("/login", userController.validate("login"), userController.login);

router.post(
    "/forgotPassword",
    userController.validate("forgotPassword"),
    userController.forgotPassword
);

router.post(
    "/resetPassword",
    userController.validate("resetPassword"),
    userController.resetPassword
);

router.post("/googleLogin", userController.googleLogin);
module.exports = router;
