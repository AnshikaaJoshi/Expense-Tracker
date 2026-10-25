import mongoose, { Schema, type Model } from "mongoose";
import type { ExpenseCategory } from "@workspace/api-zod";

export interface ExpenseRecord {
  clerkUserId: string;
  description: string;
  amountCents: number;
  category: ExpenseCategory;
  spentOn: Date;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const expenseSchema = new Schema<ExpenseRecord>(
  {
    clerkUserId: {
      type: String,
      required: true,
      immutable: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 120,
    },
    amountCents: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Amount must be a whole number of paise",
      },
    },
    category: {
      type: String,
      required: true,
      enum: [
        "Food",
        "Transport",
        "Shopping",
        "Bills",
        "Health",
        "Entertainment",
        "Travel",
        "Other",
      ],
    },
    spentOn: {
      type: Date,
      required: true,
    },
    notes: {
      type: String,
      default: "",
      maxlength: 280,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "expenses",
  },
);

expenseSchema.index({ clerkUserId: 1, spentOn: -1, createdAt: -1 });
expenseSchema.index({ clerkUserId: 1, category: 1, spentOn: -1 });

export const ExpenseModel: Model<ExpenseRecord> =
  (mongoose.models.Expense as Model<ExpenseRecord> | undefined) ??
  mongoose.model<ExpenseRecord>("Expense", expenseSchema);
