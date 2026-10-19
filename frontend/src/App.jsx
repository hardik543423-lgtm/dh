import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// === CRITICAL TRADING PAGES - EAGER LOAD (0ms navigation) ===
import LoginForm from "./page/Login/LoginForm.jsx";
import RegistrationForm from "./page/Registration/RegistrationForm.jsx";
import Watchlist from './page/WatchList/Watchlist.jsx';
import Layout from './page/Layout';
import Orders from './page/Orders/Order.jsx';
import SearchPage from './page/Search/SearchPage.jsx';
import LandingPage from './page/Landing/LandingPage.jsx';

// === VERSION CHECKER - Auto-update on new deployments ===
import VersionChecker from './components/VersionChecker.jsx';

// === SECONDARY PAGES - LAZY LOAD (preloaded after login) ===
const Portfolio = lazy(() => import('./page/Portfolio/Portfolio.jsx'));
const Invoice = lazy(() => import('./page/Portfolio/Invoice.jsx'));
const FundPage = lazy(() => import("./page/Funds/FundView.jsx"));
const Profile = lazy(() => import('./page/Profile/Profile.jsx'));
const ChartPage = lazy(() => import('./page/Chart/ChartPage.jsx'));
const AddFundsPage = lazy(() => import('./page/Funds/AddFundsPage.jsx'));
const WithdrawFundsPage = lazy(() => import('./page/Funds/WithdrawFundsPage.jsx'));
const FundRequestsPage = lazy(() => import('./page/Funds/FundRequestsPage.jsx'));
const McxFundPage = lazy(() => import('./page/Funds/McxFundView.jsx'));

// === ADMIN/RARE PAGES - LAZY LOAD (load on demand) ===
const BrockerDetailPage = lazy(() => import('./page/User/BrockerDetailPage.jsx'));
const CustomerDetailsPage = lazy(() => import('./page/User/CutomerDetailPage.jsx'));
const RecycleBin = lazy(() => import('./page/User/RecycleBin.jsx'));
const BrokerRecycleBin = lazy(() => import('./page/User/BrokerRecycleBin.jsx'));
const AdminRegistrations = lazy(() => import('./page/Admin/AdminRegistrations.jsx'));
const AdminAccessToken = lazy(() => import('./page/Admin/AdminAccessToken.jsx'));
const AdminTOTP = lazy(() => import('./page/Admin/AdminTOTP.jsx'));
const AdminLogs = lazy(() => import('./page/Admin/AdminLogs.jsx'));
const CustomerPermissions = lazy(() => import('./page/Profile/CustomerPermissions.jsx'));
const AdvanceJobbingPage = lazy(() => import('./page/Profile/AdvanceJobbingView.jsx'));
const AddClosedOrder = lazy(() => import('./page/Orders/AddClosedOrder.jsx'));

import { MarketDataProvider } from './contexts/MarketDataContext.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import { PWAProvider } from './contexts/PWAContext.jsx';
import { PermissionsProvider } from './contexts/PermissionsContext.jsx';

// Smart preload function - called after login to cache secondary pages
export const preloadSecondaryPages = () => {
    // Preload in background (non-blocking)
    setTimeout(() => {
        import('./page/Portfolio/Portfolio.jsx');
        import('./page/Funds/FundView.jsx');
        import('./page/Profile/Profile.jsx');
        import('./page/Chart/ChartPage.jsx');
    }, 1000); // Wait 1 second after login before preloading
};

// Minimal loading fallback (only for lazy-loaded pages)
const PageLoader = () => (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--bg-primary)] transition-colors duration-300">
        <div className="flex flex-col items-center animate-fade-in">
            {/* Logo Container */}
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-indigo-500/30 shadow-lg shadow-indigo-500/10 mb-6 animate-bounce-slight">
                <img src="/image.png" alt="Logo" className="w-full h-full object-cover" />
            </div>

            {/* Loading Spinner */}
            <div className="relative w-12 h-12">
                <div className="absolute inset-0 border-4 border-indigo-200 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
            </div>

            {/* Text */}
            <h3 className="mt-4 text-[var(--text-secondary)] font-medium text-sm tracking-widest uppercase animate-pulse">
                Loading Application...
            </h3>
        </div>
    </div>
);

function App() {
    // ── Enforce activeContext consistency for Customers ──
    useEffect(() => {
        const userString = localStorage.getItem('loggedInUser');
        if (userString) {
            try {
                const userObject = JSON.parse(userString);
                if (userObject.role === 'customer') {
                    const globalBrokerId = localStorage.getItem('associatedBrokerStringId');
                    const currentContext = localStorage.getItem('activeContext');
                    const expected = JSON.stringify({ brokerId: globalBrokerId, customerId: userObject.id });
                    if (currentContext !== expected) {
                        localStorage.setItem('activeContext', expected);
                    }
                }
            } catch (e) {
                console.error('Error syncing activeContext:', e);
            }
        }
    }, []);

    return (
        <BrowserRouter>
            <ThemeProvider>
                <PWAProvider>
                    <PermissionsProvider>
                        <MarketDataProvider>
                            {/* Version Checker - Shows update banner when new version available */}
                            <VersionChecker />

                            <Suspense fallback={<PageLoader />}>
                                <Routes>
                                    <Route path="/" element={<LandingPage />} />
                                    <Route path="/login" element={<LoginForm />} />
                                    <Route path="/register" element={<RegistrationForm />} />
                                    <Route path="/brockerDetail" element={<BrockerDetailPage />} />
                                    <Route path="/customerDetail" element={<CustomerDetailsPage />} />
                                    <Route path="/broker/:brokerId/customerDetail" element={<CustomerDetailsPage />} />
                                    <Route path="/recycle-bin" element={<RecycleBin />} />
                                    <Route path="/broker-recycle-bin" element={<BrokerRecycleBin />} />

                                    {/* Admin Routes */}
                                    <Route path="/admin/registrations" element={<AdminRegistrations />} />
                                    <Route path="/admin/access-token" element={<AdminAccessToken />} />
                                    <Route path="/admin/totp" element={<AdminTOTP />} />
                                    <Route path="/admin/logs" element={<AdminLogs />} />
                                    <Route
                                        path="/watchlist"
                                        element={
                                            <Layout>
                                                <Watchlist />
                                            </Layout>
                                        }
                                    />


                                    <Route
                                        path="/portfolio"
                                        element={
                                            <Layout>
                                                <Portfolio />
                                            </Layout>
                                        }
                                    />

                                    <Route
                                        path="/portfolio/invoice"
                                        element={
                                            <Layout>
                                                <Invoice />
                                            </Layout>
                                        }
                                    />

                                    <Route
                                        path="/funds"
                                        element={
                                            <Layout>
                                                <FundPage />
                                            </Layout>
                                        }
                                    />

                                    <Route
                                        path="/funds/mcx"
                                        element={
                                            <Layout>
                                                <McxFundPage />
                                            </Layout>
                                        }
                                    />

                                    <Route
                                        path="/funds/add"
                                        element={
                                            <Layout>
                                                <AddFundsPage />
                                            </Layout>
                                        }
                                    />

                                    <Route
                                        path="/funds/withdraw"
                                        element={
                                            <Layout>
                                                <WithdrawFundsPage />
                                            </Layout>
                                        }
                                    />

                                    <Route
                                        path="/funds/requests"
                                        element={
                                            <Layout>
                                                <FundRequestsPage />
                                            </Layout>
                                        }
                                    />

                                    <Route
                                        path="/orders"
                                        element={
                                            <Layout>
                                                <Orders />
                                            </Layout>
                                        }
                                    />

                                    <Route
                                        path="/orders/add-closed-order"
                                        element={
                                            <Layout>
                                                <AddClosedOrder />
                                            </Layout>
                                        }
                                    />

                                    <Route
                                        path="/profile"
                                        element={
                                            <Layout>
                                                <Profile />
                                            </Layout>
                                        }
                                    />

                                    <Route
                                        path="/profile/permissions"
                                        element={
                                            <Layout>
                                                <CustomerPermissions />
                                            </Layout>
                                        }
                                    />

                                    <Route
                                        path="/profile/advance-jobbing"
                                        element={
                                            <Layout>
                                                <AdvanceJobbingPage />
                                            </Layout>
                                        }
                                    />

                                    <Route
                                        path="/search"
                                        element={
                                            <Layout>
                                                <SearchPage />
                                            </Layout>
                                        }
                                    />

                                    <Route
                                        path="/chart/:instrument_token"
                                        element={<ChartPage />}
                                    />
                                </Routes>
                            </Suspense>
                        </MarketDataProvider>
                    </PermissionsProvider>
                </PWAProvider>
            </ThemeProvider>
        </BrowserRouter>
    );
}

export default App;
