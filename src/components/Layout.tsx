import { Link, useLocation } from 'react-router-dom';
import { ReactNode, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-2xl font-bold text-indigo-600">🍺 Alcohol Tracker</h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  to="/"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-all duration-200 ${
                    isActive('/')
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 hover:scale-105'
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  to="/add"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-all duration-200 hover:scale-105 ${
                    isActive('/add')
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  Add Entry
                </Link>
                <Link
                  to="/history"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-all duration-200 hover:scale-105 ${
                    isActive('/history')
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  History
                </Link>
                <Link
                  to="/sessions"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-all duration-200 hover:scale-105 ${
                    isActive('/sessions')
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  Sessions
                </Link>
                <Link
                  to="/library"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-all duration-200 hover:scale-105 ${
                    isActive('/library')
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  Drink Library
                </Link>
                <Link
                  to="/goals"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-all duration-200 hover:scale-105 ${
                    isActive('/goals')
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  Goals
                </Link>
              </div>
            </div>
            <div className="flex items-center">
              {user && (
                <>
                  <div className="hidden sm:flex items-center gap-4">
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-medium text-gray-700">{user.displayName || user.email}</span>
                      <span className="text-xs text-gray-500">{user.email}</span>
                    </div>
                    <button
                      onClick={() => signOut()}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all duration-200 button-bounce hover:scale-105 active:scale-95"
                    >
                      Sign Out
                    </button>
                  </div>
                  {/* Mobile menu button */}
                  <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="sm:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    aria-label="Toggle menu"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {mobileMenuOpen ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      )}
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-gray-200 animate-fade-in-down">
            <div className="px-2 pt-2 pb-3 space-y-1 bg-white">
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-base font-medium transition-all duration-200 ${
                  isActive('/')
                    ? 'bg-indigo-50 text-indigo-700 border-l-4 border-indigo-500'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                Dashboard
              </Link>
              <Link
                to="/add"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-base font-medium transition-all duration-200 ${
                  isActive('/add')
                    ? 'bg-indigo-50 text-indigo-700 border-l-4 border-indigo-500'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                Add Entry
              </Link>
              <Link
                to="/history"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-base font-medium transition-all duration-200 ${
                  isActive('/history')
                    ? 'bg-indigo-50 text-indigo-700 border-l-4 border-indigo-500'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                History
              </Link>
              <Link
                to="/sessions"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-base font-medium transition-all duration-200 ${
                  isActive('/sessions')
                    ? 'bg-indigo-50 text-indigo-700 border-l-4 border-indigo-500'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                Sessions
              </Link>
              <Link
                to="/library"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-base font-medium transition-all duration-200 ${
                  isActive('/library')
                    ? 'bg-indigo-50 text-indigo-700 border-l-4 border-indigo-500'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                Drink Library
              </Link>
              <Link
                to="/goals"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-base font-medium transition-all duration-200 ${
                  isActive('/goals')
                    ? 'bg-indigo-50 text-indigo-700 border-l-4 border-indigo-500'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                Goals
              </Link>
              <div className="border-t border-gray-200 pt-2 mt-2">
                <div className="px-3 py-2">
                  <div className="text-sm font-medium text-gray-700">{user?.displayName || user?.email}</div>
                  <div className="text-xs text-gray-500 truncate">{user?.email}</div>
                </div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    signOut();
                  }}
                  className="w-full mt-2 px-3 py-2 text-left text-base font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all duration-200 button-bounce"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {children}
        </div>
      </main>
    </div>
  );
}

