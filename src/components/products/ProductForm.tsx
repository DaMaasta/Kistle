import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Product } from '../../types';

const UNITS: Product['unit'][] = [
  'Stück', 'kg', 'g', 'L', 'ml', 'Packung', 'Flasche', 'Dose', 'Paar', 'Box',
];

const CATEGORIES = [
  'Lebensmittel', 'Getränke', 'Haushalt', 'Hygiene', 'Elektronik',
  'Werkzeug', 'Kleidung', 'Büro', 'Sport', 'Sonstiges',
];

type ProductData = Omit<
  Product,
  'id' | 'spaceId' | 'lastModifiedBy' | 'lastModifiedByEmail' | 'lastModifiedAt' | 'createdAt'
>;

interface ProductFormProps {
  initial?: Partial<Product>;
  onSubmit: (data: ProductData) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

export function ProductForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = 'Hinzufügen',
}: ProductFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);
  const [unit, setUnit] = useState<Product['unit']>(initial?.unit ?? 'Stück');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [minQuantity, setMinQuantity] = useState(
    initial?.minQuantity != null ? String(initial.minQuantity) : ''
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name ist erforderlich');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onSubmit({
        name: name.trim(),
        quantity,
        unit,
        category,
        description: description.trim(),
        minQuantity: minQuantity !== '' ? parseInt(minQuantity, 10) : null,
        barcode: null,
        imageUrl: null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input-field"
          placeholder="z.B. Nudeln, Schraubenzieher, T-Shirt"
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Menge</label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value, 10) || 0))}
            className="input-field"
            min="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Einheit</label>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as Product['unit'])}
            className="input-field"
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Kategorie</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input-field"
          >
            <option value="">Keine Kategorie</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Mindestmenge
          </label>
          <input
            type="number"
            value={minQuantity}
            onChange={(e) => setMinQuantity(e.target.value)}
            className="input-field"
            placeholder="Warnung bei..."
            min="0"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Notiz</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="input-field resize-none h-16"
          placeholder="Optionale Notiz..."
        />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Abbrechen
        </button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Wird gespeichert...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
