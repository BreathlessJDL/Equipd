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
import { StripeConnectOnboardingProvider } from './hooks/useStripeConnectOnboarding'
import { CookieConsentProvider } from './hooks/useCookieConsent'
import AdminCasesPage from './pages/AdminCasesPage'
import AdminIntelligencePage from './pages/AdminIntelligencePage'
import AdminIntelligenceImportPage from './pages/AdminIntelligenceImportPage'
import AdminIntelligenceBatchSyncPage from './pages/AdminIntelligenceBatchSyncPage'
import AdminIntelligenceMarketSyncPage from './pages/AdminIntelligenceMarketSyncPage'
import AdminIntelligenceEvidencePage from './pages/AdminIntelligenceEvidencePage'
import AdminIntelligenceCoreProductsPage from './pages/AdminIntelligenceCoreProductsPage'
import AdminIntelligenceProductsPage from './pages/AdminIntelligenceProductsPage'
import AdminIntelligenceProductContentPage from './pages/AdminIntelligenceProductContentPage'
import AdminEquipmentCatalogueNeedsAttentionPage from './pages/AdminEquipmentCatalogueNeedsAttentionPage'
import AdminEquipmentCatalogueAddProductPage from './pages/AdminEquipmentCatalogueAddProductPage'
import AdminEquipmentCatalogueImportsPage from './pages/AdminEquipmentCatalogueImportsPage'
import AdminEquipmentCatalogueConsolesPage from './pages/AdminEquipmentCatalogueConsolesPage'
import AdminOrdersPage from './pages/AdminOrdersPage'
import AdminPriceGuideImportPage from './pages/AdminPriceGuideImportPage'
import AdminSupportPage from './pages/AdminSupportPage'
import AddListingPage from './pages/AddListingPage'
import BrowsePage from './pages/BrowsePage'
import BrandsPage from './pages/BrandsPage'
import BrandPage from './pages/BrandPage'
import EditListingPage from './pages/EditListingPage'
import AboutPage from './pages/AboutPage'
import EquipmentModelPage from './pages/EquipmentModelPage'
import HelpCentrePage from './pages/HelpCentrePage'
import HelpArticlePage from './pages/HelpArticlePage'
import PriceGuidePage from './pages/PriceGuidePage'
import SellRedirectPage from './pages/SellRedirectPage'
import ValuationPage from './pages/ValuationPage'
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
            <StripeConnectOnboardingProvider>
            <OAuthSessionHandler />
            <Routes>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="browse" element={<BrowsePage />} />
            <Route path="brands" element={<BrandsPage />} />
            <Route path="brands/:brandSlug" element={<BrandPage />} />
            <Route
              path="buyer-protection"
              element={<Navigate to={BUYER_PROTECTION_HELP_PATH} replace />}
            />
            <Route path="how-it-works" element={<Navigate to="/help" replace />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="price-guide" element={<PriceGuidePage />} />
            <Route path="equipment/:canonical_product_key" element={<EquipmentModelPage />} />
            <Route path="valuation" element={<ValuationPage />} />
            <Route path="sell" element={<SellRedirectPage />} />
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
            <Route path="shop/:shopParam" element={<ShopRoutePage />} />
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
              path="admin/price-guide/import"
              element={
                <AdminProtectedRoute>
                  <AdminPriceGuideImportPage />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="admin/intelligence"
              element={
                <AdminProtectedRoute>
                  <Navigate to="/admin/intelligence/products" replace />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="admin/intelligence/source-rows"
              element={
                <AdminProtectedRoute>
                  <AdminIntelligencePage />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="admin/intelligence/import"
              element={
                <AdminProtectedRoute>
                  <AdminIntelligenceImportPage />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="admin/intelligence/imports"
              element={
                <AdminProtectedRoute>
                  <AdminEquipmentCatalogueImportsPage />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="admin/intelligence/needs-attention"
              element={
                <AdminProtectedRoute>
                  <AdminEquipmentCatalogueNeedsAttentionPage />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="admin/intelligence/consoles"
              element={
                <AdminProtectedRoute>
                  <AdminEquipmentCatalogueConsolesPage />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="admin/intelligence/add-product"
              element={
                <AdminProtectedRoute>
                  <AdminEquipmentCatalogueAddProductPage />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="admin/intelligence/market-sync"
              element={
                <AdminProtectedRoute>
                  <AdminIntelligenceMarketSyncPage />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="admin/intelligence/batch-sync"
              element={
                <AdminProtectedRoute>
                  <AdminIntelligenceBatchSyncPage />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="admin/intelligence/products"
              element={
                <AdminProtectedRoute>
                  <AdminIntelligenceProductsPage />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="admin/intelligence/product-content"
              element={
                <AdminProtectedRoute>
                  <AdminIntelligenceProductContentPage />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="admin/intelligence/core-products"
              element={
                <AdminProtectedRoute>
                  <AdminIntelligenceCoreProductsPage />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="admin/intelligence/original-prices-lifecycle"
              element={
                <AdminProtectedRoute>
                  <AdminIntelligenceEvidencePage />
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
            </StripeConnectOnboardingProvider>
          </AuthModalProvider>
        </CookieConsentProvider>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
