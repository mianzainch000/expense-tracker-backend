const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/auth");
const categoryController = require("../controllers/categoryController");

router.get("/getCategories", authenticate, categoryController.getCategories);
router.post("/addCategory", authenticate, categoryController.addCategory);
router.put(
  "/updateCategory/:id",
  authenticate,
  categoryController.updateCategory,
);
router.delete(
  "/deleteCategory/:id",
  authenticate,
  categoryController.deleteCategory,
);

module.exports = router;
