import { supabase } from "../supabase";

const CAT_COLUMNS = "id, user_id, name, created_at";
const EXP_COLUMNS = "id, user_id, category_id, date, concept, amount, type, original_line, created_at";

export async function listPersonalCategories() {
  const { data, error } = await supabase
    .from("personal_expense_categories")
    .select(CAT_COLUMNS)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createPersonalCategory({ name, userId }) {
  const { data, error } = await supabase
    .from("personal_expense_categories")
    .insert({ name, user_id: userId })
    .select(CAT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function listPersonalExpenses() {
  const { data, error } = await supabase
    .from("personal_expenses")
    .select(EXP_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function insertPersonalExpenses(expenses) {
  // expenses is an array of objects
  const { data, error } = await supabase
    .from("personal_expenses")
    .insert(expenses)
    .select(EXP_COLUMNS);
  if (error) throw error;
  return data;
}

export async function updatePersonalExpenseCategory(expenseId, categoryId) {
  const { data, error } = await supabase
    .from("personal_expenses")
    .update({ category_id: categoryId })
    .eq("id", expenseId)
    .select(EXP_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}
