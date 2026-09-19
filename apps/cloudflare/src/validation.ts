import { countries } from '@countryballs/cloud-contracts';
import type { CountryCode, CreateCloudRoomRequest, JoinCloudRoomRequest } from '@countryballs/cloud-contracts';
import { assertCondition, safeLabel, validInteger } from '@countryballs/shared-types';

function record(value: unknown): Record<string, unknown> {
  assertCondition(value !== null && typeof value === 'object' && !Array.isArray(value), 'INVALID_REQUEST', 'Objeto esperado.');
  return value as Record<string, unknown>;
}

function playerName(value: unknown): string {
  assertCondition(typeof value === 'string' && safeLabel(value, 20), 'INVALID_REQUEST', 'Use um nome de 1 a 20 caracteres.');
  return value;
}

function country(value: unknown): CountryCode {
  assertCondition(typeof value === 'string' && countries.includes(value as CountryCode), 'INVALID_REQUEST', 'País inválido.');
  return value as CountryCode;
}

export function validateCreateRoom(value: unknown): CreateCloudRoomRequest {
  const body = record(value);
  assertCondition(Object.keys(body).every(key => ['roomName', 'playerName', 'country', 'visibility', 'maxPlayers'].includes(key)), 'INVALID_REQUEST', 'Campos inesperados.');
  assertCondition(typeof body.roomName === 'string' && safeLabel(body.roomName, 32), 'INVALID_REQUEST', 'Use um nome de sala de 1 a 32 caracteres.');
  assertCondition(body.visibility === 'public' || body.visibility === 'private', 'INVALID_REQUEST', 'Visibilidade inválida.');
  assertCondition(typeof body.maxPlayers === 'number' && validInteger(body.maxPlayers, 2, 8), 'INVALID_REQUEST', 'A sala aceita de 2 a 8 jogadores.');
  return { roomName: body.roomName, playerName: playerName(body.playerName), country: country(body.country), visibility: body.visibility, maxPlayers: body.maxPlayers };
}

export function validateJoinRoom(value: unknown): JoinCloudRoomRequest {
  const body = record(value);
  assertCondition(Object.keys(body).every(key => ['playerName', 'country', 'code'].includes(key)), 'INVALID_REQUEST', 'Campos inesperados.');
  assertCondition(body.code === undefined || (typeof body.code === 'string' && /^CB-[A-HJ-NP-Z2-9]{6}$/.test(body.code)), 'NOT_FOUND', 'Código de sala inválido.');
  return { playerName: playerName(body.playerName), country: country(body.country), ...(body.code === undefined ? {} : { code: body.code }) };
}
