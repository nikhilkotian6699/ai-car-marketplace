import { notFound } from "next/navigation";
import { Sidebar } from "./admin/_components/sidebar";
import { getAdmin } from "@/actions/admin";
import Header from "@/components/header";

export default async function AdminLayout({ children }) {
  let admin;
  try {
    admin = await getAdmin();
  } catch (error) {
    console.error('Admin check failed:', error);
    return notFound();
  }

  // If user not found in our db or not an admin, redirect to 404
  if (!admin || !admin.authorized) {
    return notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Header isAdminPage={true} />
      <div className="flex h-full w-64 flex-col top-20 fixed inset-y-0 z-50">
        <Sidebar />
      </div>
      <main className="md:pl-64 pt-[80px] min-h-screen">{children}</main>
    </div>
  );
}