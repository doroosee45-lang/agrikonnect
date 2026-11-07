import * as service from './auth.service.js';
import { success, created } from '../../shared/http/response.js';

export const register = async (req, res) => {
  const result = await service.register(req.body, req);
  return created(res, result, { message: 'Compte créé. Vérifie ton téléphone pour publier ton profil.' });
};

export const login = async (req, res) => {
  const result = await service.login(req.body, req);
  return success(res, result, { message: 'Connexion réussie' });
};

export const refresh = async (req, res) => {
  const result = await service.refresh(req.body);
  return success(res, result);
};

export const logout = async (req, res) => {
  await service.logout(req.token);
  return success(res, null, { message: 'Déconnecté' });
};

export const sendPhoneOtp = async (req, res) => {
  const result = await service.sendPhoneOtp(req);
  return success(res, result, { message: 'Code envoyé par SMS' });
};

export const verifyPhone = async (req, res) => {
  const result = await service.verifyPhone(req.body, req);
  return success(res, result, { message: 'Téléphone vérifié' });
};

export const resendEmail = async (req, res) => {
  const result = await service.resendEmailVerification(req.body.email);
  return success(res, result);
};

export const verifyEmail = async (req, res) => {
  const result = await service.verifyEmail(req.body, req);
  return success(res, result, { message: 'Email vérifié' });
};

export const forgotPassword = async (req, res) => {
  const result = await service.forgotPassword(req.body.email);
  return success(res, result, {
    message: 'Si un compte existe pour cet email, un lien de réinitialisation a été envoyé.',
  });
};

export const resetPassword = async (req, res) => {
  const result = await service.resetPassword(req.body, req);
  return success(res, result, { message: 'Mot de passe réinitialisé' });
};

export const syncProfile = async (req, res) => {
  const result = await service.syncProfile(req);
  return created(res, result, { message: 'Profil initialisé' });
};
