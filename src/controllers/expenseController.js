const mongoose = require("mongoose");

const Expense = require("../models/expenseSchema");
const { check, validationResult } = require("express-validator");

exports.createExpense = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    let errorMsg = errors.array()[0].msg;
    return res.status(400).json({ errors: errorMsg });
  }

  const user = req.user;
  const { date, description, amount, paymentType, type } = req.body;

  try {
    const expenses = await Expense.find({ userId: user.userId });

    let cashBalance = 0;
    let accountBalance = 0;

    expenses.forEach((exp) => {
      const amt = Number(exp.amount) || 0;
      const payType = exp.paymentType?.toLowerCase() || "account";

      if (exp.type === "income") {
        if (payType === "cash") cashBalance += amt;
        else accountBalance += amt;
      } else {
        if (payType === "cash") cashBalance -= amt;
        else accountBalance -= amt;
      }
    });

    const currentAmount = Number(amount);
    const pType = paymentType?.toLowerCase() || "account";

    if (type === "income") {
      if (pType === "cash") cashBalance += currentAmount;
      else accountBalance += currentAmount;
    } else {
      if (pType === "cash") {
        if (cashBalance < currentAmount) {
          return res.status(400).json({
            message: `Transaction rejected. Insufficient Cash balance (Current: ${cashBalance})`,
            status: "low_balance",
          });
        }
      } else {
        if (accountBalance < currentAmount) {
          return res.status(400).json({
            message: `Transaction rejected. Insufficient Account balance (Current: ${accountBalance})`,
            status: "low_balance",
          });
        }
      }
    }

    let newExpense = new Expense({
      date,
      description,
      amount: currentAmount,
      paymentType: pType,
      type,
      userId: user.userId,
    });

    let result = await newExpense.save();

    return res.status(201).send({
      message: "Transaction added successfully",
      expense: result,
    });
  } catch (error) {
    console.error("Error saving expense:", error);
    return res.status(500).send({
      message: "Something went wrong, please try again.",
    });
  }
};

exports.getExpense = async (req, res) => {
  try {
    const expenses = await Expense.find({ userId: req.user.userId });

    if (expenses.length === 0) {
      return res.status(200).send({
        totalIncome: 0,
        totalExpenses: 0,
        totalBalance: 0,
        cash: 0,
        account: 0,
        message: "No Record Found",
      });
    }

    let cashIncome = 0,
      cashExpenses = 0;
    let accountIncome = 0,
      accountExpenses = 0;

    expenses.forEach((exp) => {
      const amount = Number(exp.amount) || 0;
      const paymentType = exp.paymentType
        ? exp.paymentType.toLowerCase()
        : "account";

      if (exp.type === "income") {
        if (paymentType === "cash") cashIncome += amount;
        else accountIncome += amount;
      } else {
        if (paymentType === "cash") cashExpenses += amount;
        else accountExpenses += amount;
      }
    });

    const cash = cashIncome - cashExpenses;
    const account = accountIncome - accountExpenses;
    const totalIncome = cashIncome + accountIncome;
    const totalExpenses = cashExpenses + accountExpenses;
    const totalBalance = totalIncome - totalExpenses;

    return res.status(200).send({
      expenses,
      totalIncome,
      totalExpenses,
      totalBalance,
      cash,
      account,
      message: "Data Fetch successful",
    });
  } catch (error) {
    console.error("Error fetching expenses:", error);
    return res.status(500).send({
      message: "Something went wrong, please try again.",
    });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const expenseToDelete = await Expense.findOne({ _id: id, userId });
    if (!expenseToDelete) {
      return res.status(404).send({ message: "Transaction not found" });
    }

    const otherExpenses = await Expense.find({
      userId,
      _id: { $ne: id },
    });

    let cashBalance = 0;
    let accountBalance = 0;

    otherExpenses.forEach((exp) => {
      const amt = Number(exp.amount) || 0;
      const payType = exp.paymentType?.toLowerCase() || "account";

      if (exp.type === "income") {
        if (payType === "cash") cashBalance += amt;
        else accountBalance += amt;
      } else {
        if (payType === "cash") cashBalance -= amt;
        else accountBalance -= amt;
      }
    });

    const pType = expenseToDelete.paymentType?.toLowerCase() || "account";

    if (expenseToDelete.type === "income") {
      if (pType === "cash" && cashBalance < 0) {
        return res.status(400).json({
          message: `Deletion failed. Removing this income would leave your Cash balance at ${cashBalance}.`,
          status: "low_balance",
        });
      }
      if (pType !== "cash" && accountBalance < 0) {
        return res.status(400).json({
          message: `Deletion failed. Removing this income would leave your Account balance at ${accountBalance}.`,
          status: "low_balance",
        });
      }
    }

    await Expense.deleteOne({ _id: id, userId });

    return res.status(200).send({
      message: "Transaction deleted successfully",
      expenseId: id,
      remainingBalances: {
        cash: cashBalance,
        account: accountBalance,
      },
    });
  } catch (error) {
    console.error("Delete Expense Error:", error);
    return res.status(500).send({ message: "Internal Server Error." });
  }
};

exports.updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const userObjectId = new mongoose.Types.ObjectId(req.user.userId);

    const oldExpense = await Expense.findOne({ _id: id, userId: userObjectId });
    if (!oldExpense) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    const updatedType = (req.body.type ?? oldExpense.type).toLowerCase();
    const updatedAmount = Number(req.body.amount ?? oldExpense.amount);
    const updatedPaymentType = (
      req.body.paymentType ?? oldExpense.paymentType
    ).toLowerCase();

    if (!["income", "expense"].includes(updatedType)) {
      return res
        .status(400)
        .json({ message: "Invalid type. Must be 'income' or 'expense'." });
    }
    if (!Number.isFinite(updatedAmount) || updatedAmount < 0) {
      return res
        .status(400)
        .json({ message: "Amount must be a positive number" });
    }

    const otherExpenses = await Expense.find({
      userId: userObjectId,
      _id: { $ne: id },
    });

    let cashBalance = 0;
    let accountBalance = 0;

    otherExpenses.forEach((exp) => {
      const amt = Number(exp.amount) || 0;
      const payType = exp.paymentType?.toLowerCase() || "account";

      if (exp.type === "income") {
        if (payType === "cash") cashBalance += amt;
        else accountBalance += amt;
      } else {
        if (payType === "cash") cashBalance -= amt;
        else accountBalance -= amt;
      }
    });

    if (updatedType === "income") {
      if (updatedPaymentType === "cash") cashBalance += updatedAmount;
      else accountBalance += updatedAmount;
    } else {
      if (updatedPaymentType === "cash") cashBalance -= updatedAmount;
      else accountBalance -= updatedAmount;
    }

    if (cashBalance < 0) {
      return res.status(400).json({
        message: `Update rejected. Your Cash balance would become negative (${cashBalance}).`,
        status: "insufficient_cash",
      });
    }

    if (accountBalance < 0) {
      return res.status(400).json({
        message: `Update rejected. Your Account balance would become negative (${accountBalance}).`,
        status: "insufficient_account",
      });
    }

    const updatedExpense = await Expense.findOneAndUpdate(
      { _id: id, userId: userObjectId },
      {
        ...req.body,
        type: updatedType,
        amount: updatedAmount,
        paymentType: updatedPaymentType,
      },
      { new: true, runValidators: true },
    );

    return res.status(200).json({
      message: "Transaction updated successfully",
      data: updatedExpense,
      finalBalances: {
        cash: cashBalance,
        account: accountBalance,
      },
    });
  } catch (error) {
    console.error("Update Expense Error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.validate = (method) => {
  switch (method) {
    case "expense": {
      return [
        check("date")
          .notEmpty()
          .withMessage("Date is required")
          .custom((value) => value.trim()),

        check("description")
          .notEmpty()
          .withMessage("Description is required")
          .custom((value) => value.trim()),

        check("amount")
          .notEmpty()
          .withMessage("Price is required")
          .isFloat({ min: 0.01 })
          .withMessage("Price must be greater than 0")
          .custom(async (value, { req }) => {
            if (req.body.type === "expense") {
              const totalIncome = await Expense.aggregate([
                { $match: { type: "income" } },
                { $group: { _id: null, sum: { $sum: "$amount" } } },
              ]);

              const currentIncome = totalIncome[0]?.sum || 0;

              if (value > currentIncome) {
                throw new Error("Expense cannot be greater than total income");
              }
            }
            return true;
          }),
      ];
    }
  }
};
