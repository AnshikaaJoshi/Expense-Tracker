import { getAuth } from "@clerk/express";
import {
  CreateExpenseBody,
  CreateExpenseResponse,
  DeleteExpenseParams,
  GetExpenseParams,
  GetExpenseResponse,
  GetExpenseSummaryQueryParams,
  GetExpenseSummaryResponse,
  ListExpensesQueryParams,
  ListExpensesResponse,
  UpdateExpenseBody,
  UpdateExpenseParams,
  UpdateExpenseResponse,
} from "@workspace/api-zod";
import { Router, type IRouter, type RequestHandler } from "express";
import mongoose from "mongoose";
import { ExpenseModel, type ExpenseRecord } from "../lib/expense";

const router: IRouter = Router();

const requireAuth: RequestHandler = (req, res, next) => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in required" });
    return;
  }

  res.locals.userId = userId;
  next();
};

function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return null;
  }

  return date;
}

function nextDay(date: Date): Date {
  return new Date(date.getTime() + 24 * 60 * 60 * 1000);
}

function serializeExpense(expense: ExpenseRecord & { _id: { toString(): string } }) {
  return {
    id: expense._id.toString(),
    description: expense.description,
    amountCents: expense.amountCents,
    category: expense.category,
    spentOn: expense.spentOn.toISOString().slice(0, 10),
    notes: expense.notes,
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseExpenseInput(
  schema: typeof CreateExpenseBody | typeof UpdateExpenseBody,
  body: unknown,
) {
  if (!isRecord(body)) {
    return { success: false as const };
  }

  const spentOn = parseDateOnly(body.spentOn);
  if (!spentOn) {
    return { success: false as const };
  }

  return schema.safeParse({ ...body, spentOn });
}

router.get("/expenses", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListExpensesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid expense filters" });
    return;
  }

  const from = parsed.data.from ? parseDateOnly(parsed.data.from) : undefined;
  const to = parsed.data.to ? parseDateOnly(parsed.data.to) : undefined;
  if ((parsed.data.from && !from) || (parsed.data.to && !to)) {
    res.status(400).json({ error: "Dates must be valid YYYY-MM-DD values" });
    return;
  }
  if (from && to && from > to) {
    res.status(400).json({ error: "The start date must be on or before the end date" });
    return;
  }

  const userId = res.locals.userId as string;
  const filter: {
    clerkUserId: string;
    spentOn?: { $gte?: Date; $lt?: Date };
    category?: ExpenseRecord["category"];
    description?: { $regex: string; $options: "i" };
  } = { clerkUserId: userId };
  if (from || to) {
    filter.spentOn = {};
    if (from) filter.spentOn.$gte = from;
    if (to) filter.spentOn.$lt = nextDay(to);
  }
  if (parsed.data.category) {
    filter.category = parsed.data.category;
  }
  if (parsed.data.search) {
    filter.description = {
      $regex: escapeRegex(parsed.data.search),
      $options: "i",
    };
  }

  const expenses = await ExpenseModel.find(filter)
    .sort({ spentOn: -1, createdAt: -1 })
    .exec();

  res.json(ListExpensesResponse.parse(expenses.map(serializeExpense)));
});

router.post("/expenses", requireAuth, async (req, res): Promise<void> => {
  const parsed = parseExpenseInput(CreateExpenseBody, req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid expense data" });
    return;
  }

  const userId = res.locals.userId as string;
  const expense = await ExpenseModel.create({
    ...parsed.data,
    clerkUserId: userId,
  });

  res
    .status(201)
    .json(CreateExpenseResponse.parse(serializeExpense(expense)));
});

router.get("/expenses/summary", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetExpenseSummaryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Provide a valid YYYY-MM-DD date range" });
    return;
  }

  const from = parseDateOnly(parsed.data.from);
  const to = parseDateOnly(parsed.data.to);
  if (!from || !to || from > to) {
    res.status(400).json({ error: "The date range is invalid" });
    return;
  }
  if (to.getTime() - from.getTime() > 3660 * 24 * 60 * 60 * 1000) {
    res.status(400).json({ error: "Summary ranges may not exceed ten years" });
    return;
  }

  type SummaryAggregation = {
    totals: Array<{
      totalCents: number;
      expenseCount: number;
      averageCents: number;
    }>;
    byMonth: Array<{ _id: string; totalCents: number }>;
    byCategory: Array<{
      _id: string;
      totalCents: number;
      count: number;
    }>;
  };

  const [result] = await ExpenseModel.aggregate<SummaryAggregation>([
    {
      $match: {
        clerkUserId: res.locals.userId as string,
        spentOn: { $gte: from, $lt: nextDay(to) },
      },
    },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              totalCents: { $sum: "$amountCents" },
              expenseCount: { $sum: 1 },
              averageCents: { $avg: "$amountCents" },
            },
          },
        ],
        byMonth: [
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m",
                  date: "$spentOn",
                  timezone: "UTC",
                },
              },
              totalCents: { $sum: "$amountCents" },
            },
          },
          { $sort: { _id: 1 } },
        ],
        byCategory: [
          {
            $group: {
              _id: "$category",
              totalCents: { $sum: "$amountCents" },
              count: { $sum: 1 },
            },
          },
          { $sort: { totalCents: -1 } },
        ],
      },
    },
  ]).exec();

  const monthTotals = new Map(
    (result?.byMonth ?? []).map((entry) => [entry._id, entry.totalCents]),
  );
  const byMonth: Array<{ month: string; totalCents: number }> = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const finalMonth = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  while (cursor <= finalMonth) {
    const month = cursor.toISOString().slice(0, 7);
    byMonth.push({
      month,
      totalCents: monthTotals.get(month) ?? 0,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  const totals = result?.totals[0];
  const summary = {
    totalCents: totals?.totalCents ?? 0,
    expenseCount: totals?.expenseCount ?? 0,
    averageCents: totals?.averageCents ?? 0,
    byMonth,
    byCategory: (result?.byCategory ?? []).map((entry) => ({
      category: entry._id,
      totalCents: entry.totalCents,
      count: entry.count,
    })),
  };

  res.json(GetExpenseSummaryResponse.parse(summary));
});

router.get("/expenses/:id", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetExpenseParams.safeParse(req.params);
  if (!parsed.success || !mongoose.isValidObjectId(parsed.data.id)) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }

  const expense = await ExpenseModel.findOne({
    _id: parsed.data.id,
    clerkUserId: res.locals.userId as string,
  }).exec();

  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }

  res.json(GetExpenseResponse.parse(serializeExpense(expense)));
});

router.put("/expenses/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateExpenseParams.safeParse(req.params);
  if (!params.success || !mongoose.isValidObjectId(params.data.id)) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }

  const parsed = parseExpenseInput(UpdateExpenseBody, req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid expense data" });
    return;
  }

  const expense = await ExpenseModel.findOneAndUpdate(
    {
      _id: params.data.id,
      clerkUserId: res.locals.userId as string,
    },
    { $set: parsed.data },
    { new: true, runValidators: true },
  ).exec();

  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }

  res.json(UpdateExpenseResponse.parse(serializeExpense(expense)));
});

router.delete("/expenses/:id", requireAuth, async (req, res): Promise<void> => {
  const parsed = DeleteExpenseParams.safeParse(req.params);
  if (!parsed.success || !mongoose.isValidObjectId(parsed.data.id)) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }

  const expense = await ExpenseModel.findOneAndDelete({
    _id: parsed.data.id,
    clerkUserId: res.locals.userId as string,
  }).exec();

  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
