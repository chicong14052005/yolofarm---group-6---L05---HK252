import api from "./api";
import type { User } from "../types/user";

const userService = {
  async getAll(): Promise<User[]> {
    const { data } = await api.get("/users");
    return data;
  },

  async getById(id: number): Promise<User> {
    const { data } = await api.get(`/users/${id}`);
    return data;
  },

  async create(user: Partial<User> & { password: string }): Promise<User> {
    const { data } = await api.post("/users", user);
    return data;
  },

  async update(id: number, user: Partial<User>): Promise<User> {
    const { data } = await api.put(`/users/${id}`, user);
    return data;
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/users/${id}`);
  },
};

export default userService;
