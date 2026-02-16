import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

export type User = {
  id: number;
  username: string;
  passwordHash: string;
  roles: string[]; // e.g. ['Admin']
  name?: string;
};

@Injectable()
export class UsersService {
  private users: User[] = [];

  constructor() {
    this.users = [
      { id: 1, username: 'admin', passwordHash: bcrypt.hashSync('password123', 8), roles: ['Admin'], name: 'Administrador' },
      { id: 2, username: 'vendedor', passwordHash: bcrypt.hashSync('password123', 8), roles: ['Vendedor'], name: 'Vendedor' },
      { id: 3, username: 'comprador', passwordHash: bcrypt.hashSync('password123', 8), roles: ['Comprador'], name: 'Comprador' },
    ];
  }

  async findByUsername(username: string) {
    return this.users.find(u => u.username === username) || null;
  }

  async findById(id: number) {
    return this.users.find(u => u.id === id) || null;
  }

  async findAll() {
    return this.users.map(u => ({ id: u.id, username: u.username, roles: u.roles, name: u.name }));
  }
}