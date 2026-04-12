import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      {/* Minimal sidebar stub - full app shell built in Task 12 */}
      <aside className="hidden w-64 border-r bg-muted/40 p-4 md:block">
        <div className="mb-6">
          <h2 className="text-lg font-bold">CobranzasAI</h2>
          <p className="text-xs text-muted-foreground">
            {session.user?.name}
          </p>
        </div>
        <nav className="space-y-1">
          <Link
            href="/cartera"
            className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            Cartera
          </Link>
          <Link
            href="/analisis-ia"
            className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            Analisis IA
          </Link>
          <Link
            href="/historico"
            className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            Historico
          </Link>
          <Link
            href="/settings"
            className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            Configuracion
          </Link>
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
