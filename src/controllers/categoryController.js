const Category = require("../models/categorySchema");
const Expense = require("../models/expenseSchema");

exports.getCategories = async (req, res) => {
  try {
    const userId = req.user.userId;

    const categories = await Category.find({ userId }).sort({
      type: 1,
      name: 1,
    });

    const grouped = { income: [], expense: [] };
    categories.forEach((c) => {
      grouped[c.type]?.push({ _id: c._id, name: c.name });
    });

    return res.status(200).json({ categories, grouped });
  } catch (error) {
    console.error("Get Categories Error:", error);
    return res.status(500).json({ message: "Something went wrong." });
  }
};

exports.addCategory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, type } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Category name is required." });
    }
    if (!["income", "expense"].includes(type)) {
      return res
        .status(400)
        .json({ message: "Type must be 'income' or 'expense'." });
    }

    const existing = await Category.findOne({
      name: { $regex: `^${name.trim()}$`, $options: "i" },
      type,
      userId,
    });
    if (existing) {
      return res.status(409).json({ message: "Category already exists." });
    }

    const category = await Category.create({ name: name.trim(), type, userId });
    return res
      .status(201)
      .json({ message: "Category added successfully.", category });
  } catch (error) {
    console.error("Add Category Error:", error);
    return res.status(500).json({ message: "Something went wrong." });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Category name is required." });
    }

    const category = await Category.findOne({ _id: id, userId });
    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }

    const duplicate = await Category.findOne({
      _id: { $ne: id },
      name: { $regex: `^${name.trim()}$`, $options: "i" },
      type: category.type,
      userId,
    });
    if (duplicate) {
      return res
        .status(409)
        .json({ message: "A category with this name already exists." });
    }

    const oldName = category.name;
    const newName = name.trim();
    category.name = newName;
    await category.save();

    const prefix = "[" + oldName + "] ";
    const escapedOld = oldName.replace(/[-[\]/{}()*+?.\^$|]/g, "\\$&");
    const expenses = await Expense.find({
      userId,
      description: { $regex: "^\\[" + escapedOld + "\\] " },
    });

    await Promise.all(
      expenses.map((exp) => {
        exp.description =
          "[" + newName + "] " + exp.description.slice(prefix.length);
        return exp.save();
      }),
    );

    return res
      .status(200)
      .json({ message: "Category updated successfully.", category });
  } catch (error) {
    console.error("Update Category Error:", error);
    return res.status(500).json({ message: "Something went wrong." });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const category = await Category.findOne({ _id: id, userId });
    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }

    await Category.deleteOne({ _id: id, userId });
    return res.status(200).json({ message: "Category deleted successfully." });
  } catch (error) {
    console.error("Delete Category Error:", error);
    return res.status(500).json({ message: "Something went wrong." });
  }
};
