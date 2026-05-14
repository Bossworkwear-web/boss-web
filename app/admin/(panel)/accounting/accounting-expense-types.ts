export type AccountingExpenseRow = {
  id: string;
  expense_date: string;
  category: string;
  description: string;
  amount_cents: number;
  currency: string;
  vendor: string;
  notes: string;
  receipt_storage_path: string | null;
  created_at: string;
};
