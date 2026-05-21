import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import App from './App.jsx'
import './index.css'

// Configuración del cliente de React Query
const clienteQuery = new QueryClient({
  defaultOptions: {
    queries: {
      // Reintentar solo 1 vez ante errores de red
      retry: 1,
      // Los datos se consideran obsoletos después de 60 segundos
      staleTime: 60_000,
      // No refrescar automáticamente al volver a enfocar la ventana
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})

// Monta la aplicación en el nodo raíz del DOM
ReactDOM.createRoot(document.getElementById('raiz')).render(
  <React.StrictMode>
    <QueryClientProvider client={clienteQuery}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
