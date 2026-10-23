// web/src/components/layout/Layout.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  ScanFace,
  ChevronDown,
} from 'lucide-react';
import temuLogo from '../../assets/temu-logo.png';
import NotificationBell from '../notifications/NotificationBell';

const RAIL = 76;   // collapsed width (px)
const FULL = 256;  // expanded width (px)
const ROW = 48;    // nav row height + gap for the active lane marker

/* ------------------------------------------------------------------ */
/* Nav structure — groups with their items                             */
/* ------------------------------------------------------------------ */

const NAV_GROUPS = [
  {
    key: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
    // alwaysOpen groups render their items directly without a
    // collapsible header and are never part of the accordion.
    alwaysOpen: true,
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    key: 'enforcement',
    label: 'Enforcement',
    icon: Ticket,
    items: [
      { path: '/tickets', label: 'Tickets', icon: Ticket },
      { path: '/violations', label: 'Violations', icon: AlertTriangle },
      { path: '/vehicles-violators', label: 'Violators', icon: Users },
    ],
  },
  {
    key: 'operations',
    label: 'Operations',
    icon: MapPin,
    items: [
      { path: '/attendance', label: 'Attendance', icon: Camera },
      { path: '/schedule', label: 'Schedule', icon: Calendar },
      { path: '/duty-map', label: 'Duty Map', icon: MapPin },
    ],
  },
  {
    key: 'reporting',
    label: 'Reporting',
    icon: FileText,
    items: [
      { path: '/reports', label: 'Reports', icon: FileText },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    icon: Wallet,
    roles: ['admin', 'staff'],
    items: [
      { path: '/payments', label: 'Payments', icon: Wallet },
    ],
  },
  {
    key: 'accounts',
    label: 'Accounts',
    icon: UserCog,
    roles: ['admin', 'staff'],
    items: [
      { path: '/users', label: 'Users', icon: UserCog },
      { path: '/face-registrations', label: 'Faces', icon: ScanFace },
    ],
  },
  {
    key: 'system',
    label: 'System',
    icon: Archive,
    roles: ['admin'],
    items: [
      { path: '/archives', label: 'Archives', icon: Archive },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Group expansion persistence                                         */
/* ------------------------------------------------------------------ */

const EXPANDED_KEY = 'temu-sidebar-expanded-groups';

const loadExpandedGroups = () => {
  try {
    const raw = localStorage.getItem(EXPANDED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
};

const saveExpandedGroups = (map) => {
  try {
    localStorage.setItem(EXPANDED_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
};

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Rail pin state
  const [pinned, setPinned] = useState(() => {
    try {
      return localStorage.getItem('temu-sidebar-pinned') === '1';
    } catch {
      return false;
    }
  });
  const [hovered, setHovered] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Expanded groups map. true = open, false = collapsed.
  const [expandedGroups, setExpandedGroups] = useState(
    () => loadExpandedGroups() || {},
  );

  useEffect(() => {
    try {
      localStorage.setItem('temu-sidebar-pinned', pinned ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [pinned]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setDrawerOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    saveExpandedGroups(expandedGroups);
  }, [expandedGroups]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  /* ------------------------------------------------------------------ */
  /* Filter groups by role                                               */
  /* ------------------------------------------------------------------ */

  const visibleGroups = useMemo(() => {
    const role = user?.role;
    return NAV_GROUPS
      .filter((g) => {
        if (!g.roles) return true;
        if (!role) return false;
        return g.roles.includes(role);
      })
      .map((g) => ({
        ...g,
        items: g.items.filter((it) => {
          if (!it.roles) return true;
          if (!role) return false;
          return it.roles.includes(role);
        }),
      }))
      .filter((g) => g.items.length > 0);
  }, [user?.role]);

  /* ------------------------------------------------------------------ */
  /* Which group contains the active route?                              */
  /* ------------------------------------------------------------------ */

  const activeGroupKey = useMemo(() => {
    const match = visibleGroups.find((g) =>
      g.items.some((it) => it.path === location.pathname),
    );
    return match?.key ?? null;
  }, [visibleGroups, location.pathname]);

  const activePath = location.pathname;

  /* ------------------------------------------------------------------ */
  /* Expanded state resolution                                           */
  /* ------------------------------------------------------------------ */

  /**
   * Resolve whether a group is expanded.
   *
   * - alwaysOpen groups are always expanded.
   * - The group that contains the active route is always expanded
   *   (navigation can force-open it even if the user previously closed
   *   it — so the active page is never hidden).
   * - Otherwise, use the explicit pref, defaulting to closed.
   */
  const isGroupExpanded = useCallback(
    (group) => {
      if (group.alwaysOpen) return true;
      if (group.key === activeGroupKey) return true;
      if (expandedGroups[group.key] !== undefined) {
        return expandedGroups[group.key];
      }
      return false;
    },
    [expandedGroups, activeGroupKey],
  );

  /**
   * Accordion behavior: opening one group closes all others.
   *
   * - Toggling the currently-open group closes it.
   * - Toggling a closed group opens it AND closes every other
   *   collapsible group.
   * - alwaysOpen groups are never forced closed.
   */
  const toggleGroup = (groupKey) => {
    const targetGroup = visibleGroups.find((g) => g.key === groupKey);
    if (!targetGroup || targetGroup.alwaysOpen) return;

    setExpandedGroups(() => {
      const currentlyExpanded = isGroupExpanded(targetGroup);
      const nextOpen = !currentlyExpanded;

      const collapsed = {};
      for (const g of visibleGroups) {
        if (g.alwaysOpen) continue;
        collapsed[g.key] = false;
      }

      if (nextOpen) collapsed[groupKey] = true;

      return collapsed;
    });
  };

  /**
   * When the active route changes, sync the expanded map so exactly one
   * collapsible group is open — the one that contains the route.
   */
  useEffect(() => {
    if (!activeGroupKey) return;

    setExpandedGroups((prev) => {
      const next = { ...prev };
      let changed = false;

      if (next[activeGroupKey] !== true) {
        next[activeGroupKey] = true;
        changed = true;
      }

      for (const g of visibleGroups) {
        if (g.alwaysOpen) continue;
        if (g.key === activeGroupKey) continue;
        if (next[g.key] !== false) {
          next[g.key] = false;
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [activeGroupKey, visibleGroups]);

  /* ------------------------------------------------------------------ */
  /* Sliding marker offset                                               */
  /* ------------------------------------------------------------------ */

  const activeOffset = useMemo(() => {
    let offset = 0;
    const GROUP_HEADER_H = 40;
    const GROUP_GAP_H = 8;

    for (const g of visibleGroups) {
      if (g.alwaysOpen) {
        for (const it of g.items) {
          if (it.path === activePath) return offset;
          offset += ROW;
        }
        offset += GROUP_GAP_H;
        continue;
      }

      if (g.key === activeGroupKey) {
        offset += GROUP_HEADER_H;
        if (isGroupExpanded(g)) {
          for (const it of g.items) {
            if (it.path === activePath) return offset;
            offset += ROW;
          }
        } else {
          if (g.items.some((it) => it.path === activePath)) {
            return -1;
          }
        }
      } else {
        offset += GROUP_HEADER_H;
        if (isGroupExpanded(g)) {
          offset += g.items.length * ROW;
        }
      }
      offset += GROUP_GAP_H;
    }
    return -1;
  }, [visibleGroups, activePath, activeGroupKey, isGroupExpanded]);

  const showMarker = activeOffset >= 0;

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */

  const initials = `${user?.firstname?.[0] || ''}${user?.lastname?.[0] || ''
    }`.toUpperCase();

  const renderSidebar = (open) => {
    const fade = `transition-opacity duration-200 whitespace-nowrap ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`;

    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Brand + bell */}
        <div
          className={`flex items-center border-b border-white/10 px-4 py-5 gap-3 ${open ? 'flex-row' : 'flex-col'
            }`}
        >
          <img
            src={temuLogo}
            alt="City of El Salvador Seal"
            className="w-11 h-11 flex-shrink-0 drop-shadow"
          />
          {open && (
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-['Oswald'] font-semibold text-white leading-none tracking-wide">
                TEMU
              </h1>
              <p className="text-[11px] text-[#8D98B3] font-['Inter'] mt-1 truncate">
                El Salvador City
              </p>
            </div>
          )}
          <NotificationBell variant="dark" />
        </div>

        {/* Nav with grouped sections */}
        <nav
          className="flex-1 mt-3 overflow-y-auto overflow-x-hidden sidebar-scroll"
          aria-label="Main"
        >
          <div className="relative px-3 pb-3">
            {/* Sliding lane marker */}
            <span
              aria-hidden="true"
              className="absolute left-0 top-0 w-1 h-11 rounded-r bg-[#F0B429] transition-transform duration-300 ease-out"
              style={{
                transform: `translateY(${Math.max(activeOffset, 0)}px)`,
                opacity: showMarker ? 1 : 0,
              }}
            />

            {visibleGroups.map((group) => {
              const expanded = isGroupExpanded(group);
              const GroupIcon = group.icon;
              const hasActive = group.items.some(
                (it) => it.path === activePath,
              );

              /* ---- Always-open group: just render items ---- */
              if (group.alwaysOpen) {
                return (
                  <div key={group.key} className="mb-2">
                    {group.items.map((item) => {
                      const isActive = item.path === activePath;
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          title={open ? undefined : item.label}
                          aria-current={isActive ? 'page' : undefined}
                          className={`group flex items-center gap-4 h-11 px-3.5 rounded-lg text-sm font-normal transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F0B429] ${isActive
                            ? 'bg-white/10 text-white'
                            : 'text-[#B7C0D8] hover:bg-white/5 hover:text-white'
                            }`}
                        >
                          <Icon
                            className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-[#F0B429]' : ''
                              }`}
                          />
                          <span className={fade}>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                );
              }

              /* ---- Collapsible group ---- */
              return (
                <div key={group.key} className="mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      // When the rail is collapsed, expand the rail first
                      // so the group is actually visible.
                      if (!open) {
                        setPinned(true);
                        return;
                      }
                      toggleGroup(group.key);
                    }}
                    title={open ? undefined : group.label}
                    aria-expanded={open ? expanded : undefined}
                    aria-controls={`group-${group.key}`}
                    className={`w-full flex items-center h-10 gap-3 px-3.5 rounded-lg text-[11px] uppercase tracking-[0.14em] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F0B429] ${hasActive
                      ? 'text-[#F0B429]'
                      : 'text-[#8D98B3] hover:text-white'
                      }`}
                  >
                    <GroupIcon
                      className="w-4 h-4 flex-shrink-0"
                      aria-hidden="true"
                    />
                    <span className={`flex-1 text-left ${fade}`}>
                      {group.label}
                    </span>
                    {open ? (
                      <ChevronDown
                        className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${expanded ? '' : '-rotate-90'
                          }`}
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>

                  <div
                    id={`group-${group.key}`}
                    className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-out ${expanded
                      ? 'max-h-[400px] opacity-100'
                      : 'max-h-0 opacity-0'
                      }`}
                  >
                    <div className="pt-1">
                      {group.items.map((item) => {
                        const isActive = item.path === activePath;
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            title={open ? undefined : item.label}
                            aria-current={isActive ? 'page' : undefined}
                            className={`group flex items-center gap-4 h-11 ml-2 pl-3.5 pr-3 rounded-lg text-sm font-normal transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F0B429] ${isActive
                              ? 'bg-white/10 text-white'
                              : 'text-[#B7C0D8] hover:bg-white/5 hover:text-white'
                              }`}
                          >
                            <Icon
                              className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-[#F0B429]' : ''
                                }`}
                            />
                            <span className={fade}>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
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
              <p className="text-sm font-normal text-white truncate">
                {user?.firstname} {user?.lastname}
              </p>
              <p className="text-xs text-[#8D98B3] capitalize font-normal">
                {user?.role}
              </p>
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
      {/* Desktop rail */}
      <div
        className="hidden lg:block relative flex-shrink-0 transition-[width] duration-300"
        style={{ width: pinned ? FULL : RAIL }}
      >
        <aside
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setHovered(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setHovered(false);
          }}
          className="absolute inset-y-0 left-0 z-30 bg-[#16233F] border-r border-dashed border-[#F0B429]/30 shadow-xl transition-[width] duration-300 ease-out"
          style={{ width: railOpen ? FULL : RAIL }}
        >
          {renderSidebar(railOpen)}
          <button
            type="button"
            onClick={() => setPinned((p) => !p)}
            aria-label={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
            title={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
            className={`absolute top-6 -right-3 w-6 h-6 rounded-full bg-[#F0B429] text-[#16233F] shadow flex items-center justify-center transition-opacity duration-200 hover:scale-110 ${railOpen ? 'opacity-100' : 'opacity-0'
              }`}
          >
            {pinned ? (
              <ChevronsLeft className="w-3.5 h-3.5" />
            ) : (
              <ChevronsRight className="w-3.5 h-3.5" />
            )}
          </button>
        </aside>
      </div>

      {/* Mobile drawer */}
      <div
        className={`lg:hidden fixed inset-0 z-40 ${drawerOpen ? '' : 'pointer-events-none'
          }`}
        aria-hidden={!drawerOpen}
      >
        <div
          onClick={() => setDrawerOpen(false)}
          className={`absolute inset-0 bg-[#0C1427]/60 transition-opacity duration-300 ${drawerOpen ? 'opacity-100' : 'opacity-0'
            }`}
        />
        <aside
          className={`absolute inset-y-0 left-0 bg-[#16233F] shadow-2xl transition-transform duration-300 ease-out ${drawerOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
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

      {/* Main content */}
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
          <span className="font-['Oswald'] font-semibold tracking-wide">
            TEMU
          </span>
        </div>
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <div className="p-4 sm:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default Layout;