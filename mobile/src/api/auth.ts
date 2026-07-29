import { apiClient } from "./client";
import { AuthResponse, User } from "./types";

export async function login(email: string, password: string) {
  const { data } = await apiClient.post<AuthResponse>("/api/auth/login", {
    email,
    password,
  });
  return data;
}

export async function register(
  email: string,
  password: string,
  displayName?: string
) {
  const { data } = await apiClient.post<AuthResponse>("/api/auth/register", {
    email,
    password,
    displayName,
  });
  return data;
}

export async function fetchMe() {
  const { data } = await apiClient.get<{ user: User }>("/api/auth/me");
  return data.user;
}
