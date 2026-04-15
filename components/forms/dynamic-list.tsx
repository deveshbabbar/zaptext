'use client';

import { Button } from '@/components/ui/button';

interface DynamicListProps<T> {
  items: T[];
  onChange: (items: T[]) => void;
  renderItem: (item: T, index: number, update: (field: string, value: unknown) => void) => React.ReactNode;
  newItem: () => T;
  addLabel?: string;
}

export function DynamicList<T>({ items, onChange, renderItem, newItem, addLabel = 'Add More' }: DynamicListProps<T>) {
  const addItem = () => onChange([...items, newItem()]);
  const removeItem = (index: number) => onChange(items.filter((_, i) => i !== index));
  const updateItem = (index: number, field: string, value: unknown) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={index} className="relative border border-border rounded-lg p-4 bg-card">
          {items.length > 1 && (
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="absolute top-2 right-2 text-muted-foreground hover:text-destructive text-lg leading-none"
            >
              x
            </button>
          )}
          {renderItem(item, index, (field, value) => updateItem(index, field, value))}
        </div>
      ))}
      <Button type="button" variant="outline" onClick={addItem} className="w-full border-dashed">
        + {addLabel}
      </Button>
    </div>
  );
}
