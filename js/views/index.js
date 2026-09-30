// View registry: order here = sidebar order = number-key shortcut.
import { renderBoard } from './board.js';
import { renderToday } from './today.js';
import { renderKanban, renderMatrix } from './flow.js';
import { renderList } from './list.js';
import { renderHabits, renderTraining, renderWins } from './rhythm.js';

export const VIEWS = [
  { id: 'board', label: 'Board', icon: 'board', render: renderBoard },
  { id: 'today', label: 'Today', icon: 'today', render: renderToday },
  { id: 'kanban', label: 'Kanban', icon: 'kanban', render: renderKanban },
  { id: 'matrix', label: 'Matrix', icon: 'matrix', render: renderMatrix },
  { id: 'list', label: 'List', icon: 'list', render: renderList },
  { id: 'habits', label: 'Habits', icon: 'habits', render: renderHabits },
  { id: 'training', label: 'Training', icon: 'training', render: renderTraining },
  { id: 'wins', label: 'Wins', icon: 'wins', render: renderWins },
];
