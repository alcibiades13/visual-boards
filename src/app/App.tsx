import { BoardPage } from '@/features/board/BoardPage';
import { Dashboard } from '@/features/dashboard/Dashboard';
import { useRoute } from './router';

export function App() {
  const route = useRoute();
  switch (route.name) {
    case 'board':
      return <BoardPage key={route.boardId} boardId={route.boardId} />;
    case 'dashboard':
      return <Dashboard />;
  }
}
