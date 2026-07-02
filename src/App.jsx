import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AuthModal from './components/auth/AuthModal'
import OAuthSessionHandler from './components/auth/OAuthSessionHandler'
import CookieConsentShell from './components/cookies/CookieConsentShell'
import ProtectedRoute from './components/ProtectedRoute'
import AdminProtectedRoute from './components/AdminProtectedRoute'
import AppShell from './components/layout/AppShell'
import ScrollToTop from './components/routing/ScrollToTop'
import { AuthProvider } from './hooks/useAuth'
import { AuthModalProvider } from './hooks/useAuthModal'
import { CookieConsentProvider } from './hooks/useCookieConsent'
import AdminCasesPage from './pages/AdminCasesPage'
import AdminOrdersPage from './pages/AdminOrdersPage'
import AdminSupportPage from './pages/AdminSupportPage'
import AddListingPage from './pages/AddListingPage'
import BrowsePage from './pages/BrowsePage'
import EditListingPage from './pages/EditListingPage'
import AboutPage from './pages/AboutPage'
import HelpCentrePage from './pages/HelpCentrePage'
import HelpArticlePage from './pages/HelpArticlePage'
import SupportFlowPage from './pages/SupportFlowPage'
import HomePage from './pages/HomePage'
import ListingDetailPage from './pages/ListingDetailPage'
import HubPage from './pages/HubPage'
import HubErrorBoundary from './components/hub/HubErrorBoundary'
import CollectOrderPage from './pages/CollectOrderPage'
import OrderDetailPage from './pages/OrderDetailPage'
import LocationListingsPage from './pages/LocationListingsPage'
import LoginPage from './pages/LoginPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import AuthCallbackPage from './pages/AuthCallbackPage'
import MessagesPage from './pages/MessagesPage'
import MyListingsPage from './pages/MyListingsPage'
import NotificationsPage from './pages/NotificationsPage'
import ProfilePage from './pages/ProfilePage'
import SettingsPage from './pages/SettingsPage'
import ShopRoutePage from './pages/ShopRoutePage'
import SavedListingsPage from './pages/SavedListingsPage'
import SignupPage from './pages/SignupPage'
import { LOCATION_SLUGS } from './lib/locations'
import { BUYER_PROTECTION_HELP_PATH } from './lib/trustMessaging'
import './styles/global.css'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <CookieConsentProvider>
          <AuthModalProvider>
            <OAuthSessionHandler />
            <Routes>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="browse" element={<BrowsePage />} />
            <Route
              path="buyer-protection"
              element={<Navigate to={BUYER_PROTECTION_HELP_PATH} replace />}
            />
            <Route path="how-it-works" element={<Navigate to="/help" replace />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="help" element={<HelpCentrePage />} />
            <Route path="help/:slug" element={<HelpArticlePage />} />
            <Route path="support" element={<SupportFlowPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="auth/reset-password" element={<ResetPasswordPage />} />
            <Route path="signup" element={<SignupPage />} />
            <Route path="auth/callback" element={<AuthCallbackPage />} />
            <Route
              path="profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route path="shop/:userId" element={<ShopRoutePage />} />
            <Route
              path="my-listings"
              element={
                <ProtectedRoute>
                  <MyListingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="messages"
              element={
                <ProtectedRoute>
                  <MessagesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="messages/draft/:draftListingId"
              element={
                <ProtectedRoute>
                  <MessagesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="messages/:conversationId"
              element={
                <ProtectedRoute>
                  <MessagesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="notifications"
              element={
                <ProtectedRoute>
                  <NotificationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="saved-listings"
              element={
                <ProtectedRoute>
                  <SavedListingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="hub"
              element={
                <ProtectedRoute>
                  <HubErrorBoundary>
                    <HubPage />
                  </HubErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="orders/collect/:token"
              element={<CollectOrderPage />}
            />
            <Route
              path="orders/:orderId"
              element={
                <ProtectedRoute>
                  <OrderDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/cases"
              element={
                <AdminProtectedRoute>
                  <AdminCasesPage />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="admin/support"
              element={
                <AdminProtectedRoute>
                  <AdminSupportPage />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="admin/orders"
              element={
                <AdminProtectedRoute>
                  <AdminOrdersPage />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="listings/new"
              element={
                <ProtectedRoute>
                  <AddListingPage />
                </ProtectedRoute>
              }
            />
            {LOCATION_SLUGS.map((locationSlug) => (
              <Route
                key={locationSlug}
                path={`listings/${locationSlug}`}
                element={<LocationListingsPage locationSlug={locationSlug} />}
              />
            ))}
            <Route
              path="listings/:slug/edit"
              element={
                <ProtectedRoute>
                  <EditListingPage />
                </ProtectedRoute>
              }
            />
            <Route path="listings/:slug" element={<ListingDetailPage />} />
          </Route>
            </Routes>
            <AuthModal />
            <CookieConsentShell />
          </AuthModalProvider>
        </CookieConsentProvider>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
