/**
 * Enveloppe un handler async pour transmettre les rejets à Express.
 * Sans cela, un throw non capturé laisse la requête suspendue.
 */
export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};
