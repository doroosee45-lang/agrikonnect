-- TRC-02 : le rappel de lot est un événement de journal typé (plus « OTHER »).
ALTER TYPE "LotEventType" ADD VALUE IF NOT EXISTS 'RECALL';
