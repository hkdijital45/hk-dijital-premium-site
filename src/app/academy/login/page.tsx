import {AcademyLogin} from '@/components/academy/Login';
export default async function Page({searchParams}:{searchParams:Promise<{access?:string}>}){const {access}=await searchParams;return <main className="ac-login-page">{access&&<p className="ac-card" role="status">Akademi üyeliği doğrulanamadı. Etkin akademi yetkisi olan hesabınızla giriş yapın.</p>}<AcademyLogin/></main>;}
