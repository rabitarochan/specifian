/** 全体レイアウト: 固定左サイドバー + 右コンテンツ領域 (Outlet) */
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
