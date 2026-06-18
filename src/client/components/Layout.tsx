/** Overall layout: fixed left sidebar + content area (Outlet) + right guide drawer. */
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { GuideProvider } from './GuideProvider';
import { GuideDrawer } from './GuideDrawer';

export function Layout() {
  return (
    <GuideProvider>
      <div className="flex h-full">
        <Sidebar />
        <main className="h-full min-w-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
        <GuideDrawer />
      </div>
    </GuideProvider>
  );
}
