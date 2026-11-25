import React, { useEffect } from "react";
import { NAV_ITEMS, type ViewTab } from "../types";

interface HeaderProps {
  activeTab: ViewTab;
  onSelectTab: (tab: ViewTab) => void;
  onOpenContext: () => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  onOpenContext,
  mobileMenuOpen,
  setMobileMenuOpen,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    const handleResize = () => {
      if (window.innerWidth > 720) setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
    };
  }, [setMobileMenuOpen]);

  const handleNavClick = (tab: ViewTab) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <header className="site-header">
        <button
          type="button"
          onClick={() => handleNavClick("home")}
          className="logo-btn"
          aria-label="Sign Assist AI Home"
          id="brand-logo-btn"
        >
          <span className="logo-btn__mark" aria-hidden="true">
            <svg
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-full"
            >
              <path
                d="M11 22V11.5C11 10.67 11.67 10 12.5 10C13.33 10 14 10.67 14 11.5V16M14 15V8.5C14 7.67 14.67 7 15.5 7C16.33 7 17 7.67 17 8.5V15M17 15.5V9.5C17 8.67 17.67 8 18.5 8C19.33 8 20 8.67 20 9.5V16.5M20 16.5V12.5C20 11.67 20.67 11 21.5 11C22.33 11 23 11.67 23 12.5V19.5C23 23.09 20.09 26 16.5 26H15C11.96 26 9.5 23.54 9.5 20.5V16.5C9.5 15.67 10.17 15 11 15"
                stroke="#111111"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="7.5" cy="9.5" r="1.6" fill="#111111" />
              <circle cx="24.5" cy="8.5" r="1.4" fill="#111111" />
            </svg>
          </span>
        </button>

        <nav className="nav-pill" aria-label="Primary Navigation">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                id={`nav-tab-${item.id}`}
                onClick={() => handleNavClick(item.id)}
                className={`nav-link ${isActive ? "nav-link--active" : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={onOpenContext}
          className="header-dark-pill header-dark-pill--desktop"
          id="open-context-btn"
        >
          <span>Context</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          className={`mobile-burger ${mobileMenuOpen ? "mobile-burger--open" : ""}`}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation-sheet"
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          id="mobile-burger-btn"
        >
          <span className="mobile-burger__bar" />
          <span className="mobile-burger__bar" />
          <span className="mobile-burger__bar" />
        </button>
      </header>

      {mobileMenuOpen && (
        <div
          className="mobile-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileMenuOpen(false);
          }}
        >
          <div
            id="mobile-navigation-sheet"
            className="mobile-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation"
          >
            {NAV_ITEMS.map((item, idx) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  style={{ animationDelay: `${0.04 * idx}s` }}
                  className={`mobile-sheet__link ${
                    isActive ? "mobile-sheet__link--active" : ""
                  }`}
                >
                  {item.label}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenContext();
              }}
              className="header-dark-pill w-full justify-center mt-2"
            >
              <span>Context &amp; Voice</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
