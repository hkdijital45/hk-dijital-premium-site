import {redirect} from 'next/navigation';
import {getAcademyMember,getLearningState} from '@/lib/academy/server';
import {contentIndex} from '@/lib/academy/content';
import {Dashboard} from '@/components/academy/Dashboard';
export default async function Page(){const member=await getAcademyMember();if(!member)redirect('/academy/login');const states=await getLearningState(member.userId);return <Dashboard name={member.name} index={contentIndex} states={states}/>;}
