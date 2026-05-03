import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Playlists from './pages/Playlists'
import PlaylistDetail from './pages/PlaylistDetail'
import Library from './pages/Library'
import Artists from './pages/Artists'
import ArtistDetail from './pages/ArtistDetail'
import Import from './pages/Import'
import Settings from './pages/Settings'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/playlists" replace />} />
        <Route path="/playlists" element={<Playlists />} />
        <Route path="/playlists/:id" element={<PlaylistDetail />} />
        <Route path="/library" element={<Library />} />
        <Route path="/artists" element={<Artists />} />
        <Route path="/artists/:id" element={<ArtistDetail />} />
        <Route path="/import" element={<Import />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  )
}
