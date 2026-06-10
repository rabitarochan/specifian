/** ルーティングとプロバイダーの組み立て */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { SpecsProvider } from './components/SpecsProvider';
import { ToastProvider } from './components/Toast';
import { Home } from './pages/Home';
import { SpecsRoute } from './pages/SpecsRoute';
import { GraphPage } from './pages/GraphPage';

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <SpecsProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/graph" element={<GraphPage />} />
              <Route path="/specs/*" element={<SpecsRoute />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </SpecsProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
