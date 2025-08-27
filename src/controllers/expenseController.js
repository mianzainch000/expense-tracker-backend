const Expense = require("../models/expenseSchema");
const { check, validationResult } = require("express-validator");

exports.createExpense = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        let errorMsg = errors.array()[0].msg;
        return res.status(400).json({ errors: errorMsg });
    }
    const user = req.user;

    // req.any name but wihi name auth middleware mai ho

    const { date, description, amount, paymentType, type } = req.body;

    try {
        let newExpense = new Expense({
            date,
            description,
            amount,
            paymentType,
            type,
            userId: user.userId,
            // userId key get in models as a reference
        });

        let result = await newExpense.save();
        if (result) {
            return res
                .status(201)
                .send({ message: "Transcation added successfully", expense: result });
        } else {
            return res.status(500).send({ message: "Some thing wrong" });
        }
    } catch (error) {
        console.error("Error saving product:", error);
        return res.status(500).send({ message: "Something went wrong, please try again." });
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

        // 1️⃣ Old expense
        const userObjectId = new mongoose.Types.ObjectId(req.user.userId);
        const oldExpense = await Expense.findOne({ _id: id, userId: userObjectId });
        if (!oldExpense) {
            return res.status(404).json({ message: "Expense not found" });
        }

        // 2️⃣ Updated data (type/amount normalize)
        const updatedType = (req.body.type ?? oldExpense.type).toLowerCase();
        const updatedAmount = Number(req.body.amount ?? oldExpense.amount);

        if (!["income", "expense"].includes(updatedType)) {
            return res.status(400).json({ message: "Invalid type" });
        }
        if (!Number.isFinite(updatedAmount) || updatedAmount < 0) {
            return res
                .status(400)
                .json({ message: "Amount must be a positive number" });
        }

        // 3️⃣ Totals from DB (excluding oldExpense) ➜ userId cast is IMPORTANT
        const [incomeAgg] = await Expense.aggregate([
            {
                $match: {
                    type: "income",
                    userId: userObjectId,
                    _id: { $ne: oldExpense._id },
                },
            },
            { $group: { _id: null, sum: { $sum: "$amount" } } },
        ]);

        const [expenseAgg] = await Expense.aggregate([
            {
                $match: {
                    type: "expense",
                    userId: userObjectId,
                    _id: { $ne: oldExpense._id },
                },
            },
            { $group: { _id: null, sum: { $sum: "$amount" } } },
        ]);

        let totalIncome = Number(incomeAgg?.sum || 0);
        let totalExpenses = Number(expenseAgg?.sum || 0);

        // 4️⃣ Add updated doc into totals
        if (updatedType === "income") {
            totalIncome += updatedAmount;
        } else {
            totalExpenses += updatedAmount;
        }

        // 5️⃣ Balance check
        if (totalExpenses > totalIncome) {
            return res.status(400).json({
                message: "Update not allowed. Expenses cannot exceed total income.",
                currentIncome: totalIncome,
                currentExpenses: totalExpenses,
            });
        }

        // 6️⃣ Update
        const updatedExpense = await Expense.findOneAndUpdate(
            { _id: id, userId: userObjectId },
            { ...req.body, type: updatedType, amount: updatedAmount },
            { new: true, runValidators: true }
        );

        return res.status(200).json({
            message: "Updated successfully",
            data: updatedExpense,
        });
    } catch (error) {
        console.error("Update Expense Error:", error);
        return res.status(500).json({
            message: "Internal Server Error",
            error: error.message,
        });
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
