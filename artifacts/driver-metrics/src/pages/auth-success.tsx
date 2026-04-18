import { useEffect } from "react";

export default function AuthSuccess() {
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (token) {
      localStorage.setItem("auth_token", token);
      localStorage.setItem("user_logged", "true");
      window.location.href = "/rides";
    } else {
      window.location.href = "/login";
    }
  }, []);

  return null;
}
