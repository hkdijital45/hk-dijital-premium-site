import {redirect} from 'next/navigation';
import {getAcademyMember} from '@/lib/academy/server';
import {AcademyShell} from '@/components/academy/Shell';
export const dynamic='force-dynamic';
export default async function Layout({children}:{children:React.ReactNode}){const member=await getAcademyMember();if(!member)redirect('/academy/login?access=required');return <AcademyShell name={member.name} admin={member.role==='academy_admin'}>{children}</AcademyShell>;}
