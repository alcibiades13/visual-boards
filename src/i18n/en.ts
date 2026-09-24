export const en = {
  'app.name': 'Visual Boards',
  'app.tagline': 'You bring the inspiration. We help you arrange it.',
  'dashboard.title': 'My boards',
  'dashboard.empty.title': 'No boards yet',
  'dashboard.empty.body': 'Boards collect your photos and quotes and arrange them as walls, vision boards and moodboards.',
  'dashboard.new': 'New board',
  'board.notFound': 'This board does not exist anymore.',
  'board.back': 'Boards',
  'nav.language': 'Language',
  'section.health': 'Health',
  'section.travel': 'Travel',
  'section.work': 'Work',
  'section.relationships': 'Relationships',
  'section.creativity': 'Creativity',
  'section.home': 'Home',
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
