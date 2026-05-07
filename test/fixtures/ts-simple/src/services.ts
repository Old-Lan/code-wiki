import { User, UserStatus, Role } from './types.js';
import { validate } from './utils.js';
import path from 'node:path';
import express from 'express';

export function getUser(id: number): User | null {
  return null;
}

export async function createUser(name: string): Promise<User> {
  return {} as User;
}

export default function initialize(): void {
  console.log('init');
}

export const VERSION = '1.0.0';

export const handler = (req: any, res: any) => {
  res.end('ok');
};
