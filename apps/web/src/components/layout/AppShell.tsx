import { ReactNode, useState } from 'react';
import { NavLink } from 'react-router-dom';

// Icons
const HomeIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
  </svg>
);

const ServerIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
  </svg>
);

const ComputerIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
  </svg>
);

const NetworkIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
  </svg>
);

const CpuIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
  </svg>
);

const BookIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
  </svg>
);

const DownloadIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
);

const InfoIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
  </svg>
);

const CogIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg 
    className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`} 
    fill="none" 
    viewBox="0 0 24 24" 
    stroke="currentColor" 
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

const MenuIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
  </svg>
);

interface NavItemProps {
  to: string;
  icon: ReactNode;
  label: string;
  collapsed?: boolean;
  badge?: ReactNode;
}

function NavItem({ to, icon, label, collapsed, badge }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `
        flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium
        transition-colors duration-150
        ${isActive 
          ? 'bg-blue-600/20 text-blue-400 border-l-2 border-blue-500 -ml-px' 
          : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
        }
        ${collapsed ? 'justify-center' : ''}
      `}
      title={collapsed ? label : undefined}
    >
      <span className="flex-shrink-0">{icon}</span>
      {!collapsed && (
        <>
          <span className="flex-1">{label}</span>
          {badge}
        </>
      )}
    </NavLink>
  );
}

interface AppShellProps {
  children: ReactNode;
  rightDrawer?: ReactNode;
  rightDrawerOpen?: boolean;
  onRightDrawerClose?: () => void;
}

export function AppShell({ 
  children, 
  rightDrawer, 
  rightDrawerOpen = false,
  onRightDrawerClose 
}: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          flex flex-col
          bg-zinc-900 border-r border-zinc-800
          transition-all duration-300 ease-in-out
          ${sidebarCollapsed ? 'w-16' : 'w-64'}
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-zinc-800">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">Q</span>
              </div>
              <span className="font-semibold text-zinc-100">QemuWeb</span>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md transition-colors"
          >
            <ChevronIcon expanded={!sidebarCollapsed} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <NavItem 
            to="/" 
            icon={<HomeIcon />} 
            label="Dashboard" 
            collapsed={sidebarCollapsed}
          />
          
          <div className="pt-4">
            {!sidebarCollapsed && (
              <div className="px-3 mb-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Services
              </div>
            )}
            <NavItem 
              to="/services" 
              icon={<ServerIcon />} 
              label="All Services" 
              collapsed={sidebarCollapsed}
            />
            <NavItem 
              to="/vm" 
              icon={<ComputerIcon />} 
              label="Virtual Machines" 
              collapsed={sidebarCollapsed}
            />
            <NavItem 
              to="/network" 
              icon={<NetworkIcon />} 
              label="Networking" 
              collapsed={sidebarCollapsed}
            />
            <NavItem 
              to="/ollama" 
              icon={<CpuIcon />} 
              label="Ollama" 
              collapsed={sidebarCollapsed}
            />
          </div>

          <div className="pt-4">
            {!sidebarCollapsed && (
              <div className="px-3 mb-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Resources
              </div>
            )}
            <NavItem 
              to="/docs" 
              icon={<BookIcon />} 
              label="Documentation" 
              collapsed={sidebarCollapsed}
            />
            <NavItem 
              to="/downloads" 
              icon={<DownloadIcon />} 
              label="Downloads" 
              collapsed={sidebarCollapsed}
            />
          </div>
        </nav>

        {/* Bottom nav */}
        <div className="border-t border-zinc-800 py-4 px-3 space-y-1">
          <NavItem 
            to="/about" 
            icon={<InfoIcon />} 
            label="About" 
            collapsed={sidebarCollapsed}
          />
          <NavItem 
            to="/settings" 
            icon={<CogIcon />} 
            label="Settings" 
            collapsed={sidebarCollapsed}
          />
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md"
          >
            <MenuIcon />
          </button>

          <div className="flex-1 flex items-center gap-4 lg:ml-0 ml-4">
            {/* Breadcrumb or page title could go here */}
          </div>

          <div className="flex items-center gap-3">
            {/* Status indicators, user menu, etc */}
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="hidden sm:inline">Connected</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      {/* Right drawer */}
      {rightDrawer && (
        <>
          {rightDrawerOpen && (
            <div 
              className="fixed inset-0 bg-black/50 z-40"
              onClick={onRightDrawerClose}
            />
          )}
          <aside 
            className={`
              fixed inset-y-0 right-0 z-50
              w-96 max-w-full
              bg-zinc-900 border-l border-zinc-800
              transform transition-transform duration-300
              ${rightDrawerOpen ? 'translate-x-0' : 'translate-x-full'}
            `}
          >
            {rightDrawer}
          </aside>
        </>
      )}
    </div>
  );
}
