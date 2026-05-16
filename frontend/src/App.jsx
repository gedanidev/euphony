import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Playlists from './pages/Playlists'
import PlaylistDetail from './pages/PlaylistDetail'
import Library from './pages/Library'
import Artists from './pages/Artists'
import ArtistDetail from './pages/ArtistDetail'
import Albums from './pages/Albums'
import Genres from './pages/Genres'
import Moods from './pages/Moods'
import Import from './pages/Import'
import Settings from './pages/Settings'

export default function App() {
  return (
    <Routes>
      {/* Public auth routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected app routes */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Navigate to="/playlists" replace />} />
                <Route path="/playlists" element={<Playlists />} />
                <Route path="/playlists/:id" element={<PlaylistDetail />} />
                <Route path="/library" element={<Library />} />
                <Route path="/artists" element={<Artists />} />
                <Route path="/artists/:id" element={<ArtistDetail />} />
                <Route path="/albums" element={<Albums />} />
                <Route path="/genres" element={<Genres />} />
                <Route path="/moods" element={<Moods />} />
                <Route path="/import" element={<Import />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
