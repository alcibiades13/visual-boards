import { useEffect } from 'react';
import { BoardPage } from '@/features/board/BoardPage';
import { Dashboard } from '@/features/dashboard/Dashboard';
import { GlobalDrop } from '@/features/library/GlobalDrop';
import { LibraryPage } from '@/features/library/LibraryPage';
import { UploadProgress } from '@/features/library/UploadProgress';
import { useLibrary } from '@/store/libraryStore';
import { ConfirmHost } from '@/ui/confirm';
import { Toasts } from '@/ui/Toasts';
import { useRoute, type Route } from './router';

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case 'board':
      return <BoardPage key={route.boardId} boardId={route.boardId} />;
    case 'library':
      return <LibraryPage />;
    case 'dashboard':
      return <Dashboard />;
  }
}

export function App() {
  const route = useRoute();
  useEffect(() => {
    void useLibrary.getState().load();
  }, []);
  return (
    <>
      <Page route={route} />
      <GlobalDrop />
      <UploadProgress />
      <Toasts />
      <ConfirmHost />
    </>
  );
}
