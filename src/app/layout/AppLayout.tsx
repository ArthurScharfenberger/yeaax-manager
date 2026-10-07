import { Outlet } from 'react-router';

import { PostDialogsProvider } from '@/features/posts/PostDialogsProvider';

import { Sidebar } from './Sidebar';

export function AppLayout() {
  return (
    <PostDialogsProvider>
      <div className="flex h-full">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Outlet />
        </main>
      </div>
    </PostDialogsProvider>
  );
}
