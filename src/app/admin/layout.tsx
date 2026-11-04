import { requireRole } from "@/lib/auth";
import { Query, User } from "@/lib/db";
import { Product } from "@/lib/store/models";
import { AppShell } from "@/components/app-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole("ADMIN");
  const [awaiting, pending, lowStock] = await Promise.all([
    Query.countDocuments({ status: "SUBMITTED" }),
    User.countDocuments({ pendingApproval: true }),
    Product.countDocuments({ active: true, $expr: { $lte: ["$stock", "$lowStockAt"] } }),
  ]);
  return (
    <AppShell
      session={session}
      nav={[
        { href: "/admin", label: "Dashboard", icon: "dashboard", exact: true, count: awaiting },
        { href: "/admin/billing", label: "Billing", icon: "billing" },
        { href: "/admin/products", label: "Products", icon: "products", count: lowStock },
        { href: "/admin/sales", label: "Sales", icon: "sales" },
        { href: "/admin/customers", label: "Customers", icon: "customers" },
        { href: "/admin/bill-settings", label: "Bill settings", icon: "settings" },
        { href: "/admin/queries/new", label: "New query", icon: "new" },
        { href: "/admin/locations", label: "Live map", icon: "map" },
        { href: "/admin/team", label: "Team", icon: "team", count: pending },
        { href: "/admin/reviews", label: "Reviews", icon: "reviews" },
        { href: "/admin/sms", label: "SMS log", icon: "sms" },
      ]}
    >
      {children}
    </AppShell>
  );
}
