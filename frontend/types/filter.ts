export type FilterType = 'text' | 'priority' | 'type' | 'tag' | 'status';

export interface FilterChip {
  id: string; // уникальный ID для React key
  type: FilterType;
  label: string; // отображаемый текст
  value: string | number; // реальное значение
}

export interface FilterOptions {
  search?: string;
  priorities?: number[]; // индексы 0-3
  types?: number[]; // индексы 0-12
  tags?: number[]; // ID тегов
  statuses?: number[]; // индексы 0-2 (draft, active, deprecated)
}
