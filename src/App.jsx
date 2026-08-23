import { lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AuthModalMount from './components/auth/AuthModalMount'
import OAuthSessionHandler from './components/auth/OAuthSessionHandler'
import CookieConsentShell from './components/cookies/CookieConsentShell'
import ProtectedRoute from './components/ProtectedRoute'
import AdminProtectedRoute from './components/AdminProtectedRoute'
import AppShell from './components/layout/AppShell'
import AnalyticsPageViews from './components/routing/AnalyticsPageViews'
import ScrollToTop from './components/routing/ScrollToTop'
import { AuthProvider } from './hooks/useAuth'
import { AuthModalProvider } from './hooks/useAuthModal'
import { StripeConnectOnboardingProvider } from './hooks/useStripeConnectOnboarding'
import { CookieConsentProvider } from './hooks/useCookieConsent'
import HomePage from './pages/HomePage'
import { LOCATION_SLUGS } from './lib/locations'
import { EQUIPMENT_LANDING_DEFS_VALIDATED } from './lib/equipmentLandingDefs.js'
import { BUYER_PROTECTION_HELP_PATH } from './lib/trustMessaging'
import './styles/global.css'

// Everything except the homepage is split out of the initial bundle. AppShell
// renders these behind a Suspense boundary so the header/footer stay put.
const AdminCasesPage = lazy(() => import('./pages/AdminCasesPage'))
const AdminIntelligencePage = lazy(() => import('./pages/AdminIntelligencePage'))
const AdminIntelligenceImportPage = lazy(() => import('./pages/AdminIntelligenceImportPage'))
const AdminIntelligenceBatchSyncPage = lazy(() => import('./pages/AdminIntelligenceBatchSyncPage'))
const AdminIntelligenceMarketSyncPage = lazy(() => import('./pages/AdminIntelligenceMarketSyncPage'))
const AdminIntelligenceEvidencePage = lazy(() => import('./pages/AdminIntelligenceEvidencePage'))
const AdminIntelligenceCoreProductsPage = lazy(() => import('./pages/AdminIntelligenceCoreProductsPage'))
const AdminIntelligenceProductsPage = lazy(() => import('./pages/AdminIntelligenceProductsPage'))
const AdminIntelligenceProductContentPage = lazy(() => import('./pages/AdminIntelligenceProductContentPage'))
const AdminEquipmentCatalogueNeedsAttentionPage = lazy(() => import('./pages/AdminEquipmentCatalogueNeedsAttentionPage'))
const AdminEquipmentCatalogueAddProductPage = lazy(() => import('./pages/AdminEquipmentCatalogueAddProductPage'))
const AdminEquipmentCatalogueImportsPage = lazy(() => import('./pages/AdminEquipmentCatalogueImportsPage'))
const AdminEquipmentCatalogueConsolesPage = lazy(() => import('./pages/AdminEquipmentCatalogueConsolesPage'))
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'))
const AdminMessagesPage = lazy(() => import('./pages/AdminMessagesPage'))
const AdminConversationPage = lazy(() => import('./pages/AdminConversationPage'))
const AdminOrdersPage = lazy(() => import('./pages/AdminOrdersPage'))
const AdminPriceGuideImportPage = lazy(() => import('./pages/AdminPriceGuideImportPage'))
const AdminSupportPage = lazy(() => import('./pages/AdminSupportPage'))
const AddListingPage = lazy(() => import('./pages/AddListingPage'))
const BrowsePage = lazy(() => import('./pages/BrowsePage'))
const BrandsPage = lazy(() => import('./pages/BrandsPage'))
const BrandPage = lazy(() => import('./pages/BrandPage'))
const EditListingPage = lazy(() => import('./pages/EditListingPage'))
const AboutPage = lazy(() => import('./pages/AboutPage'))
const EquipmentModelPage = lazy(() => import('./pages/EquipmentModelPage'))
const HelpCentrePage = lazy(() => import('./pages/HelpCentrePage'))
const HelpArticlePage = lazy(() => import('./pages/HelpArticlePage'))
const PriceGuidePage = lazy(() => import('./pages/PriceGuidePage'))
const SellRedirectPage = lazy(() => import('./pages/SellRedirectPage'))
const BuyUsedGymEquipmentPage = lazy(() => import('./pages/BuyUsedGymEquipmentPage'))
const CommercialGymEquipmentPage = lazy(() => import('./pages/CommercialGymEquipmentPage'))
const CommercialCardioEquipmentPage = lazy(() => import('./pages/CommercialCardioEquipmentPage'))
const CommercialStrengthEquipmentPage = lazy(() => import('./pages/CommercialStrengthEquipmentPage'))
const HomeGymEquipmentPage = lazy(() => import('./pages/HomeGymEquipmentPage'))
const HomeCardioEquipmentPage = lazy(() => import('./pages/HomeCardioEquipmentPage'))
const HomeStrengthEquipmentPage = lazy(() => import('./pages/HomeStrengthEquipmentPage'))
const RefurbishedCommercialGymEquipmentPage = lazy(() => import('./pages/RefurbishedCommercialGymEquipmentPage'))
const RefurbishedHomeGymEquipmentPage = lazy(() => import('./pages/RefurbishedHomeGymEquipmentPage'))
const EquipmentLandingPageById = lazy(() =>
  import('./pages/EquipmentLandingPage').then((module) => ({
    default: module.EquipmentLandingPageById,
  })),
)
const SellGymEquipmentPage = lazy(() => import('./pages/SellGymEquipmentPage'))
const ValuationPage = lazy(() => import('./pages/ValuationPage'))
const SupportFlowPage = lazy(() => import('./pages/SupportFlowPage'))
const ListingDetailPage = lazy(() => import('./pages/ListingDetailPage'))
const HubPage = lazy(() => import('./pages/HubPage'))
const HubErrorBoundary = lazy(() => import('./components/hub/HubErrorBoundary'))
const CollectOrderPage = lazy(() => import('./pages/CollectOrderPage'))
const OrderDetailPage = lazy(() => import('./pages/OrderDetailPage'))
const LocationListingsPage = lazy(() => import('./pages/LocationListingsPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'))
const MessagesPage = lazy(() => import('./pages/MessagesPage'))
const MyListingsPage = lazy(() => import('./pages/MyListingsPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const ShopRoutePage = lazy(() => import('./pages/ShopRoutePage'))
const SavedListingsPage = lazy(() => import('./pages/SavedListingsPage'))
const SignupPage = lazy(() => import('./pages/SignupPage'))

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <CookieConsentProvider>
          <AnalyticsPageViews />
          <AuthModalProvider>
            <StripeConnectOnboardingProvider>
            <OAuthSessionHandler />
            <Routes>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="browse" element={<BrowsePage />} />
            <Route path="wanted" element={<Navigate to="/hub?section=wanted" replace />} />
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
            <Route path="sell-gym-equipment" element={<SellGymEquipmentPage />} />
            <Route path="buy-used-gym-equipment" element={<BuyUsedGymEquipmentPage />} />
            <Route path="commercial-gym-equipment" element={<CommercialGymEquipmentPage />} />
            <Route path="commercial-cardio-equipment" element={<CommercialCardioEquipmentPage />} />
            <Route path="commercial-strength-equipment" element={<CommercialStrengthEquipmentPage />} />
            <Route path="home-gym-equipment" element={<HomeGymEquipmentPage />} />
            <Route path="home-cardio-equipment" element={<HomeCardioEquipmentPage />} />
            <Route path="home-strength-equipment" element={<HomeStrengthEquipmentPage />} />
            <Route
              path="refurbished-commercial-gym-equipment"
              element={<RefurbishedCommercialGymEquipmentPage />}
            />
            <Route
              path="refurbished-home-gym-equipment"
              element={<RefurbishedHomeGymEquipmentPage />}
            />
            {EQUIPMENT_LANDING_DEFS_VALIDATED.map((def) => (
              <Route
                key={def.id}
                path={def.path.replace(/^\//, '')}
                element={<EquipmentLandingPageById id={def.id} />}
              />
            ))}
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
            <Route path="admin" element={<AdminProtectedRoute />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="catalogue" element={<Navigate to="/admin/intelligence/products" replace />} />
              <Route path="cases" element={<AdminCasesPage />} />
              <Route path="support" element={<AdminSupportPage />} />
              <Route path="orders" element={<AdminOrdersPage />} />
              <Route path="messages" element={<AdminMessagesPage />} />
              <Route path="messages/:conversationId" element={<AdminConversationPage />} />
              <Route path="price-guide/import" element={<AdminPriceGuideImportPage />} />
              <Route path="intelligence" element={<Navigate to="/admin/intelligence/products" replace />} />
              <Route path="intelligence/source-rows" element={<AdminIntelligencePage />} />
              <Route path="intelligence/import" element={<AdminIntelligenceImportPage />} />
              <Route path="intelligence/imports" element={<AdminEquipmentCatalogueImportsPage />} />
              <Route path="intelligence/needs-attention" element={<AdminEquipmentCatalogueNeedsAttentionPage />} />
              <Route path="intelligence/consoles" element={<AdminEquipmentCatalogueConsolesPage />} />
              <Route path="intelligence/add-product" element={<AdminEquipmentCatalogueAddProductPage />} />
              <Route path="intelligence/market-sync" element={<AdminIntelligenceMarketSyncPage />} />
              <Route path="intelligence/batch-sync" element={<AdminIntelligenceBatchSyncPage />} />
              <Route path="intelligence/products" element={<AdminIntelligenceProductsPage />} />
              <Route path="intelligence/product-content" element={<AdminIntelligenceProductContentPage />} />
              <Route path="intelligence/core-products" element={<AdminIntelligenceCoreProductsPage />} />
              <Route path="intelligence/original-prices-lifecycle" element={<AdminIntelligenceEvidencePage />} />
            </Route>
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
            <AuthModalMount />
            <CookieConsentShell />
            </StripeConnectOnboardingProvider>
          </AuthModalProvider>
        </CookieConsentProvider>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
