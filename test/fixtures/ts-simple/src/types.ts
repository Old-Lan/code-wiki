export interface User {
  id: number;
  name: string;
  email: string;
}

export type UserStatus = 'active' | 'inactive' | 'suspended';

export enum Role {
  Admin = 'admin',
  User = 'user',
  Guest = 'guest',
}

export interface CreateUserRequest {
  name: string;
  email: string;
  role?: Role;
}
