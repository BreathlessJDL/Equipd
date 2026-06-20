import { BrowserRouter, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import AppShell from './components/layout/AppShell'
import { AuthProvider } from './hooks/useAuth'
import AddListingPage from './pages/AddListingPage'
import EditListingPage from './pages/EditListingPage'
import HomePage from './pages/HomePage'
import ListingDetailPage from './pages/ListingDetailPage'
import LocationListingsPage from './pages/LocationListingsPage'
import LoginPage from './pages/LoginPage'
import MessagesPage from './pages/MessagesPage'
import MyListingsPage from './pages/MyListingsPage'
import NotificationsPage from './pages/NotificationsPage'
import ProfilePage from './pages/ProfilePage'
import SavedListingsPage from './pages/SavedListingsPage'
import SignupPage from './pages/SignupPage'
import { LOCATION_SLUGS } from './lib/locations'
import './styles/global.css'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="signup" element={<SignupPage />} />
            <Route
              path="profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
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
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
