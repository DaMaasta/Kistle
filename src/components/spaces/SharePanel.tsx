import { useState } from 'react';
import type { FormEvent } from 'react';
import { UserPlus, Trash2, Crown, Edit2, Eye } from 'lucide-react';
import { addMember, removeMember } from '../../services/spaces.service';
import type { Space, UserRole } from '../../types';

interface SharePanelProps {
  space: Space;
  currentUserId: string;
}

const ROLE_LABELS: Record<
  UserRole,
  { label: string; Icon: typeof Crown; description: string }
> = {
  owner: { label: 'Eigentümer', Icon: Crown, description: 'Kann alles ändern und löschen' },
  editor: { label: 'Bearbeiter', Icon: Edit2, description: 'Kann Produkte hinzufügen und bearbeiten' },
  viewer: { label: 'Betrachter', Icon: Eye, description: 'Kann nur lesen' },
};

export function SharePanel({ space, currentUserId }: SharePanelProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<UserRole, 'owner'>>('editor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isOwner = space.ownerId === currentUserId;
  const members = Object.values(space.members);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await addMember(space.id, email.trim(), role);
      setSuccess(`${email} wurde erfolgreich hinzugefügt.`);
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Hinzufügen');
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(userId: string) {
    setError('');
    try {
      await removeMember(space.id, userId);
    } catch {
      setError('Fehler beim Entfernen des Mitglieds');
    }
  }

  return (
    <div className="space-y-6">
      {isOwner && (
        <div>
          <h3 className="font-medium text-slate-900 mb-3">Person einladen</h3>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field flex-1"
                placeholder="E-Mail Adresse"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Exclude<UserRole, 'owner'>)}
                className="input-field w-auto"
              >
                <option value="editor">Bearbeiter</option>
                <option value="viewer">Betrachter</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="btn-primary flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              {loading ? 'Wird eingeladen...' : 'Einladen'}
            </button>
          </form>
          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
          {success && <p className="text-green-600 text-sm mt-2">{success}</p>}
        </div>
      )}

      <div>
        <h3 className="font-medium text-slate-900 mb-3">
          Mitglieder ({members.length})
        </h3>
        <div className="space-y-2">
          {members.map((member) => {
            const info = ROLE_LABELS[member.role];
            const { Icon } = info;
            return (
              <div
                key={member.userId}
                className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
              >
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm flex-shrink-0">
                  {(member.displayName || member.email)[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900 truncate">
                    {member.displayName || member.email}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{member.email}</div>
                </div>
                <div className="flex items-center gap-1 text-sm text-slate-500 flex-shrink-0">
                  <Icon className="w-3.5 h-3.5" />
                  <span>{info.label}</span>
                </div>
                {isOwner && member.userId !== currentUserId && (
                  <button
                    onClick={() => handleRemove(member.userId)}
                    className="p-1.5 hover:bg-red-50 rounded-lg transition-colors ml-1"
                    title="Entfernen"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-xs text-slate-400 border-t border-slate-100 pt-4">
        <p className="font-medium mb-1">Rollenübersicht:</p>
        {Object.entries(ROLE_LABELS).map(([key, val]) => (
          <p key={key}>
            <span className="font-medium">{val.label}:</span> {val.description}
          </p>
        ))}
      </div>
    </div>
  );
}
