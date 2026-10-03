// web/src/components/layout/Layout.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
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
  Calendar,
  Archive,
  Menu,
  X,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import temuLogo from '../../assets/temu-logo.png';
import NotificationBell from '../notifications/NotificationBell';

const RAIL = 76;   // collapsed width (px)
const FULL = 256;  // expanded width (px)
const ROW = 48;    // nav row height + gap, used to slide the lane marker

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // pinned = rail stays open; otherwise it opens while hovered or focused
  const [pinned, setPinned] = useState(() => {
    try { return localStorage.getItem('temu-sidebar-pinned') === '1'; } catch { return false; }
  });
  const [hovered, setHovered] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem('temu-sidebar-pinned', pinned ? '1' : '0'); } catch { /* ignore */ }
  }, [pinned]);

  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setDrawerOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/vehicles-violators', label: 'Violators', icon: Users },
    { path: '/violations', label: 'Violations', icon: AlertTriangle },
    { path: '/tickets', label: 'Tickets', icon: Ticket },
    { path: '/attendance', label: 'Attendance', icon: Camera },
    { path: '/schedule', label: 'Schedule', icon: Calendar },
    { path: '/duty-map', label: 'Duty Map', icon: MapPin },
    { path: '/reports', label: 'Reports', icon: FileText },
  ];

  if (user?.role === 'staff') {
    menuItems.push({ path: '/payments', label: 'Payments', icon: Wallet });
  }

  if (user?.role === 'admin') {
    menuItems.push({ path: '/payments', label: 'Payments', icon: Wallet });
    menuItems.push({ path: '/users', label: 'Users', icon: UserCog });
    menuItems.push({ path: '/archives', label: 'Archives', icon: Archive });
  }

  const activeIndex = menuItems.findIndex((i) => i.path === location.pathname);
  const initials = `${user?.firstname?.[0] || ''}${user?.lastname?.[0] || ''}`.toUpperCase();

  /* The same sidebar body is used by the desktop rail and the mobile drawer */
  const renderSidebar = (open) => {
    const fade = `transition-opacity duration-200 whitespace-nowrap ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`;
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Brand + Notification Bell */}
        <div className={`flex items-center border-b border-white/10 px-4 py-5 gap-3 ${open ? 'flex-row' : 'flex-col'}`}>
          <img src={temuLogo} alt="City of El Salvador Seal" className="w-11 h-11 flex-shrink-0 drop-shadow" />
          {open && (
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-['Oswald'] font-semibold text-white leading-none tracking-wide">TEMU</h1>
              <p className="text-[11px] text-[#8D98B3] font-['Inter'] mt-1 truncate">El Salvador City</p>
            </div>
          )}
          <NotificationBell variant="dark" />
        </div>

        {/* Navigation with a lane marker that slides to the current page */}
        <nav
          className="flex-1 mt-4 overflow-y-auto overflow-x-hidden sidebar-scroll"
          aria-label="Main"
        >
          <div className="relative px-3">
            <span
              aria-hidden="true"
              className="absolute left-0 top-0 w-1 h-11 rounded-r bg-[#F0B429] transition-transform duration-300 ease-out"
              style={{ transform: `translateY(${Math.max(activeIndex, 0) * ROW}px)`, opacity: activeIndex < 0 ? 0 : 1 }}
            />
            {menuItems.map((item, i) => {
              const isActive = i === activeIndex;
              return (
                <Link
                  key={`${item.path}-${i}`}
                  to={item.path}
                  title={open ? undefined : item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={`group flex items-center gap-4 h-11 mb-1 px-3.5 rounded-lg text-sm font-normal transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F0B429] ${isActive ? 'bg-white/10 text-white' : 'text-[#B7C0D8] hover:bg-white/5 hover:text-white'
                    }`}
                >
                  <item.icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-[#F0B429]' : ''}`} />
                  <span className={fade}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User + logout */}
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-3 px-1.5 mb-3">
            <div className="w-10 h-10 flex-shrink-0 rounded-full bg-[#F0B429] text-[#16233F] flex items-center justify-center text-sm font-['Oswald'] font-semibold">
              {initials}
            </div>
            <div className={`min-w-0 ${fade}`}>
              <p className="text-sm font-normal text-white truncate">{user?.firstname} {user?.lastname}</p>
              <p className="text-xs text-[#8D98B3] capitalize font-normal">{user?.role}</p>
            </div>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            aria-label="Log out"
            className="w-full h-10 px-0 bg-transparent border-[#C8202F]/40 text-[#F3A6AD] hover:bg-[#C8202F]/10 hover:text-white hover:border-[#C8202F]/60 font-normal"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {open && <span className="ml-2">Log out</span>}
          </Button>
        </div>
      </div>
    );
  };

  const railOpen = pinned || hovered;

  return (
    <div className="fixed inset-0 flex bg-[#F5F6F8] overflow-hidden">
      {/* Desktop rail: reserves its pinned width, overlays content while hover-expanded */}
      <div
        className="hidden lg:block relative flex-shrink-0 transition-[width] duration-300"
        style={{ width: pinned ? FULL : RAIL }}
      >
        <aside
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setHovered(true)}
          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setHovered(false); }}
          className="absolute inset-y-0 left-0 z-30 bg-[#16233F] border-r border-dashed border-[#F0B429]/30 shadow-xl transition-[width] duration-300 ease-out"
          style={{ width: railOpen ? FULL : RAIL }}
        >
          {renderSidebar(railOpen)}
          <button
            type="button"
            onClick={() => setPinned((p) => !p)}
            aria-label={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
            title={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
            className={`absolute top-6 -right-3 w-6 h-6 rounded-full bg-[#F0B429] text-[#16233F] shadow flex items-center justify-center transition-opacity duration-200 hover:scale-110 ${railOpen ? 'opacity-100' : 'opacity-0'}`}
          >
            {pinned ? <ChevronsLeft className="w-3.5 h-3.5" /> : <ChevronsRight className="w-3.5 h-3.5" />}
          </button>
        </aside>
      </div>

      {/* Mobile drawer */}
      <div className={`lg:hidden fixed inset-0 z-40 ${drawerOpen ? '' : 'pointer-events-none'}`} aria-hidden={!drawerOpen}>
        <div
          onClick={() => setDrawerOpen(false)}
          className={`absolute inset-0 bg-[#0C1427]/60 transition-opacity duration-300 ${drawerOpen ? 'opacity-100' : 'opacity-0'}`}
        />
        <aside
          className={`absolute inset-y-0 left-0 bg-[#16233F] shadow-2xl transition-transform duration-300 ease-out ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
          style={{ width: FULL }}
        >
          {renderSidebar(true)}
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
            className="absolute top-5 right-3 p-1.5 rounded-md text-[#B7C0D8] hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </aside>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-[#16233F] text-white flex-shrink-0">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="p-1.5 -ml-1.5 rounded-md hover:bg-white/10"
          >
            <Menu className="w-6 h-6" />
          </button>
          <img src={temuLogo} alt="" className="w-8 h-8" />
          <span className="font-['Oswald'] font-semibold tracking-wide">TEMU</span>
        </div>
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <div className="p-4 sm:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default Layout;