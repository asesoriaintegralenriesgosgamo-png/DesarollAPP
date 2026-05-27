import { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  Receipt,
  PieChart,
  Landmark,
  Building2,
  Repeat,
  Loader2,
} from "lucide-react";
import { useToast } from "../ui/Toast";
import { useAuth } from "../../lib/AuthContext";
import { listPartners } from "../../lib/api/projectPartners";
import { listContributions } from "../../lib/api/partnerContributions";
import { listExpenses } from "../../lib/api/projectExpenses";
import { listBankAccounts } from "../../lib/api/projectBankAccounts";
import { listPayees } from "../../lib/api/payees";
import { listCategories } from "../../lib/api/expenseCategories";
import { listTransfers } from "../../lib/api/partnerTransfers";
import { listContracts } from "../../lib/api/partnerContracts";
import { listTasks } from "../../lib/api/constructionTasks";
import { AccountsSummary } from "./AccountsSummary";
import { PartnersList } from "./PartnersList";
import { ContributionsTable } from "./ContributionsTable";
import { ExpensesTable } from "./ExpensesTable";
import { BudgetView } from "./BudgetView";
import { BankAccountsList } from "./BankAccountsList";
import { PayeesList } from "./PayeesList";
import { TransfersTable } from "./TransfersTable";

const SUB_TABS = [
  { id: "summary", label: "Resumen", Icon: LayoutDashboard },
  { id: "partners", label: "Socios", Icon: Users },
  { id: "contributions", label: "Aportaciones", Icon: TrendingUp },
  { id: "expenses", label: "Egresos", Icon: Receipt },
  { id: "budget", label: "Presupuesto", Icon: PieChart },
  { id: "accounts", label: "Cuentas bancarias", Icon: Landmark },
  { id: "payees", label: "Proveedores", Icon: Building2 },
  { id: "transfers", label: "Transferencias", Icon: Repeat },
];

export function AccountsTab({ projectId, canEdit, members }) {
  const toast = useToast();
  const { user } = useAuth();
  const [active, setActive] = useState("summary");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    partners: [],
    contributions: [],
    expenses: [],
    accounts: [],
    payees: [],
    categories: [],
    transfers: [],
    contracts: [],
    tasks: [],
  });
  const navRef = useRef(null);

  const refresh = async () => {
    try {
      const [
        partners,
        contributions,
        expenses,
        accounts,
        payees,
        categories,
        transfers,
        contracts,
        tasks,
      ] = await Promise.all([
        listPartners(projectId),
        listContributions(projectId),
        listExpenses(projectId),
        listBankAccounts(projectId),
        listPayees(projectId),
        listCategories(projectId),
        listTransfers(projectId),
        listContracts(projectId),
        listTasks(projectId),
      ]);
      setData({
        partners,
        contributions,
        expenses,
        accounts,
        payees,
        categories,
        transfers,
        contracts,
        tasks,
      });
    } catch (err) {
      toast.error(err.message || "No se pudieron cargar las cuentas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    const el = navRef.current?.querySelector('[aria-selected="true"]');
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [active]);

  const counts = useMemo(
    () => ({
      partners: data.partners.length,
      contributions: data.contributions.length,
      expenses: data.expenses.length,
      accounts: data.accounts.length,
      payees: data.payees.length,
    }),
    [data]
  );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
      </div>
    );
  }

  const commonProps = {
    projectId,
    canEdit,
    userId: user.id,
    members,
    onChanged: refresh,
    ...data,
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Sub-nav */}
      <div className="border-b border-stone-200 relative">
        <nav
          ref={navRef}
          className="flex gap-1 overflow-x-auto no-scrollbar"
          role="tablist"
        >
          {SUB_TABS.map((t) => {
            const Icon = t.Icon;
            const isActive = active === t.id;
            const count = counts[t.id];
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors shrink-0 whitespace-nowrap ${
                  isActive
                    ? "border-stone-900 text-stone-900"
                    : "border-transparent text-stone-500 hover:text-stone-900"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
                {count != null && count > 0 && (
                  <span className="text-[10px] text-stone-400">({count})</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      {active === "summary" && <AccountsSummary {...commonProps} />}
      {active === "partners" && <PartnersList {...commonProps} />}
      {active === "contributions" && <ContributionsTable {...commonProps} />}
      {active === "expenses" && <ExpensesTable {...commonProps} />}
      {active === "budget" && <BudgetView {...commonProps} />}
      {active === "accounts" && <BankAccountsList {...commonProps} />}
      {active === "payees" && <PayeesList {...commonProps} />}
      {active === "transfers" && <TransfersTable {...commonProps} />}
    </div>
  );
}
