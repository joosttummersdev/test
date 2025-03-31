import type { AstroGlobal } from 'astro';
import { checkAuthorization, handleUnauthorized } from '../lib/auth';

export async function protectRoute(Astro: AstroGlobal, requiredRole: 'admin' | 'agent') {
  console.log('Protecting route for role:', requiredRole);
  console.log('Current path:', Astro.url.pathname);
  
  const { authorized, reason } = await checkAuthorization(requiredRole);
  
  if (!authorized) {
    console.log('Authorization failed:', reason);
    return Astro.redirect('/login');
  }
  
  console.log('Route authorized for role:', requiredRole);
  return null;
}