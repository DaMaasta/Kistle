import { Link } from 'react-router-dom';
import { LogOut, User, Package } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { logoutUser } from '../../services/auth.service';

export function Header() {
  const { user } = useAuth();

  return (
    <header className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between shadow-lg">
      <Link to="/dashboard" className="flex items-center gap-2 font-bold text-xl">
        <Package className="w-7 h-7 text-blue-400" />
        <span>Kistle</span>
      </Link>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <User className="w-4 h-4" />
          <span>{user?.displayName || user?.email}</span>
        </div>
        <button
          onClick={logoutUser}
          className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white transition-colors px-3 py-1.5 hover:bg-slate-700 rounded-lg"
        >
          <LogOut className="w-4 h-4" />
          <span>Abmelden</span>
        </button>
      </div>
    </header>
  );
}
