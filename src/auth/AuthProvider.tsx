import type { ReactNode } from 'react';
import { Auth0Provider } from '@auth0/auth0-react';

type Props = { children: ReactNode };

export function hasAuth0Configuration() {
  const { VITE_AUTH0_DOMAIN: domain, VITE_AUTH0_CLIENT_ID: clientId } = import.meta.env;
  return Boolean(domain && clientId && !domain.startsWith('YOUR_') && !clientId.startsWith('YOUR_'));
}

export function AuthProvider({ children }: Props) {
  const domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

  // Keep local UI development possible before an Auth0 tenant is configured.
  if (!domain || !clientId || !hasAuth0Configuration()) {
    return children;
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        ...(audience ? { audience } : {}),
      }}
      onRedirectCallback={(state) => {
        const returnTo = state?.returnTo;
        const allowedPaths = ['/dashboard', '/notifications', '/account/password', '/account/profile'];
        const target = typeof returnTo === 'string' && allowedPaths.includes(returnTo) ? returnTo : window.location.pathname;
        window.history.replaceState({}, '', target);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }}
      cacheLocation="memory"
    >
      {children}
    </Auth0Provider>
  );
}
