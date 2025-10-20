const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/auth");
const expenseController = require("../controllers/expenseController");

router.post(
    "/postExpense",
    authenticate,
    expenseController.validate("expense"),
    expenseController.createExpense
);

router.get("/getExpense", authenticate, expenseController.getExpense);

router.delete("/deleteExpense/:id", authenticate, expenseController.deleteExpense);

router.put(
    "/updateExpense/:id",
    authenticate,
    expenseController.validate("expense"),
    expenseController.updateExpense
);

module.exports = router;
