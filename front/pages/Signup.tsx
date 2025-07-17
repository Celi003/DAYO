
import React, { useState } from 'react';
import { registerUser } from '../services/api';
import { useNotification } from '../components/NotificationContext';

interface SignupProps {
  onGoToLogin: () => void;
}

const Signup: React.FC<SignupProps> = ({ onGoToLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { notify } = useNotification();

  const validate = () => {
    if (!username) return "Nom d'utilisateur requis.";
    if (!password) return "Mot de passe requis.";
    if (password !== confirmPassword) return "Les mots de passe ne correspondent pas.";
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return "Format d'email invalide.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await registerUser(username, password, undefined, email);
      setSuccess('Votre compte a été créé avec succès.');
      notify('Inscription réussie !', 'success');
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
          <h1 className="text-3xl font-bold text-slate-800">
            Créer un compte
          </h1>
          <p className="mt-2 text-slate-600">Rejoignez la plateforme pour gérer vos factures</p>
        </div>
        
        {success && (
            <div className="p-4 bg-green-100 border border-green-300 text-green-800 rounded-md text-sm text-center">
                <p className="font-bold">Inscription Réussie !</p>
                <p className="mt-2">{success}</p>
                <button onClick={onGoToLogin} className="mt-4 w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-blue-700">
                    Aller à la page de connexion
                </button>
            </div>
        )}

        {!success && (
            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="username-signup" className="block text-sm font-medium text-slate-700 mb-1">
                    Nom d'utilisateur
                  </label>
                  <input
                    id="username-signup"
                    name="username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full p-3 bg-white border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Votre nom d'utilisateur"
                  />
                </div>
                <div>
                  <label htmlFor="password-signup"className="block text-sm font-medium text-slate-700 mb-1">
                    Mot de passe
                  </label>
                  <input
                    id="password-signup"
                    name="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-3 bg-white border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label htmlFor="confirm-password-signup"className="block text-sm font-medium text-slate-700 mb-1">
                    Confirmer le mot de passe
                  </label>
                  <input
                    id="confirm-password-signup"
                    name="confirm-password"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full p-3 bg-white border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="••••••••"
                  />
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
                  {isLoading ? 'Inscription...' : "S'inscrire"}
                </button>
              </div>
            </form>
        )}
        
         <p className="mt-6 text-center text-sm text-slate-600">
            Déjà un compte ?{' '}
            <button onClick={onGoToLogin} className="font-medium text-blue-600 hover:text-blue-500">
              Se connecter
            </button>
          </p>
      </div>
    </div>
  );
};

export default Signup;
