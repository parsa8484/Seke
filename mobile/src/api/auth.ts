import { apiClient } from "./client";
import { AuthResponse, LoginEvent, User } from "./types";

// identifier می‌تونه ایمیل باشه یا نام کاربری — سرور خودش تشخیص می‌ده
export async function login(identifier: string, password: string) {
  const { data } = await apiClient.post<AuthResponse>("/api/auth/login", {
    identifier,
    password,
  });
  return data;
}

export async function register(
  email: string,
  username: string,
  password: string,
  displayName?: string
) {
  const { data } = await apiClient.post<AuthResponse>("/api/auth/register", {
    email,
    username,
    password,
    displayName,
  });
  return data;
}

export async function fetchMe() {
  const { data } = await apiClient.get<{ user: User }>("/api/auth/me");
  return data.user;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
) {
  const { data } = await apiClient.post<{ ok: boolean; message: string }>(
    "/api/auth/change-password",
    { currentPassword, newPassword }
  );
  return data;
}

export async function updateProfile(displayName: string) {
  const { data } = await apiClient.patch<{ user: User }>("/api/auth/profile", {
    displayName,
  });
  return data.user;
}

export async function fetchLoginHistory() {
  const { data } = await apiClient.get<{ events: LoginEvent[] }>(
    "/api/auth/login-history"
  );
  return data.events;
}
