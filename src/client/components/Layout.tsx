/** Overall layout: fixed left sidebar + right content area (Outlet). */
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function Layout() {
  return (
    <div className="sb-app">
      <Sidebar />
      <main className="sb-main">
        <Outlet />
      </main>
    </div>
  );
}
