import { Routes, Route, Navigate } from 'react-router-dom'

import MapaPublico from './pages/MapaPublico.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import AdminCapas from './pages/AdminCapas.jsx'
import NotFound from './pages/NotFound.jsx'
import LayoutAdmin from './components/admin/LayoutAdmin.jsx'

/**
 * Componente raíz de la aplicación.
 * Define el árbol de rutas principal:
 *   /          → Vista pública con mapa para ciudadanos
 *   /login     → Formulario de autenticación
 *   /admin/*   → Panel de administración (protegido por LayoutAdmin)
 */
function App() {
  return (
    <Routes>
      {/* Vista pública — acceso libre */}
      <Route path="/" element={<MapaPublico />} />

      {/* Autenticación */}
      <Route path="/login" element={<Login />} />

      {/* Panel de administración — protegido */}
      <Route path="/admin" element={<LayoutAdmin />}>
        <Route index element={<Dashboard />} />
        <Route path="capas" element={<AdminCapas />} />
        {/* Redirección por defecto dentro del panel */}
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>

      {/* Página 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
