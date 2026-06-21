'use client';

import { usePathname } from 'next/navigation';
import { SyncStatusBar } from '@/components/SyncStatusBar';
import React from 'react';

export function AppLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');

  if (isAdmin) {
    return <main style={{ flex: 1, width: '100%' }}>{children}</main>;
  }

  return (
    <>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backgroundColor: 'rgba(253,251,247,0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(26,12,2,0.08)',
        }}
      >
        <nav
          style={{
            maxWidth: '1152px',
            margin: '0 auto',
            padding: '0 1.5rem',
            height: '72px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2.5rem' }}>
            <a
              href="/"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontFamily: 'var(--font-fraunces), Georgia, serif',
                fontWeight: 600,
                fontSize: '1.375rem',
                color: '#1A1309',
                textDecoration: 'none',
                letterSpacing: '-0.02em',
              }}
            >
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: '#C45A1B',
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              EgBE
            </a>

            {/* Nav Links */}
            <div style={{ display: 'flex', gap: '1.75rem', alignItems: 'center' }}>
              {[
                { href: '/curriculum', label: 'Curriculum' },
                { href: '/study', label: 'Study' },
                { href: '/scenarios', label: 'Scenarios' },
                { href: '/graph', label: 'Graph' },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="hover:text-[#1A1309] transition-colors duration-150"
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: '#6A5C4E',
                    textDecoration: 'none',
                  }}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <SyncStatusBar />
          </div>
        </nav>
      </header>

      <main style={{ flex: 1, width: '100%' }}>{children}</main>

      <footer
        style={{
          borderTop: '1px solid rgba(26,12,2,0.08)',
          padding: '3rem 1.5rem',
          textAlign: 'center',
          fontSize: '0.875rem',
          color: '#8A7F72',
          fontWeight: 500,
          backgroundColor: '#FDFBF7',
        }}
      >
        EgBE Memory Engine · Mahidol University · Biomedical Engineering
      </footer>
    </>
  );
}
