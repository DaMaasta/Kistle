import { Link } from 'react-router-dom';
import { Users, Package, FolderOpen } from 'lucide-react';
import type { Space } from '../../types';

interface SpaceCardProps {
  space: Space;
  productCount: number;
  subSpaceCount: number;
}

export function SpaceCard({ space, productCount, subSpaceCount }: SpaceCardProps) {
  return (
    <Link
      to={`/space/${space.id}`}
      className="card hover:shadow-md transition-all hover:-translate-y-0.5 block group overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ backgroundColor: `${space.color}20` }}
          >
            {space.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
              {space.name}
            </h3>
            {space.description && (
              <p className="text-sm text-slate-500 mt-0.5 truncate">{space.description}</p>
            )}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" />
            <span>
              {productCount} {productCount === 1 ? 'Produkt' : 'Produkte'}
            </span>
          </div>
          {subSpaceCount > 0 && (
            <div className="flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5" />
              <span>
                {subSpaceCount} {subSpaceCount === 1 ? 'Unterbereich' : 'Unterbereiche'}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5 ml-auto">
            <Users className="w-3.5 h-3.5" />
            <span>{space.memberIds.length}</span>
          </div>
        </div>
      </div>
      <div className="h-1" style={{ backgroundColor: space.color }} />
    </Link>
  );
}
