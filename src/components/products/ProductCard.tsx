import { useState } from 'react';
import { Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { QuantityControl } from './QuantityControl';
import { Modal } from '../shared/Modal';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { ProductForm } from './ProductForm';
import { deleteProduct, updateProduct } from '../../services/products.service';
import { useAuth } from '../../contexts/AuthContext';
import type { Product } from '../../types';

interface ProductCardProps {
  product: Product;
}

type ProductData = Omit<
  Product,
  'id' | 'spaceId' | 'lastModifiedBy' | 'lastModifiedByEmail' | 'lastModifiedAt' | 'createdAt'
>;

export function ProductCard({ product }: ProductCardProps) {
  const { user } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const isLow =
    product.minQuantity !== null && product.quantity <= product.minQuantity;

  async function handleEdit(data: ProductData) {
    if (!user) return;
    await updateProduct(product.id, user.uid, user.email ?? '', data);
    setEditOpen(false);
  }

  async function handleDelete() {
    await deleteProduct(product.id);
  }

  return (
    <>
      <div
        className={`card p-4 ${
          isLow ? 'border-amber-300 bg-amber-50' : ''
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-slate-900 truncate">{product.name}</h3>
              {isLow && (
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              )}
            </div>
            {product.category && (
              <span className="inline-block text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full mt-0.5">
                {product.category}
              </span>
            )}
            {product.description && (
              <p className="text-xs text-slate-400 mt-1 truncate">{product.description}</p>
            )}
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <QuantityControl
              productId={product.id}
              quantity={product.quantity}
              unit={product.unit}
            />
            <div className="flex gap-1">
              <button
                onClick={() => setEditOpen(true)}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                title="Bearbeiten"
              >
                <Edit2 className="w-3.5 h-3.5 text-slate-400" />
              </button>
              <button
                onClick={() => setDeleteOpen(true)}
                className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                title="Löschen"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
              </button>
            </div>
          </div>
        </div>

        {isLow && (
          <p className="text-xs text-amber-600 mt-2 font-medium">
            ⚠ Mindestmenge ({product.minQuantity} {product.unit}) unterschritten!
          </p>
        )}

        <p className="text-xs text-slate-300 mt-2">
          Geändert von {product.lastModifiedByEmail}
        </p>
      </div>

      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Produkt bearbeiten">
        <ProductForm
          initial={product}
          onSubmit={handleEdit}
          onCancel={() => setEditOpen(false)}
          submitLabel="Speichern"
        />
      </Modal>

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Produkt löschen"
        message={`Möchtest du „${product.name}" wirklich löschen?`}
        confirmLabel="Löschen"
        danger
      />
    </>
  );
}
