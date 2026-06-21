'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  FileText as ImageIcon,
  ChevronLeft,
  Shield,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/curriculum', label: 'Curriculum & Summaries', icon: BookOpen },
  { href: '/admin/content', label: 'Flashcards & Scenarios', icon: FileText },
  { href: '/admin/media', label: 'Media & Uploads', icon: ImageIcon },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--cream)', color: 'var(--ink)' }}>
      {/* Sidebar */}
      <aside
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          height: '100%',
          width: '280px',
          backgroundColor: '#1A1309', // var(--ink) but darker
          color: '#FDFBF7', // var(--cream)
          borderRight: '1px solid rgba(253, 251, 247, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 50,
        }}
      >
        {/* Logo / Brand */}
        <div style={{ padding: '2rem 1.5rem', borderBottom: '1px solid rgba(253, 251, 247, 0.1)' }}>
          <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: 'inherit' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#C45A1B', // var(--amber)
                color: '#fff',
                borderRadius: '4px',
              }}
            >
              <Shield size={20} strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: '1rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                EgBE CMS
              </div>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgba(253, 251, 247, 0.4)' }}>
                Admin Portal
              </div>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.875rem 1rem',
                  textDecoration: 'none',
                  color: isActive ? '#FDFBF7' : 'rgba(253, 251, 247, 0.5)',
                  backgroundColor: isActive ? 'rgba(196, 90, 27, 0.15)' : 'transparent',
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  letterSpacing: '0.02em',
                  borderRadius: '6px',
                  transition: 'all 0.15s ease',
                  borderLeft: isActive ? '3px solid #C45A1B' : '3px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'rgba(253, 251, 247, 0.05)';
                    e.currentTarget.style.color = 'rgba(253, 251, 247, 0.9)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'rgba(253, 251, 247, 0.5)';
                  }
                }}
              >
                <Icon size={18} strokeWidth={2} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: '1.5rem', borderTop: '1px solid rgba(253, 251, 247, 0.1)' }}>
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.75rem',
              textDecoration: 'none',
              color: 'rgba(253, 251, 247, 0.4)',
              fontFamily: "'Inter', system-ui, sans-serif",
              fontWeight: 500,
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(253, 251, 247, 0.8)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(253, 251, 247, 0.4)'; }}
          >
            <ChevronLeft size={14} strokeWidth={2} />
            <span>Return to Main App</span>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, marginLeft: '280px', padding: '3rem', maxWidth: '1200px' }}>
        {children}
      </main>
    </div>
  );
}