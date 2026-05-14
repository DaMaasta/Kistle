import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { updateQuantity } from '../../services/products.service';
import { useAuth } from '../../contexts/AuthContext';

interface QuantityControlProps {
  productId: string;
  quantity: number;
  unit: string;
}

export function QuantityControl({ productId, quantity, unit }: QuantityControlProps) {
  const { user } = useAuth();
  const [pending, setPending] = useState(false);

  async function change(delta: number) {
    if (!user || pending) return;
    const newQty = Math.max(0, quantity + delta);
    if (newQty === quantity) return;
    setPending(true);
    try {
      await updateQuantity(productId, user.uid, user.email ?? '', newQty);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => change(-1)}
        disabled={pending || quantity <= 0}
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 transition-colors"
      >
        <Minus className="w-4 h-4 text-slate-700" />
      </button>
      <span className="text-sm font-semibold text-slate-900 min-w-[4rem] text-center">
        {quantity}{' '}
        <span className="font-normal text-slate-500">{unit}</span>
      </span>
      <button
        onClick={() => change(1)}
        disabled={pending}
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 transition-colors"
      >
        <Plus className="w-4 h-4 text-white" />
      </button>
    </div>
  );
}
