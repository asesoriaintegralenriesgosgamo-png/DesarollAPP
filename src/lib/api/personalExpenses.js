import { supabase } from "../supabase";

const CAT_COLUMNS = "id, user_id, name, color, icon, order_index, created_at";
const EXP_COLUMNS = "id, user_id, category_id, date, concept, title, amount, type, original_line, created_at, deleted_at";

export async function listPersonalCategories() {
  const { data, error } = await supabase
    .from("personal_expense_categories")
    .select(CAT_COLUMNS)
    .order("order_index", { ascending: true })
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

export async function updatePersonalCategory(categoryId, updates) {
  const { data, error } = await supabase
    .from("personal_expense_categories")
    .update(updates)
    .eq("id", categoryId)
    .select(CAT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function reorderPersonalCategories(categoryIds) {
  // Supabase doesn't easily support bulk update of different values unless using a function.
  // We can just loop through and update individually for now since the array is small.
  const promises = categoryIds.map((id, index) => 
    supabase
      .from("personal_expense_categories")
      .update({ order_index: index })
      .eq("id", id)
  );
  await Promise.all(promises);
}

export async function listPersonalExpenses() {
  const { data, error } = await supabase
    .from("personal_expenses")
    .select(EXP_COLUMNS)
    .is("deleted_at", null)
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

export async function updatePersonalExpenseTitle(expenseId, title) {
  const { data, error } = await supabase
    .from("personal_expenses")
    .update({ title })
    .eq("id", expenseId)
    .select(EXP_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function deletePersonalExpense(expenseId) {
  const { error } = await supabase
    .from("personal_expenses")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", expenseId);
  if (error) throw error;
}

export async function restorePersonalExpense(expenseId) {
  const { error } = await supabase
    .from("personal_expenses")
    .update({ deleted_at: null })
    .eq("id", expenseId);
  if (error) throw error;
}

export async function hardDeletePersonalExpense(expenseId) {
  const { error } = await supabase
    .from("personal_expenses")
    .delete()
    .eq("id", expenseId);
  if (error) throw error;
}

export async function listDeletedPersonalExpenses() {
  const { data, error } = await supabase
    .from("personal_expenses")
    .select(EXP_COLUMNS)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  if (error) throw error;
  return data;
}

// --- Periods API ---
export async function listPersonalExpensePeriods() {
  const { data, error } = await supabase
    .from("personal_expense_periods")
    .select("*")
    .order("start_date", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createPersonalExpensePeriod(period) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("No hay sesión activa");
  
  const { data, error } = await supabase
    .from("personal_expense_periods")
    .insert({ ...period, user_id: session.user.id })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deletePersonalExpensePeriod(periodId) {
  const { error } = await supabase
    .from("personal_expense_periods")
    .delete()
    .eq("id", periodId);
  if (error) throw error;
}
