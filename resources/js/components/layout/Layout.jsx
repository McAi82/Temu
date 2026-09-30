// web/src/components/layout/Layout.jsx
import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../ui/button";
import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  Ticket,
  LogOut,
  UserCog,
  Camera,
  FileText,
  MapPin,
  Wallet,
  Calendar
} from "lucide-react";
import temuLogo from "../../assets/temu-logo.png";
import NotificationBell from "../notifications/NotificationBell";

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const menuItems = [
    { path: "/", label: "Dashboard", icon: LayoutDashboard },
    { path: "/vehicles-violators", label: "Violators", icon: Users },
    { path: "/violations", label: "Violations", icon: AlertTriangle },
    { path: "/tickets", label: "Tickets", icon: Ticket },
    { path: "/attendance", label: "Attendance", icon: Camera },
    { path: "/schedule", label: "Schedule", icon: Calendar },
    { path: "/duty-map", label: "Duty Map", icon: MapPin },
    { path: "/reports", label: "Reports", icon: FileText },
  ];

  if (user?.role === "staff") {
    menuItems.push({ path: "/payments", label: "Payments", icon: Wallet });
  }

  // Add Users menu only for admin
  if (user?.role === "admin") {
    menuItems.push({ path: "/users", label: "Users", icon: UserCog });
  }

  return (
    <div className="flex h-screen bg-[#F5F6F8]">
      {/* Sidebar */}
      <aside className="w-64 bg-[#16233F] flex flex-col shadow-xl flex-shrink-0">
        {/* Brand + Notification Bell */}
        <div className="flex items-center gap-3 px-5 py-6 border-b border-white/10">
          <img
            src={temuLogo}
            alt="City of El Salvador Seal"
            className="w-10 h-10 flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-['Oswald'] font-semibold text-white leading-tight">
              TEMU
            </h1>
            <p className="text-[11px] text-[#8D98B3] font-['Inter'] font-normal truncate">
              El Salvador City
            </p>
          </div>

          {/* ✅ Notification bell - dark variant */}
          <NotificationBell variant="dark" />
        </div>

        <nav className="flex-1 mt-4 px-3 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 mb-1 text-sm font-normal transition-colors border-l-2 ${isActive
                  ? "bg-white/10 text-white border-[#F0B429]"
                  : "text-[#B7C0D8] border-transparent hover:bg-white/5 hover:text-white"
                  }`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="font-normal">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="mb-3 px-1">
            <p className="text-sm font-normal text-white truncate">
              {user?.firstname} {user?.lastname}
            </p>
            <p className="text-xs text-[#8D98B3] capitalize font-normal">
              {user?.role}
            </p>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full bg-transparent border-[#C8202F]/40 text-[#F3A6AD] hover:bg-[#C8202F]/10 hover:text-white hover:border-[#C8202F]/60 font-normal"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Log out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
};

export default Layout;