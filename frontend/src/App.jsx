import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Playlists from './pages/Playlists'
import PlaylistDetail from './pages/PlaylistDetail'
import Library from './pages/Library'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/playlists" replace />} />
        <Route path="/playlists" element={<Playlists />} />
        <Route path="/playlists/:id" element={<PlaylistDetail />} />
        <Route path="/library" element={<Library />} />
      </Routes>
    </Layout>
  )
}
