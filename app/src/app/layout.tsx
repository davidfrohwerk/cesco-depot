import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { logout } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { userHasInternalPermission } from "@/lib/access-scope";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CESCo Depot",
  description:
    "Asset lifecycle, depot repair, strategic stocking, and circular disposition.",
};

export default async function RootLayout({
  children,
}: LayoutProps<"/">) {
  const user = await getCurrentUser();
  const canViewServiceLocations =
    user &&
    userHasInternalPermission(user, "service_location.view");

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {user && (
          <header className="border-b">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-8 py-3 text-sm">
              <Link href="/organizations" className="font-semibold">
                CESCo Depot
              </Link>
              <div className="flex items-center gap-4">
                {canViewServiceLocations && (
                  <Link href="/service-locations" className="underline">
                    Service locations
                  </Link>
                )}
                <span className="opacity-70">
                  {user.displayName ?? user.email}
                </span>
                <form action={logout}>
                  <button type="submit" className="underline">
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          </header>
        )}
        {children}
      </body>
    </html>
  );
}
