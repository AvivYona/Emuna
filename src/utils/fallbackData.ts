import { Author, Background, Quote } from '../api/types';

export const fallbackAuthors: Author[] = [
  { _id: 'author-1', name: 'רבי נחמן מברסלב' },
  { _id: 'author-2', name: 'הרב קוק' },
  { _id: 'author-3', name: 'חפץ חיים' },
  { _id: 'author-4', name: 'בעל שם טוב' },
];

export const fallbackQuotes: Quote[] = [
  {
    _id: 'quote-1',
    quote: 'גם בתוך הסערה אפשר למצוא נקודת אור קטנה ששווה להחזיק בה.',
    author: fallbackAuthors[0],
  },
  {
    _id: 'quote-2',
    quote: 'כל יצירה מתחילה באמונה קטנה, והופכת לדרך שלמה.',
    author: fallbackAuthors[1],
  },
  {
    _id: 'quote-3',
    quote: 'החסד מתחיל ברגע שאנו מחייכים אל האחר.',
    author: fallbackAuthors[2],
  },
];

export const fallbackBackgrounds: Background[] = [
  {
    _id: 'bg-1',
    title: 'ים של תקווה',
    imageUrl:
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=40',
    dominantColor: '#1B4965',
  },
  {
    _id: 'bg-2',
    title: 'אור ראשון',
    imageUrl:
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=400&q=40',
    dominantColor: '#F6BD60',
  },
  {
    _id: 'bg-3',
    title: 'שקט במדבר',
    imageUrl:
      'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=400&q=40',
    dominantColor: '#BB3E03',
  },
  {
    _id: 'bg-4',
    title: 'נשימה ביער',
    imageUrl:
      'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=400&q=40',
    dominantColor: '#0B6E4F',
  },
  {
    _id: 'bg-5',
    title: 'עננות רגועה',
    imageUrl:
      'https://images.unsplash.com/photo-1435224654926-ecc9f7fa028c?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1435224654926-ecc9f7fa028c?auto=format&fit=crop&w=400&q=40',
    dominantColor: '#3E517A',
  },
];
