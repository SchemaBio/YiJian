import 'server-only';
import { cookies } from 'next/headers';
import { localeCookie, resolveLocale } from './locales';

export async function getRequestLocale() {
  const jar = await cookies();
  return resolveLocale(jar.get(localeCookie)?.value, process.env.YIJIAN_DEFAULT_LOCALE ?? process.env.NEXT_PUBLIC_DEFAULT_LOCALE);
}
