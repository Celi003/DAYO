
import React, { useState } from 'react';
import { User } from '../types';
import * as api from '../services/api';
import { useNotification } from '../components/NotificationContext';
import { useApi } from '../services/api';

interface LoginProps {
  onLogin: (user: User) => void;
  onGoToSignup: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, onGoToSignup }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{username?: string; password?: string}>({});
  const { notify } = useNotification();
  const { call } = useApi();

  const validate = () => {
    const errs: {username?: string; password?: string} = {};
    if (!username) errs.username = "Nom d'utilisateur requis.";
    if (!password) errs.password = "Mot de passe requis.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    setError(null);
    try {
      const user = await call(() => api.login(username, password));
      if (user) {
        onLogin(user);
      }
    } catch (err: any) {
      setError(err.message || "Une erreur s'est produite.");
      notify(err.message || "Une erreur s'est produite.", 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-lg">
        <div className="text-center">
            <div className="mx-auto bg-slate-800 text-white font-bold text-4xl w-20 h-20 flex items-center justify-center rounded-2xl mb-6">
                D
            </div>
          <h1 className="text-3xl font-bold text-slate-800">
            Système de Suivi des Paiements
          </h1>
          <p className="mt-2 text-slate-600">Veuillez vous connecter à votre compte</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1">
                Nom d'utilisateur
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-3 bg-white border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="admin"
              />
              {fieldErrors.username && <p className="text-red-500 text-xs mt-1">{fieldErrors.username}</p>}
            </div>
            <div>
              <label htmlFor="password"className="block text-sm font-medium text-slate-700 mb-1">
                Mot de passe
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 bg-white border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="password"
              />
              {fieldErrors.password && <p className="text-red-500 text-xs mt-1">{fieldErrors.password}</p>}
            </div>
          </div>

            {error && (
                <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-md text-sm">
                    {error}
                </div>
            )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-slate-400"
            >
              {isLoading ? 'Connexion...' : 'Se connecter'}
            </button>
          </div>
        </form>
         <p className="mt-6 text-center text-sm text-slate-600">
            Pas encore de compte ?{' '}
            <button onClick={onGoToSignup} className="font-medium text-blue-600 hover:text-blue-500">
              S'inscrire
            </button>
          </p>
      </div>
    </div>
  );
};

export default Login;
