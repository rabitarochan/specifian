/** Assembles routing and providers. */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { SpecsProvider } from './components/SpecsProvider';
import { UserComponentsProvider } from './components/UserComponentsProvider';
import { ValidationProvider } from './components/ValidationProvider';
import { SearchPaletteProvider } from './components/SearchPalette';
import { ToastProvider } from './components/Toast';
import { Home } from './pages/Home';
import { SpecsRoute } from './pages/SpecsRoute';
import { GraphPage } from './pages/GraphPage';

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <SpecsProvider>
          <ValidationProvider>
            <SearchPaletteProvider>
              <UserComponentsProvider>
                <Routes>
                  <Route element={<Layout />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/graph" element={<GraphPage />} />
                    <Route path="/specs/*" element={<SpecsRoute />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Routes>
              </UserComponentsProvider>
            </SearchPaletteProvider>
          </ValidationProvider>
        </SpecsProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
