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
        // 🔹 Pahle user ke sare expenses nikalo
        const expenses = await Expense.find({ userId: user.userId });

        let cashIncome = 0,
            cashExpenses = 0;
        let accountIncome = 0,
            accountExpenses = 0;

        expenses.forEach((exp) => {
            const amt = Number(exp.amount) || 0;
            const payType = exp.paymentType?.toLowerCase() || "account";

            if (exp.type === "income") {
                if (payType === "cash") cashIncome += amt;
                else accountIncome += amt;
            } else {
                if (payType === "cash") cashExpenses += amt;
                else accountExpenses += amt;
            }
        });

        // 🔹 New expense add karne ke baad balance calculate karo
        let newCashIncome = cashIncome;
        let newCashExpenses = cashExpenses;
        let newAccountIncome = accountIncome;
        let newAccountExpenses = accountExpenses;

        if (type === "income") {
            if (paymentType === "cash") newCashIncome += Number(amount);
            else newAccountIncome += Number(amount);
        } else {
            if (paymentType === "cash") newCashExpenses += Number(amount);
            else newAccountExpenses += Number(amount);
        }

        const cashBalance = newCashIncome - newCashExpenses;
        const accountBalance = newAccountIncome - newAccountExpenses;

        if (cashBalance < 0 || accountBalance < 0) {
            return res.status(400).json({
                message:
                    "Transaction not allowed. Cash or Account balance cannot go negative.",
                cashBalance,
                accountBalance,
            });
        }

        // 🔹 Save karo agar balance negative nahi
        let newExpense = new Expense({
            date,
            description,
            amount,
            paymentType,
            type,
            userId: user.userId,
        });

        let result = await newExpense.save();
        return res.status(201).send({
            message: "Transaction added successfully",
            expense: result,
        });
    } catch (error) {
        console.error("Error saving product:", error);
        return res
            .status(500)
            .send({ message: "Something went wrong, please try again." });
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
                : "account"; // default account

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

        // 1️⃣ Fetch the expense/income by ID
        const expense = await Expense.findById(id);
        if (!expense) {
            // Agar expense na mile to 404 send karo
            return res.status(404).send({ message: "Expense not found" });
        }

        // 2️⃣ Check if deleting an income that will cause negative balance
        if (expense.type === "income") {
            // Calculate total income
            const totalIncomeAgg = await Expense.aggregate([
                { $match: { type: "income" } },
                { $group: { _id: null, sum: { $sum: "$amount" } } },
            ]);
            const totalIncome = totalIncomeAgg[0]?.sum || 0;

            // Calculate remaining income after deletion
            const remainingIncome = totalIncome - expense.amount;

            // Calculate total expenses
            const totalExpensesAgg = await Expense.aggregate([
                { $match: { type: "expense" } },
                { $group: { _id: null, sum: { $sum: "$amount" } } },
            ]);
            const totalExpenses = totalExpensesAgg[0]?.sum || 0;

            // Agar remaining income expenses se kam hai to delete na karne do
            if (remainingIncome < totalExpenses) {
                return res.status(400).send({
                    message:
                        "Cannot delete this income. Existing expenses are greater than remaining income after deletion.",
                });
            }
        }

        // 3️⃣ Delete the document
        await Expense.deleteOne({ _id: id, userId: req.user.userId });

        // 4️⃣ Send success response
        return res.status(200).send({
            message: "Transaction deleted successfully",
            expenseId: id,
        });
    } catch (error) {
        console.error(error);
        // Agar koi unexpected error aaye to 500 response
        return res.status(500).send({ message: "Internal Server Error." });
    }
};

const mongoose = require("mongoose");

exports.updateExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const userObjectId = new mongoose.Types.ObjectId(req.user.userId);

        // 🔹 Old expense
        const oldExpense = await Expense.findOne({ _id: id, userId: userObjectId });
        if (!oldExpense) {
            return res.status(404).json({ message: "Expense not found" });
        }

        const updatedType = (req.body.type ?? oldExpense.type).toLowerCase();
        const updatedAmount = Number(req.body.amount ?? oldExpense.amount);
        const updatedPaymentType = (
            req.body.paymentType ?? oldExpense.paymentType
        ).toLowerCase();

        if (!["income", "expense"].includes(updatedType)) {
            return res.status(400).json({ message: "Invalid type" });
        }
        if (!Number.isFinite(updatedAmount) || updatedAmount < 0) {
            return res
                .status(400)
                .json({ message: "Amount must be a positive number" });
        }

        // 🔹 All user expenses (except oldExpense)
        const expenses = await Expense.find({
            userId: userObjectId,
            _id: { $ne: oldExpense._id },
        });

        let cashIncome = 0,
            cashExpenses = 0;
        let accountIncome = 0,
            accountExpenses = 0;

        expenses.forEach((exp) => {
            const amt = Number(exp.amount) || 0;
            const payType = exp.paymentType?.toLowerCase() || "account";

            if (exp.type === "income") {
                if (payType === "cash") cashIncome += amt;
                else accountIncome += amt;
            } else {
                if (payType === "cash") cashExpenses += amt;
                else accountExpenses += amt;
            }
        });

        // 🔹 Updated transaction apply karo
        if (updatedType === "income") {
            if (updatedPaymentType === "cash") cashIncome += updatedAmount;
            else accountIncome += updatedAmount;
        } else {
            if (updatedPaymentType === "cash") cashExpenses += updatedAmount;
            else accountExpenses += updatedAmount;
        }

        const cashBalance = cashIncome - cashExpenses;
        const accountBalance = accountIncome - accountExpenses;

        if (cashBalance < 0 || accountBalance < 0) {
            return res.status(400).json({
                message:
                    "Update not allowed. Cash or Account balance cannot go negative.",
                cashBalance,
                accountBalance,
            });
        }

        // 🔹 Update if valid
        const updatedExpense = await Expense.findOneAndUpdate(
            { _id: id, userId: userObjectId },
            {
                ...req.body,
                type: updatedType,
                amount: updatedAmount,
                paymentType: updatedPaymentType,
            },
            { new: true, runValidators: true }
        );

        return res.status(200).json({
            message: "Updated successfully",
            data: updatedExpense,
        });
    } catch (error) {
        console.error("Update Expense Error:", error);
        return res
            .status(500)
            .json({ message: "Internal Server Error", error: error.message });
    }
};

exports.validate = (method) => {
    switch (method) {
        case "expense": {
            return [
                // Date validation
                check("date").notEmpty().withMessage("Date is required"),

                // Description validation
                check("description").notEmpty().withMessage("Description is required"),

                // Amount validation
                check("amount")
                    .notEmpty()
                    .withMessage("Price is required")
                    .isFloat({ min: 0.01 })
                    .withMessage("Price must be greater than 0")
                    .custom(async (value, { req }) => {
                        // Only for expense type
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
