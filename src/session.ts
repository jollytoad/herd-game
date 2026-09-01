export function sessionCookie(code: string, token: string): HeadersInit {
  return {
    "set-cookie": `token=${
      encodeURIComponent(token)
    }; Path=/rooms/${code}; HttpOnly; SameSite=Lax; Max-Age=604800`,
  };
}
