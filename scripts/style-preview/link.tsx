import React from 'react';
import { useRouter } from './navigation';
export default function Link({ href, children, ...props }: any) { const router = useRouter(); return <a href={href} {...props} onClick={event => { if (!event.ctrlKey && !event.metaKey) { event.preventDefault(); router.push(href); } }}>{children}</a>; }
