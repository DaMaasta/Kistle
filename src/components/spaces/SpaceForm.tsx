import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Space } from '../../types';

const SPACE_TYPES: { value: Space['type']; label: string; icon: string }[] = [
  { value: 'room', label: 'Raum', icon: '🏠' },
  { value: 'cabinet', label: 'Schrank', icon: '🗄️' },
  { value: 'shelf', label: 'Regal', icon: '📚' },
  { value: 'box', label: 'Box', icon: '📦' },
  { value: 'fridge', label: 'Kühlschrank', icon: '❄️' },
  { value: 'other', label: 'Sonstiges', icon: '📋' },
];

const COLORS = ['#3b82f6', '#ea580c', '#10b981', '#f59e0b', '#ef4444', '#6b7280'];

interface SpaceFormProps {
  initial?: Partial<Space>;
  onSubmit: (data: Partial<Space>) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

export function SpaceForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = 'Erstellen',
}: SpaceFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [type, setType] = useState<Space['type']>(initial?.type ?? 'room');
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedType = SPACE_TYPES.find((t) => t.value === type);

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
        description: description.trim(),
        type,
        icon: selectedType?.icon ?? '📦',
        color,
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
          placeholder="z.B. Keller, Kühlschrank, Regal A"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Typ</label>
        <div className="grid grid-cols-3 gap-2">
          {SPACE_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                type === t.value
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 hover:border-slate-300 text-slate-600'
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Farbe</label>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                color === c ? 'border-slate-800 scale-110' : 'border-transparent'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Beschreibung</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="input-field resize-none h-20"
          placeholder="Optionale Beschreibung..."
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
